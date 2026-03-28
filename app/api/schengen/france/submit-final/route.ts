import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"

import { authOptions } from "@/lib/auth"
import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
  saveApplicantProfileFileFromAbsolutePath,
} from "@/lib/applicant-profiles"
import { advanceFranceCase, setFranceCaseException } from "@/lib/france-cases"
import { createTask, updateTask } from "@/lib/french-visa-tasks"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function flushProgress(taskId: string, chunk: string, progressBuffer: { current: string }, prefix: string) {
  progressBuffer.current += chunk
  const lines = progressBuffer.current.split(/\r?\n/)
  progressBuffer.current = lines.pop() ?? ""
  for (const line of lines) {
    const match = line.match(/^PROGRESS:(\d+):(.+)$/)
    if (!match) continue
    const progress = Number.parseInt(match[1], 10)
    const message = match[2].trim()
    void updateTask(taskId, { status: "running", progress, message: prefix + message })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 })
    }

    const userId = session.user.id
    const formData = await request.formData()
    const files: File[] = []
    for (const file of formData.getAll("file")) {
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        files.push(file as File)
      }
    }
    if (files.length === 0) {
      const single = formData.get("file")
      if (single && typeof single === "object" && "arrayBuffer" in single) {
        files.push(single as File)
      }
    }

    const applicantProfileId = (formData.get("applicantProfileId") as string | null)?.trim() || ""
    const applicantProfile = applicantProfileId ? await getApplicantProfile(userId, applicantProfileId) : null
    if (files.length === 0 && applicantProfileId) {
      const stored = await getApplicantProfileFileByCandidates(userId, applicantProfileId, ["schengenExcel", "franceExcel"])
      if (stored) {
        const content = await fs.readFile(stored.absolutePath)
        files.push(
          new File([content], stored.meta.originalName, {
            type: stored.meta.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        )
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "请至少上传一个包含最终表字段的 Excel 文件" },
        { status: 400 },
      )
    }

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "submit_final_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json({ success: false, error: "法签提交最终表服务未找到" }, { status: 500 })
    }

    type SubmitResult = {
      success: boolean
      error?: string
      message?: string
      pdf_file?: string
    }

    const taskIds: string[] = []
    for (const file of files) {
      const fileName = file.name || "submit.xlsx"
      const task = await createTask(userId, "submit-final", `提交最终表 · ${fileName}`, {
        applicantProfileId: applicantProfileId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      })
      taskIds.push(task.task_id)

      const outputId = `fv-submit-${task.task_id}`
      const outputDir = path.join(process.cwd(), "temp", "french-visa-submit-final", outputId)
      await fs.mkdir(outputDir, { recursive: true })

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
      const inputPath = path.join(outputDir, safeName)
      await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))

      await updateTask(task.task_id, {
        status: "running",
        progress: 5,
        message: `[${fileName}] 准备中...`,
      })

      if (applicantProfileId) {
        await advanceFranceCase({
          userId,
          applicantProfileId,
          mainStatus: "DOCS_READY",
          subStatus: "DOCS_GENERATED",
          clearException: true,
          reason: "Started France final submission generation",
        }).catch((error) => {
          console.error("Failed to advance France case before submit-final", error)
        })
      }

      let stdout = ""
      const progressBuffer = { current: "" }
      const prefix = `[${fileName}] `

      const proc = spawn("python", ["-u", scriptPath, inputPath, "--output-dir", outputDir], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      })

      const timeoutId = setTimeout(() => {
        try {
          proc.kill()
        } catch {
          // ignore
        }
        void updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "执行超时（5 分钟）",
          error: "Timeout",
        })
      }, 300000)

      proc.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString()
      })
      proc.stderr?.on("data", (chunk: Buffer) => {
        flushProgress(task.task_id, chunk.toString(), progressBuffer, prefix)
      })

      proc.on("close", async (code) => {
        clearTimeout(timeoutId)
        try {
          const data = JSON.parse(stdout.trim() || "{}") as SubmitResult
          if (data.success && data.pdf_file) {
            const downloadPdf = `/api/schengen/france/submit-final/download/${outputId}/${encodeURIComponent(data.pdf_file)}`
            let archivedProfilePdfUrl: string | undefined

            if (applicantProfileId) {
              try {
                await saveApplicantProfileFileFromAbsolutePath({
                  userId,
                  id: applicantProfileId,
                  slot: "franceFinalSubmissionPdf",
                  sourcePath: path.join(outputDir, data.pdf_file),
                  originalName: data.pdf_file,
                  mimeType: "application/pdf",
                })
                archivedProfilePdfUrl = `/api/applicants/${applicantProfileId}/files/franceFinalSubmissionPdf`
              } catch (archiveError) {
                console.error("Failed to archive France final submission PDF to applicant profile", archiveError)
              }
            }

            await updateTask(task.task_id, {
              status: "completed",
              progress: 100,
              message: prefix + (data.message || "最终表提交完成"),
              result: {
                success: true,
                message: data.message,
                download_pdf: downloadPdf,
                archived_profile_pdf_url: archivedProfilePdfUrl,
                pdf_file: data.pdf_file,
              },
            })
            return
          }

          if (data.success) {
            await updateTask(task.task_id, {
              status: "completed",
              progress: 100,
              message: prefix + (data.message || "最终表提交完成"),
              result: { success: true, message: data.message },
            })
            return
          }

          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "提交失败",
            error: data.error || `退出码 ${code}`,
            result: { success: false, error: data.error },
          })

          if (applicantProfileId) {
            await setFranceCaseException({
              userId,
              applicantProfileId,
              mainStatus: "DOCS_READY",
              subStatus: "DOCS_GENERATED",
              exceptionCode: "DOCS_REGENERATE_REQUIRED",
              reason: "France final submission generation failed",
            }).catch((error) => {
              console.error("Failed to set France case exception after submit-final failure", error)
            })
          }
        } catch {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "解析结果失败",
            error: stdout.trim() || `退出码 ${code}`,
          })

          if (applicantProfileId) {
            await setFranceCaseException({
              userId,
              applicantProfileId,
              mainStatus: "DOCS_READY",
              subStatus: "DOCS_GENERATED",
              exceptionCode: "DOCS_REGENERATE_REQUIRED",
              reason: "France final submission result parsing failed",
            }).catch((error) => {
              console.error("Failed to set France case exception after submit-final parse failure", error)
            })
          }
        }
      })

      proc.on("error", async (error) => {
        clearTimeout(timeoutId)
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "进程启动失败",
          error: String(error),
        })
      })
    }

    return NextResponse.json({
      success: true,
      task_ids: taskIds,
      task_id: taskIds.length === 1 ? taskIds[0] : undefined,
      message: `已创建 ${taskIds.length} 个提交最终表任务，请在下方任务列表中查看进度`,
    })
  } catch (error) {
    console.error("法签提交最终表错误:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

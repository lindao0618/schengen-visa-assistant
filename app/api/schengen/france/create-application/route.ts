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
import { getPythonRuntimeCommand } from "@/lib/python-runtime"

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
    const caseId = (formData.get("caseId") as string | null)?.trim() || ""
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
        { success: false, error: "请至少上传一个包含法国申请信息的 Excel 文件" },
        { status: 400 },
      )
    }

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "create_application_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json({ success: false, error: "法签生成新申请服务未找到" }, { status: 500 })
    }

    type CreateResult = {
      success: boolean
      error?: string
      application_ref?: string
      json_file?: string
      message?: string
    }

    const taskIds: string[] = []
    for (const file of files) {
      const fileName = file.name || "application.xlsx"
      const task = await createTask(userId, "create-application", `生成新申请 · ${fileName}`, {
        applicantProfileId: applicantProfileId || undefined,
        caseId: caseId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      })
      taskIds.push(task.task_id)

      const outputId = `fv-create-${task.task_id}`
      const outputDir = path.join(process.cwd(), "temp", "french-visa-create-application", outputId)
      await fs.mkdir(outputDir, { recursive: true })

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
      const inputPath = path.join(outputDir, safeName)
      await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))

      const resultFilePath = path.join(outputDir, "create_result.json")
      await updateTask(task.task_id, {
        status: "running",
        progress: 5,
        message: `[${fileName}] 准备中...`,
      })

      if (applicantProfileId) {
        await advanceFranceCase({
          userId,
          applicantProfileId,
          mainStatus: "FORM_IN_PROGRESS",
          subStatus: "FORM_RECEIVED",
          clearException: true,
          reason: "Started France application generation",
        }).catch((error) => {
          console.error("Failed to advance France case before create-application", error)
        })
      }

      const progressBuffer = { current: "" }
      const prefix = `[${fileName}] `

      const proc = spawn(getPythonRuntimeCommand(), ["-u", scriptPath, inputPath, "--output-dir", outputDir], {
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

      proc.stderr?.on("data", (chunk: Buffer) => {
        flushProgress(task.task_id, chunk.toString(), progressBuffer, prefix)
      })

      proc.on("close", async (code) => {
        clearTimeout(timeoutId)

        try {
          const raw = await fs.readFile(resultFilePath, "utf-8")
          const data = JSON.parse(raw) as CreateResult

          if (data.success && data.json_file) {
            const downloadJson = `/api/schengen/france/create-application/download/${outputId}/${encodeURIComponent(data.json_file)}`
            const archivedJsonPath = path.join(outputDir, data.json_file)
            let archivedProfileJsonUrl: string | undefined

            if (applicantProfileId) {
              try {
                await saveApplicantProfileFileFromAbsolutePath({
                  userId,
                  id: applicantProfileId,
                  slot: "franceApplicationJson",
                  sourcePath: archivedJsonPath,
                  originalName: data.json_file,
                  mimeType: "application/json",
                })
                archivedProfileJsonUrl = `/api/applicants/${applicantProfileId}/files/franceApplicationJson`
              } catch (archiveError) {
                console.error("Failed to archive France application JSON to applicant profile", archiveError)
              }
            }

            await updateTask(task.task_id, {
              status: "completed",
              progress: 100,
              message: prefix + (data.message || "生成完成"),
              result: {
                success: true,
                message: data.message,
                download_json: downloadJson,
                archived_profile_json_url: archivedProfileJsonUrl,
                application_ref: data.application_ref,
              },
            })

            if (applicantProfileId) {
              await advanceFranceCase({
                userId,
                applicantProfileId,
                mainStatus: "REVIEWING",
                subStatus: "HUMAN_REVIEWING",
                clearException: true,
                reason: "France application JSON generated",
              }).catch((error) => {
                console.error("Failed to advance France case after create-application success", error)
              })
            }
            return
          }

          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "生成失败",
            error: data.error || `退出码 ${code}`,
            result: { success: false, error: data.error },
          })

          if (applicantProfileId) {
            await setFranceCaseException({
              userId,
              applicantProfileId,
              mainStatus: "FORM_IN_PROGRESS",
              subStatus: "FORM_RECEIVED",
              exceptionCode: "DOCS_REGENERATE_REQUIRED",
              reason: "France application generation failed",
            }).catch((error) => {
              console.error("Failed to set France case exception after create-application failure", error)
            })
          }
        } catch {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "读取结果失败",
            error: `退出码 ${code}`,
          })

          if (applicantProfileId) {
            await setFranceCaseException({
              userId,
              applicantProfileId,
              mainStatus: "FORM_IN_PROGRESS",
              subStatus: "FORM_RECEIVED",
              exceptionCode: "DOCS_REGENERATE_REQUIRED",
              reason: "France application result parsing failed",
            }).catch((error) => {
              console.error("Failed to set France case exception after create-application parse failure", error)
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
      message: `已创建 ${taskIds.length} 个生成新申请任务，请在下方任务列表查看进度`,
    })
  } catch (error) {
    console.error("法签生成新申请错误:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

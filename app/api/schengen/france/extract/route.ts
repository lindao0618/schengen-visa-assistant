import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
  saveApplicantProfileFileFromAbsolutePath,
} from "@/lib/applicant-profiles"
import { authOptions } from "@/lib/auth"
import { advanceFranceCase, setFranceCaseException } from "@/lib/france-cases"
import { createTask, updateTask } from "@/lib/french-visa-tasks"

export const dynamic = "force-dynamic"
export const maxDuration = 300

interface ExtractResult {
  success: boolean
  message?: string
  error?: string
  output_file?: string
  json_file?: string
}

function flushProgress(
  taskId: string,
  chunk: string,
  progressBuffer: { current: string },
  prefix: string,
) {
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
      const stored = await getApplicantProfileFileByCandidates(userId, applicantProfileId, [
        "schengenExcel",
        "franceExcel",
      ])
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
        { success: false, error: "请至少上传一个包含 FV 注册信息的 Excel 文件" },
        { status: 400 },
      )
    }

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "extract_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json(
        { success: false, error: "法签提取服务未找到，请确认 services/french-visa/extract_cli.py 已部署" },
        { status: 500 },
      )
    }

    const task = await createTask(
      userId,
      "extract",
      `提取注册信息 · ${files.length} 个文件`,
      {
        applicantProfileId: applicantProfileId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      },
    )

    const outputId = `fv-extract-${task.task_id}`
    const outputDir = path.join(process.cwd(), "temp", "french-visa-extract", outputId)
    await fs.mkdir(outputDir, { recursive: true })

    const inputPaths: string[] = []
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const base =
        (file.name || "data").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.(xlsx|xls)$/i, "") || "data"
      const ext = /\.xls$/i.test(file.name || "") ? "xls" : "xlsx"
      const safeName = `${base}_${index + 1}.${ext}`
      const inputPath = path.join(outputDir, safeName)
      await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))
      inputPaths.push(inputPath)
    }

    const prefix = files.length > 1 ? `[${files.length} 个文件] ` : ""
    await updateTask(task.task_id, {
      status: "running",
      progress: 5,
      message: prefix + "正在提取注册信息...",
    })

    if (applicantProfileId) {
      await advanceFranceCase({
        userId,
        applicantProfileId,
        mainStatus: "TLS_PROCESSING",
        subStatus: "TLS_REGISTERING",
        clearException: true,
        reason: "Started France extract flow",
      }).catch((error) => {
        console.error("Failed to advance France case before extract", error)
      })
    }

    let stdout = ""
    const progressBuffer = { current: "" }

    const proc = spawn("python", ["-u", scriptPath, ...inputPaths, "--output-dir", outputDir], {
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
        const data = JSON.parse(stdout.trim() || "{}") as ExtractResult
        if (data.success && data.output_file) {
          const downloadExcel = `/api/schengen/france/extract/download/${outputId}/${encodeURIComponent(data.output_file)}`
          const downloadJson = data.json_file
            ? `/api/schengen/france/extract/download/${outputId}/${encodeURIComponent(data.json_file)}`
            : undefined
          let archivedProfileAccountsUrl: string | undefined

          if (data.json_file && applicantProfileId) {
            try {
              await saveApplicantProfileFileFromAbsolutePath({
                userId,
                id: applicantProfileId,
                slot: "franceTlsAccountsJson",
                sourcePath: path.join(outputDir, data.json_file),
                originalName: data.json_file,
                mimeType: "application/json",
              })
              archivedProfileAccountsUrl = `/api/applicants/${applicantProfileId}/files/franceTlsAccountsJson`
            } catch (archiveError) {
              console.error("Failed to archive extracted TLS accounts JSON to applicant profile", archiveError)
            }
          }

          await updateTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: prefix + (data.message || "提取完成"),
            result: {
              success: true,
              message: data.message,
              download_excel: downloadExcel,
              download_json: downloadJson,
              archived_profile_accounts_url: archivedProfileAccountsUrl,
            },
          })

          if (applicantProfileId) {
            await advanceFranceCase({
              userId,
              applicantProfileId,
              mainStatus: "TLS_PROCESSING",
              subStatus: "TLS_REGISTERING",
              clearException: true,
              reason: "France registration info extracted",
            }).catch((error) => {
              console.error("Failed to advance France case after extract success", error)
            })
          }
          return
        }

        const errorMessage = data.error || `退出码 ${code}`
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: prefix + "提取失败",
          error: errorMessage,
          result: {
            success: false,
            error: errorMessage,
          },
        })

        if (applicantProfileId) {
          await setFranceCaseException({
            userId,
            applicantProfileId,
            mainStatus: "TLS_PROCESSING",
            subStatus: "TLS_REGISTERING",
            exceptionCode: "TLS_REGISTER_FAILED",
            reason: errorMessage,
          }).catch((error) => {
            console.error("Failed to set France case exception after extract failure", error)
          })
        }
      } catch {
        const errorMessage = stdout.trim() || `退出码 ${code}`
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: prefix + "解析结果失败",
          error: errorMessage,
        })

        if (applicantProfileId) {
          await setFranceCaseException({
            userId,
            applicantProfileId,
            mainStatus: "TLS_PROCESSING",
            subStatus: "TLS_REGISTERING",
            exceptionCode: "TLS_REGISTER_FAILED",
            reason: errorMessage,
          }).catch((error) => {
            console.error("Failed to set France case exception after extract parse failure", error)
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

      if (applicantProfileId) {
        await setFranceCaseException({
          userId,
          applicantProfileId,
          mainStatus: "TLS_PROCESSING",
          subStatus: "TLS_REGISTERING",
          exceptionCode: "TLS_REGISTER_FAILED",
          reason: String(error),
        }).catch((caseError) => {
          console.error("Failed to set France case exception after extract process error", caseError)
        })
      }
    })

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "已创建提取任务，请在下方任务列表中查看进度",
    })
  } catch (error) {
    console.error("法签提取错误:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

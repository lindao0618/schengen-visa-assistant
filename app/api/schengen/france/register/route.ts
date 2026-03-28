import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { getApplicantProfile, getApplicantProfileFileByCandidates } from "@/lib/applicant-profiles"
import { authOptions } from "@/lib/auth"
import { advanceFranceCase, setFranceCaseException } from "@/lib/france-cases"
import { createTask, updateTask } from "@/lib/french-visa-tasks"

export const dynamic = "force-dynamic"
export const maxDuration = 300

interface RegisterResult {
  success: boolean
  error?: string
  total?: number
  success_count?: number
  fail_count?: number
  results?: unknown[]
  message?: string
  log_file?: string
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
    void updateTask(taskId, {
      status: "running",
      progress,
      message: `${prefix}${message}`,
    })
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
        { success: false, error: "请至少上传一个包含 France-visas 注册信息的 Excel 文件" },
        { status: 400 },
      )
    }

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "register_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json(
        { success: false, error: "法签注册服务未找到，请确认 services/french-visa/register_cli.py 已部署" },
        { status: 500 },
      )
    }

    const taskIds: string[] = []
    for (const file of files) {
      const fileName = file.name || "register.xlsx"
      const task = await createTask(userId, "register", `账号注册 · ${fileName}`, {
        applicantProfileId: applicantProfileId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      })
      taskIds.push(task.task_id)

      const outputId = `fv-register-${task.task_id}`
      const outputDir = path.join(process.cwd(), "temp", "french-visa-register", outputId)
      await fs.mkdir(outputDir, { recursive: true })

      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
      const inputPath = path.join(outputDir, safeName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(inputPath, buffer)

      await updateTask(task.task_id, {
        status: "running",
        progress: 1,
        message: `[${fileName}] 准备中...`,
      })

      if (applicantProfileId) {
        await advanceFranceCase({
          userId,
          applicantProfileId,
          mainStatus: "TLS_PROCESSING",
          subStatus: "TLS_REGISTERING",
          clearException: true,
          reason: "Started legacy France register flow",
        }).catch((error) => {
          console.error("Failed to advance France case before register", error)
        })
      }

      const prefix = `[${fileName}] `
      let stdout = ""
      const progressBuffer = { current: "" }

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
          message: `${prefix}执行超时（5 分钟）`,
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
          const data = JSON.parse(stdout.trim() || "{}") as RegisterResult
          const logFile = data.log_file
          const downloadLog = logFile
            ? `/api/schengen/france/register/download/${outputId}/${encodeURIComponent(logFile)}`
            : undefined

          if (data.success) {
            await updateTask(task.task_id, {
              status: "completed",
              progress: 100,
              message: prefix + (data.message || "注册完成"),
              result: {
                success: true,
                message: data.message,
                total: data.total,
                success_count: data.success_count,
                fail_count: data.fail_count,
                results: data.results,
                download_log: downloadLog,
              },
            })

            if (applicantProfileId) {
              await advanceFranceCase({
                userId,
                applicantProfileId,
                mainStatus: "TLS_PROCESSING",
                subStatus: "SLOT_HUNTING",
                clearException: true,
                reason: "France register completed",
              }).catch((error) => {
                console.error("Failed to advance France case after register success", error)
              })
            }
            return
          }

          const errorMessage = data.error || `退出码 ${code}`
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "注册失败",
            error: errorMessage,
            result: {
              success: false,
              error: errorMessage,
              download_log: downloadLog,
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
              console.error("Failed to set France case exception after register failure", error)
            })
          }
        } catch {
          const errorMessage = stdout.trim() || `进程退出码 ${code}`
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
              console.error("Failed to set France case exception after register parse failure", error)
            })
          }
        }
      })

      proc.on("error", async (error) => {
        clearTimeout(timeoutId)
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: `${prefix}进程启动失败`,
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
            console.error("Failed to set France case exception after register process error", caseError)
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      task_ids: taskIds,
      task_id: taskIds.length === 1 ? taskIds[0] : undefined,
      message: `已创建 ${taskIds.length} 个账号注册任务，请在下方任务列表中查看进度`,
    })
  } catch (error) {
    console.error("法签注册错误:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

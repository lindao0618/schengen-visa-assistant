import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"

import { authOptions } from "@/lib/auth"
import { getApplicantProfile, getApplicantProfileFileByCandidates } from "@/lib/applicant-profiles"
import { advanceFranceCase, setFranceCaseException } from "@/lib/france-cases"
import { createTask, updateTask } from "@/lib/french-visa-tasks"
import { getPythonRuntimeCommand } from "@/lib/python-runtime"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type JsonObject = Record<string, unknown>

type RegisterRunData = JsonObject & {
  success?: boolean
  error?: string
  total?: number
  success_count?: number
  fail_count?: number
  results?: Array<Record<string, unknown>>
  message?: string
  log_file?: string
}

function buildDownloadUrl(outputId: string, filename?: string) {
  if (!filename) return undefined
  return `/api/schengen/france/extract-register/download/${outputId}/${encodeURIComponent(filename)}`
}

function flushRegisterProgress(
  taskId: string,
  chunk: string,
  progressBuffer: { current: string },
  prefix: string,
  fileIndex: number,
  totalFiles: number,
) {
  progressBuffer.current += chunk
  const lines = progressBuffer.current.split(/\r?\n/)
  progressBuffer.current = lines.pop() ?? ""
  for (const line of lines) {
    const match = line.match(/^PROGRESS:(\d+):(.+)$/)
    if (!match) continue
    const progress = Number.parseInt(match[1], 10)
    const message = match[2].trim()
    const overall = Math.min(99, 10 + Math.round((((fileIndex - 1) + progress / 100) / totalFiles) * 85))
    void updateTask(taskId, {
      status: "running",
      progress: overall,
      message: `${prefix}注册：${message}`,
    })
  }
}

function spawnJsonProcess(
  command: string,
  args: string[],
  cwd: string,
  onStderr?: (chunk: string) => void,
) {
  return new Promise<{ code: number | null; data: RegisterRunData | null; stdout: string }>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    })
    let stdout = ""
    let stderr = ""
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      onStderr?.(text)
    })
    proc.on("close", (code) => {
      try {
        const data = JSON.parse(stdout.trim() || "{}") as RegisterRunData
        resolve({ code, data, stdout })
      } catch {
        if (stdout.trim()) {
          reject(new Error(stdout.trim()))
          return
        }
        reject(new Error(stderr.trim() || `退出码 ${code}`))
      }
    })
    proc.on("error", (error) => reject(error))
  })
}

function hasLogicalFailure(data: RegisterRunData | null) {
  if (!data?.success) return true
  const successCount = typeof data.success_count === "number" ? data.success_count : 0
  const failCount = typeof data.fail_count === "number" ? data.fail_count : 0
  return failCount > 0 && successCount === 0
}

function firstFailureMessage(data: RegisterRunData | null) {
  if (!Array.isArray(data?.results)) return ""
  return (
    data.results
      .map((item) => String(item?.error || item?.message || "").trim())
      .find((message) => Boolean(message)) || ""
  )
}

function buildRegisterResultMessage(results: Array<Record<string, unknown>>) {
  const lines = results
    .map((item) => {
      const email = typeof item.email === "string" ? item.email.trim() : ""
      const status = typeof item.status === "string" ? item.status.trim() : ""
      const detail =
        (typeof item.error === "string" && item.error.trim()) ||
        (typeof item.message === "string" && item.message.trim()) ||
        ""
      if (status === "success") {
        return email ? `${email} 注册成功` : detail || "注册成功"
      }
      if (!email && !detail) return ""
      return email ? `${email} 注册失败：${detail || "未知原因"}` : detail || "注册失败"
    })
    .filter(Boolean)
  return lines.join("\n")
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
        { success: false, error: "请至少上传一个包含 FV 注册信息的 Excel 文件" },
        { status: 400 },
      )
    }

    const registerScriptPath = path.join(process.cwd(), "services", "french-visa", "register_cli.py")
    try {
      await fs.access(registerScriptPath)
    } catch {
      return NextResponse.json(
        { success: false, error: "法签注册服务未找到，请确认 services/french-visa/register_cli.py 已部署" },
        { status: 500 },
      )
    }

    const task = await createTask(userId, "extract-register", `FV注册 · ${files.length} 个文件`, {
      applicantProfileId: applicantProfileId || undefined,
      caseId: caseId || undefined,
      applicantName: applicantProfile?.name || applicantProfile?.label,
    })

    const outputId = `fv-extract-register-${task.task_id}`
    const outputDir = path.join(process.cwd(), "temp", "french-visa-extract-register", outputId)
    await fs.mkdir(outputDir, { recursive: true })

    const inputPaths: Array<{ inputPath: string; fileName: string }> = []
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const base = (file.name || "data").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.(xlsx|xls)$/i, "") || "data"
      const ext = /\.xls$/i.test(file.name || "") ? "xls" : "xlsx"
      const safeName = `${base}_${index + 1}.${ext}`
      const inputPath = path.join(outputDir, safeName)
      await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))
      inputPaths.push({ inputPath, fileName: file.name || safeName })
    }

    await updateTask(task.task_id, {
      status: "running",
      progress: 5,
      message: "准备开始 FV 注册...",
    })

    if (applicantProfileId) {
      await advanceFranceCase({
        userId,
        applicantProfileId,
        mainStatus: "TLS_PROCESSING",
        subStatus: "TLS_REGISTERING",
        clearException: true,
        reason: "Started France FV register flow",
      }).catch((error) => {
        console.error("Failed to advance France case before extract-register", error)
      })
    }

    void (async () => {
      try {
        const pythonCommand = getPythonRuntimeCommand()
        const runResults: Array<Record<string, unknown>> = []
        const downloadArtifacts: Array<Record<string, string>> = []
        let totalRows = 0
        let successCount = 0
        let failCount = 0

        for (let index = 0; index < inputPaths.length; index += 1) {
          const current = inputPaths[index]
          const prefix = `[${current.fileName}] `

          await updateTask(task.task_id, {
            status: "running",
            progress: Math.min(95, 10 + Math.round((index / inputPaths.length) * 85)),
            message: `${prefix}开始读取原始 Excel 并注册...`,
          })

          const progressBuffer = { current: "" }
          const registerRun = await spawnJsonProcess(
            pythonCommand,
            ["-u", registerScriptPath, current.inputPath, "--output-dir", outputDir],
            process.cwd(),
            (chunk) => flushRegisterProgress(task.task_id, chunk, progressBuffer, prefix, index + 1, inputPaths.length),
          )

          const registerData = registerRun.data
          const logFile = typeof registerData?.log_file === "string" ? registerData.log_file : undefined
          const downloadLog = buildDownloadUrl(outputId, logFile)

          if (logFile && downloadLog) {
            downloadArtifacts.push({
              label: `运行日志 · ${current.fileName}`,
              filename: logFile,
              url: downloadLog,
            })
          }

          const fileSuccessCount = typeof registerData?.success_count === "number" ? registerData.success_count : 0
          const fileFailCount = typeof registerData?.fail_count === "number" ? registerData.fail_count : 0
          totalRows += typeof registerData?.total === "number" ? registerData.total : 0
          successCount += fileSuccessCount
          failCount += fileFailCount

          if (Array.isArray(registerData?.results)) {
            runResults.push(
              ...registerData.results.map((item) => ({
                ...item,
                source_file: current.fileName,
              })),
            )
          }

          if (hasLogicalFailure(registerData)) {
            const errorMessage =
              typeof registerData?.error === "string"
                ? registerData.error
                : firstFailureMessage(registerData) || `退出码 ${registerRun.code}`

            await updateTask(task.task_id, {
              status: "failed",
              progress: 0,
              message: `${prefix}FV 注册失败`,
              error: errorMessage,
              result: {
                success: false,
                stage: "register",
                message: buildRegisterResultMessage(runResults) || errorMessage || "FV 注册失败",
                total: totalRows,
                success_count: successCount,
                fail_count: failCount,
                results: runResults,
                download_log: downloadLog,
                download_artifacts: downloadArtifacts,
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
                console.error("Failed to set France case exception after extract-register failure", error)
              })
            }
            return
          }
        }

        await updateTask(task.task_id, {
          status: "completed",
          progress: 100,
          message: "FV 注册完成",
          result: {
            success: true,
            stage: "register",
            message: buildRegisterResultMessage(runResults) || "FV 注册完成",
            total: totalRows,
            success_count: successCount,
            fail_count: failCount,
            results: runResults,
            download_log: downloadArtifacts[0]?.url,
            download_artifacts: downloadArtifacts,
          },
        })

        if (applicantProfileId) {
          await advanceFranceCase({
            userId,
            applicantProfileId,
            mainStatus: "TLS_PROCESSING",
            subStatus: "SLOT_HUNTING",
            clearException: true,
            reason: "France FV register completed",
          }).catch((error) => {
            console.error("Failed to advance France case after extract-register success", error)
          })
        }
      } catch (error) {
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "FV 注册失败",
          error: error instanceof Error ? error.message : "未知错误",
        })

        if (applicantProfileId) {
          await setFranceCaseException({
            userId,
            applicantProfileId,
            mainStatus: "TLS_PROCESSING",
            subStatus: "TLS_REGISTERING",
            exceptionCode: "TLS_REGISTER_FAILED",
            reason: error instanceof Error ? error.message : "France FV register failed",
          }).catch((caseError) => {
            console.error("Failed to set France case exception after extract-register exception", caseError)
          })
        }
      }
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "已创建 FV 注册任务，请在下方任务列表中查看进度",
    })
  } catch (error) {
    console.error("法签 FV 注册错误:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

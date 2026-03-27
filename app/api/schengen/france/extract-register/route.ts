import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createTask, updateTask } from "@/lib/french-visa-tasks"
import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
  saveApplicantProfileFileFromAbsolutePath,
} from "@/lib/applicant-profiles"
import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type JsonObject = Record<string, unknown>

function flushRegisterProgress(
  taskId: string,
  chunk: string,
  progressBuffer: { current: string },
  prefix: string
) {
  progressBuffer.current += chunk
  const lines = progressBuffer.current.split(/\r?\n/)
  progressBuffer.current = lines.pop() ?? ""
  for (const line of lines) {
    const m = line.match(/^PROGRESS:(\d+):(.+)$/)
    if (!m) continue
    const pct = parseInt(m[1], 10)
    const msg = m[2].trim()
    const mappedProgress = Math.min(99, 55 + Math.round((pct / 100) * 44))
    void updateTask(taskId, { status: "running", progress: mappedProgress, message: prefix + `注册：${msg}` })
  }
}

function spawnJsonProcess(
  command: string,
  args: string[],
  cwd: string,
  onStderr?: (chunk: string) => void
) {
  return new Promise<{ code: number | null; data: JsonObject | null; stdout: string }>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    })
    let stdout = ""
    let stderr = ""
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr?.on("data", (d: Buffer) => {
      const chunk = d.toString()
      stderr += chunk
      onStderr?.(chunk)
    })
    proc.on("close", (code) => {
      try {
        const data = JSON.parse(stdout.trim() || "{}") as JsonObject
        resolve({ code, data, stdout })
      } catch {
        if (stdout.trim()) {
          reject(new Error(stdout.trim()))
          return
        }
        reject(new Error(stderr.trim() || `退出码 ${code}`))
      }
    })
    proc.on("error", (err) => reject(err))
  })
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
      if (file && typeof file === "object" && "arrayBuffer" in file) files.push(file as File)
    }
    if (files.length === 0) {
      const one = formData.get("file") as File | null
      if (one) files.push(one)
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
          })
        )
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: "请上传至少一个 Excel 文件（含 FV 注册表）" }, { status: 400 })
    }

    const extractScriptPath = path.join(process.cwd(), "services", "french-visa", "extract_cli.py")
    const registerScriptPath = path.join(process.cwd(), "services", "french-visa", "register_cli.py")
    try {
      await Promise.all([fs.access(extractScriptPath), fs.access(registerScriptPath)])
    } catch {
      return NextResponse.json({ success: false, error: "法签提取或注册服务未找到，请确认 services/french-visa 已部署" }, { status: 500 })
    }

    const task = await createTask(
      userId,
      "extract-register",
      `提取+注册 · ${files.length} 个文件`,
      {
        applicantProfileId: applicantProfileId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      }
    )

    const outputId = `fv-extract-register-${task.task_id}`
    const outputDir = path.join(process.cwd(), "temp", "french-visa-extract-register", outputId)
    await fs.mkdir(outputDir, { recursive: true })

    const inputPaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const base = (file.name || "data").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.(xlsx|xls)$/i, "") || "data"
      const ext = /\.xls$/i.test(file.name || "") ? "xls" : "xlsx"
      const safeName = `${base}_${i + 1}.${ext}`
      const inputPath = path.join(outputDir, safeName)
      await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))
      inputPaths.push(inputPath)
    }

    await updateTask(task.task_id, { status: "running", progress: 5, message: "准备开始提取+注册..." })

    void (async () => {
      try {
        await updateTask(task.task_id, { status: "running", progress: 12, message: "正在提取注册信息..." })
        const extractRun = await spawnJsonProcess("python", ["-u", extractScriptPath, ...inputPaths, "--output-dir", outputDir], process.cwd())
        const extractData = extractRun.data

        if (!extractData?.success || typeof extractData.output_file !== "string") {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "提取失败，未开始注册",
            error: typeof extractData?.error === "string" ? extractData.error : `退出码 ${extractRun.code}`,
            result: {
              success: false,
              stage: "extract",
              error: typeof extractData?.error === "string" ? extractData.error : undefined,
            },
          })
          return
        }

        const extractExcelName = extractData.output_file
        const extractJsonName = typeof extractData.json_file === "string" ? extractData.json_file : undefined
        const extractedExcelPath = path.join(outputDir, extractExcelName)
        const downloadExcel = `/api/schengen/france/extract-register/download/${outputId}/${encodeURIComponent(extractExcelName)}`
        const downloadJson = extractJsonName
          ? `/api/schengen/france/extract-register/download/${outputId}/${encodeURIComponent(extractJsonName)}`
          : undefined
        let archivedProfileAccountsUrl: string | undefined
        if (extractJsonName && applicantProfileId) {
          try {
            await saveApplicantProfileFileFromAbsolutePath({
              userId,
              id: applicantProfileId,
              slot: "franceTlsAccountsJson",
              sourcePath: path.join(outputDir, extractJsonName),
              originalName: extractJsonName,
              mimeType: "application/json",
            })
            archivedProfileAccountsUrl = `/api/applicants/${applicantProfileId}/files/franceTlsAccountsJson`
          } catch (archiveError) {
            console.error("Failed to archive extracted TLS accounts JSON to applicant profile", archiveError)
          }
        }

        await updateTask(task.task_id, {
          status: "running",
          progress: 55,
          message: "提取完成，开始注册账号...",
          result: {
            success: true,
            stage: "extract",
            download_excel: downloadExcel,
            download_json: downloadJson,
            archived_profile_accounts_url: archivedProfileAccountsUrl,
            extract_message: extractData.message,
          },
        })

        const progressBuffer = { current: "" }
        const registerRun = await spawnJsonProcess(
          "python",
          ["-u", registerScriptPath, extractedExcelPath, "--output-dir", outputDir],
          process.cwd(),
          (chunk) => flushRegisterProgress(task.task_id, chunk, progressBuffer, "")
        )
        const registerData = registerRun.data
        const logFile = typeof registerData?.log_file === "string" ? registerData.log_file : undefined
        const downloadLog = logFile
          ? `/api/schengen/france/extract-register/download/${outputId}/${encodeURIComponent(logFile)}`
          : undefined

        if (!registerData?.success) {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "注册失败",
            error: typeof registerData?.error === "string" ? registerData.error : `退出码 ${registerRun.code}`,
            result: {
              success: false,
              stage: "register",
              download_excel: downloadExcel,
              download_json: downloadJson,
              archived_profile_accounts_url: archivedProfileAccountsUrl,
              download_log: downloadLog,
              message: typeof registerData?.message === "string" ? registerData.message : "提取完成，但注册失败",
              total: registerData?.total,
              success_count: registerData?.success_count,
              fail_count: registerData?.fail_count,
              results: registerData?.results,
            },
          })
          return
        }

        await updateTask(task.task_id, {
          status: "completed",
          progress: 100,
          message: "提取+注册完成",
          result: {
            success: true,
            stage: "extract-register",
            message: typeof registerData.message === "string" ? registerData.message : "提取+注册完成",
            download_excel: downloadExcel,
            download_json: downloadJson,
            archived_profile_accounts_url: archivedProfileAccountsUrl,
            download_log: downloadLog,
            total: registerData.total,
            success_count: registerData.success_count,
            fail_count: registerData.fail_count,
            results: registerData.results,
          },
        })
      } catch (error) {
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "提取+注册失败",
          error: error instanceof Error ? error.message : "未知错误",
        })
      }
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "已创建提取+注册任务，请在下方任务列表中查看进度",
    })
  } catch (error) {
    console.error("法签提取+注册错误:", error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "未知错误" }, { status: 500 })
  }
}

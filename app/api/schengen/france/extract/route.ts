import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createTask, updateTask } from "@/lib/french-visa-tasks"
import { getApplicantProfile, getApplicantProfileFileByCandidates } from "@/lib/applicant-profiles"
import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function flushProgress(taskId: string, chunk: string, progressBuffer: { current: string }, prefix: string) {
  progressBuffer.current += chunk
  const lines = progressBuffer.current.split(/\r?\n/)
  progressBuffer.current = lines.pop() ?? ""
  for (const line of lines) {
    const match = line.match(/^PROGRESS:(\d+):(.+)$/)
    if (!match) continue
    const pct = parseInt(match[1], 10)
    const msg = match[2].trim()
    void updateTask(taskId, { status: "running", progress: pct, message: prefix + msg })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 })
    }

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
    const applicantProfile = applicantProfileId ? await getApplicantProfile(session.user.id, applicantProfileId) : null

    if (files.length === 0 && applicantProfileId) {
      const stored = await getApplicantProfileFileByCandidates(session.user.id, applicantProfileId, ["schengenExcel", "franceExcel"])
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

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "extract_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json({ success: false, error: "法签提取服务未找到，请确认 services/french-visa 已部署" }, { status: 500 })
    }

    const task = await createTask(
      session.user.id,
      "extract",
      `提取注册信息 · ${files.length} 个文件`,
      {
        applicantProfileId: applicantProfileId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      }
    )

    const outputId = `fv-extract-${task.task_id}`
    const outputDir = path.join(process.cwd(), "temp", "french-visa-extract", outputId)
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

    const prefix = files.length > 1 ? `[${files.length} 个文件] ` : ""
    await updateTask(task.task_id, { status: "running", progress: 5, message: prefix + "正在提取..." })

    type ExtractResult = { success: boolean; message?: string; error?: string; output_file?: string; json_file?: string }
    let stdout = ""
    const progressBuffer = { current: "" }

    const proc = spawn("python", ["-u", scriptPath, ...inputPaths, "--output-dir", outputDir], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    })
    const timeoutId = setTimeout(() => {
      try {
        proc.kill()
      } catch {}
      void updateTask(task.task_id, { status: "failed", progress: 0, message: "执行超时（5 分钟）", error: "Timeout" })
    }, 300000)

    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr?.on("data", (d: Buffer) => {
      flushProgress(task.task_id, d.toString(), progressBuffer, prefix)
    })
    proc.on("close", async (code) => {
      clearTimeout(timeoutId)
      try {
        const data = JSON.parse(stdout.trim() || "{}") as ExtractResult
        if (data.success && data.output_file) {
          const excelUrl = `/api/schengen/france/extract/download/${outputId}/${encodeURIComponent(data.output_file)}`
          const jsonUrl = data.json_file
            ? `/api/schengen/france/extract/download/${outputId}/${encodeURIComponent(data.json_file)}`
            : undefined
          await updateTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: prefix + (data.message || "提取完成"),
            result: {
              success: true,
              message: data.message,
              download_excel: excelUrl,
              download_json: jsonUrl,
            },
          })
        } else {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "提取失败",
            error: data.error || `退出码 ${code}`,
            result: { success: false, error: data.error },
          })
        }
      } catch {
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: prefix + "解析结果失败",
          error: stdout.trim() || `退出码 ${code}`,
        })
      }
    })
    proc.on("error", async (err) => {
      clearTimeout(timeoutId)
      await updateTask(task.task_id, { status: "failed", progress: 0, message: "进程启动失败", error: String(err) })
    })

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "已创建提取任务，请在下方任务列表中查看进度",
    })
  } catch (error) {
    console.error("法签提取错误:", error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "未知错误" }, { status: 500 })
  }
}

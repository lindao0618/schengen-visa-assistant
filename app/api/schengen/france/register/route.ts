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

function flushProgress(
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
    if (m) {
      const pct = parseInt(m[1], 10)
      const msg = m[2].trim()
      void updateTask(taskId, { status: "running", progress: pct, message: prefix + msg })
    }
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
    for (const f of formData.getAll("file")) {
      if (f && typeof f === "object" && "arrayBuffer" in f) files.push(f as File)
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
      return NextResponse.json(
        { success: false, error: "请上传至少一个 Excel 文件（含邮箱、密码、姓、名等）" },
        { status: 400 }
      )
    }

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "register_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json(
        { success: false, error: "法签注册服务未找到，请确认 services/french-visa/register_cli.py 已部署" },
        { status: 500 }
      )
    }

    type RegisterResult = {
      success: boolean
      error?: string
      total?: number
      success_count?: number
      fail_count?: number
      results?: unknown[]
      message?: string
      log_file?: string
    }

    const taskIds: string[] = []
    for (const file of files) {
      const fileName = file.name || "register.xlsx"
      const task = await createTask(session.user.id, "register", `账号注册 · ${fileName}`, {
        applicantProfileId: applicantProfileId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      })
      taskIds.push(task.task_id)
      const outputId = `fv-register-${task.task_id}`
      const outputDir = path.join(process.cwd(), "temp", "french-visa-register", outputId)
      await fs.mkdir(outputDir, { recursive: true })
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
      const inputPath = path.join(outputDir, safeName)
      const buf = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(inputPath, buf)

      await updateTask(task.task_id, { status: "running", progress: 1, message: `[${fileName}] 准备中...` })

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
          /* ignore */
        }
        void updateTask(task.task_id, { status: "failed", progress: 0, message: "执行超时（5分钟）", error: "Timeout" })
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
          const data = JSON.parse(stdout.trim() || "{}") as RegisterResult
          const logFile = data.log_file
          const download_log = logFile
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
                download_log,
              },
            })
          } else {
            await updateTask(task.task_id, {
              status: "failed",
              progress: 0,
              message: prefix + "注册失败",
              error: data.error || `退出码 ${code}`,
              result: { success: false, error: data.error, download_log },
            })
          }
        } catch {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "解析结果失败",
            error: stdout.trim() || `进程退出码 ${code}`,
          })
        }
      })
      proc.on("error", async (err) => {
        clearTimeout(timeoutId)
        await updateTask(task.task_id, { status: "failed", progress: 0, message: "进程启动失败", error: String(err) })
      })
    }

    return NextResponse.json({
      success: true,
      task_ids: taskIds,
      task_id: taskIds.length === 1 ? taskIds[0] : undefined,
      message: `已创建 ${taskIds.length} 个账号注册任务，请在下方的任务列表中查看进度`,
    })
  } catch (error) {
    console.error("法签注册错误:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}

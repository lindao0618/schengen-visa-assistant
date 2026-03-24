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
    const userId = session.user.id

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
      return NextResponse.json(
        { success: false, error: "请上传至少一个 Excel 文件（含回执单所需字段）" },
        { status: 400 }
      )
    }

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "fill_receipt_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json(
        { success: false, error: "法签填写回执单服务未找到" },
        { status: 500 }
      )
    }

    const file = files[0]
    const fileName = file.name || "receipt.xlsx"
    const task = await createTask(userId, "fill-receipt", `填写回执单 · ${fileName}`, {
      applicantProfileId: applicantProfileId || undefined,
      applicantName: applicantProfile?.name || applicantProfile?.label,
    })
    const outputId = `fv-receipt-${task.task_id}`
    const outputDir = path.join(process.cwd(), "temp", "french-visa-fill-receipt", outputId)
    await fs.mkdir(outputDir, { recursive: true })
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const inputPath = path.join(outputDir, safeName)
    await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()))

    await updateTask(task.task_id, { status: "running", progress: 5, message: `[${fileName}] 准备中...` })

    type FillResult = {
      success: boolean
      error?: string
      message?: string
      pdf_saved?: boolean
      pdf_file?: string
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
        const data = JSON.parse(stdout.trim() || "{}") as FillResult
        if (data.success && data.pdf_file) {
          // 使用固定文件名 receipt.pdf 避免中文/特殊字符导致的 URL 编码问题
          const download_pdf = `/api/schengen/france/fill-receipt/download/${outputId}/receipt.pdf`
          let archivedProfilePdfUrl: string | undefined

          if (applicantProfileId) {
            try {
              await saveApplicantProfileFileFromAbsolutePath({
                userId,
                id: applicantProfileId,
                slot: "franceReceiptPdf",
                sourcePath: path.join(outputDir, data.pdf_file),
                originalName: data.pdf_file,
                mimeType: "application/pdf",
              })
              archivedProfilePdfUrl = `/api/applicants/${applicantProfileId}/files/franceReceiptPdf`
            } catch (archiveError) {
              console.error("Failed to archive France receipt PDF to applicant profile", archiveError)
            }
          }
          await updateTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: prefix + (data.message || "回执单填写完成"),
            result: {
              success: true,
              message: data.message,
              download_pdf,
              archived_profile_pdf_url: archivedProfilePdfUrl,
              pdf_file: data.pdf_file,
            },
          })
        } else if (data.success) {
          await updateTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: prefix + (data.message || "回执单填写完成"),
            result: { success: true, message: data.message },
          })
        } else {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: prefix + "填写失败",
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
      message: "已创建填写回执单任务，请在下方的任务列表中查看进度",
    })
  } catch (error) {
    console.error("法签填写回执单错误:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}

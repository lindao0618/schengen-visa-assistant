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

interface DebugDownload {
  label: string
  filename: string
  url: string
}

interface FillResult {
  success: boolean
  error?: string
  message?: string
  pdf_saved?: boolean
  pdf_file?: string
}

function flushProgress(taskId: string, chunk: string, progressBuffer: { current: string }, prefix: string) {
  progressBuffer.current += chunk
  const lines = progressBuffer.current.split(/\r?\n/)
  progressBuffer.current = lines.pop() ?? ""
  for (const line of lines) {
    const matched = line.match(/^PROGRESS:(\d+):(.+)$/)
    if (!matched) continue
    const progress = Number.parseInt(matched[1], 10)
    const message = matched[2].trim()
    void updateTask(taskId, { status: "running", progress, message: prefix + message })
  }
}

function artifactLabel(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return `调试截图 · ${filename}`
  if (ext === ".html") return `页面 HTML · ${filename}`
  if (ext === ".json") return `调试 JSON · ${filename}`
  if (ext === ".log") return `运行日志 · ${filename}`
  return `调试文件 · ${filename}`
}

async function collectDebugDownloads(outputDir: string, outputId: string): Promise<DebugDownload[]> {
  const results: DebugDownload[] = []
  const seen = new Set<string>()

  const pushFile = async (absolutePath: string, filename: string) => {
    try {
      await fs.access(absolutePath)
    } catch {
      return
    }
    if (seen.has(filename)) return
    seen.add(filename)
    results.push({
      label: artifactLabel(filename),
      filename,
      url: `/api/schengen/france/fill-receipt/download/${outputId}/${encodeURIComponent(filename)}`,
    })
  }

  await pushFile(path.join(outputDir, "runner_stdout.log"), "runner_stdout.log")
  await pushFile(path.join(outputDir, "runner_stderr.log"), "runner_stderr.log")

  const entries = await fs.readdir(outputDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (![".png", ".html", ".json", ".log"].includes(ext)) continue
    if (entry.name === "runner_stdout.log" || entry.name === "runner_stderr.log") continue
    await pushFile(path.join(outputDir, entry.name), entry.name)
  }

  return results
}

function refineFillReceiptError(rawDetail: string) {
  const detail = rawDetail || "填写回执单失败"
  if (detail.includes("formStep3:haveOldSchengenVisas")) {
    return "填写回执单第 3 步失败：页面里没有找到“是否有旧申根签证”这一项。已保存截图、HTML 和日志，请先下载现场文件确认 France-visas 页面结构。"
  }
  if (detail.includes("formStep4:btnSuivant")) {
    return "填写回执单第 4 步失败：旅行信息页没有顺利进入下一步。已保存截图、HTML 和日志，请检查当前页面是否还有未填写项。"
  }
  return detail
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
    for (const item of formData.getAll("file")) {
      if (item && typeof item === "object" && "arrayBuffer" in item) {
        files.push(item as File)
      }
    }
    if (files.length === 0) {
      const file = formData.get("file")
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        files.push(file as File)
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
        { success: false, error: "请上传至少一个包含回执单所需字段的 Excel 文件" },
        { status: 400 },
      )
    }

    const scriptPath = path.join(process.cwd(), "services", "french-visa", "fill_receipt_cli.py")
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json({ success: false, error: "法签填写回执单服务未找到" }, { status: 500 })
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

    await updateTask(task.task_id, {
      status: "running",
      progress: 5,
      message: `[${fileName}] 准备中...`,
    })

    if (applicantProfileId) {
      await advanceFranceCase({
        userId,
        applicantProfileId,
        mainStatus: "REVIEWING",
        subStatus: "HUMAN_REVIEWING",
        clearException: true,
        reason: "Started France receipt filling",
      }).catch((error) => {
        console.error("Failed to advance France case before fill-receipt", error)
      })
    }

    let stdout = ""
    let stderr = ""
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
      const text = chunk.toString()
      stderr += text
      flushProgress(task.task_id, text, progressBuffer, prefix)
    })

    proc.on("close", async (code) => {
      clearTimeout(timeoutId)

      if (stdout.trim()) {
        await fs.writeFile(path.join(outputDir, "runner_stdout.log"), stdout, "utf-8").catch(() => {})
      }
      if (stderr.trim()) {
        await fs.writeFile(path.join(outputDir, "runner_stderr.log"), stderr, "utf-8").catch(() => {})
      }

      const debugDownloads = await collectDebugDownloads(outputDir, outputId)
      const downloadLog =
        debugDownloads.find((item) => item.filename === "runner_stderr.log")?.url ||
        debugDownloads.find((item) => item.filename === "runner_stdout.log")?.url

      try {
        const data = JSON.parse(stdout.trim() || "{}") as FillResult
        if (data.success && data.pdf_file) {
          const downloadPdf = `/api/schengen/france/fill-receipt/download/${outputId}/receipt.pdf`
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
              download_pdf: downloadPdf,
              archived_profile_pdf_url: archivedProfilePdfUrl,
              pdf_file: data.pdf_file,
              download_log: downloadLog,
              download_artifacts: debugDownloads,
            },
          })

          if (applicantProfileId) {
            await advanceFranceCase({
              userId,
              applicantProfileId,
              mainStatus: "DOCS_READY",
              subStatus: "DOCS_GENERATED",
              clearException: true,
              reason: "France receipt PDF generated",
            }).catch((error) => {
              console.error("Failed to advance France case after fill-receipt success", error)
            })
          }
          return
        }

        if (data.success) {
          await updateTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: prefix + (data.message || "回执单填写完成"),
            result: {
              success: true,
              message: data.message,
              download_log: downloadLog,
              download_artifacts: debugDownloads,
            },
          })

          if (applicantProfileId) {
            await advanceFranceCase({
              userId,
              applicantProfileId,
              mainStatus: "DOCS_READY",
              subStatus: "DOCS_GENERATED",
              clearException: true,
              reason: "France receipt filling completed",
            }).catch((error) => {
              console.error("Failed to advance France case after fill-receipt completion", error)
            })
          }
          return
        }

        const normalizedError = refineFillReceiptError(data.error || `退出码 ${code}`)
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: prefix + "填写失败",
          error: normalizedError,
          result: {
            success: false,
            error: normalizedError,
            message: "填写回执单失败，已保存截图、HTML 和日志，可直接下载排查。",
            download_log: downloadLog,
            download_artifacts: debugDownloads,
          },
        })

        if (applicantProfileId) {
          await setFranceCaseException({
            userId,
            applicantProfileId,
            mainStatus: "REVIEWING",
            subStatus: "HUMAN_REVIEWING",
            exceptionCode: "DOCS_REGENERATE_REQUIRED",
            reason: normalizedError,
          }).catch((error) => {
            console.error("Failed to set France case exception after fill-receipt failure", error)
          })
        }
      } catch {
        const normalizedError = refineFillReceiptError(stdout.trim() || stderr.trim() || `退出码 ${code}`)
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: prefix + "解析结果失败",
          error: normalizedError,
          result: {
            success: false,
            error: normalizedError,
            message: "脚本返回结果解析失败，已保留现场日志和调试文件。",
            download_log: downloadLog,
            download_artifacts: debugDownloads,
          },
        })

        if (applicantProfileId) {
          await setFranceCaseException({
            userId,
            applicantProfileId,
            mainStatus: "REVIEWING",
            subStatus: "HUMAN_REVIEWING",
            exceptionCode: "DOCS_REGENERATE_REQUIRED",
            reason: normalizedError,
          }).catch((error) => {
            console.error("Failed to set France case exception after fill-receipt parse failure", error)
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

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "已创建填写回执单任务，请在下方任务列表查看进度。",
    })
  } catch (error) {
    console.error("fill-receipt route error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

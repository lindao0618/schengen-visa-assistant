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
  updateApplicantProfileSchengenDetails,
} from "@/lib/applicant-profiles"
import { advanceFranceCase, setFranceCaseException } from "@/lib/france-cases"
import { createTask, updateTask } from "@/lib/french-visa-tasks"
import { getPythonRuntimeCommand } from "@/lib/python-runtime"

export const dynamic = "force-dynamic"
export const maxDuration = 300

let createApplicationQueue: Promise<void> = Promise.resolve()

function enqueueCreateApplicationTask(run: () => Promise<void>) {
  const queued = createApplicationQueue.then(run, run)
  createApplicationQueue = queued.catch((error) => {
    console.error("France create-application queue task failed:", error)
  })
  return queued
}

type DebugDownload = {
  label: string
  filename: string
  url: string
}

function artifactLabel(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") return `调试截图 · ${filename}`
  if (ext === ".html") return `页面 HTML · ${filename}`
  if (ext === ".log") return `运行日志 · ${filename}`
  if (ext === ".json") return `调试 JSON · ${filename}`
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
      url: `/api/schengen/france/create-application/download/${outputId}/${encodeURIComponent(filename)}`,
    })
  }

  await pushFile(path.join(outputDir, "runner_stdout.log"), "runner_stdout.log")
  await pushFile(path.join(outputDir, "runner_stderr.log"), "runner_stderr.log")
  await pushFile(path.join(outputDir, "create_result.json"), "create_result.json")
  try {
    const rootEntries = await fs.readdir(outputDir, { withFileTypes: true })
    for (const entry of rootEntries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
      if (!entry.isFile()) continue
      if (!entry.name.startsWith("error_")) continue
      await pushFile(path.join(outputDir, entry.name), entry.name)
    }
  } catch {
    // ignore listing errors
  }

  const artifactsDir = path.join(outputDir, "artifacts")
  try {
    const entries = await fs.readdir(artifactsDir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
      if (!entry.isFile()) continue
      await pushFile(path.join(artifactsDir, entry.name), entry.name)
    }
  } catch {
    // ignore missing artifacts dir
  }

  return results
}

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
        status: "pending",
        progress: 5,
        message: `[${fileName}] 已加入生成队列，等待前一个法签任务完成...`,
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

      void enqueueCreateApplicationTask(async () => {
        await updateTask(task.task_id, {
          status: "running",
          progress: 6,
          message: `[${fileName}] 队列轮到，开始生成...`,
        })

      const progressBuffer = { current: "" }
      const prefix = `[${fileName}] `

      await new Promise<void>((resolve) => {
      const proc = spawn(getPythonRuntimeCommand(), ["-u", scriptPath, inputPath, "--output-dir", outputDir], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      })
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

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
        stderrChunks.push(Buffer.from(chunk))
        flushProgress(task.task_id, chunk.toString(), progressBuffer, prefix)
      })
      proc.stdout?.on("data", (chunk: Buffer) => {
        stdoutChunks.push(Buffer.from(chunk))
      })

      proc.on("close", async (code) => {
        try {
        clearTimeout(timeoutId)
        const stdoutLog = Buffer.concat(stdoutChunks).toString("utf-8")
        const stderrLog = Buffer.concat(stderrChunks).toString("utf-8")
        if (stdoutLog.trim()) {
          await fs.writeFile(path.join(outputDir, "runner_stdout.log"), stdoutLog, "utf-8").catch(() => {})
        }
        if (stderrLog.trim()) {
          await fs.writeFile(path.join(outputDir, "runner_stderr.log"), stderrLog, "utf-8").catch(() => {})
        }
        const debugDownloads = await collectDebugDownloads(outputDir, outputId)
        const stderrDownload = debugDownloads.find((item) => item.filename === "runner_stderr.log")?.url
        const stdoutDownload = debugDownloads.find((item) => item.filename === "runner_stdout.log")?.url

        try {
          const raw = await fs.readFile(resultFilePath, "utf-8")
          const data = JSON.parse(raw) as CreateResult

          if (data.success && data.json_file) {
            const downloadJson = `/api/schengen/france/create-application/download/${outputId}/${encodeURIComponent(data.json_file)}`
            const archivedJsonPath = path.join(outputDir, data.json_file)
            let archivedProfileJsonUrl: string | undefined

            if (applicantProfileId) {
              if (data.application_ref) {
                try {
                  await updateApplicantProfileSchengenDetails(
                    userId,
                    applicantProfileId,
                    { fraNumber: data.application_ref },
                    session.user.role
                  )
                } catch (profileUpdateError) {
                  console.error("Failed to persist France application reference to applicant profile", profileUpdateError)
                }
              }

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
                download_log: stderrDownload || stdoutDownload,
                download_artifacts: debugDownloads,
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
            error: data.error || stderrLog.trim().slice(-1200) || stdoutLog.trim().slice(-1200) || `退出码 ${code}`,
            result: {
              success: false,
              error: data.error || stderrLog.trim().slice(-1200) || stdoutLog.trim().slice(-1200),
              message: "生成新申请失败，已保存调试文件。",
              download_log: stderrDownload || stdoutDownload,
              download_artifacts: debugDownloads,
            },
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
            error: stderrLog.trim().slice(-1200) || stdoutLog.trim().slice(-1200) || `退出码 ${code}`,
            result: {
              success: false,
              message: "读取结果失败，已保存调试文件。",
              download_log: stderrDownload || stdoutDownload,
              download_artifacts: debugDownloads,
            },
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
        } finally {
          resolve()
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
        resolve()
      })
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

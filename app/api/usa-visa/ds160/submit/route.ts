import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import { authOptions } from "@/lib/auth"
import { getApplicantProfile, saveApplicantProfileFileFromAbsolutePath } from "@/lib/applicant-profiles"
import { createTask, updateTask } from "@/lib/usa-visa-tasks"
import { writeOutputAccessMetadata } from "@/lib/task-route-access"
import { getPythonRuntimeCommand } from "@/lib/python-runtime"

const PYTHON_RUNTIME = getPythonRuntimeCommand()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json()
    let { application_id, surname, birth_year, passport_number, test_mode, applicantProfileId, caseId } = body

    let applicantProfile = null
    if (applicantProfileId) {
      applicantProfile = await getApplicantProfile(userId, String(applicantProfileId))
    }

      if (applicantProfileId && (!application_id || !surname || !birth_year || !passport_number)) {
      const profile = applicantProfile
      if (profile) {
        application_id = application_id || profile.usVisa?.aaCode || ""
        surname = surname || profile.usVisa?.surname || profile.surname || profile.fullName || profile.name || profile.label
        birth_year = birth_year || profile.usVisa?.birthYear || profile.birthYear || (profile.birthDate ? profile.birthDate.slice(0, 4) : "")
        passport_number = passport_number || profile.usVisa?.passportNumber || profile.passportNumber || ""
      }
    }

    if (!application_id || !surname || !birth_year || !passport_number) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少必填字段：application_id、surname、birth_year、passport_number",
        },
        { status: 400 }
      )
    }

    const outputId = `ds160-submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const outputDir = path.join(process.cwd(), "temp", "ds160-submit-outputs", outputId)
    await fs.mkdir(outputDir, { recursive: true })

    const task = await createTask(userId, "submit-ds160", `提交 DS160 · ${application_id}`, {
      applicantProfileId: applicantProfileId || undefined,
      caseId: caseId || undefined,
      applicantName: applicantProfile?.name || applicantProfile?.label,
    })
    await updateTask(task.task_id, { status: "running", progress: 5, message: "正在提交 DS-160..." })

    await writeOutputAccessMetadata(outputDir, {
      userId,
      taskId: task.task_id,
      outputId,
    })

    const scriptPath = path.join(process.cwd(), "services", "ds160-submitter", "ds160_submitter_cli.py")
    const captchaKey = process.env.CAPTCHA_API_KEY || process.env["2CAPTCHA_API_KEY"] || ""
    const args = [
      scriptPath,
      application_id,
      surname,
      String(birth_year),
      passport_number,
      "--output-dir",
      outputDir,
      ...(captchaKey ? ["--api-key", captchaKey] : []),
    ]
    if (test_mode) args.push("--test-mode")

    const proc = spawn(PYTHON_RUNTIME, args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    })

    let stdout = ""
    let stderr = ""
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString()
    })

    proc.on("close", async (code) => {
      try {
        const data = JSON.parse(stdout.trim() || "{}") as {
          success?: boolean
          pdf_file?: string
          error?: string
          message?: string
          application_id?: string
          download_url?: string
          download_url_simple?: string
        }

        let archivedProfilePdfUrl: string | undefined

        if (data.success && data.pdf_file) {
          await writeOutputAccessMetadata(outputDir, {
            userId,
            taskId: task.task_id,
            outputId,
            preferredFilename: data.pdf_file,
          })
          data.download_url = `/api/usa-visa/ds160/submit/download/${outputId}/${encodeURIComponent(data.pdf_file)}`
          data.download_url_simple = `/api/usa-visa/ds160/submit/download/${outputId}`

          if (applicantProfileId) {
            try {
                await saveApplicantProfileFileFromAbsolutePath({
                userId,
                id: String(applicantProfileId),
                slot: "usVisaDs160ConfirmationPdf",
                sourcePath: path.join(outputDir, data.pdf_file),
                originalName: `${application_id}-ds160-confirmation.pdf`,
                mimeType: "application/pdf",
              })
              archivedProfilePdfUrl = `/api/applicants/${encodeURIComponent(
                String(applicantProfileId)
              )}/files/usVisaDs160ConfirmationPdf`
            } catch (archiveError) {
              console.error("Failed to archive DS-160 confirmation PDF:", archiveError)
            }
          }
        }

        if (data.success) {
          await updateTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: `DS-160 提交成功 · ${application_id}`,
            result: {
              success: true,
              pdf_file: data.pdf_file,
              download_url: data.download_url,
              download_url_simple: data.download_url_simple,
              archived_profile_pdf_url: archivedProfilePdfUrl,
              output_id: outputId,
              application_id,
              message: data.message || "提交成功",
            },
          })
        } else {
          await updateTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "提交失败",
            error: data.error || stderr || stdout || `退出码 ${code}`,
          })
        }
      } catch {
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "解析结果失败",
          error: stderr || stdout || `退出码 ${code}`,
        })
      }
    })

    proc.on("error", async (err) => {
      await updateTask(task.task_id, {
        status: "failed",
        progress: 0,
        message: "进程启动失败",
        error: String(err),
      })
    })

    const timeout = setTimeout(() => {
      proc.kill()
      void updateTask(task.task_id, {
        status: "failed",
        progress: 0,
        message: "执行超时（15 分钟）",
        error: "Timeout",
      })
    }, 900000)

    proc.on("close", () => clearTimeout(timeout))

    return NextResponse.json({
      task_id: task.task_id,
      status: "pending",
      message: "任务已创建，请在下方任务列表中查看进度",
    })
  } catch (error) {
    console.error("DS-160 提交错误:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    )
  }
}

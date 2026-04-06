import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createTask, updateTask } from "@/lib/french-visa-tasks"
import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
  saveApplicantProfileFileFromAbsolutePath,
  updateApplicantProfileSchengenDetails,
} from "@/lib/applicant-profiles"
import { extractFranceTlsCityFromExcelBuffer } from "@/lib/france-tls-city-excel"
import { extractTlsAccountsFromExcelBuffer } from "@/lib/france-visa-extract-accounts"
import { normalizeFranceTlsCity } from "@/lib/france-tls-city"
import { advanceFranceCase, setFranceCaseException } from "@/lib/france-cases"
import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import { getPythonRuntimeCommand } from "@/lib/python-runtime"

export const dynamic = "force-dynamic"
export const maxDuration = 300

interface DebugDownload {
  label: string
  filename: string
  url: string
}

function getCaptchaConfig() {
  const capsolverApiKey = process.env.CAPSOLVER_API_KEY || process.env["CAPSOLVER_KEY"] || ""
  const twocaptchaApiKey =
    process.env.TWOCAPTCHA_API_KEY ||
    process.env["2CAPTCHA_API_KEY"] ||
    process.env["2CAPTCHA_KEY"] ||
    process.env.CAPTCHA_API_KEY ||
    ""

  if (capsolverApiKey && twocaptchaApiKey) {
    return {
      captcha_provider: "capsolver",
      capsolver_api_key: capsolverApiKey,
      twocaptcha_api_key: twocaptchaApiKey,
    }
  }
  if (capsolverApiKey) {
    return { captcha_provider: "capsolver", capsolver_api_key: capsolverApiKey, twocaptcha_api_key: "" }
  }
  if (twocaptchaApiKey) {
    return { captcha_provider: "2captcha", capsolver_api_key: "", twocaptcha_api_key: twocaptchaApiKey }
  }
  return { captcha_provider: "manual", capsolver_api_key: "", twocaptcha_api_key: "" }
}

function getCaptchaDiagnostics() {
  const hasCapsolverKey = Boolean(process.env.CAPSOLVER_API_KEY || process.env["CAPSOLVER_KEY"])
  const has2captchaKey = Boolean(
    process.env.TWOCAPTCHA_API_KEY ||
      process.env["2CAPTCHA_API_KEY"] ||
      process.env["2CAPTCHA_KEY"] ||
      process.env.CAPTCHA_API_KEY
  )
  return { hasCapsolverKey, has2captchaKey }
}

function getUcConfig() {
  const ucChromedriverPath = process.env.TLS_UC_CHROMEDRIVER_PATH || process.env.CHROMEDRIVER_PATH || ""
  const ucChromeVersionRaw = process.env.TLS_UC_CHROME_VERSION || ""
  const ucChromeVersion = ucChromeVersionRaw ? Number.parseInt(ucChromeVersionRaw, 10) : undefined
  const proxy = process.env.TLS_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ""
  const headless = process.env.TLS_HEADLESS === "true"
  return { uc_chromedriver_path: ucChromedriverPath, uc_chrome_version: ucChromeVersion, proxy: proxy.trim(), headless }
}

function normalizeLocation(location: unknown) {
  return normalizeFranceTlsCity(location) || null
}

function friendlyErrorMessage(rawMessage: string): string {
  const m = rawMessage.toLowerCase()
  if (m.includes("already in use") || m.includes("email_already_in_use")) {
    return "该邮箱已注册 TLS 账号，无需重复注册，可直接使用该账号登录 TLS 预约系统。"
  }
  if (m.includes("cloudflare") || m.includes("cf gate") || m.includes("browser will restart")) {
    return "Cloudflare 验证未通过，请检查网络环境后重试。"
  }
  if (m.includes("invalid email") || m.includes("invalid password")) {
    return "邮箱或密码格式不正确，请检查 Excel 中的账号信息。"
  }
  return rawMessage
}

function summarizeRegisterResults(parsed: unknown) {
  const payload = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  const results = Array.isArray(payload?.results) ? (payload?.results as Array<Record<string, unknown>>) : []
  if (!results.length) {
    return { hasAnyResult: false, successCount: 0, failCount: 0, sampleError: "", friendlyError: "" }
  }

  const successStatuses = new Set(["submitted", "filled_only", "success", "completed"])
  let successCount = 0
  let failCount = 0
  let sampleError = ""
  for (const item of results) {
    const status = String(item?.status || "").toLowerCase()
    const message = String(item?.message || "").trim()
    if (successStatuses.has(status)) {
      successCount += 1
    } else {
      failCount += 1
      if (!sampleError && message) sampleError = message
    }
  }
  return { hasAnyResult: true, successCount, failCount, sampleError, friendlyError: sampleError ? friendlyErrorMessage(sampleError) : "" }
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
      url: `/api/schengen/france/tls-register/download/${outputId}/${encodeURIComponent(filename)}`,
    })
  }

  await pushFile(path.join(outputDir, "runner_stdout.log"), "runner_stdout.log")
  await pushFile(path.join(outputDir, "runner_stderr.log"), "runner_stderr.log")
  await pushFile(path.join(outputDir, "run_results.json"), "run_results.json")

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 })
    const userId = session.user.id

    const formData = await request.formData()
    const excel = formData.get("excel")
    const requestedLocation = normalizeLocation(formData.get("location"))
    const applicantProfileId = String(formData.get("applicantProfileId") || "").trim()
    const caseId = String(formData.get("caseId") || "").trim()

    if (!excel && !applicantProfileId) {
      return NextResponse.json(
        { success: false, error: "请上传 Excel，或选择一个包含申根 Excel 的申请人档案" },
        { status: 400 },
      )
    }

    const applicantProfile = applicantProfileId ? await getApplicantProfile(userId, applicantProfileId) : null
    if (applicantProfileId && !applicantProfile) {
      return NextResponse.json({ success: false, error: "申请人档案不存在" }, { status: 400 })
    }

    const outputBase = path.join(process.cwd(), "temp", "french-visa-tls-register")
    const profileLabel = applicantProfile?.name || applicantProfile?.label || "申请人"
    const task = await createTask(
      userId,
      "tls-register",
      applicantProfileId ? `TLS 账户注册 · ${profileLabel}` : "TLS 账户注册",
      applicantProfileId
        ? { applicantProfileId, caseId: caseId || undefined, applicantName: profileLabel }
        : { caseId: caseId || undefined },
    )
    const outputId = `fv-tls-register-${task.task_id}`
    const outputDir = path.join(outputBase, outputId)
    await fs.mkdir(outputDir, { recursive: true })

    let excelBuffer: Buffer
    let accountsBytes: Buffer
    if (excel instanceof File) {
      excelBuffer = Buffer.from(await excel.arrayBuffer())
      const extracted = extractTlsAccountsFromExcelBuffer(excelBuffer)
      accountsBytes = Buffer.from(JSON.stringify(extracted, null, 2), "utf-8")
    } else {
      const storedExcel = applicantProfileId
        ? await getApplicantProfileFileByCandidates(userId, applicantProfileId, ["schengenExcel", "franceExcel"])
        : null
      if (!storedExcel) {
        return NextResponse.json(
          { success: false, error: "该档案没有申根 Excel。请先在「申请人」页上传申根 Excel，或手动上传 Excel。" },
          { status: 400 },
        )
      }
      excelBuffer = await fs.readFile(storedExcel.absolutePath)
      const extracted = extractTlsAccountsFromExcelBuffer(excelBuffer)
      accountsBytes = Buffer.from(JSON.stringify(extracted, null, 2), "utf-8")
    }
    const parsedExcelCity = extractFranceTlsCityFromExcelBuffer(excelBuffer)
    const location =
      requestedLocation || normalizeLocation(applicantProfile?.schengen?.city) || normalizeLocation(parsedExcelCity)
    if (!location) {
      return NextResponse.json(
        { success: false, error: "未识别到 TLS 递签城市，请先在申请人档案里补上，或手动选择 LON / MNC / EDI" },
        { status: 400 },
      )
    }
    if (applicantProfileId && parsedExcelCity && parsedExcelCity !== normalizeLocation(applicantProfile?.schengen?.city)) {
      await updateApplicantProfileSchengenDetails(userId, applicantProfileId, { city: parsedExcelCity }).catch(() => null)
    }
    const accountsJsonFileName = "accounts.json"
    const accountsPath = path.join(outputDir, accountsJsonFileName)
    await fs.writeFile(accountsPath, accountsBytes)
    if (applicantProfileId) {
      try {
        await saveApplicantProfileFileFromAbsolutePath({
          userId,
          id: applicantProfileId,
          slot: "franceTlsAccountsJson",
          sourcePath: accountsPath,
          originalName: `TLS_accounts_from_excel_${Date.now()}.json`,
          mimeType: "application/json",
        })
      } catch (archiveError) {
        console.error("archive franceTlsAccountsJson from excel failed", archiveError)
      }
    }

    const captchaCfg = getCaptchaConfig()
    const captchaDiag = getCaptchaDiagnostics()
    if (!captchaDiag.hasCapsolverKey && !captchaDiag.has2captchaKey) {
      return NextResponse.json(
        {
          success: false,
          error: "未配置验证码密钥：请在 .env.local 设置 CAPSOLVER_API_KEY（推荐）或 TWOCAPTCHA_API_KEY/CAPTCHA_API_KEY。",
          captcha: { provider: captchaCfg.captcha_provider, ...captchaDiag },
        },
        { status: 400 },
      )
    }
    const ucCfg = getUcConfig()

    const jobObj: Record<string, unknown> = {
      location,
      accounts_path: accountsJsonFileName,
      interactive_manual_steps: false,
      auto_submit: true,
      accept_all_visible_checkboxes: false,
      captcha_provider: captchaCfg.captcha_provider,
      capsolver_api_key: captchaCfg.capsolver_api_key,
      twocaptcha_api_key: captchaCfg.twocaptcha_api_key,
      browser_channel: "chrome",
      headless: ucCfg.headless,
      slow_mo_ms: 75,
      pause_between_accounts_sec: 2,
      navigation_timeout_ms: 45000,
      post_navigation_wait_ms: 1500,
      user_data_dir: ".tls_profile",
      results_path: "run_results.json",
      artifacts_dir: "artifacts",
      ...(() => {
        const { uc_chromedriver_path, uc_chrome_version, proxy } = ucCfg
        return {
          ...(uc_chromedriver_path ? { uc_chromedriver_path: uc_chromedriver_path } : {}),
          ...(uc_chrome_version ? { uc_chrome_version: uc_chrome_version } : {}),
          ...(proxy ? { proxy } : {}),
        }
      })(),
    }

    const jobPath = path.join(outputDir, "tls_register_job.json")
    await fs.writeFile(jobPath, JSON.stringify(jobObj, null, 2), "utf-8")

    await updateTask(task.task_id, {
      status: "running",
      progress: 5,
      message: "开始 TLS 账户注册...",
      result: {
        success: true,
        captcha: { provider: captchaCfg.captcha_provider, ...captchaDiag },
      },
    })

    if (applicantProfileId) {
      await advanceFranceCase({
        userId,
        applicantProfileId,
        mainStatus: "TLS_PROCESSING",
        subStatus: "TLS_REGISTERING",
        clearException: true,
        reason: "Started TLS account registration",
      }).catch((error) => {
        console.error("Failed to advance France case before tls-register", error)
      })
    }

    void (async () => {
      const tlsRegisterScript = "D:/Ai-user/tls_auto/tls_auto_register.py"
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      const pythonProc = spawn(getPythonRuntimeCommand(), ["-u", tlsRegisterScript, "--job", jobPath], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      })
      pythonProc.stdout?.on("data", (d: Buffer) => stdoutChunks.push(Buffer.from(d)))
      pythonProc.stderr?.on("data", (d: Buffer) => stderrChunks.push(Buffer.from(d)))

      const timeoutId = setTimeout(() => {
        try {
          pythonProc.kill()
        } catch {
          /* ignore */
        }
      }, 300000)

      const exitCode = await new Promise<number>((resolve) => {
        pythonProc.on("close", (code) => {
          resolve(typeof code === "number" ? code : 1)
        })
        pythonProc.on("error", () => resolve(1))
      }).finally(() => clearTimeout(timeoutId))

      const stdoutLog = Buffer.concat(stdoutChunks).toString("utf-8")
      const stderrLog = Buffer.concat(stderrChunks).toString("utf-8")
      if (stdoutLog.trim()) {
        await fs.writeFile(path.join(outputDir, "runner_stdout.log"), stdoutLog, "utf-8").catch(() => {})
      }
      if (stderrLog.trim()) {
        await fs.writeFile(path.join(outputDir, "runner_stderr.log"), stderrLog, "utf-8").catch(() => {})
      }

      const runResultsPath = path.join(outputDir, "run_results.json")
      let parsed: unknown = null
      let parseError: string | null = null
      try {
        const raw = await fs.readFile(runResultsPath, "utf-8")
        parsed = JSON.parse(raw)
      } catch (e) {
        parseError = e instanceof Error ? e.message : String(e)
      }

      const summary = summarizeRegisterResults(parsed)
      const debugDownloads = await collectDebugDownloads(outputDir, outputId)
      const stderrDownload = debugDownloads.find((item) => item.filename === "runner_stderr.log")?.url
      const stdoutDownload = debugDownloads.find((item) => item.filename === "runner_stdout.log")?.url
      if (exitCode !== 0 || !parsed || !summary.hasAnyResult || summary.successCount === 0) {
        const displayError =
          summary.friendlyError ||
          summary.sampleError ||
          parseError ||
          stderrLog.trim().slice(-1200) ||
          stdoutLog.trim().slice(-1200) ||
          `退出码 ${exitCode}`
        const displayMessage = summary.friendlyError
          ? `TLS 账户注册失败：${summary.friendlyError}`
          : "TLS 账户注册失败，已保存调试文件。"
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "TLS 账户注册失败",
          error: displayError,
          result:
            parsed && typeof parsed === "object"
              ? {
                  ...(parsed as Record<string, unknown>),
                  summary,
                  success: false,
                  message: displayMessage,
                  download_log: stderrDownload || stdoutDownload,
                  download_artifacts: debugDownloads,
                }
              : {
                  summary,
                  success: false,
                  message: displayMessage,
                  download_log: stderrDownload || stdoutDownload,
                  download_artifacts: debugDownloads,
                },
        })
        if (applicantProfileId) {
          await setFranceCaseException({
            userId,
            applicantProfileId,
            mainStatus: "TLS_PROCESSING",
            subStatus: "TLS_REGISTERING",
            exceptionCode: "TLS_REGISTER_FAILED",
            reason:
              summary.sampleError ||
              parseError ||
              stderrLog.trim().slice(-1200) ||
              stdoutLog.trim().slice(-1200) ||
              `Exit code ${exitCode}`,
          }).catch((error) => {
            console.error("Failed to set France case exception after tls-register failure", error)
          })
        }
        return
      }

      await updateTask(task.task_id, {
        status: "completed",
        progress: 100,
        message:
          summary.failCount > 0
            ? `TLS 账户注册完成（成功 ${summary.successCount}，失败 ${summary.failCount}）`
            : "TLS 账户注册完成",
        result: {
          success: true,
          results: parsed,
          summary,
          download_log: stderrDownload || stdoutDownload,
          download_artifacts: debugDownloads,
        },
      })
      if (applicantProfileId) {
        await advanceFranceCase({
          userId,
          applicantProfileId,
          mainStatus: "TLS_PROCESSING",
          subStatus: "SLOT_HUNTING",
          clearException: true,
          reason: "TLS account registration completed",
        }).catch((error) => {
          console.error("Failed to advance France case after tls-register success", error)
        })
      }
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "已创建 TLS 账户注册任务，请在下方任务列表查看进度。",
    })
  } catch (error) {
    console.error("tls-register error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"

import { authOptions } from "@/lib/auth"
import { getApplicantProfile, getApplicantProfileFileByCandidates, updateApplicantProfileSchengenDetails } from "@/lib/applicant-profiles"
import { extractFranceVisaCredentialsFromExcelBuffer } from "@/lib/france-visa-excel-credentials"
import { createTask, updateTask } from "@/lib/french-visa-tasks"
import { extractFranceTlsCityFromExcelBuffer } from "@/lib/france-tls-city-excel"
import { normalizeFranceTlsCity } from "@/lib/france-tls-city"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const TLS_APPLY_MAX_RUNTIME_MS = 240000
const TLS_APPLY_PROCESS_TIMEOUT_MS = 270000

interface DebugDownload {
  label: string
  filename: string
  url: string
}

function getCaptchaConfig() {
  const capsolverApiKey = process.env.CAPSOLVER_API_KEY || process.env.CAPSOLVER_KEY || ""
  const twocaptchaApiKey =
    process.env.TWOCAPTCHA_API_KEY ||
    process.env["2CAPTCHA_API_KEY"] ||
    process.env["2CAPTCHA_KEY"] ||
    process.env.CAPTCHA_API_KEY ||
    ""

  if (capsolverApiKey) {
    return { captcha_provider: "capsolver", capsolver_api_key: capsolverApiKey, twocaptcha_api_key: "" }
  }
  if (twocaptchaApiKey) {
    return { captcha_provider: "2captcha", capsolver_api_key: "", twocaptcha_api_key: twocaptchaApiKey }
  }
  return { captcha_provider: "manual", capsolver_api_key: "", twocaptcha_api_key: "" }
}

function getCaptchaDiagnostics() {
  const hasCapsolverKey = Boolean(process.env.CAPSOLVER_API_KEY || process.env.CAPSOLVER_KEY)
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
  return { uc_chromedriver_path: ucChromedriverPath, uc_chrome_version: ucChromeVersion, proxy: proxy.trim() }
}

function normalizeLocation(location: unknown) {
  return normalizeFranceTlsCity(location) || null
}

function artifactLabel(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") return `调试截图 · ${filename}`
  if (ext === ".html") return `页面 HTML · ${filename}`
  if (ext === ".log") return `运行日志 · ${filename}`
  if (ext === ".json") return `调试 JSON · ${filename}`
  return `调试文件 · ${filename}`
}

function refineApplyFailureDetail(rawDetail: string) {
  const text = rawDetail.toLowerCase()
  if (
    text.includes("login failed") ||
    text.includes("invalid credential") ||
    text.includes("incorrect") ||
    text.includes("wrong password") ||
    text.includes("keycloak")
  ) {
    return "TLS 登录失败：请检查档案中提取出的邮箱/密码是否正确，或账号是否被锁定。"
  }
  if (text.includes("captcha") || text.includes("cloudflare") || text.includes("turnstile")) {
    return "验证码/Cloudflare 验证未通过：请确认 Capsolver 配置与余额，或稍后重试。"
  }
  return rawDetail
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
      url: `/api/schengen/france/tls-apply/download/${outputId}/${encodeURIComponent(filename)}`,
    })
  }

  await pushFile(path.join(outputDir, "runner_stdout.log"), "runner_stdout.log")
  await pushFile(path.join(outputDir, "runner_stderr.log"), "runner_stderr.log")
  await pushFile(path.join(outputDir, "apply_results.json"), "apply_results.json")

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
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 })
    }

    const userId = session.user.id
    const formData = await request.formData()
    const applicants = formData.get("applicants")
    const requestedLocation = normalizeLocation(formData.get("location"))
    const applicantProfileId = String(formData.get("applicantProfileId") || "").trim()

    if (!applicants && !applicantProfileId) {
      return NextResponse.json(
        { success: false, error: "请上传 applicants JSON，或选择一个包含申请 JSON 的申请人档案" },
        { status: 400 },
      )
    }
    if (!applicantProfileId) {
      return NextResponse.json(
        { success: false, error: "请选择申请人档案，TLS 账号会从档案里的申根 Excel 读取" },
        { status: 400 },
      )
    }

    const applicantProfile = await getApplicantProfile(userId, applicantProfileId)
    if (!applicantProfile) {
      return NextResponse.json({ success: false, error: "申请人档案不存在" }, { status: 400 })
    }

    const excelStored = await getApplicantProfileFileByCandidates(userId, applicantProfileId, [
      "schengenExcel",
      "franceExcel",
    ])
    if (!excelStored) {
      return NextResponse.json(
        { success: false, error: "该档案未上传申根 Excel，无法读取 TLS 登录邮箱和密码" },
        { status: 400 },
      )
    }

    let email = ""
    let password = ""
    let excelBuffer: Buffer
    try {
      excelBuffer = await fs.readFile(excelStored.absolutePath)
      ;({ email, password } = extractFranceVisaCredentialsFromExcelBuffer(excelBuffer))
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析 Excel 失败"
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }

    const parsedExcelCity = extractFranceTlsCityFromExcelBuffer(excelBuffer)
    const location =
      requestedLocation || normalizeLocation(applicantProfile.schengen?.city) || normalizeLocation(parsedExcelCity)
    if (!location) {
      return NextResponse.json(
        { success: false, error: "未识别到 TLS 递签城市，请先在申请人档案里补上，或手动选择 LON / MNC / EDI" },
        { status: 400 },
      )
    }
    if (parsedExcelCity && parsedExcelCity !== normalizeLocation(applicantProfile.schengen?.city)) {
      await updateApplicantProfileSchengenDetails(userId, applicantProfileId, { city: parsedExcelCity }).catch(() => null)
    }

    const outputBase = path.join(process.cwd(), "temp", "french-visa-tls-apply")
    const profileLabel = applicantProfile.name || applicantProfile.label || "申请人"
    const task = await createTask(userId, "tls-apply", `TLS 填表提交 · ${profileLabel}`, {
      applicantProfileId,
      applicantName: profileLabel,
    })
    const outputId = `fv-tls-apply-${task.task_id}`
    const outputDir = path.join(outputBase, outputId)
    await fs.mkdir(outputDir, { recursive: true })

    let applicantsBytes: Buffer
    if (applicants instanceof File) {
      applicantsBytes = Buffer.from(await applicants.arrayBuffer())
    } else {
      const storedApplicants = await getApplicantProfileFileByCandidates(userId, applicantProfileId, [
        "franceApplicationJson",
      ])
      if (!storedApplicants) {
        return NextResponse.json(
          { success: false, error: "该档案没有生成新申请 JSON，请先执行“生成新申请”或手动上传 applicants 文件" },
          { status: 400 },
        )
      }
      applicantsBytes = await fs.readFile(storedApplicants.absolutePath)
    }

    const applicantsPath = path.join(outputDir, "applicants.json")
    await fs.writeFile(applicantsPath, applicantsBytes)

    const applicantsParsed = JSON.parse(await fs.readFile(applicantsPath, "utf-8"))
    if (!Array.isArray(applicantsParsed) || applicantsParsed.length === 0) {
      return NextResponse.json({ success: false, error: "applicants.json 必须是非空数组" }, { status: 400 })
    }

    const captchaConfig = getCaptchaConfig()
    const captchaDiag = getCaptchaDiagnostics()
    if (!captchaDiag.hasCapsolverKey && !captchaDiag.has2captchaKey) {
      return NextResponse.json(
        {
          success: false,
          error: "未配置验证码密钥：请在 .env.local 设置 CAPSOLVER_API_KEY（推荐）或 TWOCAPTCHA_API_KEY/CAPTCHA_API_KEY。",
          captcha: { provider: captchaConfig.captcha_provider, ...captchaDiag },
        },
        { status: 400 },
      )
    }
    const ucConfig = getUcConfig()
    const debugHoldBrowserMs = Number.parseInt(process.env.TLS_APPLY_DEBUG_HOLD_BROWSER_MS || "0", 10)
    const profileTtlSeconds = Number.parseInt(process.env.TLS_APPLY_PROFILE_TTL_SECONDS || "3600", 10)
    const jobObj: Record<string, unknown> = {
      location,
      account: { email, password },
      applicants_path: "applicants.json",
      captcha_provider: captchaConfig.captcha_provider,
      capsolver_api_key: captchaConfig.capsolver_api_key,
      twocaptcha_api_key: captchaConfig.twocaptcha_api_key,
      browser_channel: "chrome",
      headless: false,
      slow_mo_ms: 80,
      navigation_timeout_ms: 60000,
      post_navigation_wait_ms: 1500,
      max_runtime_ms: TLS_APPLY_MAX_RUNTIME_MS,
      user_data_dir: ".tls_apply_profile",
      fresh_profile_each_run: false,
      profile_ttl_seconds: Number.isFinite(profileTtlSeconds) ? Math.max(0, profileTtlSeconds) : 3600,
      results_path: "apply_results.json",
      artifacts_dir: "artifacts",
      debug_hold_browser_ms: Number.isFinite(debugHoldBrowserMs) ? Math.max(0, debugHoldBrowserMs) : 0,
      ...(ucConfig.uc_chromedriver_path ? { uc_chromedriver_path: ucConfig.uc_chromedriver_path } : {}),
      ...(ucConfig.uc_chrome_version ? { uc_chrome_version: ucConfig.uc_chrome_version } : {}),
      ...(ucConfig.proxy ? { proxy: ucConfig.proxy } : {}),
    }

    const jobPath = path.join(outputDir, "tls_apply_job.json")
    await fs.writeFile(jobPath, JSON.stringify(jobObj, null, 2), "utf-8")

    await updateTask(task.task_id, {
      status: "running",
      progress: 5,
      message: "开始 TLS 填表提交...",
      result: {
        success: true,
        captcha: { provider: captchaConfig.captcha_provider, ...captchaDiag },
      },
    })

    void (async () => {
      const tlsApplyScript = "D:/Ai-user/tls_auto/tls_apply.py"
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      let didTimeout = false

      const pythonProc = spawn("python", ["-u", tlsApplyScript, "--job", jobPath], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      })

      pythonProc.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(Buffer.from(chunk)))
      pythonProc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(Buffer.from(chunk)))

      const timeoutId = setTimeout(() => {
        didTimeout = true
        try {
          pythonProc.kill("SIGTERM")
        } catch {
          // ignore
        }
        setTimeout(() => {
          try {
            pythonProc.kill("SIGKILL")
          } catch {
            // ignore
          }
        }, 5000)
      }, TLS_APPLY_PROCESS_TIMEOUT_MS)

      const exitCode = await new Promise<number>((resolve) => {
        pythonProc.on("close", (code) => resolve(typeof code === "number" ? code : 1))
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

      const applyResultsPath = path.join(outputDir, "apply_results.json")
      let parsed: unknown = null
      let parseError: string | null = null
      try {
        parsed = JSON.parse(await fs.readFile(applyResultsPath, "utf-8"))
      } catch (error) {
        parseError = error instanceof Error ? error.message : String(error)
      }

      const debugDownloads = await collectDebugDownloads(outputDir, outputId)
      const stderrDownload = debugDownloads.find((item) => item.filename === "runner_stderr.log")?.url
      const stdoutDownload = debugDownloads.find((item) => item.filename === "runner_stdout.log")?.url
      const failureMessage = didTimeout ? "TLS 填表超时，已自动停止" : "TLS 填表失败"
      const failureDetail = didTimeout
        ? `TLS 填表超过 ${Math.round(TLS_APPLY_PROCESS_TIMEOUT_MS / 1000)} 秒仍未完成，系统已自动停止。`
        : parseError || stderrLog.trim().slice(-1200) || stdoutLog.trim().slice(-1200) || `退出码 ${exitCode}`
      const normalizedFailureDetail = refineApplyFailureDetail(failureDetail)

      if (exitCode !== 0 || !parsed) {
        await updateTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: failureMessage,
          error: normalizedFailureDetail,
          result: {
            success: false,
            message: didTimeout ? "TLS 填表超时，已自动停止，并保留了调试文件。" : "TLS 填表失败，已保存调试文件。",
            download_log: stderrDownload || stdoutDownload,
            download_artifacts: debugDownloads,
          },
        })
        return
      }

      await updateTask(task.task_id, {
        status: "completed",
        progress: 100,
        message: "TLS 填表提交完成",
        result: {
          success: true,
          results: parsed,
          download_log: stderrDownload || stdoutDownload,
          download_artifacts: debugDownloads,
        },
      })
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "已创建 TLS 填表任务，请在下方任务列表查看进度。",
    })
  } catch (error) {
    console.error("tls-apply error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

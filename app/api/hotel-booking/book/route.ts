import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"

import { authOptions } from "@/lib/auth"
import { createHotelBookingTask, updateHotelBookingTask } from "@/lib/hotel-booking-tasks"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BOOKING_MAX_RUNTIME_MS = 240000
const BOOKING_PROCESS_TIMEOUT_MS = 270000

function getHotelBookingDefaults() {
  const bookingEmail =
    process.env.HOTEL_BOOKING_EMAIL ||
    process.env.BOOKING_COM_EMAIL ||
    process.env.SMTP_USER ||
    ""
  const bookingPassword =
    process.env.HOTEL_BOOKING_PASSWORD ||
    process.env.BOOKING_COM_PASSWORD ||
    ""
  const imapServer =
    process.env.HOTEL_BOOKING_IMAP_SERVER ||
    process.env.IMAP_SERVER ||
    "imap.163.com"
  const imapPort =
    process.env.HOTEL_BOOKING_IMAP_PORT ||
    process.env.IMAP_PORT ||
    "993"
  const imapUsername =
    process.env.HOTEL_BOOKING_IMAP_USERNAME ||
    process.env.IMAP_USERNAME ||
    bookingEmail
  const imapPassword =
    process.env.HOTEL_BOOKING_IMAP_PASSWORD ||
    process.env.IMAP_PASSWORD ||
    process.env.SMTP_PASSWORD ||
    ""
  const imapMaxWaitSec =
    process.env.HOTEL_BOOKING_IMAP_MAX_WAIT_SEC ||
    process.env.IMAP_MAX_WAIT_SEC ||
    "90"

  return {
    bookingEmail,
    bookingPassword,
    imapServer,
    imapPort,
    imapUsername,
    imapPassword,
    imapMaxWaitSec,
  }
}

interface DebugDownload {
  label: string
  filename: string
  url: string
}

function artifactLabel(filename: string) {
  if (filename === "payment_handoff.json") return "支付页人工接手包"
  const ext = path.extname(filename).toLowerCase()
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return `截图 · ${filename}`
  if (ext === ".html") return `页面 HTML · ${filename}`
  if (ext === ".log") return `运行日志 · ${filename}`
  if (ext === ".json") return `调试 JSON · ${filename}`
  if (ext === ".pdf") return `预订确认单 · ${filename}`
  return `调试文件 · ${filename}`
}

async function collectDebugDownloads(outputDir: string, outputId: string): Promise<DebugDownload[]> {
  const results: DebugDownload[] = []
  const seen = new Set<string>()

  const pushFile = async (absolutePath: string, filename: string) => {
    try { await fs.access(absolutePath) } catch { return }
    if (seen.has(filename)) return
    seen.add(filename)
    results.push({
      label: artifactLabel(filename),
      filename,
      url: `/api/hotel-booking/download/${outputId}/${encodeURIComponent(filename)}`,
    })
  }

  await pushFile(path.join(outputDir, "runner_stdout.log"), "runner_stdout.log")
  await pushFile(path.join(outputDir, "runner_stderr.log"), "runner_stderr.log")
  await pushFile(path.join(outputDir, "booking_results.json"), "booking_results.json")
  await pushFile(path.join(outputDir, "payment_handoff.json"), "payment_handoff.json")
  await pushFile(path.join(outputDir, "booking_confirmation.pdf"), "booking_confirmation.pdf")

  const artifactsDir = path.join(outputDir, "artifacts")
  try {
    const entries = await fs.readdir(artifactsDir, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile()) continue
      await pushFile(path.join(artifactsDir, entry.name), entry.name)
    }
  } catch { /* ignore */ }

  return results
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json()
    const defaults = getHotelBookingDefaults()
    const {
      booking_email,
      booking_password,
      city,
      checkin_date,
      checkout_date,
      adults = 1,
      rooms = 1,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_address1 = "",
      guest_city_addr = "",
      guest_zip = "",
      guest_country_code = "cn",
      guest_phone_country_code = "86",
      guest_phone = "",
      travel_purpose = "leisure",
      credit_card_number,
      credit_card_expiry_month,
      credit_card_expiry_year,
      credit_card_cvv,
      credit_card_holder,
      filter_no_prepayment = true,
      sort_by = "price",
      max_price_per_night = null,
      headless = false,
      pause_before_payment = true,
      // IMAP 自动收取验证码
      imap_server,
      imap_port = 993,
      imap_username,
      imap_password,
      imap_max_wait_sec = 90,
    } = body as Record<string, unknown>

    const resolvedBookingEmail = String(booking_email || defaults.bookingEmail).trim()
    const resolvedBookingPassword = String(booking_password || defaults.bookingPassword).trim()
    const resolvedImapServer = String(imap_server || defaults.imapServer).trim()
    const resolvedImapPort = String(imap_port || defaults.imapPort).trim()
    const resolvedImapUsername = String(imap_username || defaults.imapUsername).trim()
    const resolvedImapPassword = String(imap_password || defaults.imapPassword).trim()
    const resolvedImapMaxWaitSec = Number(imap_max_wait_sec || defaults.imapMaxWaitSec || 90)

    if (!resolvedBookingEmail || !resolvedBookingPassword) {
      return NextResponse.json({ success: false, error: "请提供 Booking.com 账号和密码" }, { status: 400 })
    }
    if (!city) {
      return NextResponse.json({ success: false, error: "请填写目的城市" }, { status: 400 })
    }
    if (!checkin_date || !checkout_date) {
      return NextResponse.json({ success: false, error: "请填写入住和离店日期" }, { status: 400 })
    }
    if (!guest_first_name || !guest_last_name) {
      return NextResponse.json({ success: false, error: "请填写入住人姓名" }, { status: 400 })
    }

    const guestName = `${guest_first_name} ${guest_last_name}`.trim()
    const task = await createHotelBookingTask(
      {
        userId,
        city: String(city),
        checkin_date: String(checkin_date),
        checkout_date: String(checkout_date),
        guest_name: guestName,
      },
      "酒店预订任务已创建"
    )

    const outputBase = path.join(process.cwd(), "temp", "hotel-booking")
    const outputId = `hotel-${task.task_id}`
    const outputDir = path.join(outputBase, outputId)
    await fs.mkdir(outputDir, { recursive: true })
    const artifactsDir = path.join(outputDir, "artifacts")
    await fs.mkdir(artifactsDir, { recursive: true })

    const proxy = process.env.HOTEL_BOOKING_PROXY || process.env.TLS_PROXY || process.env.HTTPS_PROXY || ""
    const useHeadless = headless || process.env.HOTEL_BOOKING_HEADLESS === "true"

    const jobObj: Record<string, unknown> = {
      booking_email: resolvedBookingEmail,
      booking_password: resolvedBookingPassword,
      // IMAP（仅在配置了才传入）
      ...(resolvedImapServer && resolvedImapUsername && resolvedImapPassword
        ? {
            imap_server: resolvedImapServer,
            imap_port: resolvedImapPort,
            imap_username: resolvedImapUsername,
            imap_password: resolvedImapPassword,
            imap_max_wait_sec: resolvedImapMaxWaitSec,
          }
        : {}),
      city,
      checkin_date,
      checkout_date,
      adults,
      rooms,
      guest_first_name,
      guest_last_name,
      guest_email: guest_email || resolvedBookingEmail,
      guest_address1,
      guest_city_addr,
      guest_zip,
      guest_country_code,
      guest_phone_country_code,
      guest_phone,
      travel_purpose,
      credit_card_number: credit_card_number || "",
      credit_card_expiry_month: credit_card_expiry_month || "",
      credit_card_expiry_year: credit_card_expiry_year || "",
      credit_card_cvv: credit_card_cvv || "",
      credit_card_holder: credit_card_holder || guestName,
      filter_no_prepayment,
      sort_by,
      max_price_per_night,
      headless: useHeadless,
      pause_before_payment,
      debug_pause_before_payment: pause_before_payment,
      proxy: proxy.trim(),
      slow_mo_ms: 600,
      navigation_timeout_ms: 60000,
      results_path: path.join(outputDir, "booking_results.json"),
      artifacts_dir: artifactsDir,
    }

    const jobPath = path.join(outputDir, "booking_job.json")
    await fs.writeFile(jobPath, JSON.stringify(jobObj, null, 2), "utf-8")

    await updateHotelBookingTask(task.task_id, {
      status: "running",
      progress: 5,
      message: "正在启动浏览器自动化...",
    })

    // 后台运行，立即返回 task_id
    void (async () => {
      const scriptPath = path.join(process.cwd(), "services", "hotel-booking", "booking_auto.py")
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      let didTimeout = false

      const proc = spawn("python", ["-u", scriptPath, "--job", jobPath], {
        cwd: outputDir,
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      })

      // 解析进度输出
      proc.stdout?.on("data", (chunk: Buffer) => {
        stdoutChunks.push(Buffer.from(chunk))
        const text = chunk.toString("utf-8")
        for (const line of text.split("\n")) {
          const m = line.match(/^PROGRESS:(\d+):(.*)$/)
          if (m) {
            const pct = Math.min(99, parseInt(m[1], 10))
            const msg = m[2].trim()
            updateHotelBookingTask(task.task_id, { progress: pct, message: msg }).catch(() => {})
          }
        }
      })
      proc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(Buffer.from(chunk)))

      const timeoutId = setTimeout(() => {
        didTimeout = true
        try { proc.kill("SIGTERM") } catch { /* ignore */ }
        setTimeout(() => { try { proc.kill("SIGKILL") } catch { /* ignore */ } }, 5000)
      }, BOOKING_PROCESS_TIMEOUT_MS)

      const exitCode = await new Promise<number>((resolve) => {
        proc.on("close", (code) => resolve(typeof code === "number" ? code : 1))
        proc.on("error", () => resolve(1))
      }).finally(() => clearTimeout(timeoutId))

      const stdoutLog = Buffer.concat(stdoutChunks).toString("utf-8")
      const stderrLog = Buffer.concat(stderrChunks).toString("utf-8")
      if (stdoutLog.trim()) await fs.writeFile(path.join(outputDir, "runner_stdout.log"), stdoutLog, "utf-8").catch(() => {})
      if (stderrLog.trim()) await fs.writeFile(path.join(outputDir, "runner_stderr.log"), stderrLog, "utf-8").catch(() => {})

      const resultsFilePath = path.join(outputDir, "booking_results.json")
      let parsed: Record<string, unknown> | null = null
      try {
        parsed = JSON.parse(await fs.readFile(resultsFilePath, "utf-8"))
      } catch { /* ignore */ }

      const debugDownloads = await collectDebugDownloads(outputDir, outputId)
      const logDownload = debugDownloads.find((d) => d.filename === "runner_stdout.log" || d.filename === "runner_stderr.log")?.url
      const pdfDownload = debugDownloads.find((d) => d.filename === "booking_confirmation.pdf")?.url

      if (exitCode !== 0 || !parsed || !parsed.success) {
        const failDetail = didTimeout
          ? `预订操作超过 ${Math.round(BOOKING_PROCESS_TIMEOUT_MS / 1000)} 秒，已自动停止`
          : (parsed as Record<string, unknown> | null)?.error as string
            || stderrLog.trim().slice(-800)
            || stdoutLog.trim().slice(-800)
            || `退出码 ${exitCode}`
        await updateHotelBookingTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: didTimeout ? "预订超时" : "预订失败",
          error: failDetail,
          result: {
            success: false,
            error: failDetail,
            download_log: logDownload,
            download_artifacts: debugDownloads,
          },
        })
        return
      }

      const hotelName = String(parsed.hotel_name || "")
      const pausedBeforePayment = Boolean(parsed.paused_before_payment)
      await updateHotelBookingTask(task.task_id, {
        status: "completed",
        progress: 100,
        message: pausedBeforePayment
          ? `已到达支付页并暂停${hotelName ? `，酒店：${hotelName}` : ""}`
          : `预订成功！${hotelName ? `酒店：${hotelName}` : ""}${parsed.confirmation_number ? ` 预订号：${parsed.confirmation_number}` : ""}`,
        hotel_name: hotelName,
        result: {
          ...parsed,
          download_log: logDownload,
          download_artifacts: debugDownloads,
          pdf_download: pdfDownload,
        },
      })
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "酒店预订任务已启动，请在下方任务列表查看进度。",
    })
  } catch (error) {
    console.error("hotel-booking error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}

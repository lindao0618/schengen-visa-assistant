import { NextRequest, NextResponse } from "next/server"

import { adminForbiddenResponse, getAdminSession } from "@/lib/admin-auth"
import {
  getFranceReminderAdminSummary,
  listFranceCasesForAdmin,
  listFranceReminderLogsForAdmin,
  updateFranceReminderLogStatus,
} from "@/lib/france-cases"
import { runFranceReminderTasks } from "@/lib/france-reminder-runner"

export const dynamic = "force-dynamic"

const ALLOWED_REMINDER_SEND_STATUSES = new Set([
  "pending",
  "processing",
  "sent",
  "failed",
  "skipped",
])

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")?.trim() || ""
    const mainStatus = searchParams.get("mainStatus") || "all"
    const exceptionCode = searchParams.get("exceptionCode") || "all"
    const reminderStatus = searchParams.get("reminderStatus") || "all"
    const severity = searchParams.get("severity") || "all"
    const automationMode = searchParams.get("automationMode") || "all"
    const channel = searchParams.get("channel") || "all"
    const caseLimit = Math.min(Number(searchParams.get("caseLimit") || "50"), 200)
    const logLimit = Math.min(Number(searchParams.get("logLimit") || "100"), 300)

    const [summary, cases, reminderLogs] = await Promise.all([
      getFranceReminderAdminSummary(),
      listFranceCasesForAdmin({
        search,
        mainStatus,
        exceptionCode,
        limit: caseLimit,
      }),
      listFranceReminderLogsForAdmin({
        search,
        mainStatus,
        sendStatus: reminderStatus,
        severity,
        automationMode,
        channel,
        limit: logLimit,
      }),
    ])

    return NextResponse.json({
      success: true,
      summary,
      cases,
      reminderLogs,
    })
  } catch (error) {
    console.error("获取法签案件后台数据失败:", error)
    return NextResponse.json(
      {
        success: false,
        message: "获取法签案件后台数据失败",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const body = await request.json()
    const logId = typeof body?.logId === "string" ? body.logId.trim() : ""
    const sendStatus =
      typeof body?.sendStatus === "string" ? body.sendStatus.trim().toLowerCase() : ""
    const errorMessage =
      typeof body?.errorMessage === "string" && body.errorMessage.trim().length > 0
        ? body.errorMessage.trim()
        : null
    const renderedContent =
      typeof body?.renderedContent === "string" && body.renderedContent.trim().length > 0
        ? body.renderedContent.trim()
        : null

    if (!logId || !sendStatus || !ALLOWED_REMINDER_SEND_STATUSES.has(sendStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "缺少有效的提醒日志参数",
        },
        { status: 400 },
      )
    }

    const reminderLog = await updateFranceReminderLogStatus({
      logId,
      sendStatus,
      errorMessage,
      renderedContent,
    })

    return NextResponse.json({
      success: true,
      reminderLog,
    })
  } catch (error) {
    console.error("更新提醒日志状态失败:", error)
    return NextResponse.json(
      {
        success: false,
        message: "更新提醒日志状态失败",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === "string" ? body.action.trim() : ""
    const limit = Math.min(Number(body?.limit || "20"), 100)

    if (action !== "process_due_logs") {
      return NextResponse.json(
        {
          success: false,
          message: "不支持的提醒处理动作",
        },
        { status: 400 },
      )
    }

    const taskResult = await runFranceReminderTasks({ limit })
    const result = {
      scanned: taskResult.process.scanned,
      processed: taskResult.process.processed,
      sent: taskResult.process.sent,
      failed: taskResult.process.failed,
      skipped: taskResult.process.skipped,
      scanCreated3Day: taskResult.scan.created3Day,
      scanCreated1Day: taskResult.scan.created1Day,
      scanTotalCreated: taskResult.scan.totalCreated,
      scanScannedCases: taskResult.scan.scanned,
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("处理到期提醒失败:", error)
    return NextResponse.json(
      {
        success: false,
        message: "处理到期提醒失败",
      },
      { status: 500 },
    )
  }
}

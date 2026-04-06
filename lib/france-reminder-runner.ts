import prisma from "@/lib/db"
import { formatFranceExceptionLabel, formatFranceStatusLabel, formatReminderChannelLabel } from "@/lib/france-case-labels"
import { sendEmail, buildReminderEmailContent } from "@/lib/mailer"

type DueReminderLogRecord = Awaited<ReturnType<typeof loadDueReminderLogs>>[number]

function buildReminderGreeting(name: string) {
  return name ? `${name} 您好，` : "您好，"
}

function renderReminderBody(log: DueReminderLogRecord) {
  const applicantName = log.visaCase.applicantProfile.name
  const statusLabel = formatFranceStatusLabel(log.visaCase.mainStatus, log.visaCase.subStatus)
  const exceptionLabel = formatFranceExceptionLabel(log.visaCase.exceptionCode)

  const contextSuffix = exceptionLabel
    ? `当前案件状态为「${statusLabel}」，异常为「${exceptionLabel}」。`
    : `当前案件状态为「${statusLabel}」。`

  switch (log.templateCode) {
    case "payment_success_welcome":
      return `${buildReminderGreeting(applicantName)}已确认收到您的付款，法签服务已正式开始。后续资料准备、表格填写和进度变化都会继续同步给您。`
    case "onboard_day3_enrollment_cert":
      return `${buildReminderGreeting(applicantName)}系统检测到入群已满 72 小时，但在读证明仍未确认上传。请尽快补齐，以免影响后续资料准备。`
    case "prep_day7_balance_check":
      return `${buildReminderGreeting(applicantName)}当前处于前期资料准备阶段，请继续确认近三个月流水、余额和银行卡信息是否满足要求。`
    case "form_24h_not_submitted":
      return `${buildReminderGreeting(applicantName)}表格已发出 24 小时，目前还未回收。请尽快填写并提交，以便进入审核流程。`
    case "form_48h_escalation":
      return `${buildReminderGreeting(applicantName)}表格发出已满 48 小时仍未提交，系统已升级为人工跟进，请尽快处理。`
    case "review_fail_feedback":
      return `${buildReminderGreeting(applicantName)}AI 审核发现资料仍需调整。请根据修改建议补齐后重新提交，我们会继续帮您推进。`
    case "docs_ready_notice":
      return `${buildReminderGreeting(applicantName)}材料已生成完毕，可以进入 TLS / 递签前准备阶段。`
    case "slot_hunting_day3_update":
      return `${buildReminderGreeting(applicantName)}抢号已持续 3 天，目前仍在监控合适日期。若有更新，我们会第一时间同步。`
    case "slot_window_ending":
      return `${buildReminderGreeting(applicantName)}当前抢号时间窗口即将结束，需要人工优先跟进，避免错过可用递签日期。`
    case "slot_booked_payment_notice":
      return `${buildReminderGreeting(applicantName)}已经为您抢到号位，请尽快完成对应付款，以免预约失效。`
    case "tls_payment_2h_escalation":
      return `${buildReminderGreeting(applicantName)}抢号成功后 2 小时内尚未完成 TLS 付款，系统已标记为紧急，请立即处理。`
    case "package_send_t_minus_3":
      return `${buildReminderGreeting(applicantName)}距离递签还有 3 天，递签材料包和注意事项应在今天完成发送与确认。`
    case "t_minus_1_final_reminder":
      return `${buildReminderGreeting(applicantName)}距离递签仅剩 1 天，请再次核对材料、预约时间和出行安排。`
    case "submitted_congrats":
      return `${buildReminderGreeting(applicantName)}恭喜您已完成递签，后续进入等待签证结果阶段。`
    case "submitted_day5_comfort":
      return `${buildReminderGreeting(applicantName)}您的案件已递签满 5 个工作日，目前仍在正常等待结果中，请耐心等待。`
    case "submitted_day15_escalation":
      return `${buildReminderGreeting(applicantName)}案件递签已满 15 个工作日仍未出结果，系统已升级为人工优先跟进。`
    default:
      return `${buildReminderGreeting(applicantName)}这里是一条法签进度提醒。${contextSuffix}`
  }
}

function renderReminderContent(log: DueReminderLogRecord) {
  const channelLabel = formatReminderChannelLabel(log.channel)
  const body = renderReminderBody(log)

  return [
    "【模拟发送】",
    `规则：${log.ruleCode}`,
    `渠道：${channelLabel}`,
    body,
    "",
    `案件状态：${formatFranceStatusLabel(log.visaCase.mainStatus, log.visaCase.subStatus)}`,
    `申请人：${log.visaCase.applicantProfile.name}`,
    `用户：${log.user.email}`,
  ].join("\n")
}

async function loadDueReminderLogs(limit: number) {
  const now = new Date()
  return prisma.reminderLog.findMany({
    where: {
      sendStatus: "pending",
      triggeredAt: { lte: now },
      visaCase: {
        caseType: "france-schengen",
        isActive: true,
      },
    },
    orderBy: [{ triggeredAt: "asc" }],
    take: limit,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      visaCase: {
        select: {
          id: true,
          mainStatus: true,
          subStatus: true,
          exceptionCode: true,
          applicantProfile: {
            select: { id: true, name: true },
          },
        },
      },
      rule: {
        select: {
          id: true,
          name: true,
          ruleCode: true,
        },
      },
    },
  })
}

export async function processDueFranceReminderLogs(options?: { limit?: number }) {
  const limit = Math.min(options?.limit ?? 20, 100)
  const dueLogs = await loadDueReminderLogs(limit)

  let processed = 0
  let sent = 0
  let failed = 0
  let skipped = 0
  const results: Array<{
    logId: string
    ruleCode: string
    sendStatus: string
    errorMessage?: string
  }> = []

  for (const log of dueLogs) {
    const claimed = await prisma.reminderLog.updateMany({
      where: {
        id: log.id,
        sendStatus: "pending",
      },
      data: {
        sendStatus: "processing",
      },
    })

    if (claimed.count === 0) {
      skipped += 1
      results.push({
        logId: log.id,
        ruleCode: log.ruleCode,
        sendStatus: "skipped",
      })
      continue
    }

    try {
      const renderedContent = renderReminderContent(log)

      // 检查是否需要发送邮件
      if (log.channel.includes("EMAIL")) {
        // 获取收件人邮箱
        const toEmail = log.user.email
        if (toEmail) {
          const subject = "【法签提醒】" + log.ruleCode
          const body = renderReminderBody(log)
          const statusLabel = formatFranceStatusLabel(log.visaCase.mainStatus, log.visaCase.subStatus)

          const emailContent = buildReminderEmailContent(log.visaCase.applicantProfile.name, body, statusLabel)

          await sendEmail({
            to: toEmail,
            subject,
            text: emailContent.text,
            html: emailContent.html,
          })
        }
      }

      await prisma.reminderLog.update({
        where: { id: log.id },
        data: {
          sendStatus: "sent",
          renderedContent,
          errorMessage: null,
          sentAt: new Date(),
        },
      })

      processed += 1
      sent += 1
      results.push({
        logId: log.id,
        ruleCode: log.ruleCode,
        sendStatus: "sent",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "发送失败"
      await prisma.reminderLog.update({
        where: { id: log.id },
        data: {
          sendStatus: "failed",
          errorMessage,
          sentAt: null,
        },
      })

      processed += 1
      failed += 1
      results.push({
        logId: log.id,
        ruleCode: log.ruleCode,
        sendStatus: "failed",
        errorMessage,
      })
    }
  }

  return {
    scanned: dueLogs.length,
    processed,
    sent,
    failed,
    skipped,
    results,
  }
}

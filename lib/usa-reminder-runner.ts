import prisma from "@/lib/db"
import { formatUsaStatusLabel } from "@/lib/usa-case-labels"
import { sendEmail, buildReminderEmailContent } from "@/lib/mailer"

type DueReminderLogRecord = Awaited<ReturnType<typeof loadDueReminderLogs>>[number]

function buildReminderGreeting(name: string) {
  return name ? `${name} 您好，` : "您好，"
}

function renderReminderBody(log: DueReminderLogRecord) {
  const applicantName = log.visaCase.applicantProfile.name
  const statusLabel = formatUsaStatusLabel(log.visaCase.mainStatus, log.visaCase.subStatus)
  const slotDate = log.visaCase.slotTime

  switch (log.templateCode) {
    case "payment_success_welcome":
      return `${buildReminderGreeting(applicantName)}已确认收到您的付款，美签服务已正式开始。后续资料准备、表格填写和进度变化都会继续同步给您。`
    case "package_send_t_minus_3":
      const daysLeft = slotDate ? Math.ceil((slotDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 3
      return `${buildReminderGreeting(applicantName)}距离面签还有 ${daysLeft} 天，面签材料包和注意事项应在今天完成发送与确认。请确保所有材料已准备完毕！`
    case "t_minus_1_final_reminder":
      return `${buildReminderGreeting(applicantName)}距离面签仅剩 1 天，请再次核对材料、预约时间和出行安排。祝您面签顺利！`
    case "submitted_congrats":
      return `${buildReminderGreeting(applicantName)}恭喜您已完成面签，后续进入等待签证结果阶段。我们会及时通知您结果！`
    case "visa_approved_notify":
      return `${buildReminderGreeting(applicantName)}好消息！您的签证已通过，请联系我们领取。`
    case "form_24h_not_submitted":
      return `${buildReminderGreeting(applicantName)}表格已发出 24 小时，目前还未回收。请尽快填写并提交，以便进入审核流程。`
    case "form_48h_escalation":
      return `${buildReminderGreeting(applicantName)}表格发出已满 48 小时仍未提交，系统已升级为人工跟进，请尽快处理。`
    case "service_closed_review_invite":
      return `${buildReminderGreeting(applicantName)}您的签证服务已完成，如果对我们的服务满意，欢迎给个好评！`
    default:
      return `${buildReminderGreeting(applicantName)}这里是一条美签进度提醒。当前案件状态为「${statusLabel}」。`
  }
}

function renderReminderContent(log: DueReminderLogRecord) {
  const body = renderReminderBody(log)

  return [
    "【美签提醒】",
    `规则：${log.ruleCode}`,
    body,
    "",
    `案件状态：${formatUsaStatusLabel(log.visaCase.mainStatus, log.visaCase.subStatus)}`,
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
        caseType: "usa-visa",
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
          slotTime: true,
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

// 定时扫描任务：扫描所有有 slotTime 但尚未到日期的美签案件，创建提醒
export async function scanUsaCasesForSlotReminders() {
  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const oneDayLater = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

  // 查找所有有 slotTime 的活跃美签案件
  const usaCases = await prisma.visaCase.findMany({
    where: {
      caseType: "usa-visa",
      isActive: true,
      slotTime: { not: null },
      mainStatus: {
        in: ["SLOT_BOOKED", "DOCS_READY"],
      },
    },
    include: {
      applicantProfile: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, name: true } },
      reminderLogs: {
        where: {
          ruleCode: { in: ["PACKAGE_SEND_T_MINUS_3", "T_MINUS_1_FINAL_REMINDER"] },
          triggeredAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
    },
  })

  let created3Day = 0
  let created1Day = 0
  let skipped = 0

  await Promise.all(
    usaCases.map(async (visaCase) => {
      if (!visaCase.slotTime) return

      const slotTime = visaCase.slotTime
      const has3DayReminder = visaCase.reminderLogs.some((r) => r.ruleCode === "PACKAGE_SEND_T_MINUS_3")
      const has1DayReminder = visaCase.reminderLogs.some((r) => r.ruleCode === "T_MINUS_1_FINAL_REMINDER")

      // 距离面签3天时的提醒
      const threeDaysBeforeSlot = new Date(slotTime.getTime() - 3 * 24 * 60 * 60 * 1000)
      if (!has3DayReminder && threeDaysBeforeSlot <= now && now <= slotTime) {
        await prisma.reminderRule.findFirst({ where: { ruleCode: "PACKAGE_SEND_T_MINUS_3" } }).then(async (rule) => {
          if (rule) {
            await prisma.reminderLog.create({
              data: {
                caseId: visaCase.id,
                ruleId: rule.id,
                userId: visaCase.userId,
                ruleCode: "PACKAGE_SEND_T_MINUS_3",
                channel: "WECHAT",
                automationMode: "AUTO",
                severity: "NORMAL",
                templateCode: "package_send_t_minus_3",
                sendStatus: "pending",
                triggeredAt: now,
              },
            })
            created3Day++
          }
        })
      }

      // 距离面签1天时的提醒
      const oneDayBeforeSlot = new Date(slotTime.getTime() - 1 * 24 * 60 * 60 * 1000)
      if (!has1DayReminder && oneDayBeforeSlot <= now && now <= slotTime) {
        await prisma.reminderRule.findFirst({ where: { ruleCode: "T_MINUS_1_FINAL_REMINDER" } }).then(async (rule) => {
          if (rule) {
            await prisma.reminderLog.create({
              data: {
                caseId: visaCase.id,
                ruleId: rule.id,
                userId: visaCase.userId,
                ruleCode: "T_MINUS_1_FINAL_REMINDER",
                channel: "WECHAT",
                automationMode: "AUTO",
                severity: "NORMAL",
                templateCode: "t_minus_1_final_reminder",
                sendStatus: "pending",
                triggeredAt: now,
              },
            })
            created1Day++
          }
        })
      }

      if (!created3Day && !created1Day) skipped++
    }),
  )

  return {
    scanned: usaCases.length,
    created3Day,
    created1Day,
    skipped,
    totalCreated: created3Day + created1Day,
  }
}

export async function processDueUsaReminderLogs(options?: { limit?: number }) {
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
          const subject = "【美签提醒】" + log.ruleCode
          const body = renderReminderBody(log)
          const statusLabel = formatUsaStatusLabel(log.visaCase.mainStatus, log.visaCase.subStatus)

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

// 统一的扫描+处理入口
export async function runUsaReminderTasks(options?: { limit?: number }) {
  const scanResult = await scanUsaCasesForSlotReminders()
  const processResult = await processDueUsaReminderLogs(options)

  return {
    scan: scanResult,
    process: processResult,
  }
}

import { UsaMainStatus, UsaSubStatus } from "@/lib/usa-case-machine"

const USA_MAIN_STATUS_LABELS: Record<UsaMainStatus, string> = {
  PENDING_PAYMENT: "待付款",
  ONBOARDED: "已入群",
  PRE_PREP: "前期准备",
  FORM_IN_PROGRESS: "表格填写中",
  REVIEWING: "审核中",
  DOCS_READY: "材料已准备",
  SLOT_BOOKED: "已预约",
  SUBMITTED: "已面签",
  COMPLETED: "已完成",
}

const USA_SUB_STATUS_LABELS: Record<UsaSubStatus, string> = {
  QUOTE_SENT: "报价已发送",
  GROUP_CREATED: "已入群",
  BANK_CARD_PENDING: "银行卡待确认",
  BALANCE_PREPARING: "余额准备中",
  FORM_SENT: "表格已发出",
  FORM_RECEIVED: "表格已回收",
  AI_REVIEWING: "AI审核中",
  HUMAN_REVIEWING: "人工审核中",
  DOCS_GENERATED: "材料已生成",
  SLOT_HUNTING: "抢号中",
  PENDING_SUBMISSION: "待递交",
  DOCS_SENT: "材料已寄出",
  AWAITING_INTERVIEW: "等待面签",
  APPROVED_NOTIFIED: "已通知通过",
  SERVICE_CLOSED: "服务已关闭",
}

export function formatUsaMainStatusLabel(mainStatus: string | null | undefined) {
  if (!mainStatus) return "未设置"
  return USA_MAIN_STATUS_LABELS[mainStatus as UsaMainStatus] || mainStatus
}

export function formatUsaSubStatusLabel(subStatus: string | null | undefined) {
  if (!subStatus) return "无"
  return USA_SUB_STATUS_LABELS[subStatus as UsaSubStatus] || subStatus
}

export function formatUsaStatusLabel(mainStatus: string | null | undefined, subStatus: string | null | undefined) {
  const mainLabel = formatUsaMainStatusLabel(mainStatus)
  const subLabel = formatUsaSubStatusLabel(subStatus)
  return subLabel !== "无" ? `${mainLabel} - ${subLabel}` : mainLabel
}

// 异常状态标签
const USA_EXCEPTION_LABELS: Record<string, string> = {
  PAYMENT_TIMEOUT: "付款超时",
  BANK_CARD_MISSING: "银行卡缺失",
  BALANCE_INSUFFICIENT: "余额不足",
  FORM_TIMEOUT: "表格超时",
  REVIEW_FAILED: "审核失败",
  DOCS_REGENERATE_REQUIRED: "需要重新生成材料",
  SLOT_TIMEOUT: "抢号超时",
  VISA_RESULT_DELAYED: "签证结果延迟",
}

export function formatUsaExceptionLabel(exceptionCode: string | null | undefined) {
  if (!exceptionCode) return "无"
  return USA_EXCEPTION_LABELS[exceptionCode] || exceptionCode
}

// 提醒相关标签
export function formatReminderAutomationModeLabel(automationMode: string | null | undefined) {
  if (!automationMode) return "无"
  const labels: Record<string, string> = {
    AUTO: "全自动",
    MANUAL: "人工介入",
  }
  return labels[automationMode] || automationMode
}

export function formatReminderChannelLabel(channel: string | null | undefined) {
  if (!channel) return "无"
  const labels: Record<string, string> = {
    WECHAT: "微信",
    EMAIL: "邮件",
    INTERNAL: "内部提醒",
  }
  return labels[channel] || channel
}

export function formatReminderSeverityLabel(severity: string | null | undefined) {
  if (!severity) return "无"
  const labels: Record<string, string> = {
    NORMAL: "普通",
    URGENT: "紧急",
  }
  return labels[severity] || severity
}

// 更新 ApplicantProfile 字段标签
export function getUsaVisaFieldLabel(field: string) {
  const labels: Record<string, string> = {
    usVisaAaCode: "AA码",
    usVisaSurname: "申请人姓氏 (英文)",
    usVisaGivenName: "申请人名字 (英文)",
    usVisaBirthYear: "出生年份",
    usVisaPassportNumber: "护照号",
    usVisaPassportExpiry: "护照有效期",
    usVisaSlotTime: "面签时间",
    usVisaConsulate: "使领馆",
    usVisaCategory: "签证类别",
    usVisaPurpose: "出行目的",
  }
  return labels[field] || field
}

// 格式化面签时间显示
export function formatUsaSlotTime(slotTime: Date | null | undefined) {
  if (!slotTime) return "未预约"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(slotTime)
}

export function formatUsaStatusSummary(visaCase: { mainStatus?: string; subStatus?: string; slotTime?: Date | null }) {
  const statusLabel = formatUsaStatusLabel(visaCase.mainStatus, visaCase.subStatus)
  if (visaCase.slotTime) {
    return `${statusLabel} (${formatUsaSlotTime(visaCase.slotTime)})`
  }
  return statusLabel
}

import type {
  FranceExceptionCode,
  FranceMainStatus,
  FranceSubStatus,
} from "@/lib/france-case-machine"

export const FRANCE_MAIN_STATUS_LABELS: Record<FranceMainStatus, string> = {
  PENDING_PAYMENT: "待付款",
  ONBOARDED: "已付款 / 已入群",
  PRE_PREP: "前期资料准备",
  FORM_IN_PROGRESS: "表格阶段",
  REVIEWING: "审核中",
  DOCS_READY: "材料已就绪",
  TLS_PROCESSING: "TLS 处理中",
  SLOT_BOOKED: "已获取 Slot",
  SUBMITTED: "已递签",
  COMPLETED: "已完成",
}

export const FRANCE_SUB_STATUS_LABELS: Record<FranceSubStatus, string> = {
  QUOTE_SENT: "报价已发送",
  GROUP_CREATED: "服务群已建立",
  BANK_CARD_PENDING: "待办银行卡",
  BALANCE_PREPARING: "余额准备中",
  FORM_SENT: "表格已发送",
  FORM_RECEIVED: "表格已回收",
  AI_REVIEWING: "AI 审核中",
  HUMAN_REVIEWING: "人工复核中",
  DOCS_GENERATED: "材料已生成",
  TLS_REGISTERING: "TLS / FV 注册中",
  FV_FILLING: "FV 填表中",
  SLOT_HUNTING: "正在抢号",
  PENDING_SUBMISSION: "待提交",
  WAITING_TLS_PAYMENT: "等待 TLS 付款",
  PACKAGE_SENT: "已提交给 Slot 外包商",
  AWAITING_VISA: "等待出签",
  APPROVED_NOTIFIED: "已通知出签",
  SERVICE_CLOSED: "服务已关闭",
}

export const FRANCE_EXCEPTION_LABELS: Record<FranceExceptionCode, string> = {
  PAYMENT_TIMEOUT: "付款超时",
  BANK_CARD_MISSING: "缺少银行卡",
  BALANCE_INSUFFICIENT: "余额不足",
  FORM_TIMEOUT: "表格超时",
  REVIEW_FAILED: "审核未通过",
  DOCS_REGENERATE_REQUIRED: "材料需重新生成",
  TLS_REGISTER_FAILED: "TLS 注册失败",
  FV_FILL_FAILED: "FV 填写失败",
  SLOT_TIMEOUT: "抢号超时",
  TLS_PAYMENT_TIMEOUT: "TLS 付款超时",
  DOCS_INCOMPLETE: "材料不完整",
  VISA_RESULT_DELAYED: "出签结果延迟",
}

export const REMINDER_SEND_STATUS_LABELS: Record<string, string> = {
  pending: "待触发",
  processing: "处理中",
  sent: "已发送",
  failed: "发送失败",
  skipped: "已跳过",
}

export const REMINDER_AUTOMATION_MODE_LABELS: Record<string, string> = {
  AUTO: "全自动",
  MANUAL: "人工介入",
}

export const REMINDER_SEVERITY_LABELS: Record<string, string> = {
  NORMAL: "普通",
  URGENT: "紧急",
}

export const REMINDER_CHANNEL_LABELS: Record<string, string> = {
  WECHAT: "微信",
  EMAIL: "邮件",
  INTERNAL: "内部提醒",
}

export function formatFranceMainStatusLabel(status?: string | null) {
  if (!status) return "未开始"
  return FRANCE_MAIN_STATUS_LABELS[status as FranceMainStatus] || status
}

export function formatFranceSubStatusLabel(status?: string | null) {
  if (!status) return ""
  return FRANCE_SUB_STATUS_LABELS[status as FranceSubStatus] || status
}

export function formatFranceExceptionLabel(code?: string | null) {
  if (!code) return ""
  return FRANCE_EXCEPTION_LABELS[code as FranceExceptionCode] || code
}

export function formatFranceStatusLabel(mainStatus?: string | null, subStatus?: string | null) {
  const main = formatFranceMainStatusLabel(mainStatus)
  const sub = formatFranceSubStatusLabel(subStatus)
  return sub ? `${main} / ${sub}` : main
}

export function formatReminderChannelLabel(channel?: string | null) {
  if (!channel) return "未指定"
  if (channel.includes(",")) {
    return channel
      .split(",")
      .map((item) => REMINDER_CHANNEL_LABELS[item] || item)
      .join(" / ")
  }
  return REMINDER_CHANNEL_LABELS[channel] || channel
}

export function formatReminderAutomationModeLabel(mode?: string | null) {
  if (!mode) return "未指定"
  return REMINDER_AUTOMATION_MODE_LABELS[mode] || mode
}

export function formatReminderSeverityLabel(severity?: string | null) {
  if (!severity) return "普通"
  return REMINDER_SEVERITY_LABELS[severity] || severity
}

export function formatReminderSendStatusLabel(status?: string | null) {
  if (!status) return "待触发"
  return REMINDER_SEND_STATUS_LABELS[status] || status
}

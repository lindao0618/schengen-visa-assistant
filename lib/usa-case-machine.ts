export const USA_CASE_TYPE = "usa-visa" as const

export const USA_MAIN_STATUSES = [
  "PENDING_PAYMENT",
  "ONBOARDED",
  "PRE_PREP",
  "FORM_IN_PROGRESS",
  "REVIEWING",
  "DOCS_READY",
  "SLOT_BOOKED",
  "SUBMITTED",
  "COMPLETED",
] as const

export type UsaMainStatus = (typeof USA_MAIN_STATUSES)[number]

export const USA_SUB_STATUSES = [
  "QUOTE_SENT",
  "GROUP_CREATED",
  "BANK_CARD_PENDING",
  "BALANCE_PREPARING",
  "FORM_SENT",
  "FORM_RECEIVED",
  "AI_REVIEWING",
  "HUMAN_REVIEWING",
  "DOCS_GENERATED",
  "SLOT_HUNTING",
  "PENDING_SUBMISSION",
  "DOCS_SENT",
  "AWAITING_INTERVIEW",
  "APPROVED_NOTIFIED",
  "SERVICE_CLOSED",
] as const

export type UsaSubStatus = (typeof USA_SUB_STATUSES)[number]

export const USA_EXCEPTION_CODES = [
  "PAYMENT_TIMEOUT",
  "BANK_CARD_MISSING",
  "BALANCE_INSUFFICIENT",
  "FORM_TIMEOUT",
  "REVIEW_FAILED",
  "DOCS_REGENERATE_REQUIRED",
  "SLOT_TIMEOUT",
  "VISA_RESULT_DELAYED",
] as const

export type UsaExceptionCode = (typeof USA_EXCEPTION_CODES)[number]

export const REMINDER_TRIGGER_TYPES = [
  "status_enter",
  "duration_reached",
  "date_offset",
  "field_missing",
] as const

export type ReminderTriggerType = (typeof REMINDER_TRIGGER_TYPES)[number]

export const REMINDER_CHANNELS = ["WECHAT", "EMAIL", "INTERNAL"] as const
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number]

export const REMINDER_AUTOMATION_MODES = ["AUTO", "MANUAL"] as const
export type ReminderAutomationMode = (typeof REMINDER_AUTOMATION_MODES)[number]

export const REMINDER_SEVERITIES = ["NORMAL", "URGENT"] as const
export type ReminderSeverity = (typeof REMINDER_SEVERITIES)[number]

export const USA_MAIN_STATUS_RANK: Record<UsaMainStatus, number> = {
  PENDING_PAYMENT: 1,
  ONBOARDED: 2,
  PRE_PREP: 3,
  FORM_IN_PROGRESS: 4,
  REVIEWING: 5,
  DOCS_READY: 6,
  SLOT_BOOKED: 7,
  SUBMITTED: 8,
  COMPLETED: 9,
}

export function isUsaMainStatus(value: string | null | undefined): value is UsaMainStatus {
  return !!value && (USA_MAIN_STATUSES as readonly string[]).includes(value)
}

export function isUsaSubStatus(value: string | null | undefined): value is UsaSubStatus {
  return !!value && (USA_SUB_STATUSES as readonly string[]).includes(value)
}

export function isUsaExceptionCode(value: string | null | undefined): value is UsaExceptionCode {
  return !!value && (USA_EXCEPTION_CODES as readonly string[]).includes(value)
}

export function getUsaMainStatusRank(status: UsaMainStatus) {
  return USA_MAIN_STATUS_RANK[status]
}

export function compareUsaMainStatus(a: UsaMainStatus, b: UsaMainStatus) {
  return getUsaMainStatusRank(a) - getUsaMainStatusRank(b)
}

export interface UsaReminderRuleSeed {
  ruleCode: string
  name: string
  enabled?: boolean
  caseType?: string
  mainStatus?: UsaMainStatus
  subStatus?: UsaSubStatus
  exceptionCode?: UsaExceptionCode
  triggerType: ReminderTriggerType
  triggerValue?: Record<string, unknown> | null
  delayMinutes?: number
  channels: ReminderChannel[]
  automationMode: ReminderAutomationMode
  severity: ReminderSeverity
  templateCode: string
  cooldownMinutes?: number
  stopCondition?: Record<string, unknown> | null
}

export const DEFAULT_USA_CASE_MAIN_STATUS: UsaMainStatus = "PENDING_PAYMENT"
export const DEFAULT_USA_CASE_SUB_STATUS: UsaSubStatus = "QUOTE_SENT"

export const DEFAULT_USA_REMINDER_RULES: UsaReminderRuleSeed[] = [
  {
    ruleCode: "PAYMENT_SUCCESS_WELCOME",
    name: "付款成功欢迎包",
    mainStatus: "ONBOARDED",
    triggerType: "status_enter",
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "payment_success_welcome",
  },
  {
    ruleCode: "PACKAGE_SEND_T_MINUS_3",
    name: "面签前3天发材料包",
    mainStatus: "SLOT_BOOKED",
    triggerType: "date_offset",
    triggerValue: { field: "slotTime", daysBefore: 3 },
    channels: ["WECHAT", "EMAIL"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "package_send_t_minus_3",
  },
  {
    ruleCode: "T_MINUS_1_FINAL_REMINDER",
    name: "面签前1天最终提醒",
    mainStatus: "SLOT_BOOKED",
    triggerType: "date_offset",
    triggerValue: { field: "slotTime", daysBefore: 1 },
    channels: ["WECHAT", "EMAIL"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "t_minus_1_final_reminder",
  },
  {
    ruleCode: "SUBMITTED_CONGRATS",
    name: "面签完成恭喜消息",
    mainStatus: "SUBMITTED",
    triggerType: "status_enter",
    channels: ["WECHAT", "EMAIL"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "submitted_congrats",
  },
  {
    ruleCode: "VISA_APPROVED_NOTIFY",
    name: "签证通过通知",
    mainStatus: "COMPLETED",
    subStatus: "APPROVED_NOTIFIED",
    triggerType: "status_enter",
    channels: ["WECHAT", "EMAIL"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "visa_approved_notify",
  },
  {
    ruleCode: "SERVICE_CLOSED_REVIEW_INVITE",
    name: "服务完成邀请好评",
    mainStatus: "COMPLETED",
    subStatus: "SERVICE_CLOSED",
    triggerType: "duration_reached",
    triggerValue: { days: 3 },
    delayMinutes: 3 * 24 * 60,
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "service_closed_review_invite",
  },
  {
    ruleCode: "FORM_24H_NOT_SUBMITTED",
    name: "表格24小时未提交",
    mainStatus: "FORM_IN_PROGRESS",
    subStatus: "FORM_SENT",
    triggerType: "duration_reached",
    triggerValue: { hours: 24 },
    delayMinutes: 24 * 60,
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "form_24h_not_submitted",
  },
  {
    ruleCode: "FORM_48H_ESCALATION",
    name: "表格48小时未提交升级处理",
    mainStatus: "FORM_IN_PROGRESS",
    subStatus: "FORM_SENT",
    triggerType: "duration_reached",
    triggerValue: { hours: 48 },
    delayMinutes: 48 * 60,
    channels: ["INTERNAL"],
    automationMode: "MANUAL",
    severity: "URGENT",
    templateCode: "form_48h_escalation",
  },
]

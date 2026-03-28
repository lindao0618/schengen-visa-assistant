export const FRANCE_CASE_TYPE = "france-schengen" as const

export const FRANCE_MAIN_STATUSES = [
  "PENDING_PAYMENT",
  "ONBOARDED",
  "PRE_PREP",
  "FORM_IN_PROGRESS",
  "REVIEWING",
  "DOCS_READY",
  "TLS_PROCESSING",
  "SLOT_BOOKED",
  "SUBMITTED",
  "COMPLETED",
] as const

export type FranceMainStatus = (typeof FRANCE_MAIN_STATUSES)[number]

export const FRANCE_SUB_STATUSES = [
  "QUOTE_SENT",
  "GROUP_CREATED",
  "BANK_CARD_PENDING",
  "BALANCE_PREPARING",
  "FORM_SENT",
  "FORM_RECEIVED",
  "AI_REVIEWING",
  "HUMAN_REVIEWING",
  "DOCS_GENERATED",
  "TLS_REGISTERING",
  "FV_FILLING",
  "SLOT_HUNTING",
  "PENDING_SUBMISSION",
  "WAITING_TLS_PAYMENT",
  "PACKAGE_SENT",
  "AWAITING_VISA",
  "APPROVED_NOTIFIED",
  "SERVICE_CLOSED",
] as const

export type FranceSubStatus = (typeof FRANCE_SUB_STATUSES)[number]

export const FRANCE_EXCEPTION_CODES = [
  "PAYMENT_TIMEOUT",
  "BANK_CARD_MISSING",
  "BALANCE_INSUFFICIENT",
  "FORM_TIMEOUT",
  "REVIEW_FAILED",
  "DOCS_REGENERATE_REQUIRED",
  "TLS_REGISTER_FAILED",
  "FV_FILL_FAILED",
  "SLOT_TIMEOUT",
  "TLS_PAYMENT_TIMEOUT",
  "DOCS_INCOMPLETE",
  "VISA_RESULT_DELAYED",
] as const

export type FranceExceptionCode = (typeof FRANCE_EXCEPTION_CODES)[number]

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

export const FRANCE_MAIN_STATUS_RANK: Record<FranceMainStatus, number> = {
  PENDING_PAYMENT: 1,
  ONBOARDED: 2,
  PRE_PREP: 3,
  FORM_IN_PROGRESS: 4,
  REVIEWING: 5,
  DOCS_READY: 6,
  TLS_PROCESSING: 7,
  SLOT_BOOKED: 8,
  SUBMITTED: 9,
  COMPLETED: 10,
}

export function isFranceMainStatus(value: string | null | undefined): value is FranceMainStatus {
  return !!value && (FRANCE_MAIN_STATUSES as readonly string[]).includes(value)
}

export function isFranceSubStatus(value: string | null | undefined): value is FranceSubStatus {
  return !!value && (FRANCE_SUB_STATUSES as readonly string[]).includes(value)
}

export function isFranceExceptionCode(value: string | null | undefined): value is FranceExceptionCode {
  return !!value && (FRANCE_EXCEPTION_CODES as readonly string[]).includes(value)
}

export function getFranceMainStatusRank(status: FranceMainStatus) {
  return FRANCE_MAIN_STATUS_RANK[status]
}

export function compareFranceMainStatus(a: FranceMainStatus, b: FranceMainStatus) {
  return getFranceMainStatusRank(a) - getFranceMainStatusRank(b)
}

export interface FranceReminderRuleSeed {
  ruleCode: string
  name: string
  enabled?: boolean
  caseType?: string
  mainStatus?: FranceMainStatus
  subStatus?: FranceSubStatus
  exceptionCode?: FranceExceptionCode
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

export const DEFAULT_FRANCE_CASE_MAIN_STATUS: FranceMainStatus = "PENDING_PAYMENT"
export const DEFAULT_FRANCE_CASE_SUB_STATUS: FranceSubStatus = "QUOTE_SENT"

export const DEFAULT_FRANCE_REMINDER_RULES: FranceReminderRuleSeed[] = [
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
    ruleCode: "ONBOARD_DAY3_ENROLLMENT_CERT",
    name: "入群72小时在读证明催促",
    mainStatus: "ONBOARDED",
    triggerType: "duration_reached",
    triggerValue: { hours: 72, field: "enrollmentCertificateConfirmed", equals: false },
    delayMinutes: 72 * 60,
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "onboard_day3_enrollment_cert",
  },
  {
    ruleCode: "PREP_DAY7_BALANCE_CHECK",
    name: "入群7天余额检查",
    mainStatus: "PRE_PREP",
    triggerType: "duration_reached",
    triggerValue: { days: 7, field: "formSubmitted", equals: false },
    delayMinutes: 7 * 24 * 60,
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "prep_day7_balance_check",
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
  {
    ruleCode: "REVIEW_FAIL_FEEDBACK",
    name: "AI审核失败反馈",
    mainStatus: "REVIEWING",
    exceptionCode: "REVIEW_FAILED",
    triggerType: "status_enter",
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "review_fail_feedback",
  },
  {
    ruleCode: "DOCS_READY_NOTICE",
    name: "材料生成完成通知",
    mainStatus: "DOCS_READY",
    triggerType: "status_enter",
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "docs_ready_notice",
  },
  {
    ruleCode: "SLOT_HUNTING_DAY3_UPDATE",
    name: "抢号第3天进度更新",
    mainStatus: "TLS_PROCESSING",
    subStatus: "SLOT_HUNTING",
    triggerType: "duration_reached",
    triggerValue: { hours: 72 },
    delayMinutes: 72 * 60,
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "slot_hunting_day3_update",
  },
  {
    ruleCode: "SLOT_WINDOW_ENDING",
    name: "临近抢号区间结束提醒",
    mainStatus: "TLS_PROCESSING",
    subStatus: "SLOT_HUNTING",
    triggerType: "date_offset",
    triggerValue: { field: "slotWindowEndAt", daysBefore: 3 },
    delayMinutes: 0,
    channels: ["INTERNAL"],
    automationMode: "MANUAL",
    severity: "URGENT",
    templateCode: "slot_window_ending",
  },
  {
    ruleCode: "SLOT_BOOKED_PAYMENT_NOTICE",
    name: "抢号成功付款提醒",
    mainStatus: "SLOT_BOOKED",
    triggerType: "status_enter",
    delayMinutes: 30,
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "slot_booked_payment_notice",
  },
  {
    ruleCode: "TLS_PAYMENT_2H_ESCALATION",
    name: "抢号成功2小时未付款升级处理",
    mainStatus: "SLOT_BOOKED",
    subStatus: "WAITING_TLS_PAYMENT",
    triggerType: "duration_reached",
    triggerValue: { hours: 2 },
    delayMinutes: 2 * 60,
    channels: ["INTERNAL"],
    automationMode: "MANUAL",
    severity: "URGENT",
    templateCode: "tls_payment_2h_escalation",
  },
  {
    ruleCode: "PACKAGE_SEND_T_MINUS_3",
    name: "递签前3天发材料包",
    mainStatus: "SLOT_BOOKED",
    triggerType: "date_offset",
    triggerValue: { field: "appointmentDate", daysBefore: 3 },
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "package_send_t_minus_3",
  },
  {
    ruleCode: "T_MINUS_1_FINAL_REMINDER",
    name: "递签前1天最终提醒",
    mainStatus: "SLOT_BOOKED",
    triggerType: "date_offset",
    triggerValue: { field: "appointmentDate", daysBefore: 1 },
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "t_minus_1_final_reminder",
  },
  {
    ruleCode: "SUBMITTED_CONGRATS",
    name: "递签完成恭喜消息",
    mainStatus: "SUBMITTED",
    triggerType: "status_enter",
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "submitted_congrats",
  },
  {
    ruleCode: "SUBMITTED_DAY5_COMFORT",
    name: "递签后第5个工作日安抚",
    mainStatus: "SUBMITTED",
    subStatus: "AWAITING_VISA",
    triggerType: "duration_reached",
    triggerValue: { businessDays: 5 },
    delayMinutes: 5 * 24 * 60,
    channels: ["WECHAT"],
    automationMode: "AUTO",
    severity: "NORMAL",
    templateCode: "submitted_day5_comfort",
  },
  {
    ruleCode: "SUBMITTED_DAY15_ESCALATION",
    name: "递签超过15个工作日未出签升级处理",
    mainStatus: "SUBMITTED",
    exceptionCode: "VISA_RESULT_DELAYED",
    triggerType: "duration_reached",
    triggerValue: { businessDays: 15 },
    delayMinutes: 15 * 24 * 60,
    channels: ["INTERNAL"],
    automationMode: "MANUAL",
    severity: "URGENT",
    templateCode: "submitted_day15_escalation",
  },
  {
    ruleCode: "VISA_APPROVED_NOTIFY",
    name: "下签成功通知领取",
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
]

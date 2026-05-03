export type OpsAgentImportKind = "france-schengen" | "usa-visa" | "unknown"
export type OpsAgentImportQueueType = "ready" | "missing-person" | "low-confidence"

export interface OpsAgentDateRange {
  start: string
  end: string
}

export interface OpsAgentImportFilenameParse {
  rawFilename: string
  normalizedName: string
  kind: OpsAgentImportKind
  applicantName: string
  travelText?: string
  expectedSubmissionText?: string
  bookingWindowText?: string
  bookingWindow?: OpsAgentDateRange
  expectedSubmissionMonth?: OpsAgentDateRange
  unavailableDates: string[]
  confidence: number
  queueType: OpsAgentImportQueueType
  needsConfirmation: boolean
  warnings: string[]
  promptSafeSummary: string
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.\\/]+$/, "")
}

function normalizeFilename(filename: string) {
  return stripExtension(filename)
    .replace(/[－—–]/g, "-")
    .replace(/\s+/g, "")
    .trim()
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function toDateOnly(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function inferYearForMonthDay(month: number, day: number, now: Date) {
  const candidate = new Date(now.getFullYear(), month - 1, day)
  if (candidate.getTime() < startOfDay(now).getTime()) return now.getFullYear() + 1
  return now.getFullYear()
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseMonthDay(value: string, now: Date) {
  const match = value.match(/(\d{1,2})[./月-](\d{1,2})/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const year = inferYearForMonthDay(month, day, now)
  const date = new Date(year, month - 1, day)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function parseBookingWindow(text: string, now: Date): OpsAgentDateRange | undefined {
  const match = text.match(/(\d{1,2}[.月/-]\d{1,2})\s*-\s*(?:(\d{1,2})[.月/-])?(\d{1,2})/)
  if (!match) return undefined

  const start = parseMonthDay(match[1], now)
  if (!start) return undefined

  const endMonth = match[2] ? Number(match[2]) : start.getMonth() + 1
  const endDay = Number(match[3])
  const endBase = new Date(start.getFullYear(), endMonth - 1, endDay)
  const end = endBase.getTime() < start.getTime()
    ? new Date(start.getFullYear() + 1, endMonth - 1, endDay)
    : endBase

  if (Number.isNaN(end.getTime())) return undefined
  return {
    start: toDateOnly(start),
    end: toDateOnly(end),
  }
}

function parseUnavailableDates(text: string, now: Date) {
  const matches = Array.from(text.matchAll(/(\d{1,2})[.月/-](\d{1,2})(?=[^\d]*(?:去不了|不能|不行|不可|没空))/g))
  return Array.from(new Set(
    matches
      .map((match) => parseMonthDay(`${match[1]}.${match[2]}`, now))
      .filter((item): item is Date => Boolean(item))
      .map(toDateOnly),
  ))
}

function parseExpectedMonth(text: string, now: Date): OpsAgentDateRange | undefined {
  const match = text.match(/(\d{1,2})\s*月/)
  if (!match) return undefined
  const month = Number(match[1])
  if (month < 1 || month > 12) return undefined
  const candidateStart = new Date(now.getFullYear(), month - 1, 1)
  const year = candidateStart.getTime() < startOfDay(now).getTime() ? now.getFullYear() + 1 : now.getFullYear()
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`,
  }
}

function safeSummary(parsed: {
  kind: OpsAgentImportKind
  applicantName: string
  travelText?: string
  expectedSubmissionText?: string
  bookingWindow?: OpsAgentDateRange
  unavailableDates: string[]
}) {
  const parts = [
    `签证类型:${parsed.kind}`,
    `姓名:${parsed.applicantName || "缺人"}`,
  ]
  if (parsed.travelText && /^\d{1,2}月份?出行$/.test(parsed.travelText)) {
    parts.push(`出行:${parsed.travelText}`)
  }
  if (parsed.expectedSubmissionText && /^\d{1,2}月递签$/.test(parsed.expectedSubmissionText)) {
    parts.push(`预计递签:${parsed.expectedSubmissionText}`)
  }
  if (parsed.bookingWindow) {
    parts.push(`递签窗口:${parsed.bookingWindow.start}至${parsed.bookingWindow.end}`)
  }
  if (parsed.unavailableDates.length) {
    parts.push(`不可用日期:${parsed.unavailableDates.join(",")}`)
  }
  return parts.join("；")
}

function buildBaseResult(rawFilename: string, normalizedName: string): OpsAgentImportFilenameParse {
  return {
    rawFilename,
    normalizedName,
    kind: "unknown",
    applicantName: "",
    unavailableDates: [],
    confidence: 0.2,
    queueType: "low-confidence",
    needsConfirmation: true,
    warnings: ["无法识别签证类型"],
    promptSafeSummary: "签证类型:unknown；姓名:缺人",
  }
}

export function parseOpsAgentImportFilename(filename: string, now = new Date()): OpsAgentImportFilenameParse {
  const rawFilename = String(filename || "")
  const normalizedName = normalizeFilename(rawFilename)
  const base = buildBaseResult(rawFilename, normalizedName)

  if (normalizedName.startsWith("法签-")) {
    const [, applicantName = "", travelText = "", ...rest] = normalizedName.split("-")
    const tail = rest.join("-")
    const bookingWindow = parseBookingWindow(tail, now)
    const unavailableDates = parseUnavailableDates(tail, now)
    const warnings = []
    if (!applicantName) warnings.push("缺少申请人姓名")
    if (!bookingWindow) warnings.push("未识别到递签时间窗口")
    const queueType: OpsAgentImportQueueType = !applicantName ? "missing-person" : bookingWindow ? "ready" : "low-confidence"
    const result: OpsAgentImportFilenameParse = {
      rawFilename,
      normalizedName,
      kind: "france-schengen",
      applicantName,
      travelText,
      bookingWindowText: tail.replace(/[（(].*$/, ""),
      bookingWindow,
      unavailableDates,
      confidence: applicantName && bookingWindow ? 0.92 : 0.55,
      queueType,
      needsConfirmation: true,
      warnings,
      promptSafeSummary: "",
    }
    result.promptSafeSummary = safeSummary(result)
    return result
  }

  if (normalizedName.startsWith("美签-")) {
    const [, applicantName = "", expectedSubmissionText = ""] = normalizedName.split("-")
    const expectedSubmissionMonth = parseExpectedMonth(expectedSubmissionText, now)
    const warnings = []
    if (!applicantName) warnings.push("缺少申请人姓名")
    if (!expectedSubmissionMonth) warnings.push("未识别到预计递签月份")
    const queueType: OpsAgentImportQueueType = !applicantName ? "missing-person" : expectedSubmissionMonth ? "ready" : "low-confidence"
    const result: OpsAgentImportFilenameParse = {
      rawFilename,
      normalizedName,
      kind: "usa-visa",
      applicantName,
      expectedSubmissionText,
      expectedSubmissionMonth,
      unavailableDates: [],
      confidence: applicantName && expectedSubmissionMonth ? 0.9 : 0.52,
      queueType,
      needsConfirmation: true,
      warnings,
      promptSafeSummary: "",
    }
    result.promptSafeSummary = safeSummary(result)
    return result
  }

  return base
}

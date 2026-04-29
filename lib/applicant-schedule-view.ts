export const SCHEDULE_RANGE_OPTIONS = [
  { days: 3, label: "未来 3 天" },
  { days: 7, label: "未来 7 天" },
  { days: 15, label: "未来 15 天" },
  { days: 30, label: "未来 30 天" },
] as const

export type ScheduleRangeDays = (typeof SCHEDULE_RANGE_OPTIONS)[number]["days"]
export type ScheduleViewMode = "list" | "calendar"
export type ApplicantScheduleGroupKey = "next-3" | "next-7" | "next-15" | "next-30" | "missing-slot" | "submitted"

export type ApplicantScheduleItem = {
  id: string
  applicantId: string
  applicantName: string
  caseType: string
  visaType?: string | null
  applyRegion?: string | null
  tlsCity?: string | null
  slotTime?: string | null
  mainStatus: string
  subStatus?: string | null
  priority: string
  travelDate?: string | null
  updatedAt: string
  assignee?: { id: string; name?: string | null; email: string } | null
}

export type ApplicantScheduleGroup = {
  key: ApplicantScheduleGroupKey
  title: string
  helper: string
  tone: "urgent" | "soon" | "normal" | "later" | "missing" | "done"
  items: ApplicantScheduleItem[]
}

export type ApplicantScheduleSummary = {
  todayCount: number
  next3Count: number
  next7Count: number
  next15Count: number
  next30Count: number
  missingSlotCount: number
  submittedCount: number
}

export type ApplicantScheduleCalendarDay = {
  date: string
  dayOfMonth: number
  inCurrentMonth: boolean
  items: ApplicantScheduleItem[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const GROUP_DEFINITIONS: Array<{
  key: ApplicantScheduleGroupKey
  title: string
  helper: string
  tone: ApplicantScheduleGroup["tone"]
  minDay: number
  maxDay: ScheduleRangeDays
}> = [
  { key: "next-3", title: "未来 3 天", helper: "需要优先确认材料、预约和递签提醒。", tone: "urgent", minDay: 0, maxDay: 3 },
  { key: "next-7", title: "未来 7 天", helper: "本周内需要处理的递签安排。", tone: "soon", minDay: 4, maxDay: 7 },
  { key: "next-15", title: "未来 15 天", helper: "两周内的递签排期，适合提前检查材料。", tone: "normal", minDay: 8, maxDay: 15 },
  { key: "next-30", title: "未来 30 天", helper: "本月需要关注的递签安排。", tone: "later", minDay: 16, maxDay: 30 },
]

export function normalizeScheduleRangeDays(value: unknown): ScheduleRangeDays {
  const parsed = Number(value)
  const found = SCHEDULE_RANGE_OPTIONS.find((item) => item.days === parsed)
  return found?.days ?? 30
}

export function isSubmittedScheduleStatus(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase()
  return normalized === "SUBMITTED" || normalized === "COMPLETED"
}

export function buildScheduleDateWindow(days: ScheduleRangeDays, now = new Date()) {
  const from = startOfLocalDay(now)
  const to = addDays(from, days)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export function buildApplicantScheduleGroups({
  now = new Date(),
  items,
  missingSlotItems = [],
  submittedItems = [],
}: {
  now?: Date
  items: ApplicantScheduleItem[]
  missingSlotItems?: ApplicantScheduleItem[]
  submittedItems?: ApplicantScheduleItem[]
}): ApplicantScheduleGroup[] {
  const start = startOfLocalDay(now)
  const sortedItems = sortScheduleItems(items)

  const dateGroups = GROUP_DEFINITIONS.map((definition) => ({
    key: definition.key,
    title: definition.title,
    helper: definition.helper,
    tone: definition.tone,
    items: sortedItems.filter((item) => {
      const dayIndex = getDayIndex(start, item.slotTime)
      return dayIndex >= definition.minDay && dayIndex <= definition.maxDay
    }),
  }))

  return [
    ...dateGroups,
    {
      key: "missing-slot",
      title: "未填写递签时间",
      helper: "这些案件还没有 slot 时间，容易漏排期。",
      tone: "missing",
      items: sortScheduleItems(missingSlotItems),
    },
    {
      key: "submitted",
      title: "已完成递签",
      helper: "已经递签或完成的案件，用于复盘和确认后续流程。",
      tone: "done",
      items: sortScheduleItems(submittedItems),
    },
  ]
}

export function buildApplicantScheduleSummary({
  now = new Date(),
  items,
  missingSlotItems = [],
  submittedItems = [],
}: {
  now?: Date
  items: ApplicantScheduleItem[]
  missingSlotItems?: ApplicantScheduleItem[]
  submittedItems?: ApplicantScheduleItem[]
}): ApplicantScheduleSummary {
  const start = startOfLocalDay(now)
  const countWithin = (maxDay: number) =>
    items.filter((item) => {
      const dayIndex = getDayIndex(start, item.slotTime)
      return dayIndex >= 0 && dayIndex <= maxDay
    }).length

  return {
    todayCount: countWithin(0),
    next3Count: countWithin(3),
    next7Count: countWithin(7),
    next15Count: countWithin(15),
    next30Count: countWithin(30),
    missingSlotCount: missingSlotItems.length,
    submittedCount: submittedItems.length,
  }
}

export function buildCalendarMonthDays({
  month,
  items,
}: {
  month: string
  items: ApplicantScheduleItem[]
}): ApplicantScheduleCalendarDay[] {
  const [yearText, monthText] = month.split("-")
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const base = Number.isFinite(year) && Number.isFinite(monthIndex)
    ? new Date(year, monthIndex, 1)
    : startOfLocalMonth(new Date())
  const firstDay = new Date(base.getFullYear(), base.getMonth(), 1)
  const gridStart = addDays(firstDay, -firstDay.getDay())
  const targetMonth = firstDay.getMonth()
  const itemsByDate = new Map<string, ApplicantScheduleItem[]>()

  for (const item of items) {
    if (!item.slotTime) continue
    const key = formatDateKey(new Date(item.slotTime))
    const nextItems = itemsByDate.get(key) || []
    nextItems.push(item)
    itemsByDate.set(key, nextItems)
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    const key = formatDateKey(date)
    return {
      date: key,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === targetMonth,
      items: sortScheduleItems(itemsByDate.get(key) || []),
    }
  })
}

export function formatScheduleDateTime(value?: string | null) {
  if (!value) return "未填写"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "未填写"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

export function formatScheduleDate(value?: string | null) {
  if (!value) return "未填写"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "未填写"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function formatDateKey(date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function normalizeScheduleMonth(value: string | null | undefined, now = new Date()) {
  const raw = String(value || "").trim()
  if (/^\d{4}-\d{2}$/.test(raw)) return raw
  return formatDateKey(startOfLocalMonth(now)).slice(0, 7)
}

function getDayIndex(start: Date, value?: string | null) {
  if (!value) return Number.NaN
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return Number.NaN
  return Math.floor((startOfLocalDay(date).getTime() - start.getTime()) / DAY_MS)
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfLocalMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function sortScheduleItems(items: ApplicantScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.slotTime ? new Date(left.slotTime).getTime() : Number.MAX_SAFE_INTEGER
    const rightTime = right.slotTime ? new Date(right.slotTime).getTime() : Number.MAX_SAFE_INTEGER
    return leftTime - rightTime || left.applicantName.localeCompare(right.applicantName, "zh-CN")
  })
}

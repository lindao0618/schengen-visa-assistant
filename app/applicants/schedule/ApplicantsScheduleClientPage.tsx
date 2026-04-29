"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  UserRound,
} from "lucide-react"

import {
  SCHEDULE_RANGE_OPTIONS,
  type ApplicantScheduleCalendarDay,
  type ApplicantScheduleGroup,
  type ApplicantScheduleItem,
  type ApplicantScheduleSummary,
  type ScheduleRangeDays,
  buildApplicantScheduleGroups,
  buildCalendarMonthDays,
  formatDateKey,
  formatScheduleDate,
  formatScheduleDateTime,
} from "@/lib/applicant-schedule-view"
import {
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type ScheduleResponse = {
  items: ApplicantScheduleItem[]
  missingSlotItems: ApplicantScheduleItem[]
  submittedItems: ApplicantScheduleItem[]
  summary: ApplicantScheduleSummary
  error?: string
}

type ViewMode = "list" | "calendar"

const EMPTY_SUMMARY: ApplicantScheduleSummary = {
  todayCount: 0,
  next3Count: 0,
  next7Count: 0,
  next15Count: 0,
  next30Count: 0,
  missingSlotCount: 0,
  submittedCount: 0,
}

const groupToneClasses: Record<ApplicantScheduleGroup["tone"], string> = {
  urgent: "border-blue-200 bg-blue-50/80 text-blue-950",
  soon: "border-sky-200 bg-sky-50/80 text-sky-950",
  normal: "border-slate-200 bg-slate-50/80 text-slate-950",
  later: "border-slate-100 bg-white text-slate-950",
  missing: "border-amber-200 bg-amber-50/80 text-amber-950",
  done: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
}

const groupAccentClasses: Record<ApplicantScheduleGroup["tone"], string> = {
  urgent: "bg-blue-600",
  soon: "bg-sky-500",
  normal: "bg-slate-500",
  later: "bg-slate-300",
  missing: "bg-amber-500",
  done: "bg-emerald-500",
}

function getCurrentMonth() {
  return formatDateKey(new Date()).slice(0, 7)
}

function shiftMonth(month: string, offset: number) {
  const [yearText, monthText] = month.split("-")
  const date = new Date(Number(yearText), Number(monthText) - 1 + offset, 1)
  return formatDateKey(date).slice(0, 7)
}

function getStatusLabel(status: string) {
  switch (status) {
    case "PENDING_PAYMENT":
      return "待付款"
    case "ONBOARDED":
      return "已入群"
    case "FORM_IN_PROGRESS":
      return "填表中"
    case "DOCS_READY":
      return "材料就绪"
    case "SLOT_BOOKED":
      return "已获取 Slot"
    case "SUBMITTED":
      return "已完成递签"
    case "COMPLETED":
      return "已完成"
    default:
      return status
  }
}

function buildDetailHref(item: ApplicantScheduleItem) {
  return `/applicants/${item.applicantId}?tab=cases&caseId=${item.id}`
}

export default function ApplicantsScheduleClientPage() {
  const router = useRouter()
  const [rangeDays, setRangeDays] = useState<ScheduleRangeDays>(30)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [includeMissingSlot, setIncludeMissingSlot] = useState(true)
  const [includeSubmitted, setIncludeSubmitted] = useState(false)
  const [assigneeId, setAssigneeId] = useState("all")
  const [visaType, setVisaType] = useState("all")
  const [status, setStatus] = useState("all")
  const [month, setMonth] = useState(getCurrentMonth)
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()))
  const [data, setData] = useState<ScheduleResponse>({
    items: [],
    missingSlotItems: [],
    submittedItems: [],
    summary: EMPTY_SUMMARY,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const loadSchedule = useCallback(async (mode: "auto" | "manual" = "auto") => {
    if (mode === "manual") {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError("")

    const query = new URLSearchParams({
      days: String(rangeDays),
      includeMissingSlot: String(includeMissingSlot),
      includeSubmitted: String(includeSubmitted),
    })
    if (assigneeId !== "all") query.set("assigneeId", assigneeId)
    if (visaType !== "all") query.set("visaType", visaType)
    if (status !== "all") query.set("status", status)

    try {
      const response = await fetch(`/api/applicants/schedule?${query.toString()}`, {
        credentials: "include",
        cache: "no-store",
      })
      const nextData = (await response.json().catch(() => null)) as ScheduleResponse | null
      if (!response.ok || !nextData?.summary) {
        throw new Error(nextData?.error || "递签日程加载失败")
      }
      setData(nextData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "递签日程加载失败")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [assigneeId, includeMissingSlot, includeSubmitted, rangeDays, status, visaType])

  useEffect(() => {
    void loadSchedule("auto")
  }, [loadSchedule])

  const groups = useMemo(
    () =>
      buildApplicantScheduleGroups({
        items: data.items,
        missingSlotItems: data.missingSlotItems,
        submittedItems: data.submittedItems,
      }),
    [data.items, data.missingSlotItems, data.submittedItems],
  )
  const calendarItems = useMemo(
    () => [...data.items, ...data.submittedItems],
    [data.items, data.submittedItems],
  )
  const calendarDays = useMemo(
    () => buildCalendarMonthDays({ month, items: calendarItems }),
    [calendarItems, month],
  )
  const selectedDay = calendarDays.find((day) => day.date === selectedDate)
  const hasAnyItems =
    data.items.length > 0 || data.missingSlotItems.length > 0 || data.submittedItems.length > 0

  const openItem = (item: ApplicantScheduleItem) => {
    router.push(buildDetailHref(item))
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_32%),linear-gradient(180deg,#f8fafc,#ffffff)] px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/70">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  递签日程
                </Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  数据来源：Case slot 时间
                </Badge>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">递签日程看板</h1>
                <p className="text-sm leading-6 text-slate-500">
                  按未来 3 / 7 / 15 / 30 天集中查看客户递签安排，快速发现未填写 slot 的案件。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
              <Button variant="outline" asChild>
                <Link href="/applicants">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回申请人
                </Link>
              </Button>
              <Button variant="outline" onClick={() => void loadSchedule("manual")} disabled={loading || refreshing}>
                <RefreshCw className={cn("mr-2 h-4 w-4", (loading || refreshing) && "animate-spin")} />
                刷新日程
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="未来 3 天" value={data.summary.next3Count} tone="blue" />
          <SummaryCard label="未来 7 天" value={data.summary.next7Count} tone="sky" />
          <SummaryCard label="未来 15 天" value={data.summary.next15Count} tone="slate" />
          <SummaryCard label="未来 30 天" value={data.summary.next30Count} tone="slate" />
          <SummaryCard label="未填写" value={data.summary.missingSlotCount} tone="amber" />
          <SummaryCard label="已完成递签" value={data.summary.submittedCount} tone="emerald" />
        </section>

        <Card className="border-slate-200 bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>筛选和视图</CardTitle>
            <CardDescription>先选择时间窗口，再切换列表或月历视图。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.days}
                  type="button"
                  variant={rangeDays === option.days ? "default" : "outline"}
                  onClick={() => setRangeDays(option.days)}
                >
                  {option.label}
                </Button>
              ))}
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "outline"}
                onClick={() => setViewMode("list")}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                列表看板
              </Button>
              <Button
                type="button"
                variant={viewMode === "calendar" ? "default" : "outline"}
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                月历视图
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-5">
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="负责人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部负责人</SelectItem>
                  <SelectItem value="me">我负责</SelectItem>
                </SelectContent>
              </Select>
              <Select value={visaType} onValueChange={setVisaType}>
                <SelectTrigger>
                  <SelectValue placeholder="签证类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部签证</SelectItem>
                  <SelectItem value="france-schengen">法签 / 申根</SelectItem>
                  <SelectItem value="usa-visa">美签</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="SLOT_BOOKED">已获取 Slot</SelectItem>
                  <SelectItem value="SUBMITTED">已完成递签</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                </SelectContent>
              </Select>
              <ToggleLine
                label="未填写递签时间"
                checked={includeMissingSlot}
                onCheckedChange={setIncludeMissingSlot}
              />
              <ToggleLine
                label="已完成递签"
                checked={includeSubmitted}
                onCheckedChange={setIncludeSubmitted}
              />
            </div>
          </CardContent>
        </Card>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-[2rem] border border-slate-200 bg-white/80">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在加载递签日程...
          </div>
        ) : viewMode === "list" ? (
          <ScheduleListView groups={groups} hasAnyItems={hasAnyItems} onOpenItem={openItem} />
        ) : (
          <ScheduleCalendarView
            month={month}
            days={calendarDays}
            selectedDate={selectedDate}
            selectedDay={selectedDay}
            onPreviousMonth={() => setMonth((value) => shiftMonth(value, -1))}
            onNextMonth={() => setMonth((value) => shiftMonth(value, 1))}
            onToday={() => {
              const today = formatDateKey(new Date())
              setMonth(today.slice(0, 7))
              setSelectedDate(today)
            }}
            onSelectDate={setSelectedDate}
            onOpenItem={openItem}
          />
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "blue" | "sky" | "slate" | "amber" | "emerald" }) {
  const className = {
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    slate: "border-slate-200 bg-white text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  }[tone]

  return (
    <div className={cn("rounded-3xl border p-4 shadow-sm", className)}>
      <div className="text-sm font-medium opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  )
}

function ToggleLine({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ScheduleListView({
  groups,
  hasAnyItems,
  onOpenItem,
}: {
  groups: ApplicantScheduleGroup[]
  hasAnyItems: boolean
  onOpenItem: (item: ApplicantScheduleItem) => void
}) {
  if (!hasAnyItems) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center">
        <CalendarClock className="mx-auto h-10 w-10 text-slate-400" />
        <div className="mt-4 text-lg font-semibold text-slate-950">当前没有匹配的递签日程</div>
        <p className="mt-2 text-sm text-slate-500">可以放宽日期范围，或进入申请人详情页补齐 Case 的 slot 时间。</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.key} className={cn("overflow-hidden border shadow-sm", groupToneClasses[group.tone])}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <span className={cn("h-3 w-3 rounded-full", groupAccentClasses[group.tone])} />
                  {group.title}
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">{group.helper}</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white/80">
                {group.items.length} 个
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {group.items.length > 0 ? (
              <div className="space-y-2">
                {group.items.map((item) => (
                  <ScheduleItemCard key={item.id} item={item} onOpen={() => onOpenItem(item)} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/70 bg-white/50 px-4 py-6 text-sm text-slate-500">
                当前分组没有客户。
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ScheduleCalendarView({
  month,
  days,
  selectedDate,
  selectedDay,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  onOpenItem,
}: {
  month: string
  days: ApplicantScheduleCalendarDay[]
  selectedDate: string
  selectedDay?: ApplicantScheduleCalendarDay
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSelectDate: (date: string) => void
  onOpenItem: (item: ApplicantScheduleItem) => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-slate-200 bg-white/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{month} 月历</CardTitle>
              <CardDescription>点击日期查看当天全部递签客户。</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onPreviousMonth}>
                上一月
              </Button>
              <Button type="button" variant="outline" onClick={onToday}>
                今天
              </Button>
              <Button type="button" variant="outline" onClick={onNextMonth}>
                下一月
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={cn(
                  "min-h-28 rounded-2xl border p-2 text-left transition hover:border-blue-300 hover:bg-blue-50/50",
                  day.inCurrentMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/70 text-slate-400",
                  selectedDate === day.date && "border-blue-500 bg-blue-50 ring-2 ring-blue-100",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{day.dayOfMonth}</span>
                  {day.items.length > 0 ? (
                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs text-white">{day.items.length}</span>
                  ) : null}
                </div>
                <div className="mt-2 space-y-1">
                  {day.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="truncate rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                      {item.applicantName}
                    </div>
                  ))}
                  {day.items.length > 3 ? (
                    <div className="text-xs font-medium text-slate-500">+{day.items.length - 3} 个</div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle>{selectedDate}</CardTitle>
          <CardDescription>当天递签客户</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedDay?.items.length ? (
            <div className="space-y-2">
              {selectedDay.items.map((item) => (
                <ScheduleItemCard key={item.id} item={item} onOpen={() => onOpenItem(item)} compact />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              这一天没有递签安排。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ScheduleItemCard({
  item,
  onOpen,
  compact = false,
}: {
  item: ApplicantScheduleItem
  onOpen: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-white/80 bg-white/85 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-slate-950">{item.applicantName}</span>
            <Badge variant="outline">{getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}</Badge>
            <Badge variant="outline">{getStatusLabel(item.mainStatus)}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              {formatScheduleDateTime(item.slotTime)}
            </span>
            <span>{item.tlsCity || getApplicantCrmRegionLabel(item.applyRegion || "") || "未填写城市"}</span>
            {item.travelDate ? <span>出行：{formatScheduleDate(item.travelDate)}</span> : null}
          </div>
        </div>
        {!compact ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <UserRound className="h-4 w-4" />
            {item.assignee?.name || item.assignee?.email || "未分配"}
          </div>
        ) : null}
      </div>
    </button>
  )
}

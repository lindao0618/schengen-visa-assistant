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
  type ScheduleVisaColorKey,
  type ScheduleRangeDays,
  buildApplicantScheduleGroups,
  buildCalendarMonthDays,
  formatDateKey,
  formatScheduleDate,
  formatScheduleDateTime,
  getQuickScheduleDatePatchTarget,
  getScheduleDateTime,
  getScheduleVisaColorKey,
} from "@/lib/applicant-schedule-view"
import {
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  urgent: "border-blue-400/25 bg-blue-400/10 text-white",
  soon: "border-sky-400/25 bg-sky-400/10 text-white",
  normal: "border-white/5 bg-white/[0.02] text-white",
  later: "border-white/5 bg-white/[0.02] text-white",
  missing: "border-amber-400/25 bg-amber-400/10 text-white",
  done: "border-emerald-400/25 bg-emerald-400/10 text-white",
}

const groupAccentClasses: Record<ApplicantScheduleGroup["tone"], string> = {
  urgent: "bg-blue-600",
  soon: "bg-sky-500",
  normal: "bg-slate-500",
  later: "bg-slate-300",
  missing: "bg-amber-500",
  done: "bg-emerald-500",
}

const visaToneClasses: Record<
  ScheduleVisaColorKey,
  {
    dot: string
    badge: string
    chip: string
    card: string
    stripe: string
  }
> = {
  france: {
    dot: "bg-emerald-500",
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    chip: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    card: "border-white/5 bg-white/[0.02] hover:border-emerald-300/25",
    stripe: "bg-emerald-500",
  },
  usa: {
    dot: "bg-blue-600",
    badge: "border-blue-400/25 bg-blue-400/10 text-blue-300",
    chip: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    card: "border-white/5 bg-white/[0.02] hover:border-blue-300/25",
    stripe: "bg-blue-600",
  },
  uk: {
    dot: "bg-amber-500",
    badge: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    chip: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    card: "border-white/5 bg-white/[0.02] hover:border-amber-300/25",
    stripe: "bg-amber-500",
  },
  germany: {
    dot: "bg-zinc-700",
    badge: "border-zinc-400/25 bg-zinc-400/10 text-zinc-200",
    chip: "border-zinc-400/20 bg-zinc-400/10 text-zinc-200",
    card: "border-white/5 bg-white/[0.02] hover:border-zinc-300/25",
    stripe: "bg-zinc-700",
  },
  italy: {
    dot: "bg-rose-500",
    badge: "border-rose-400/25 bg-rose-400/10 text-rose-300",
    chip: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    card: "border-white/5 bg-white/[0.02] hover:border-rose-300/25",
    stripe: "bg-rose-500",
  },
  spain: {
    dot: "bg-orange-500",
    badge: "border-orange-400/25 bg-orange-400/10 text-orange-300",
    chip: "border-orange-400/20 bg-orange-400/10 text-orange-200",
    card: "border-white/5 bg-white/[0.02] hover:border-orange-300/25",
    stripe: "bg-orange-500",
  },
  schengen: {
    dot: "bg-teal-500",
    badge: "border-teal-400/25 bg-teal-400/10 text-teal-300",
    chip: "border-teal-400/20 bg-teal-400/10 text-teal-200",
    card: "border-white/5 bg-white/[0.02] hover:border-teal-300/25",
    stripe: "bg-teal-500",
  },
  other: {
    dot: "bg-slate-500",
    badge: "border-white/10 bg-white/[0.02] text-white/58",
    chip: "border-white/10 bg-white/[0.02] text-white/58",
    card: "border-white/5 bg-white/[0.02] hover:border-white/10",
    stripe: "bg-slate-400",
  },
}

const scheduleVisaLegendItems: Array<{ key: ScheduleVisaColorKey; label: string }> = [
  { key: "france", label: "法国申根" },
  { key: "usa", label: "美国签证" },
  { key: "uk", label: "英国签证" },
  { key: "schengen", label: "其他申根" },
  { key: "other", label: "其他" },
]

const scheduleControlButtonClass =
  "rounded-2xl border-white/10 bg-white/[0.02] text-white/82 shadow-none hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:text-white"
const scheduleControlButtonActiveClass =
  "border-blue-300/30 bg-blue-400/15 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.14)] hover:bg-blue-400/20"
const scheduleSelectTriggerClass =
  "rounded-2xl border-white/10 bg-white/[0.02] text-white/82 hover:border-white/20 focus:ring-blue-400/20 focus:ring-offset-0"
const scheduleSelectContentClass = "border-white/10 bg-[#080808] text-white"
const scheduleSelectItemClass =
  "rounded-lg text-white/74 focus:bg-white/[0.06] focus:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white"

function getVisaTone(item: ApplicantScheduleItem) {
  return visaToneClasses[getScheduleVisaColorKey(item)] || visaToneClasses.other
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

function toDateTimeLocalInputValue(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function getDefaultScheduleInputValue() {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function getQuickScheduleInputValue(item: ApplicantScheduleItem) {
  return toDateTimeLocalInputValue(getScheduleDateTime(item)) || getDefaultScheduleInputValue()
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
  const [editingScheduleItem, setEditingScheduleItem] = useState<ApplicantScheduleItem | null>(null)
  const [quickScheduleValue, setQuickScheduleValue] = useState("")
  const [quickScheduleSaving, setQuickScheduleSaving] = useState(false)
  const [quickScheduleError, setQuickScheduleError] = useState("")

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

  const openQuickScheduleEditor = (item: ApplicantScheduleItem) => {
    setEditingScheduleItem(item)
    setQuickScheduleValue(getQuickScheduleInputValue(item))
    setQuickScheduleError("")
  }

  const closeQuickScheduleEditor = () => {
    if (quickScheduleSaving) return
    setEditingScheduleItem(null)
    setQuickScheduleValue("")
    setQuickScheduleError("")
  }

  const saveQuickScheduleDate = async () => {
    if (!editingScheduleItem) return
    const rawValue = quickScheduleValue.trim()
    if (!rawValue) {
      setQuickScheduleError("请选择递签日期和时间")
      return
    }

    const targetField = getQuickScheduleDatePatchTarget(editingScheduleItem)
    const patchValue = targetField === "submissionDate" ? rawValue.slice(0, 10) : rawValue
    setQuickScheduleSaving(true)
    setQuickScheduleError("")

    try {
      const response = await fetch(`/api/cases/${editingScheduleItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [targetField]: patchValue }),
      })
      const nextData = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(nextData?.error || "递签时间保存失败")
      }
      setEditingScheduleItem(null)
      setQuickScheduleValue("")
      await loadSchedule("manual")
    } catch (saveError) {
      setQuickScheduleError(saveError instanceof Error ? saveError.message : "递签时间保存失败")
    } finally {
      setQuickScheduleSaving(false)
    }
  }

  const quickScheduleTarget = editingScheduleItem ? getQuickScheduleDatePatchTarget(editingScheduleItem) : "slotTime"

  return (
    <div className="pro-task-surface min-h-screen bg-black px-4 pb-20 pt-40 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="pro-spotlight pro-spotlight-blue overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] p-5 text-white">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-widest text-white/60">
                  递签日程
                </Badge>
                <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/10 text-[10px] uppercase tracking-widest text-emerald-300">
                  数据来源：Case slot / 递签时间
                </Badge>
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-white">递签日程看板</h1>
                <p className="text-sm leading-6 text-white/48">
                  按未来 3 / 7 / 15 / 30 天集中查看客户递签安排，快速发现未填写 slot 的案件。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.06] active:scale-95" asChild>
                <Link href="/applicants">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回申请人
                </Link>
              </Button>
              <Button variant="outline" className="pro-cta-glow rounded-full border-white/10 bg-white text-black hover:bg-white/80 active:scale-95" onClick={() => void loadSchedule("manual")} disabled={loading || refreshing}>
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

        <Card className="pro-spotlight pro-spotlight-blue border-white/5 bg-white/[0.02] text-white shadow-none">
          <CardHeader>
            <CardTitle className="text-white">筛选和视图</CardTitle>
            <CardDescription className="text-white/42">先选择时间窗口，再切换列表或月历视图。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.days}
                  type="button"
                  variant="outline"
                  className={cn(
                    scheduleControlButtonClass,
                    rangeDays === option.days && scheduleControlButtonActiveClass,
                  )}
                  onClick={() => setRangeDays(option.days)}
                >
                  {option.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                className={cn(scheduleControlButtonClass, viewMode === "list" && scheduleControlButtonActiveClass)}
                onClick={() => setViewMode("list")}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                列表看板
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(scheduleControlButtonClass, viewMode === "calendar" && scheduleControlButtonActiveClass)}
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                月历视图
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-5">
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className={scheduleSelectTriggerClass}>
                  <SelectValue placeholder="负责人" />
                </SelectTrigger>
                <SelectContent className={scheduleSelectContentClass}>
                  <SelectItem className={scheduleSelectItemClass} value="all">全部负责人</SelectItem>
                  <SelectItem className={scheduleSelectItemClass} value="me">我负责</SelectItem>
                </SelectContent>
              </Select>
              <Select value={visaType} onValueChange={setVisaType}>
                <SelectTrigger className={scheduleSelectTriggerClass}>
                  <SelectValue placeholder="签证类型" />
                </SelectTrigger>
                <SelectContent className={scheduleSelectContentClass}>
                  <SelectItem className={scheduleSelectItemClass} value="all">全部签证</SelectItem>
                  <SelectItem className={scheduleSelectItemClass} value="france-schengen">法签 / 申根</SelectItem>
                  <SelectItem className={scheduleSelectItemClass} value="usa-visa">美签</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={scheduleSelectTriggerClass}>
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent className={scheduleSelectContentClass}>
                  <SelectItem className={scheduleSelectItemClass} value="all">全部状态</SelectItem>
                  <SelectItem className={scheduleSelectItemClass} value="SLOT_BOOKED">已获取 Slot</SelectItem>
                  <SelectItem className={scheduleSelectItemClass} value="SUBMITTED">已完成递签</SelectItem>
                  <SelectItem className={scheduleSelectItemClass} value="COMPLETED">已完成</SelectItem>
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
          <div className="pro-status-glow-error rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-[32px] border border-white/5 bg-white/[0.02] text-white/60">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在加载递签日程...
          </div>
        ) : viewMode === "list" ? (
          <ScheduleListView
            groups={groups}
            hasAnyItems={hasAnyItems}
            onOpenItem={openItem}
            onEditSchedule={openQuickScheduleEditor}
          />
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
            onEditSchedule={openQuickScheduleEditor}
          />
        )}
        <Dialog open={Boolean(editingScheduleItem)} onOpenChange={(open) => !open && closeQuickScheduleEditor()}>
          <DialogContent className="border-white/10 bg-[#080808] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>设置递签时间</DialogTitle>
              <DialogDescription>
                {editingScheduleItem?.applicantName || "当前客户"}：
                {quickScheduleTarget === "slotTime"
                  ? "申根 Case 会写入 slot 时间。"
                  : "非申根 Case 会写入递签日期。"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="quick-schedule-date">递签日期 / 时间</Label>
              <Input
                id="quick-schedule-date"
                type="datetime-local"
                value={quickScheduleValue}
                className="pro-input pro-focus-glow"
                onChange={(event) => {
                  setQuickScheduleValue(event.target.value)
                  setQuickScheduleError("")
                }}
              />
              <p className="text-xs text-white/45">
                {quickScheduleTarget === "slotTime"
                  ? "保存后会从“未填写递签时间”移到对应日期。"
                  : "美签等非申根案件只保存日期，时间不会展示在详情页。"}
              </p>
            </div>
            {quickScheduleError ? (
              <div className="pro-status-glow-error rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">
                {quickScheduleError}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeQuickScheduleEditor} disabled={quickScheduleSaving}>
                取消
              </Button>
              <Button type="button" onClick={() => void saveQuickScheduleDate()} disabled={quickScheduleSaving}>
                {quickScheduleSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中
                  </>
                ) : (
                  "保存递签时间"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "blue" | "sky" | "slate" | "amber" | "emerald" }) {
  const className = {
    blue: "border-blue-400/20 bg-blue-400/10 text-white",
    sky: "border-sky-400/20 bg-sky-400/10 text-white",
    slate: "border-white/5 bg-white/[0.02] text-white",
    amber: "border-amber-400/20 bg-amber-400/10 text-white",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-white",
  }[tone]

  return (
    <div className={cn("pro-spotlight rounded-3xl border p-4", className)}>
      <div className="relative z-10 text-[10px] font-bold uppercase tracking-widest text-white/72">{label}</div>
      <div className="relative z-10 mt-2 font-mono text-3xl font-semibold text-white">{value}</div>
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
    <div className="flex h-10 items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-3 text-sm">
      <span className="font-medium text-white/65">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ScheduleListView({
  groups,
  hasAnyItems,
  onOpenItem,
  onEditSchedule,
}: {
  groups: ApplicantScheduleGroup[]
  hasAnyItems: boolean
  onOpenItem: (item: ApplicantScheduleItem) => void
  onEditSchedule: (item: ApplicantScheduleItem) => void
}) {
  if (!hasAnyItems) {
    return (
      <div className="pro-status-glow-success rounded-[32px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center text-white">
        <CalendarClock className="mx-auto h-10 w-10 text-white/38" />
        <div className="mt-4 text-lg font-semibold text-white">当前没有匹配的递签日程</div>
        <p className="mt-2 text-sm text-white/45">可以放宽日期范围，或进入申请人详情页补齐 Case 的 slot 时间。</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {groups.map((group) => (
        <Card key={group.key} className={cn("pro-spotlight overflow-hidden border shadow-none", groupToneClasses[group.tone])}>
          <CardHeader className="relative z-10 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-white">
                  <span className={cn("h-3 w-3 rounded-full", groupAccentClasses[group.tone])} />
                  {group.title}
                </CardTitle>
                <CardDescription className="mt-1 text-white/68">{group.helper}</CardDescription>
              </div>
              <Badge variant="outline" className="border-white/10 bg-white/[0.04] font-mono text-white/72">
                {group.items.length} 个
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {group.items.length > 0 ? (
              <div className="space-y-2">
                {group.items.map((item) => (
                  <ScheduleItemCard
                    key={item.id}
                    item={item}
                    onOpen={() => onOpenItem(item)}
                    onEditSchedule={() => onEditSchedule(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm font-medium text-white/62">
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
  onEditSchedule,
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
  onEditSchedule: (item: ApplicantScheduleItem) => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="pro-spotlight pro-spotlight-blue border-white/5 bg-white/[0.02] text-white shadow-none">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-white">{month} 月历</CardTitle>
              <CardDescription className="text-white/42">点击日期查看当天全部递签客户。</CardDescription>
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
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
            {scheduleVisaLegendItems.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-2.5 py-1">
                <span className={cn("h-2.5 w-2.5 rounded-full", visaToneClasses[item.key].dot)} />
                {item.label}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-white/45">
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
                  "min-h-28 rounded-2xl border p-2 text-left transition hover:border-blue-300/25 hover:bg-blue-400/10",
                  day.inCurrentMonth ? "border-white/5 bg-white/[0.02] text-white" : "border-white/5 bg-white/[0.01] text-white/28",
                  selectedDate === day.date && "border-blue-300/35 bg-blue-400/10 ring-2 ring-blue-400/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{day.dayOfMonth}</span>
                  {day.items.length > 0 ? (
                    <span className="rounded-full bg-white px-2 py-0.5 font-mono text-xs text-black">{day.items.length}</span>
                  ) : null}
                </div>
                <div className="mt-2 space-y-1">
                  {day.items.slice(0, 3).map((item) => {
                    const tone = getVisaTone(item)
                    return (
                      <div
                        key={item.id}
                        className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium", tone.chip)}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
                        <span className="truncate text-white/85">{item.applicantName}</span>
                      </div>
                    )
                  })}
                  {day.items.length > 3 ? (
                    <div className="font-mono text-xs font-medium text-white/45">+{day.items.length - 3} 个</div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="pro-spotlight pro-spotlight-blue border-white/5 bg-white/[0.02] text-white shadow-none">
        <CardHeader>
          <CardTitle className="font-mono text-white">{selectedDate}</CardTitle>
          <CardDescription className="text-white/42">当天递签客户</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedDay?.items.length ? (
            <div className="space-y-2">
              {selectedDay.items.map((item) => (
                <ScheduleItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => onOpenItem(item)}
                  onEditSchedule={() => onEditSchedule(item)}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/45">
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
  onEditSchedule,
  compact = false,
}: {
  item: ApplicantScheduleItem
  onOpen: () => void
  onEditSchedule?: () => void
  compact?: boolean
}) {
  const assigneeLabel = item.assignee?.name || item.assignee?.email || "未分配"
  const tone = getVisaTone(item)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        "pro-spotlight relative w-full overflow-hidden rounded-2xl border p-4 pl-5 text-left transition hover:-translate-y-0.5",
        tone.card,
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", tone.stripe)} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-white">{item.applicantName}</span>
            <Badge variant="outline" className={tone.badge}>
              {getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}
            </Badge>
            <Badge variant="outline" className="border-white/[0.12] bg-white/[0.04] text-white/70">{getStatusLabel(item.mainStatus)}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-white/62">
            <span className="inline-flex items-center gap-1">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              {formatScheduleDateTime(getScheduleDateTime(item))}
            </span>
            <span>{item.tlsCity || getApplicantCrmRegionLabel(item.applyRegion || "") || "未填写城市"}</span>
            {item.travelDate ? <span>出行：{formatScheduleDate(item.travelDate)}</span> : null}
          </div>
        </div>
        {!compact ? (
          <div className="flex shrink-0 flex-col items-start gap-2 text-xs text-white/62 lg:items-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-white/[0.04] hover:text-white"
              onClick={(event) => {
                event.stopPropagation()
                onEditSchedule?.()
              }}
              title="点击设置递签时间"
            >
              <UserRound className="h-4 w-4" />
              {assigneeLabel}
            </button>
            {onEditSchedule ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="pro-cta-glow h-8 rounded-full border-white/10 bg-white/[0.06] px-3 text-xs text-white/88 hover:bg-white/[0.1] hover:text-white"
                onClick={(event) => {
                  event.stopPropagation()
                  onEditSchedule()
                }}
              >
                设置递签时间
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

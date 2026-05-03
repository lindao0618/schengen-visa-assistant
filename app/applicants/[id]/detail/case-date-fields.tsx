"use client"

import { useRef } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const labelClass = "text-[10px] font-bold uppercase tracking-widest text-white/35"
const inputClass = "h-12 rounded-2xl border-white/10 bg-white/[0.055] text-white placeholder:text-white/25 focus-visible:ring-2 focus-visible:ring-blue-500/20"
const selectTriggerClass = "min-h-12 border-white/10 bg-white/[0.055] text-white hover:border-blue-300/40"

const SLOT_TIME_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hh = String(hour).padStart(2, "0")
  const mm = String(minute).padStart(2, "0")
  const value = `${hh}:${mm}`
  return { value, label: value }
})

export function BookingWindowRangeField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { start, end } = splitBookingWindow(value)
  const endDateInputRef = useRef<HTMLInputElement | null>(null)

  const openEndDatePicker = () => {
    const target = endDateInputRef.current
    if (!target) return
    target.focus()
    const picker = (target as HTMLInputElement & { showPicker?: () => void }).showPicker
    if (typeof picker === "function") {
      picker.call(target)
    }
  }

  return (
    <div className="space-y-2">
      <Label className={labelClass}>{label}</Label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input
          type="date"
          value={start}
          disabled={disabled}
          className={inputClass}
          onChange={(event) => {
            const nextStart = event.target.value
            const nextEnd = end && nextStart && end < nextStart ? "" : end
            onChange(mergeBookingWindow(nextStart, nextEnd))
            if (event.target.value) {
              window.setTimeout(openEndDatePicker, 0)
            }
          }}
        />
        <Input
          ref={endDateInputRef}
          type="date"
          min={start || undefined}
          value={end}
          disabled={disabled}
          className={inputClass}
          onChange={(event) => onChange(mergeBookingWindow(start, event.target.value))}
        />
      </div>
      <p className="text-xs text-white/35">保存格式：YYYY/MM/DD - YYYY/MM/DD</p>
    </div>
  )
}

export function SlotTimeField({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { date, time } = splitDateTimeLocal(value)

  return (
    <div className="space-y-2">
      <Label className={labelClass}>slot 时间</Label>
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          type="date"
          value={date}
          disabled={disabled}
          className={inputClass}
          onChange={(event) => {
            const nextDate = event.target.value
            if (!nextDate) {
              onChange("")
              return
            }
            const nextTime = time || "07:00"
            onChange(mergeDateTimeLocal(nextDate, nextTime))
          }}
        />
        <Select
          disabled={disabled}
          value={time || "__unset__"}
          onValueChange={(next) => {
            if (next === "__unset__") {
              onChange("")
              return
            }
            const targetDate = date || getTodayInputDate()
            onChange(mergeDateTimeLocal(targetDate, next))
          }}
        >
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="选择时间：07:00-16:30" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">未设置</SelectItem>
            {SLOT_TIME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-white/35">可选时间：07:00 - 16:30，每 30 分钟一档。</p>
    </div>
  )
}

function normalizeSlashDate(value: string) {
  return value.replace(/\./g, "/").replace(/-/g, "/").trim()
}

function toInputDate(value: string) {
  const normalized = normalizeSlashDate(value)
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return ""
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function fromInputDate(value: string) {
  if (!value) return ""
  return value.replace(/-/g, "/")
}

function splitBookingWindow(value?: string | null) {
  const raw = (value || "").trim()
  if (!raw) return { start: "", end: "" }
  const compact = raw.replace(/\s+/g, " ")
  const exact = compact.match(
    /(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\s*(?:-|~|至|到|—|–)\s*(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/,
  )
  if (exact) {
    return { start: toInputDate(exact[1]), end: toInputDate(exact[2]) }
  }

  const hits = compact.match(/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/g) || []
  return {
    start: hits[0] ? toInputDate(hits[0]) : "",
    end: hits[1] ? toInputDate(hits[1]) : "",
  }
}

function mergeBookingWindow(start: string, end: string) {
  const startText = fromInputDate(start)
  const endText = fromInputDate(end)
  if (startText && endText) return `${startText} - ${endText}`
  if (startText) return startText
  if (endText) return endText
  return ""
}

function splitDateTimeLocal(value: string) {
  if (!value) return { date: "", time: "" }
  const [datePart, timePart = ""] = value.split("T")
  return { date: datePart || "", time: timePart.slice(0, 5) }
}

function mergeDateTimeLocal(date: string, time: string) {
  if (!date || !time) return ""
  return `${date}T${time}`
}

function getTodayInputDate() {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

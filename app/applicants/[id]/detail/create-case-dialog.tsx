"use client"

import { type Dispatch, type SetStateAction, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
  deriveApplicantCaseTypeFromVisaType,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { FRANCE_TLS_CITY_OPTIONS } from "@/lib/france-tls-city"

import type { ApplicantDetailResponse, CaseFormState } from "./types"

type CreateCaseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: ApplicantDetailResponse
  newCaseForm: CaseFormState
  setNewCaseForm: Dispatch<SetStateAction<CaseFormState>>
  isReadOnlyViewer: boolean
  canAssignCase: boolean
  canEditApplicant: boolean
  creatingCase: boolean
  onCreateCase: () => void | Promise<void>
}

const SLOT_TIME_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hh = String(hour).padStart(2, "0")
  const mm = String(minute).padStart(2, "0")
  const value = `${hh}:${mm}`
  return { value, label: value }
})

export function CreateCaseDialog({
  open,
  onOpenChange,
  detail,
  newCaseForm,
  setNewCaseForm,
  isReadOnlyViewer,
  canAssignCase,
  canEditApplicant,
  creatingCase,
  onCreateCase,
}: CreateCaseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建 Case</DialogTitle>
          <DialogDescription>先创建一条 Case，再推进状态、归档材料和挂提醒规则。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="案件类型" value={getApplicantCrmVisaTypeLabel(newCaseForm.visaType || newCaseForm.caseType)} />
          <div className="space-y-2">
            <Label>签证类型</Label>
            <Select
              disabled={isReadOnlyViewer}
              value={newCaseForm.visaType || newCaseForm.caseType}
              onValueChange={(value) =>
                setNewCaseForm((prev) => ({
                  ...prev,
                  visaType: value,
                  caseType: deriveApplicantCaseTypeFromVisaType(value),
                  tlsCity: value === "france-schengen" ? prev.tlsCity : "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择签证类型" />
              </SelectTrigger>
              <SelectContent>
                {CRM_VISA_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>地区</Label>
            <Select
              disabled={isReadOnlyViewer}
              value={newCaseForm.applyRegion || "__unset__"}
              onValueChange={(value) =>
                setNewCaseForm((prev) => ({
                  ...prev,
                  applyRegion: value === "__unset__" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择地区" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">暂不设置</SelectItem>
                {CRM_REGION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newCaseForm.caseType === "france-schengen" ? (
            <div className="space-y-2">
              <Label>TLS 城市</Label>
              <Select
                disabled={isReadOnlyViewer}
                value={newCaseForm.tlsCity || "__unset__"}
                onValueChange={(value) =>
                  setNewCaseForm((prev) => ({
                    ...prev,
                    tlsCity: value === "__unset__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 TLS 城市" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">暂不设置</SelectItem>
                  {FRANCE_TLS_CITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <ReadOnlyField label="TLS 城市" value="-" />
          )}

          {newCaseForm.caseType === "france-schengen" ? (
            <BookingWindowRangeField
              label="抢号区间"
              value={newCaseForm.bookingWindow}
              onChange={(value) => setNewCaseForm((prev) => ({ ...prev, bookingWindow: value }))}
              disabled={isReadOnlyViewer}
            />
          ) : (
            <ReadOnlyField label="抢号区间" value="-" />
          )}

          {newCaseForm.caseType === "france-schengen" ? (
            <div className="space-y-2">
              <Label>是否接受 VIP</Label>
              <Select
                disabled={isReadOnlyViewer}
                value={newCaseForm.acceptVip || "__unset__"}
                onValueChange={(value) =>
                  setNewCaseForm((prev) => ({
                    ...prev,
                    acceptVip: value === "__unset__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">未设置</SelectItem>
                  <SelectItem value="接受">接受</SelectItem>
                  <SelectItem value="不接受">不接受</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <ReadOnlyField label="是否接受 VIP" value="-" />
          )}

          <div className="space-y-2">
            <Label>优先级</Label>
            <Select
              disabled={isReadOnlyViewer}
              value={newCaseForm.priority}
              onValueChange={(value) => setNewCaseForm((prev) => ({ ...prev, priority: value }))}
            >
              <SelectTrigger
                className={
                  newCaseForm.priority === "urgent"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : newCaseForm.priority === "high"
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                }
              >
                <SelectValue placeholder="选择优先级" />
              </SelectTrigger>
              <SelectContent>
                {CRM_PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>分配给</Label>
            <Select
              disabled={!canAssignCase || isReadOnlyViewer}
              value={newCaseForm.assignedToUserId || "__unset__"}
              onValueChange={(value) =>
                setNewCaseForm((prev) => ({
                  ...prev,
                  assignedToUserId: value === "__unset__" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="未分配" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">未分配</SelectItem>
                {detail.availableAssignees.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {(option.name || option.email) + ` (${option.role})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field
            label="出行时间"
            type="date"
            value={newCaseForm.travelDate}
            onChange={(value) => setNewCaseForm((prev) => ({ ...prev, travelDate: value }))}
            disabled={isReadOnlyViewer}
          />
          <Field
            label="递签时间"
            type="date"
            value={newCaseForm.submissionDate}
            onChange={(value) => setNewCaseForm((prev) => ({ ...prev, submissionDate: value }))}
            disabled={isReadOnlyViewer}
          />
        </div>

        {newCaseForm.caseType === "france-schengen" ? (
          <SlotTimeField
            value={newCaseForm.slotTime}
            onChange={(value) => setNewCaseForm((prev) => ({ ...prev, slotTime: value }))}
            disabled={isReadOnlyViewer}
          />
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void onCreateCase()} disabled={creatingCase || !canEditApplicant}>
            {creatingCase ? "创建中..." : "创建 Case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} readOnly className="bg-gray-50" />
    </div>
  )
}

function BookingWindowRangeField({
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
      <Label>{label}</Label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input
          type="date"
          value={start}
          disabled={disabled}
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
          onChange={(event) => onChange(mergeBookingWindow(start, event.target.value))}
        />
      </div>
      <p className="text-xs text-gray-500">保存格式：YYYY/MM/DD - YYYY/MM/DD</p>
    </div>
  )
}

function SlotTimeField({
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
      <Label>slot 时间</Label>
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          type="date"
          value={date}
          disabled={disabled}
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
          <SelectTrigger>
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
      <p className="text-xs text-gray-500">可选时间：07:00 - 16:30，每 30 分钟一档。</p>
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

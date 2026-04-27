"use client"

import type { Dispatch, SetStateAction } from "react"
import { useRef } from "react"
import { Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AssigneeOption, CaseFormState, VisaCaseRecord } from "@/app/applicants/[id]/detail/types"
import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
  deriveApplicantCaseTypeFromVisaType,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { formatFranceStatusLabel } from "@/lib/france-case-labels"
import { FRANCE_TLS_CITY_OPTIONS } from "@/lib/france-tls-city"
import { Field, formatDateTime, ReadOnlyField, Section } from "@/app/applicants/[id]/detail/detail-ui"

const SLOT_TIME_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  return { value, label: value }
})

function formatCaseStatus(mainStatus?: string | null, subStatus?: string | null, caseType?: string | null) {
  if (caseType === "france-schengen") {
    return formatFranceStatusLabel(mainStatus, subStatus)
  }
  return `${mainStatus || "-"}${subStatus ? ` / ${subStatus}` : ""}`
}

function splitBookingWindow(value?: string | null) {
  if (!value) return { start: "", end: "" }
  const normalized = value.trim()
  if (!normalized) return { start: "", end: "" }
  const parts = normalized
    .split(/\s*(?:-|~|至|到)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  return {
    start: normalizeBookingDate(parts[0] || ""),
    end: normalizeBookingDate(parts[1] || ""),
  }
}

function normalizeBookingDate(value: string) {
  if (!value) return ""
  return value.replaceAll("/", "-")
}

function mergeBookingWindow(start: string, end: string) {
  const normalizedStart = start.trim()
  const normalizedEnd = end.trim()
  if (!normalizedStart && !normalizedEnd) return ""
  if (normalizedStart && normalizedEnd) return `${normalizedStart.replaceAll("-", "/")} - ${normalizedEnd.replaceAll("-", "/")}`
  return (normalizedStart || normalizedEnd).replaceAll("-", "/")
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

export function CaseDetailForm({
  selectedCase,
  caseForm,
  setCaseForm,
  availableAssignees,
  isReadOnlyViewer,
  canAssignCase,
  canEditApplicant,
  savingCase,
  onSaveCase,
}: {
  selectedCase: VisaCaseRecord | null
  caseForm: CaseFormState
  setCaseForm: Dispatch<SetStateAction<CaseFormState>>
  availableAssignees: AssigneeOption[]
  isReadOnlyViewer: boolean
  canAssignCase: boolean
  canEditApplicant: boolean
  savingCase: boolean
  onSaveCase: () => Promise<void>
}) {
  return (
    <Section
      title="Case 详情"
      description="这里维护案件基础信息。对于 France Case，设为当前案件后，自动化和进度条就会围绕这条 Case 运行。"
      tone="amber"
    >
      {!selectedCase ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-6 text-sm text-amber-800">请选择左侧的 Case。</div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ReadOnlyField label="Case ID" value={selectedCase.id} />
            <ReadOnlyField label="当前状态" value={formatCaseStatus(selectedCase.mainStatus, selectedCase.subStatus, selectedCase.caseType)} />
            <ReadOnlyField label="最近更新" value={formatDateTime(selectedCase.updatedAt)} />
            <ReadOnlyField label="案件类型" value={getApplicantCrmVisaTypeLabel(caseForm.visaType || caseForm.caseType)} />

            <div className="space-y-2">
              <Label>签证类型</Label>
              <Select
                disabled={isReadOnlyViewer}
                value={caseForm.visaType || caseForm.caseType}
                onValueChange={(value) =>
                  setCaseForm((prev) => ({
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
              <Label>DS-160 预检查 JSON</Label>
              {selectedCase.ds160PrecheckFile ? (
                <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/90 p-3">
                  <div className="text-sm font-medium text-sky-950">{selectedCase.ds160PrecheckFile.originalName}</div>
                  <div className="text-xs text-sky-800/70">上传时间：{formatDateTime(selectedCase.ds160PrecheckFile.uploadedAt)}</div>
                  <Button variant="outline" size="sm" asChild className="border-sky-300 text-sky-800 hover:bg-sky-100">
                    <a href={`/api/cases/${selectedCase.id}/precheck-file`} target="_blank" rel="noopener noreferrer">
                      查看预检查 JSON
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50/70 p-3 text-sm text-sky-800">当前案件还没有保存 DS-160 预检查结果。</div>
              )}
            </div>

            <div className="space-y-2">
              <Label>地区</Label>
              <Select
                disabled={isReadOnlyViewer}
                value={caseForm.applyRegion || "__unset__"}
                onValueChange={(value) => setCaseForm((prev) => ({ ...prev, applyRegion: value === "__unset__" ? "" : value }))}
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

            {caseForm.caseType === "france-schengen" ? (
              <div className="space-y-2">
                <Label>TLS 城市</Label>
                <Select
                  disabled={isReadOnlyViewer}
                  value={caseForm.tlsCity || "__unset__"}
                  onValueChange={(value) => setCaseForm((prev) => ({ ...prev, tlsCity: value === "__unset__" ? "" : value }))}
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

            {caseForm.caseType === "france-schengen" ? (
              <BookingWindowRangeField
                label="抢号区间"
                value={caseForm.bookingWindow}
                onChange={(value) => setCaseForm((prev) => ({ ...prev, bookingWindow: value }))}
                disabled={isReadOnlyViewer}
              />
            ) : (
              <ReadOnlyField label="抢号区间" value="-" />
            )}

            {caseForm.caseType !== "france-schengen" ? <ReadOnlyField label="是否接受 VIP" value="-" /> : null}

            <div className="space-y-2">
              <Label>优先级</Label>
              <Select disabled={isReadOnlyViewer} value={caseForm.priority} onValueChange={(value) => setCaseForm((prev) => ({ ...prev, priority: value }))}>
                <SelectTrigger
                  className={
                    caseForm.priority === "urgent"
                      ? "border-red-300 bg-red-50 text-red-700"
                      : caseForm.priority === "high"
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

            {caseForm.caseType !== "france-schengen" ? (
              <Field label="出行时间" type="date" value={caseForm.travelDate} onChange={(value) => setCaseForm((prev) => ({ ...prev, travelDate: value }))} disabled={isReadOnlyViewer} />
            ) : null}
            {caseForm.caseType !== "france-schengen" ? (
              <Field
                label="递签时间"
                type="date"
                value={caseForm.submissionDate}
                onChange={(value) => setCaseForm((prev) => ({ ...prev, submissionDate: value }))}
                disabled={isReadOnlyViewer}
              />
            ) : null}

            <div className="space-y-2">
              <Label>分配给</Label>
              <Select
                disabled={!canAssignCase || isReadOnlyViewer}
                value={caseForm.assignedToUserId || "__unset__"}
                onValueChange={(value) => setCaseForm((prev) => ({ ...prev, assignedToUserId: value === "__unset__" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未分配" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">未分配</SelectItem>
                  {availableAssignees.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {(option.name || option.email) + ` (${option.role})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>当前案件</Label>
              <Select disabled={isReadOnlyViewer} value={caseForm.isActive ? "yes" : "no"} onValueChange={(value) => setCaseForm((prev) => ({ ...prev, isActive: value === "yes" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">是</SelectItem>
                  <SelectItem value="no">否</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {caseForm.caseType === "france-schengen" ? (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 p-4">
              <div className="mb-3">
                <div className="text-sm font-semibold text-amber-950">slot 信息</div>
                <div className="text-xs text-amber-800/70">单独维护递签时间，方便直接查看和提取。</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SlotTimeField value={caseForm.slotTime} onChange={(value) => setCaseForm((prev) => ({ ...prev, slotTime: value }))} disabled={isReadOnlyViewer} />
                <div className="space-y-2">
                  <Label>是否接受 VIP</Label>
                  <Select
                    disabled={isReadOnlyViewer}
                    value={caseForm.acceptVip || "__unset__"}
                    onValueChange={(value) => setCaseForm((prev) => ({ ...prev, acceptVip: value === "__unset__" ? "" : value }))}
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
                <ReadOnlyField label="当前 slot 展示" value={formatDateTime(caseForm.slotTime || null)} />
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={() => void onSaveCase()} disabled={savingCase || !canEditApplicant} className="rounded-2xl bg-amber-500 text-white hover:bg-amber-600">
              <Save className="mr-2 h-4 w-4" />
              {savingCase ? "保存中..." : "保存 Case"}
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

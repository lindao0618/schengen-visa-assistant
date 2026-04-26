"use client"

import type { Dispatch, ReactNode, SetStateAction } from "react"
import { useRef } from "react"
import { Plus, Save } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import type { AssigneeOption, CaseFormState, VisaCaseRecord } from "@/app/applicants/[id]/detail/types"
import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
  deriveApplicantCaseTypeFromVisaType,
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { formatFranceStatusLabel } from "@/lib/france-case-labels"
import { FRANCE_TLS_CITY_OPTIONS } from "@/lib/france-tls-city"
import { cn } from "@/lib/utils"

const SLOT_TIME_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  return { value, label: value }
})

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function getPriorityLabel(value?: string | null) {
  if (!value) return "-"
  if (value === "urgent") return "紧急"
  if (value === "high") return "高优先级"
  return "普通"
}

function getPriorityVariant(value?: string | null) {
  if (value === "urgent") return "destructive" as const
  if (value === "high") return "warning" as const
  return "outline" as const
}

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

function Section({
  title,
  description,
  tone = "slate",
  children,
}: {
  title: string
  description: string
  tone?: "slate" | "sky" | "emerald" | "amber"
  children: ReactNode
}) {
  const toneMap = {
    slate: {
      card: "border-slate-200 bg-white/95",
      title: "text-slate-900",
      desc: "text-slate-500",
    },
    sky: {
      card: "border-sky-200 bg-[linear-gradient(180deg,_#ffffff,_#f0f9ff)]",
      title: "text-sky-950",
      desc: "text-sky-700/80",
    },
    emerald: {
      card: "border-emerald-200 bg-[linear-gradient(180deg,_#ffffff,_#ecfdf5)]",
      title: "text-emerald-950",
      desc: "text-emerald-700/80",
    },
    amber: {
      card: "border-amber-200 bg-[linear-gradient(180deg,_#ffffff,_#fffbeb)]",
      title: "text-amber-950",
      desc: "text-amber-700/80",
    },
  } as const

  const styles = toneMap[tone]
  return (
    <Card className={cn("shadow-sm", styles.card)}>
      <CardHeader>
        <CardTitle className={cn("text-lg font-semibold", styles.title)}>{title}</CardTitle>
        <CardDescription className={cn("text-sm", styles.desc)}>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
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
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} />
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

export function CasesTabContent({
  cases,
  selectedCaseId,
  onSelectCaseId,
  selectedCase,
  caseForm,
  setCaseForm,
  availableAssignees,
  isReadOnlyViewer,
  canAssignCase,
  canEditApplicant,
  savingCase,
  onOpenCreateCase,
  onSaveCase,
}: {
  cases: VisaCaseRecord[]
  selectedCaseId: string
  onSelectCaseId: (caseId: string) => void
  selectedCase: VisaCaseRecord | null
  caseForm: CaseFormState
  setCaseForm: Dispatch<SetStateAction<CaseFormState>>
  availableAssignees: AssigneeOption[]
  isReadOnlyViewer: boolean
  canAssignCase: boolean
  canEditApplicant: boolean
  savingCase: boolean
  onOpenCreateCase: () => void
  onSaveCase: () => Promise<void>
}) {
  return (
    <TabsContent value="cases" className="space-y-6">
      {cases.length > 0 ? (
        <Section title="案件切换" description="同一个申请人可同时办理多个签证案件，点击标签即可切换当前工作案件。" tone="amber">
          <div className="flex flex-wrap gap-3">
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCaseId(item.id)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-all",
                  selectedCaseId === item.id
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-200 bg-white text-amber-900 hover:border-amber-300 hover:bg-amber-50",
                ].join(" ")}
              >
                {getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}
                {item.applyRegion ? ` · ${getApplicantCrmRegionLabel(item.applyRegion)}` : ""}
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Section title="Case 列表" description="一个申请人可以挂多个 Case。当前激活中的 France Case 会驱动法签自动化和提醒。" tone="amber">
          <div className="space-y-3">
            <Button onClick={onOpenCreateCase} disabled={!canEditApplicant} className="w-full rounded-2xl bg-amber-500 text-white hover:bg-amber-600">
              <Plus className="mr-2 h-4 w-4" />
              新建 Case
            </Button>

            {cases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-800">
                当前还没有 Case，先创建一个再继续。
              </div>
            ) : (
              cases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectCaseId(item.id)}
                  className={[
                    "w-full rounded-2xl border p-4 text-left shadow-sm transition-all",
                    selectedCaseId === item.id
                      ? "border-amber-500 bg-[linear-gradient(135deg,_#f59e0b,_#d97706)] text-white"
                      : "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/60",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}</div>
                      <div className="mt-1 text-xs opacity-80">{item.applyRegion ? getApplicantCrmRegionLabel(item.applyRegion) : "未设置地区"}</div>
                    </div>
                    {item.isActive ? <Badge variant={selectedCaseId === item.id ? "secondary" : "info"}>当前案件</Badge> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={getPriorityVariant(item.priority)}>{getPriorityLabel(item.priority)}</Badge>
                    {item.exceptionCode ? <Badge variant="destructive">异常处理中</Badge> : null}
                  </div>
                  <div className="mt-3 text-xs opacity-80">最近更新：{formatDateTime(item.updatedAt)}</div>
                </button>
              ))
            )}
          </div>
        </Section>

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
                    <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50/70 p-3 text-sm text-sky-800">
                      当前案件还没有保存 DS-160 预检查结果。
                    </div>
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
      </div>
    </TabsContent>
  )
}

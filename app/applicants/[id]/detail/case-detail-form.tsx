"use client"

import type { Dispatch, SetStateAction } from "react"
import { FileText, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CaseCommandBar } from "@/app/applicants/[id]/detail/case-command-bar"
import { BookingWindowRangeField, SlotTimeField } from "@/app/applicants/[id]/detail/case-date-fields"
import type { AssigneeOption, CaseFormState, VisaCaseRecord } from "@/app/applicants/[id]/detail/types"
import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
  deriveApplicantCaseTypeFromVisaType,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { FRANCE_TLS_CITY_OPTIONS } from "@/lib/france-tls-city"
import { Field, formatDateTime, ReadOnlyField } from "@/app/applicants/[id]/detail/detail-ui"

const labelClass = "text-[10px] font-bold uppercase tracking-widest text-white/35"
const selectTriggerClass = "min-h-12 border-white/10 bg-white/[0.055] text-white hover:border-blue-300/40"

function getVisaTypeIcon(value?: string | null) {
  if (value === "france-schengen") return "🇫🇷"
  if (value === "usa-visa") return "🇺🇸"
  if (value === "uk-visa") return "🇬🇧"
  return "✦"
}

function getRegionIcon(value?: string | null) {
  if (value === "france") return "🇫🇷"
  if (value === "usa") return "🇺🇸"
  if (value === "uk") return "🇬🇧"
  if (value === "china") return "🇨🇳"
  return "⌁"
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
    <section className="relative overflow-hidden rounded-[32px] border border-white/[0.06] bg-[#151518] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_32%),linear-gradient(180deg,#151518,#101012)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] md:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/5 blur-[72px]" />
      <div className="relative z-10 mb-7 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Case Detail Config</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Case 详情配置</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">维护签证案件的基础信息，此 Case 的配置将驱动提醒、自动化和 Slot 预约流程。</p>
        </div>
      </div>

      {!selectedCase ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-sm text-white/45">请选择左侧的 Case。</div>
      ) : (
        <div className="relative z-10 space-y-6">
          <CaseCommandBar
            selectedCase={selectedCase}
            caseForm={caseForm}
            canEditApplicant={canEditApplicant}
            savingCase={savingCase}
            onSaveCase={onSaveCase}
          />

          <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.025] p-5 shadow-inner shadow-white/[0.02] md:p-6">
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Core Case Fields</p>
              <h3 className="mt-2 text-base font-bold tracking-tight text-white">基础参数</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="案件类型" value={getApplicantCrmVisaTypeLabel(caseForm.visaType || caseForm.caseType)} />

              <div className="space-y-2">
                <Label className={labelClass}>签证类型</Label>
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
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="选择签证类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_VISA_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="inline-flex items-center gap-2">
                          <span className="text-base leading-none">{getVisaTypeIcon(option.value)}</span>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>所属地区</Label>
                <Select
                  disabled={isReadOnlyViewer}
                  value={caseForm.applyRegion || "__unset__"}
                  onValueChange={(value) => setCaseForm((prev) => ({ ...prev, applyRegion: value === "__unset__" ? "" : value }))}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="选择地区" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">暂不设置</SelectItem>
                    {CRM_REGION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="inline-flex items-center gap-2">
                          <span className="text-base leading-none">{getRegionIcon(option.value)}</span>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>优先级</Label>
                <Select disabled={isReadOnlyViewer} value={caseForm.priority} onValueChange={(value) => setCaseForm((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger
                    className={[
                      selectTriggerClass,
                      caseForm.priority === "urgent"
                        ? "border-red-400/30 bg-red-400/10 text-red-200"
                        : caseForm.priority === "high"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                          : "border-white/10 bg-white/[0.055] text-white",
                    ].join(" ")}
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
                <Label className={labelClass}>分配给</Label>
                <Select
                  disabled={!canAssignCase || isReadOnlyViewer}
                  value={caseForm.assignedToUserId || "__unset__"}
                  onValueChange={(value) => setCaseForm((prev) => ({ ...prev, assignedToUserId: value === "__unset__" ? "" : value }))}
                >
                  <SelectTrigger className={selectTriggerClass}>
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
                <Label className={labelClass}>当前案件</Label>
                <Select disabled={isReadOnlyViewer} value={caseForm.isActive ? "yes" : "no"} onValueChange={(value) => setCaseForm((prev) => ({ ...prev, isActive: value === "yes" }))}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">是</SelectItem>
                    <SelectItem value="no">否</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {caseForm.caseType === "france-schengen" ? (
            <FranceSchengenCaseSection caseForm={caseForm} setCaseForm={setCaseForm} isReadOnlyViewer={isReadOnlyViewer} />
          ) : caseForm.caseType === "usa-visa" ? (
            <UsVisaCaseSection selectedCase={selectedCase} caseForm={caseForm} setCaseForm={setCaseForm} isReadOnlyViewer={isReadOnlyViewer} />
          ) : (
            <GeneralTravelCaseSection caseForm={caseForm} setCaseForm={setCaseForm} isReadOnlyViewer={isReadOnlyViewer} />
          )}
        </div>
      )}
    </section>
  )
}

function FranceSchengenCaseSection({
  caseForm,
  setCaseForm,
  isReadOnlyViewer,
}: {
  caseForm: CaseFormState
  setCaseForm: Dispatch<SetStateAction<CaseFormState>>
  isReadOnlyViewer: boolean
}) {
  const acceptVipValue =
    caseForm.acceptVip === "接受" ? "yes" : caseForm.acceptVip === "不接受" ? "no" : caseForm.acceptVip || "__unset__"

  return (
    <div className="border-t border-white/[0.06] pt-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">France TLS Automation</p>
          <h3 className="mt-2 text-base font-bold tracking-tight text-white">Slot 预约配置</h3>
        </div>
        <UploadCloud className="h-4 w-4 text-white/25" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label className={labelClass}>TLS 城市</Label>
          <Select
            disabled={isReadOnlyViewer}
            value={caseForm.tlsCity || "__unset__"}
            onValueChange={(value) => setCaseForm((prev) => ({ ...prev, tlsCity: value === "__unset__" ? "" : value }))}
          >
            <SelectTrigger className={selectTriggerClass}>
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
        <BookingWindowRangeField
          label="目标时段"
          value={caseForm.bookingWindow}
          onChange={(value) => setCaseForm((prev) => ({ ...prev, bookingWindow: value }))}
          disabled={isReadOnlyViewer}
        />
        <div className="space-y-2">
          <Label className={labelClass}>VIP 服务</Label>
          <Select
            disabled={isReadOnlyViewer}
            value={acceptVipValue}
            onValueChange={(value) => setCaseForm((prev) => ({ ...prev, acceptVip: value === "__unset__" ? "" : value }))}
          >
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unset__">未设置</SelectItem>
              <SelectItem value="yes">接受</SelectItem>
              <SelectItem value="no">不接受</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SlotTimeField value={caseForm.slotTime} onChange={(value) => setCaseForm((prev) => ({ ...prev, slotTime: value }))} disabled={isReadOnlyViewer} />
        <ReadOnlyField label="当前 slot 展示" value={formatDateTime(caseForm.slotTime || null)} />
      </div>
    </div>
  )
}

function UsVisaCaseSection({
  selectedCase,
  caseForm,
  setCaseForm,
  isReadOnlyViewer,
}: {
  selectedCase: VisaCaseRecord
  caseForm: CaseFormState
  setCaseForm: Dispatch<SetStateAction<CaseFormState>>
  isReadOnlyViewer: boolean
}) {
  return (
    <div className="border-t border-white/[0.06] pt-8">
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">US Consular Workflow</p>
        <h3 className="mt-2 text-base font-bold tracking-tight text-white">美国签证配置</h3>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="出行时间" type="date" value={caseForm.travelDate} onChange={(value) => setCaseForm((prev) => ({ ...prev, travelDate: value }))} disabled={isReadOnlyViewer} />
        <Field
          label="面试时间"
          type="date"
          value={caseForm.submissionDate}
          onChange={(value) => setCaseForm((prev) => ({ ...prev, submissionDate: value }))}
          disabled={isReadOnlyViewer}
        />
        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Label className={labelClass}>DS-160 预检查数据</Label>
            <button type="button" className="text-[10px] font-bold text-blue-300 transition hover:text-blue-200">
              上传 JSON
            </button>
          </div>
          {selectedCase.ds160PrecheckFile ? (
            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
              <div className="text-sm font-bold text-blue-100">{selectedCase.ds160PrecheckFile.originalName}</div>
              <div className="mt-1 text-xs text-blue-100/55">上传时间：{formatDateTime(selectedCase.ds160PrecheckFile.uploadedAt)}</div>
              <Button variant="outline" size="sm" asChild className="mt-3 rounded-xl border-blue-300/30 bg-transparent text-blue-100 hover:bg-blue-400/10">
                <a href={`/api/cases/${selectedCase.id}/precheck-file`} target="_blank" rel="noopener noreferrer">
                  查看预检查 JSON
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-5 text-center">
              <FileText className="mb-3 h-5 w-5 text-white/25" />
              <p className="text-sm text-white/38">当前案件还没有保存 DS-160 预检查结果</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GeneralTravelCaseSection({
  caseForm,
  setCaseForm,
  isReadOnlyViewer,
}: {
  caseForm: CaseFormState
  setCaseForm: Dispatch<SetStateAction<CaseFormState>>
  isReadOnlyViewer: boolean
}) {
  return (
    <div className="border-t border-white/[0.06] pt-8">
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Travel Timeline</p>
        <h3 className="mt-2 text-base font-bold tracking-tight text-white">出行与递签配置</h3>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="出行时间" type="date" value={caseForm.travelDate} onChange={(value) => setCaseForm((prev) => ({ ...prev, travelDate: value }))} disabled={isReadOnlyViewer} />
        <Field
          label="递签时间"
          type="date"
          value={caseForm.submissionDate}
          onChange={(value) => setCaseForm((prev) => ({ ...prev, submissionDate: value }))}
          disabled={isReadOnlyViewer}
        />
      </div>
    </div>
  )
}

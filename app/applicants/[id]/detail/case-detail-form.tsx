"use client"

import type { Dispatch, SetStateAction } from "react"

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
import { formatFranceStatusLabel } from "@/lib/france-case-labels"
import { FRANCE_TLS_CITY_OPTIONS } from "@/lib/france-tls-city"
import { Field, formatDateTime, ReadOnlyField, Section } from "@/app/applicants/[id]/detail/detail-ui"

function formatCaseStatus(mainStatus?: string | null, subStatus?: string | null, caseType?: string | null) {
  if (caseType === "france-schengen") {
    return formatFranceStatusLabel(mainStatus, subStatus)
  }
  return `${mainStatus || "-"}${subStatus ? ` / ${subStatus}` : ""}`
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
          <CaseCommandBar
            selectedCase={selectedCase}
            caseForm={caseForm}
            canEditApplicant={canEditApplicant}
            savingCase={savingCase}
            onSaveCase={onSaveCase}
          />

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
        </div>
      )}
    </Section>
  )
}

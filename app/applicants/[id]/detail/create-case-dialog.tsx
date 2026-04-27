"use client"

import { type Dispatch, type SetStateAction } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookingWindowRangeField, SlotTimeField } from "./case-date-fields"
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

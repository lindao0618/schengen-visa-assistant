"use client"

import { Save, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getApplicantCrmPriorityLabel, getApplicantCrmVisaTypeLabel } from "@/lib/applicant-crm-labels"
import { formatFranceStatusLabel } from "@/lib/france-case-labels"
import { formatDateTime } from "@/app/applicants/[id]/detail/detail-ui"
import type { CaseFormState, VisaCaseRecord } from "@/app/applicants/[id]/detail/types"

function formatCaseStatus(mainStatus?: string | null, subStatus?: string | null, caseType?: string | null) {
  if (caseType === "france-schengen") {
    return formatFranceStatusLabel(mainStatus, subStatus)
  }
  return `${mainStatus || "-"}${subStatus ? ` / ${subStatus}` : ""}`
}

function getPriorityVariant(priority?: string | null) {
  if (priority === "urgent") return "destructive" as const
  if (priority === "high") return "warning" as const
  return "outline" as const
}

export function CaseCommandBar({
  selectedCase,
  caseForm,
  canEditApplicant,
  savingCase,
  onSaveCase,
}: {
  selectedCase: VisaCaseRecord
  caseForm: CaseFormState
  canEditApplicant: boolean
  savingCase: boolean
  onSaveCase: () => Promise<void>
}) {
  const caseTypeLabel = getApplicantCrmVisaTypeLabel(caseForm.visaType || caseForm.caseType)
  const statusLabel = formatCaseStatus(selectedCase.mainStatus, selectedCase.subStatus, selectedCase.caseType)

  return (
    <div className="sticky top-3 z-20 rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-lg shadow-amber-100/60 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-amber-100 text-amber-900">
              {caseTypeLabel}
            </Badge>
            <Badge variant={getPriorityVariant(caseForm.priority)}>
              {getApplicantCrmPriorityLabel(caseForm.priority)}
            </Badge>
            {caseForm.isActive ? (
              <Badge variant="info">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                当前案件
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div>
              <span className="font-semibold text-slate-700">当前状态：</span>
              {statusLabel}
            </div>
            <div>
              <span className="font-semibold text-slate-700">最近更新：</span>
              {formatDateTime(selectedCase.updatedAt)}
            </div>
            <div>
              <span className="font-semibold text-slate-700">分配：</span>
              {selectedCase.assignedTo?.name || selectedCase.assignedTo?.email || "未分配"}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void onSaveCase()}
          disabled={savingCase || !canEditApplicant}
          className="rounded-2xl bg-amber-500 text-white hover:bg-amber-600 xl:min-w-[150px]"
        >
          <Save className="mr-2 h-4 w-4" />
          {savingCase ? "保存中..." : "保存当前 Case"}
        </Button>
      </div>
    </div>
  )
}

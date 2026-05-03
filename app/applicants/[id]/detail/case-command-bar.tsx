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

function getPriorityBadgeClass(priority?: string | null) {
  if (priority === "urgent") return "border border-red-400/30 bg-red-400/12 text-red-200"
  if (priority === "high") return "border border-amber-400/30 bg-amber-400/12 text-amber-200"
  return "border border-white/12 bg-white/[0.08] text-white/80"
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
    <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="border border-blue-400/20 bg-blue-400/10 text-blue-200">
              {caseTypeLabel}
            </Badge>
            <Badge variant="outline" className={getPriorityBadgeClass(caseForm.priority)}>
              {getApplicantCrmPriorityLabel(caseForm.priority)}
            </Badge>
            {caseForm.isActive ? (
              <Badge variant="info" className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                当前案件
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-2 text-xs text-white/45 sm:grid-cols-3">
            <div>
              <span className="font-semibold text-white/80">当前状态：</span>
              {statusLabel}
            </div>
            <div>
              <span className="font-semibold text-white/80">最近更新：</span>
              {formatDateTime(selectedCase.updatedAt)}
            </div>
            <div>
              <span className="font-semibold text-white/80">分配：</span>
              {selectedCase.assignedTo?.name || selectedCase.assignedTo?.email || "未分配"}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void onSaveCase()}
          disabled={savingCase || !canEditApplicant}
          className="rounded-2xl bg-white text-black shadow-lg shadow-white/10 hover:bg-white/90 xl:min-w-[150px]"
        >
          <Save className="mr-2 h-4 w-4" />
          {savingCase ? "保存中..." : "保存当前 Case"}
        </Button>
      </div>
    </div>
  )
}

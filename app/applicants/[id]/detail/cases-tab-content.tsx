"use client"

import type { Dispatch, SetStateAction } from "react"

import { TabsContent } from "@/components/ui/tabs"
import { CaseDetailForm } from "@/app/applicants/[id]/detail/case-detail-form"
import { CaseListPanel, CaseSwitcherPanel } from "@/app/applicants/[id]/detail/case-list-panel"
import type { AssigneeOption, CaseFormState, VisaCaseRecord } from "@/app/applicants/[id]/detail/types"

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
      <CaseSwitcherPanel cases={cases} selectedCaseId={selectedCaseId} onSelectCaseId={onSelectCaseId} />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <CaseListPanel
          cases={cases}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={onSelectCaseId}
          canEditApplicant={canEditApplicant}
          onOpenCreateCase={onOpenCreateCase}
        />
        <CaseDetailForm
          selectedCase={selectedCase}
          caseForm={caseForm}
          setCaseForm={setCaseForm}
          availableAssignees={availableAssignees}
          isReadOnlyViewer={isReadOnlyViewer}
          canAssignCase={canAssignCase}
          canEditApplicant={canEditApplicant}
          savingCase={savingCase}
          onSaveCase={onSaveCase}
        />
      </div>
    </TabsContent>
  )
}

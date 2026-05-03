"use client"

import type { Dispatch, ReactNode, SetStateAction } from "react"

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
  caseContextRail,
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
  caseContextRail?: ReactNode
  onOpenCreateCase: () => void
  onSaveCase: () => Promise<void>
}) {
  return (
    <TabsContent value="cases" className="space-y-6" data-case-workspace="detail-first-right-rail">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
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

        <aside className="space-y-5 xl:sticky xl:top-28">
          <CaseListPanel
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCaseId={onSelectCaseId}
            canEditApplicant={canEditApplicant}
            onOpenCreateCase={onOpenCreateCase}
          />
          {caseContextRail}
          <CaseSwitcherPanel cases={cases} selectedCaseId={selectedCaseId} onSelectCaseId={onSelectCaseId} />
        </aside>
      </div>
    </TabsContent>
  )
}

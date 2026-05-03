"use client"

import type { Dispatch, SetStateAction } from "react"
import { useEffect } from "react"
import dynamic from "next/dynamic"

import { selectVisibleApplicantMaterialFiles } from "@/lib/applicant-material-files"

import { emptyAuditDialog } from "./types"
import { useApplicantFileActions } from "./use-applicant-file-actions"
import { useApplicantMaterialFiles } from "./use-applicant-material-files"
import { useMaterialPreviewController } from "./use-material-preview-controller"
import type {
  ApplicantDetailResponse,
  ApplicantDetailTab,
  AuditDialogState,
  BasicFormState,
  PreviewState,
} from "./types"

const AuditDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/audit-dialog").then((mod) => mod.AuditDialog),
  { ssr: false },
)

const MaterialPreviewDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/material-preview-dialog").then((mod) => mod.MaterialPreviewDialog),
  { ssr: false },
)

const MaterialsTab = dynamic(
  () => import("@/app/applicants/[id]/detail/materials-tab").then((mod) => mod.MaterialsTab),
  { ssr: false },
)

const AUDIT_PROGRESS_STEPS = ["正在读取 Excel", "正在识别字段", "正在检查规则", "审核完成"]

type ApplicantMaterialsSectionProps = {
  applicantId: string
  activeTab: ApplicantDetailTab
  detail: ApplicantDetailResponse
  selectedCaseId?: string | null
  selectedCaseType?: string | null
  canEditApplicant: boolean
  canRunAutomation: boolean
  preview: PreviewState
  setPreview: Dispatch<SetStateAction<PreviewState>>
  auditDialog: AuditDialogState
  setAuditDialog: Dispatch<SetStateAction<AuditDialogState>>
  setBasicForm: Dispatch<SetStateAction<BasicFormState>>
  setDetail: Dispatch<SetStateAction<ApplicantDetailResponse | null>>
  setMessage: Dispatch<SetStateAction<string>>
  invalidateApplicantCaches: () => void
  primeApplicantDetailCache: (detail: ApplicantDetailResponse) => void
  loadDetail: () => Promise<void>
}

export function ApplicantMaterialsSection({
  applicantId,
  activeTab,
  detail,
  selectedCaseId,
  selectedCaseType,
  canEditApplicant,
  canRunAutomation,
  preview,
  setPreview,
  auditDialog,
  setAuditDialog,
  setBasicForm,
  setDetail,
  setMessage,
  invalidateApplicantCaches,
  primeApplicantDetailCache,
  loadDetail,
}: ApplicantMaterialsSectionProps) {
  const {
    materialFiles,
    setMaterialFiles,
    materialFilesLoaded,
    setMaterialFilesLoaded,
    materialFilesLoading,
    materialFilesError,
    setMaterialFilesError,
  } = useApplicantMaterialFiles({
    applicantId,
    activeTab,
    detailProfileId: detail.profile.id,
    setDetail,
  })
  const { openPreview, previewDialogControls } = useMaterialPreviewController({
    applicantId,
    canEditApplicant,
    detail,
    preview,
    setDetail,
    setMessage,
    setPreview,
    setAuditDialog,
    invalidateApplicantCaches,
    primeApplicantDetailCache,
  })
  const { uploadFiles, autoFixUsVisaAuditIssues } = useApplicantFileActions({
    applicantId,
    canEditApplicant,
    canRunAutomation,
    auditDialog,
    setAuditDialog,
    setBasicForm,
    setDetail,
    setMaterialFiles,
    setMaterialFilesLoaded,
    setMaterialFilesError,
    setMessage,
    invalidateApplicantCaches,
    loadDetail,
  })

  useEffect(() => {
    if (!auditDialog.open || auditDialog.status !== "running") return

    const timers = [
      window.setTimeout(() => {
        setAuditDialog((prev) => (prev.open && prev.status === "running" ? { ...prev, phaseIndex: 1 } : prev))
      }, 250),
      window.setTimeout(() => {
        setAuditDialog((prev) => (prev.open && prev.status === "running" ? { ...prev, phaseIndex: 2 } : prev))
      }, 700),
    ]

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [auditDialog.open, auditDialog.status, setAuditDialog])

  const visibleMaterialFiles = selectVisibleApplicantMaterialFiles({
    materialFiles,
    materialFilesLoaded,
    detailFiles: detail.profile.files,
  })
  const auditPhaseIndex =
    auditDialog.status === "running"
      ? Math.min(auditDialog.phaseIndex ?? 0, AUDIT_PROGRESS_STEPS.length - 2)
      : AUDIT_PROGRESS_STEPS.length - 1

  return (
    <>
      {activeTab === "materials" ? (
        <MaterialsTab
          applicantId={applicantId}
          applicantProfileId={detail.profile.id}
          applicantName={detail.profile.name || detail.profile.label}
          selectedCaseId={selectedCaseId || undefined}
          selectedCaseType={selectedCaseType || undefined}
          files={visibleMaterialFiles}
          filesLoading={materialFilesLoading}
          filesError={materialFilesError}
          canEditApplicant={canEditApplicant}
          canRunAutomation={canRunAutomation}
          onUpload={uploadFiles}
          onPreview={openPreview}
        />
      ) : null}

      {preview.open ? (
        <MaterialPreviewDialog
          preview={preview}
          canEditApplicant={canEditApplicant}
          {...previewDialogControls}
        />
      ) : null}

      {auditDialog.open ? (
        <AuditDialog
          auditDialog={auditDialog}
          auditProgressSteps={AUDIT_PROGRESS_STEPS}
          auditPhaseIndex={auditPhaseIndex}
          canRunAutomation={canRunAutomation}
          onClose={() => setAuditDialog(emptyAuditDialog)}
          onAutoFix={autoFixUsVisaAuditIssues}
        />
      ) : null}
    </>
  )
}

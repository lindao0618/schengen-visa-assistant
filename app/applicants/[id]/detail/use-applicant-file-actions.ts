"use client"

import type { ChangeEvent, Dispatch, SetStateAction } from "react"

import { buildBasicForm } from "./form-state"
import { readJsonSafely } from "./json-response"
import type { ApplicantFileUploadResponse, UsVisaAutoFixResponse } from "./upload-feedback"
import type {
  ApplicantDetailResponse,
  ApplicantMaterialFiles,
  AuditDialogState,
  BasicFormState,
} from "./types"

type UseApplicantFileActionsOptions = {
  applicantId: string
  canEditApplicant: boolean
  canRunAutomation: boolean
  auditDialog: AuditDialogState
  setAuditDialog: Dispatch<SetStateAction<AuditDialogState>>
  setBasicForm: Dispatch<SetStateAction<BasicFormState>>
  setDetail: Dispatch<SetStateAction<ApplicantDetailResponse | null>>
  setMaterialFiles: Dispatch<SetStateAction<ApplicantMaterialFiles>>
  setMaterialFilesLoaded: Dispatch<SetStateAction<boolean>>
  setMaterialFilesError: Dispatch<SetStateAction<string>>
  setMessage: Dispatch<SetStateAction<string>>
  invalidateApplicantCaches: () => void
  loadDetail: () => Promise<void>
}

export function useApplicantFileActions({
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
}: UseApplicantFileActionsOptions) {
  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>, slot: string) => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能上传或覆盖材料")
      event.target.value = ""
      return
    }
    const file = event.target.files?.[0]
    if (!file) return

    const {
      buildApplicantUploadSuccessMessage,
      buildRunningUploadAuditDialog,
      buildUploadAuditResultDialog,
      getUploadExcelScope,
    } = await import("./upload-feedback")
    const uploadExcelScope = getUploadExcelScope(slot)
    setMessage("")

    try {
      if (uploadExcelScope) {
        setAuditDialog(buildRunningUploadAuditDialog(uploadExcelScope, slot))
      }

      const formData = new FormData()
      formData.append(slot, file)
      const response = await fetch(`/api/applicants/${applicantId}/files`, {
        method: "POST",
        body: formData,
      })
      const data = await readJsonSafely<ApplicantFileUploadResponse>(response)

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "上传文件失败")
      }

      invalidateApplicantCaches()
      const uploadedProfile = data.profile
      const nextFiles = uploadedProfile.files || {}
      setMaterialFiles(nextFiles)
      setMaterialFilesLoaded(true)
      setMaterialFilesError("")
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              profile: uploadedProfile,
            }
          : prev,
      )
      setBasicForm(buildBasicForm(uploadedProfile))

      setMessage(buildApplicantUploadSuccessMessage(data))

      if (uploadExcelScope) {
        setAuditDialog(
          buildUploadAuditResultDialog(
            uploadExcelScope,
            slot,
            uploadExcelScope === "schengen" ? data.schengenAudit : data.usVisaAudit,
          ),
        )
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传文件失败")
    } finally {
      event.target.value = ""
    }
  }

  const autoFixUsVisaAuditIssues = async () => {
    if (!canRunAutomation) {
      setMessage("当前角色不能触发自动化处理")
      return
    }
    if (auditDialog.scope !== "usVisa" || !auditDialog.slot || auditDialog.autoFixing) return

    setAuditDialog((prev) => ({
      ...prev,
      autoFixing: true,
      helperText: "正在处理可自动修复的格式问题，并回写到当前档案…",
    }))
    setMessage("")

    try {
      const response = await fetch(`/api/applicants/${applicantId}/files/${auditDialog.slot}/auto-fix-us-visa`, {
        method: "POST",
      })
      const data = await readJsonSafely<UsVisaAutoFixResponse>(response)

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "自动处理格式问题失败")
      }

      invalidateApplicantCaches()
      await loadDetail()

      const { buildUsVisaAutoFixAuditDialog } = await import("./upload-feedback")
      const fixedCount = data.fixedCount || 0
      const passed = Boolean(data.usVisaAudit?.ok)

      setAuditDialog(buildUsVisaAutoFixAuditDialog(auditDialog.slot, fixedCount, data.usVisaAudit))

      if (fixedCount > 0) {
        setMessage(passed ? `已自动处理 ${fixedCount} 处格式问题并保存到档案` : `已自动处理 ${fixedCount} 处格式问题`)
      }
    } catch (error) {
      setAuditDialog((prev) => ({
        ...prev,
        autoFixing: false,
        helperText: error instanceof Error ? error.message : "自动处理格式问题失败",
      }))
    }
  }

  return {
    uploadFiles,
    autoFixUsVisaAuditIssues,
  }
}

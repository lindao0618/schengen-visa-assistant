import type { ApplicantDetailTab } from "@/app/applicants/[id]/detail/types"

export type ApplicantMaterialFileMeta = {
  originalName: string
  uploadedAt: string
  [key: string]: unknown
}

export type ApplicantMaterialFileMap = Record<string, ApplicantMaterialFileMeta>

export type ApplicantMaterialFilesLoadState = {
  activeTab: ApplicantDetailTab
  hasFilesLoaded: boolean
  loading: boolean
}

export type ApplicantMaterialFilesLoadingVisibilityState = {
  loading?: boolean
  visibleFileCount: number
}

export type ApplicantMaterialFilesVisibilityState = {
  materialFiles?: ApplicantMaterialFileMap | null
  materialFilesLoaded: boolean
  detailFiles?: ApplicantMaterialFileMap | null
}

const APPLICANT_MATERIAL_FILES_HANDOFF_PREFIX = "applicant-material-files:handoff:"

function hasApplicantMaterialFiles(files?: ApplicantMaterialFileMap | null) {
  return Boolean(files && Object.keys(files).length > 0)
}

export function getApplicantMaterialFilesHandoffKey(applicantId: string) {
  return `${APPLICANT_MATERIAL_FILES_HANDOFF_PREFIX}${applicantId}`
}

export function selectVisibleApplicantMaterialFiles({
  materialFiles,
  materialFilesLoaded,
  detailFiles,
}: ApplicantMaterialFilesVisibilityState) {
  if (materialFilesLoaded || hasApplicantMaterialFiles(materialFiles)) {
    return materialFiles || {}
  }

  return detailFiles || {}
}

export function shouldFetchApplicantMaterialFiles({
  activeTab,
  hasFilesLoaded,
  loading,
}: ApplicantMaterialFilesLoadState) {
  return activeTab === "materials" && !hasFilesLoaded && !loading
}

export function shouldShowApplicantMaterialFilesLoading({
  loading,
  visibleFileCount,
}: ApplicantMaterialFilesLoadingVisibilityState) {
  return Boolean(loading) && visibleFileCount <= 0
}

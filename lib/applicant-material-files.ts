import type { ApplicantDetailTab } from "@/app/applicants/[id]/detail/types"

export type ApplicantMaterialFilesLoadState = {
  activeTab: ApplicantDetailTab
  hasFilesLoaded: boolean
  loading: boolean
}

export type ApplicantMaterialFilesLoadingVisibilityState = {
  loading?: boolean
  visibleFileCount: number
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

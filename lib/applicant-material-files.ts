import type { ApplicantDetailTab } from "@/app/applicants/[id]/detail/types"

export type ApplicantMaterialFilesLoadState = {
  activeTab: ApplicantDetailTab
  hasFilesLoaded: boolean
  loading: boolean
}

export function shouldFetchApplicantMaterialFiles({
  activeTab,
  hasFilesLoaded,
  loading,
}: ApplicantMaterialFilesLoadState) {
  return activeTab === "materials" && !hasFilesLoaded && !loading
}

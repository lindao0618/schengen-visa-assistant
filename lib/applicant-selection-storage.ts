export const ACTIVE_APPLICANT_PROFILE_KEY = "activeApplicantProfileId"
export const ACTIVE_APPLICANT_CASE_KEY = "activeApplicantCaseId"
export const RECENT_APPLICANT_PROFILE_IDS_KEY = "recentApplicantProfileIds"

export function getApplicantCaseStorageKey(applicantProfileId: string) {
  return `${ACTIVE_APPLICANT_CASE_KEY}:${applicantProfileId}`
}

export function readStoredApplicantCaseId(applicantProfileId: string) {
  if (typeof window === "undefined") return ""
  return (
    window.localStorage.getItem(getApplicantCaseStorageKey(applicantProfileId)) ||
    window.localStorage.getItem(ACTIVE_APPLICANT_CASE_KEY) ||
    ""
  )
}

export function writeStoredApplicantCaseId(applicantProfileId: string, caseId?: string | null) {
  if (typeof window === "undefined") return
  if (caseId) {
    window.localStorage.setItem(ACTIVE_APPLICANT_CASE_KEY, caseId)
    window.localStorage.setItem(getApplicantCaseStorageKey(applicantProfileId), caseId)
    return
  }

  window.localStorage.removeItem(ACTIVE_APPLICANT_CASE_KEY)
  window.localStorage.removeItem(getApplicantCaseStorageKey(applicantProfileId))
}

export function dispatchActiveApplicantCaseChange(applicantProfileId: string, caseId?: string | null) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("active-applicant-case-changed", {
      detail: {
        applicantProfileId,
        caseId: caseId ?? null,
      },
    }),
  )
}

export function dispatchActiveApplicantProfileChange(applicantProfileId: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("active-applicant-profile-changed", {
      detail: { applicantProfileId },
    }),
  )
}

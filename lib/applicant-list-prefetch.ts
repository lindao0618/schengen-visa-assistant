export type ApplicantDetailPrefetchSource = "automatic" | "intent" | "create"

export function shouldPrefetchApplicantDetailJson({
  applicantId,
  source,
}: {
  applicantId?: string | null
  source: ApplicantDetailPrefetchSource
}) {
  return Boolean(applicantId) && source !== "automatic"
}

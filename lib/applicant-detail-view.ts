export type ApplicantDetailView = "full" | "active"

export function resolveApplicantDetailView(
  input: URLSearchParams | string | null | undefined,
): ApplicantDetailView {
  if (!input) return "full"

  const value = typeof input === "string" ? input : input.get("view")
  return value === "active" ? "active" : "full"
}

export function shouldIncludeApplicantDetailAssignees(
  input: URLSearchParams | string | null | undefined,
) {
  if (!input) return false

  const value = typeof input === "string" ? input : input.get("includeAssignees")
  return value === "1" || value === "true"
}

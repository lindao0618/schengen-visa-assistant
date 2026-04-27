import type { ApplicantCrmRow, QuickView } from "@/app/applicants/applicant-crm-types"

export const APPLICANT_CRM_PAGE_SIZE = 50

type ApplicantCrmListSearchParamsInput = {
  keyword: string
  selectedVisaTypes: string[]
  selectedStatuses: string[]
  selectedRegions: string[]
  selectedPriorities: string[]
  selectedGroups: string[]
  quickView: QuickView
  limit: number
  offset: number
}

function appendValues(params: URLSearchParams, key: string, values: string[]) {
  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed) params.append(key, trimmed)
  }
}

export function buildApplicantCrmListSearchParams({
  keyword,
  selectedVisaTypes,
  selectedStatuses,
  selectedRegions,
  selectedPriorities,
  selectedGroups,
  quickView,
  limit,
  offset,
}: ApplicantCrmListSearchParamsInput) {
  const params = new URLSearchParams()
  const trimmedKeyword = keyword.trim()
  if (trimmedKeyword) params.set("keyword", trimmedKeyword)
  appendValues(params, "visaTypes", selectedVisaTypes)
  appendValues(params, "statuses", selectedStatuses)
  appendValues(params, "regions", selectedRegions)
  appendValues(params, "priorities", selectedPriorities)
  appendValues(params, "groups", selectedGroups)
  if (quickView !== "all") params.set("quickView", quickView)
  params.set("limit", String(limit))
  params.set("offset", String(Math.max(0, offset)))
  params.set("includeProfiles", "0")
  params.set("includeProfileFiles", "0")
  return params.toString()
}

export function mergeApplicantCrmPageRows(
  currentRows: ApplicantCrmRow[],
  nextRows: ApplicantCrmRow[],
  mode: "replace" | "append",
) {
  if (mode === "replace") return nextRows

  const seen = new Set(currentRows.map((row) => row.id))
  const merged = [...currentRows]
  for (const row of nextRows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return merged
}

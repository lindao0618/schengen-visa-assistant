import type { ApplicantCrmFilters } from "@/lib/applicant-crm"

type ApplicantCrmIncludeDefaults = Pick<
  ApplicantCrmFilters,
  "includeStats" | "includeSelectorCases" | "includeProfiles" | "includeProfileFiles" | "includeAvailableAssignees"
>

const APPLICANT_CRM_MAX_PAGE_LIMIT = 200
const APPLICANT_CRM_QUICK_VIEWS = new Set(["mine", "review", "exception", "today"])

function getMultiValues(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean)
}

function getBooleanFlag(searchParams: URLSearchParams, key: string, defaultValue = false) {
  const value = searchParams.get(key)
  if (value === null) return defaultValue
  return ["1", "true", "yes"].includes(value.toLowerCase())
}

function getPositiveInteger(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)
  if (value === null) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function getNonNegativeInteger(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)
  if (value === null) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function getQuickView(searchParams: URLSearchParams) {
  const value = searchParams.get("quickView")?.trim()
  return value && APPLICANT_CRM_QUICK_VIEWS.has(value) ? (value as ApplicantCrmFilters["quickView"]) : undefined
}

export function buildApplicantCrmFiltersFromSearchParams(
  searchParams: URLSearchParams,
  defaults: ApplicantCrmIncludeDefaults = {},
): ApplicantCrmFilters {
  const requestedLimit = getPositiveInteger(searchParams, "limit")
  const limit = requestedLimit ? Math.min(requestedLimit, APPLICANT_CRM_MAX_PAGE_LIMIT) : undefined
  const offset = limit ? getNonNegativeInteger(searchParams, "offset") : undefined

  return {
    keyword: searchParams.get("keyword")?.trim() || "",
    visaTypes: getMultiValues(searchParams, "visaTypes"),
    statuses: getMultiValues(searchParams, "statuses"),
    regions: getMultiValues(searchParams, "regions"),
    priorities: getMultiValues(searchParams, "priorities"),
    groups: getMultiValues(searchParams, "groups"),
    quickView: getQuickView(searchParams),
    includeStats: getBooleanFlag(searchParams, "includeStats", Boolean(defaults.includeStats)),
    includeSelectorCases: getBooleanFlag(
      searchParams,
      "includeSelectorCases",
      Boolean(defaults.includeSelectorCases),
    ),
    includeProfiles: getBooleanFlag(searchParams, "includeProfiles", Boolean(defaults.includeProfiles)),
    includeProfileFiles: getBooleanFlag(searchParams, "includeProfileFiles", Boolean(defaults.includeProfileFiles)),
    includeAvailableAssignees: getBooleanFlag(
      searchParams,
      "includeAvailableAssignees",
      Boolean(defaults.includeAvailableAssignees),
    ),
    limit,
    offset,
  }
}

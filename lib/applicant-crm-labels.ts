export const CRM_VISA_TYPE_FILTER_VALUES = [
  "france-schengen",
  "uk-visa",
  "usa-visa",
] as const

export const CRM_REGION_FILTER_VALUES = [
  "uk",
  "china",
  "usa",
  "other",
] as const

export const CRM_PRIORITY_FILTER_VALUES = [
  "normal",
  "high",
  "urgent",
] as const

export const CRM_VISA_TYPE_OPTIONS = [
  { value: "france-schengen", label: "法国申根" },
  { value: "uk-visa", label: "英国签证" },
  { value: "usa-visa", label: "美国签证" },
] as const

export const CRM_REGION_OPTIONS = [
  { value: "uk", label: "英国" },
  { value: "china", label: "中国" },
  { value: "usa", label: "美国" },
  { value: "other", label: "其他" },
] as const

export const CRM_PRIORITY_OPTIONS = [
  { value: "normal", label: "普通" },
  { value: "high", label: "高优先级" },
  { value: "urgent", label: "紧急" },
] as const

const VISA_TYPE_LABELS: Record<string, string> = {
  "france-schengen": "法国申根",
  "uk-visa": "英国签证",
  "usa-visa": "美国签证",
}

const REGION_LABELS: Record<string, string> = {
  uk: "英国",
  china: "中国",
  usa: "美国",
  other: "其他",
}

const PRIORITY_LABELS: Record<string, string> = {
  normal: "普通",
  high: "高优先级",
  urgent: "紧急",
}

function normalizeKey(value?: string | null) {
  return (value || "").trim().toLowerCase()
}

export function normalizeApplicantCrmVisaType(value?: string | null) {
  const normalized = normalizeKey(value)
  if (!normalized) return undefined

  if (
    normalized === "france-schengen" ||
    normalized === "schengen-france" ||
    normalized === "schengen-visa" ||
    normalized === "schengen"
  ) {
    return "france-schengen"
  }

  if (
    normalized === "uk-visa" ||
    normalized === "uk" ||
    normalized === "england-visa" ||
    normalized === "british-visa"
  ) {
    return "uk-visa"
  }

  if (
    normalized === "usa-visa" ||
    normalized === "usa" ||
    normalized === "us-visa" ||
    normalized === "b1/b2" ||
    normalized === "b1b2"
  ) {
    return "usa-visa"
  }

  return undefined
}

export function deriveApplicantCaseTypeFromVisaType(value?: string | null) {
  return normalizeApplicantCrmVisaType(value) || "france-schengen"
}

export function normalizeApplicantCrmRegion(value?: string | null) {
  const normalized = normalizeKey(value)
  if (!normalized) return undefined

  if (
    normalized === "uk" ||
    normalized === "gb" ||
    normalized === "england" ||
    normalized === "london" ||
    normalized === "manchester" ||
    normalized === "edinburgh" ||
    normalized === "lon" ||
    normalized === "mnc" ||
    normalized === "edi"
  ) {
    return "uk"
  }

  if (
    normalized === "china" ||
    normalized === "cn" ||
    normalized === "beijing" ||
    normalized === "shanghai" ||
    normalized === "guangzhou" ||
    normalized === "chengdu" ||
    normalized === "wuhan" ||
    normalized === "shenzhen" ||
    normalized === "hangzhou" ||
    normalized === "bjs" ||
    normalized === "sha" ||
    normalized === "can" ||
    normalized === "ctu" ||
    normalized === "wuh" ||
    normalized === "szx" ||
    normalized === "hgh"
  ) {
    return "china"
  }

  if (
    normalized === "usa" ||
    normalized === "us" ||
    normalized === "america" ||
    normalized === "united states"
  ) {
    return "usa"
  }

  return "other"
}

export function getApplicantCrmVisaTypeLabel(value?: string | null) {
  const normalized = normalizeApplicantCrmVisaType(value)
  if (!normalized) return "-"
  return VISA_TYPE_LABELS[normalized] || value || "-"
}

export function getApplicantCrmRegionLabel(value?: string | null) {
  const normalized = normalizeApplicantCrmRegion(value)
  if (!normalized) return "-"
  return REGION_LABELS[normalized] || value || "-"
}

export function getApplicantCrmPriorityLabel(value?: string | null) {
  const normalized = normalizeKey(value)
  if (!normalized) return "-"
  return PRIORITY_LABELS[normalized] || value || "-"
}

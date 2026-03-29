const VISA_TYPE_LABELS: Record<string, string> = {
  "france-schengen": "法国申根",
  "schengen-france": "法国申根",
  "schengen-visa": "申根签证",
  schengen: "申根签证",
  "usa-visa": "美国签证",
  usa: "美国签证",
  "b1/b2": "美国 B1/B2",
}

const REGION_LABELS: Record<string, string> = {
  france: "法国",
  fr: "法国",
  uk: "英国",
  gb: "英国",
  england: "英国",
  china: "中国",
  cn: "中国",
  us: "美国",
  usa: "美国",
  london: "伦敦",
  manchester: "曼彻斯特",
  edinburgh: "爱丁堡",
  lon: "伦敦",
  mnc: "曼彻斯特",
  edi: "爱丁堡",
  bjs: "北京",
  sha: "上海",
  can: "广州",
  ctu: "成都",
  wuh: "武汉",
  szx: "深圳",
  hgh: "杭州",
}

const PRIORITY_LABELS: Record<string, string> = {
  normal: "普通",
  high: "高优先级",
  urgent: "紧急",
}

function normalizeKey(value?: string | null) {
  return (value || "").trim().toLowerCase()
}

export function getApplicantCrmVisaTypeLabel(value?: string | null) {
  const normalized = normalizeKey(value)
  if (!normalized) return "-"
  return VISA_TYPE_LABELS[normalized] || value || "-"
}

export function getApplicantCrmRegionLabel(value?: string | null) {
  const normalized = normalizeKey(value)
  if (!normalized) return "-"
  return REGION_LABELS[normalized] || value || "-"
}

export function getApplicantCrmPriorityLabel(value?: string | null) {
  const normalized = normalizeKey(value)
  if (!normalized) return "-"
  return PRIORITY_LABELS[normalized] || value || "-"
}

export const CRM_PRIORITY_FILTER_VALUES = ["normal", "high", "urgent"] as const

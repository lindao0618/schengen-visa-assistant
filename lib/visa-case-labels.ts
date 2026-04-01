import { getApplicantCrmRegionLabel, getApplicantCrmVisaTypeLabel } from "@/lib/applicant-crm-labels"

export interface VisaCaseLabelRecord {
  id: string
  caseType?: string | null
  visaType?: string | null
  applyRegion?: string | null
}

export function formatVisaCaseLabel(caseRecord: VisaCaseLabelRecord) {
  const visaTypeLabel = getApplicantCrmVisaTypeLabel(caseRecord.visaType || caseRecord.caseType)
  const regionLabel = getApplicantCrmRegionLabel(caseRecord.applyRegion)
  const shortId = caseRecord.id.slice(-6).toUpperCase()

  return [visaTypeLabel !== "-" ? visaTypeLabel : "案件", regionLabel !== "-" ? regionLabel : null, `#${shortId}`]
    .filter(Boolean)
    .join(" · ")
}

export function formatFallbackVisaCaseLabel(caseId?: string | null) {
  if (!caseId) return undefined
  return `案件 #${caseId.slice(-6).toUpperCase()}`
}

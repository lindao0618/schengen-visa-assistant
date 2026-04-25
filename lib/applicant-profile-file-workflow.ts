import {
  type ApplicantSchengenIntakeSnapshot,
  type ApplicantUsVisaIntakeSnapshot,
  ApplicantProfileFileSlot,
  saveApplicantProfileFiles,
  updateApplicantProfileSchengenDetails,
  updateApplicantProfileUsVisaDetails,
} from "@/lib/applicant-profiles"
import { extractFranceTlsCityFromExcelBuffer } from "@/lib/france-tls-city-excel"
import {
  auditSchengenExcelBuffer,
  extractSchengenExcelReviewFields,
  getSchengenExcelFieldLabel,
  type SchengenExcelAuditResult,
} from "@/lib/schengen-excel-audit"
import { extractSchengenApplicantSummaryFromExcelBuffer } from "@/lib/schengen-excel-summary"
import {
  auditUsVisaExcelBuffer,
  extractUsVisaExcelReviewFields,
  getUsVisaExcelFieldLabel,
  type UsVisaExcelAuditResult,
} from "@/lib/us-visa-excel-audit"
import { extractUsVisaApplicantDetailsFromExcelBuffer } from "@/lib/us-visa-excel-parser"

const US_VISA_EXCEL_SLOTS = new Set<ApplicantProfileFileSlot>([
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "ds160Excel",
  "aisExcel",
])

const SCHENGEN_EXCEL_SLOTS = new Set<ApplicantProfileFileSlot>(["schengenExcel", "franceExcel"])

export interface ApplicantProfileFileUploadEntry {
  slot: ApplicantProfileFileSlot
  file: File
}

function buildUsVisaIntakeSnapshot(
  slot: ApplicantProfileFileSlot,
  file: File,
  fields: Record<string, string>,
  audit: UsVisaExcelAuditResult,
): ApplicantUsVisaIntakeSnapshot {
  const items = Object.entries(fields).map(([key, value]) => ({
    key,
    label: getUsVisaExcelFieldLabel(key),
    value,
  }))

  return {
    version: 1,
    sourceSlot: slot,
    sourceOriginalName: file.name || undefined,
    extractedAt: new Date().toISOString(),
    fieldCount: items.length,
    fields,
    items,
    audit: {
      ok: audit.ok,
      errors: audit.errors.map((issue) => ({
        field: issue.field,
        message: issue.message,
        value: issue.value,
      })),
    },
  }
}

function buildSchengenIntakeSnapshot(
  slot: ApplicantProfileFileSlot,
  file: File,
  fields: Record<string, string>,
  audit: SchengenExcelAuditResult,
): ApplicantSchengenIntakeSnapshot {
  const items = Object.entries(fields).map(([key, value]) => ({
    key,
    label: getSchengenExcelFieldLabel(key),
    value,
  }))

  return {
    version: 1,
    sourceSlot: slot,
    sourceOriginalName: file.name || undefined,
    extractedAt: new Date().toISOString(),
    fieldCount: items.length,
    fields,
    items,
    audit: {
      ok: audit.ok,
      errors: audit.errors.map((issue) => ({
        field: issue.field,
        message: issue.message,
        value: issue.value,
      })),
    },
  }
}

export async function saveApplicantProfileFilesWithAnalysis(
  userId: string,
  id: string,
  entries: ApplicantProfileFileUploadEntry[],
  role?: string,
) {
  let profile = await saveApplicantProfileFiles(userId, id, entries, role)
  if (!profile) return null

  const excelEntry = entries.find((entry) => US_VISA_EXCEL_SLOTS.has(entry.slot))
  const schengenExcelEntry = entries.find((entry) => SCHENGEN_EXCEL_SLOTS.has(entry.slot))

  let parsedUsVisaDetails:
    | {
        aaCode?: string
        surname?: string
        givenName?: string
        birthYear?: string
        passportNumber?: string
        chineseName?: string
        telecodeSurname?: string
        telecodeGivenName?: string
      }
    | undefined
  let parsedSchengenDetails:
    | {
        city?: string
        summary?: ReturnType<typeof extractSchengenApplicantSummaryFromExcelBuffer>
      }
    | undefined
  let parsedUsVisaFullIntake:
    | ApplicantUsVisaIntakeSnapshot
    | undefined
  let parsedSchengenFullIntake:
    | ApplicantSchengenIntakeSnapshot
    | undefined
  let schengenAudit:
    | SchengenExcelAuditResult
    | undefined
  let usVisaAudit:
    | UsVisaExcelAuditResult
    | undefined

  if (excelEntry) {
    const usBuffer = Buffer.from(await excelEntry.file.arrayBuffer())
    usVisaAudit = auditUsVisaExcelBuffer(usBuffer)
    const reviewFields = extractUsVisaExcelReviewFields(usBuffer)
    const parsed = extractUsVisaApplicantDetailsFromExcelBuffer(usBuffer)
    const fullIntake = buildUsVisaIntakeSnapshot(excelEntry.slot, excelEntry.file, reviewFields, usVisaAudit)
    const updatedProfile = await updateApplicantProfileUsVisaDetails(
      userId,
      id,
      {
        aaCode: reviewFields.applicationId,
        ...parsed,
        fullIntake,
      },
      role,
    )
    if (updatedProfile) {
      profile = updatedProfile
    }
    parsedUsVisaDetails = {
      aaCode: reviewFields.applicationId,
      ...parsed,
    }
    parsedUsVisaFullIntake = fullIntake
  }

  if (schengenExcelEntry) {
    const schengenBuffer = Buffer.from(await schengenExcelEntry.file.arrayBuffer())
    schengenAudit = auditSchengenExcelBuffer(schengenBuffer)
    const reviewFields = extractSchengenExcelReviewFields(schengenBuffer)
    const summary = extractSchengenApplicantSummaryFromExcelBuffer(schengenBuffer)
    const fullIntake = buildSchengenIntakeSnapshot(
      schengenExcelEntry.slot,
      schengenExcelEntry.file,
      reviewFields,
      schengenAudit,
    )
    const city = extractFranceTlsCityFromExcelBuffer(schengenBuffer)
    const updatedProfile = await updateApplicantProfileSchengenDetails(
      userId,
      id,
      {
        city,
        fullIntake,
      },
      role,
    )
    if (updatedProfile) {
      profile = updatedProfile
    }
    parsedSchengenDetails = { city, summary }
    parsedSchengenFullIntake = fullIntake
  }

  return {
    profile,
    parsedUsVisaDetails,
    parsedUsVisaFullIntake,
    parsedSchengenDetails,
    parsedSchengenFullIntake,
    schengenAudit,
    usVisaAudit,
  }
}

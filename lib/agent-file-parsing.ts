import fs from "fs/promises"

import {
  type ApplicantProfile,
  type ApplicantSchengenIntakeSnapshot,
  type ApplicantProfileFileSlot,
  type ApplicantUsVisaIntakeSnapshot,
  getApplicantProfile,
  getApplicantProfileFile,
  getApplicantProfileFileByCandidates,
} from "@/lib/applicant-profiles"
import { extractFranceTlsCityFromExcelBuffer } from "@/lib/france-tls-city-excel"
import { extractSchengenApplicantSummaryFromExcelBuffer } from "@/lib/schengen-excel-summary"
import { auditSchengenExcelBuffer, extractSchengenExcelReviewFields, getSchengenExcelFieldLabel } from "@/lib/schengen-excel-audit"
import { auditUsVisaExcelBuffer, extractUsVisaExcelReviewFields, getUsVisaExcelFieldLabel } from "@/lib/us-visa-excel-audit"
import { extractUsVisaApplicantDetailsFromExcelBuffer } from "@/lib/us-visa-excel-parser"

const US_VISA_EXCEL_SLOTS: ApplicantProfileFileSlot[] = [
  "usVisaDs160Excel",
  "ds160Excel",
  "usVisaAisExcel",
  "aisExcel",
]

const US_VISA_PHOTO_SLOTS: ApplicantProfileFileSlot[] = ["usVisaPhoto", "photo"]

const SCHENGEN_EXCEL_SLOTS: ApplicantProfileFileSlot[] = ["schengenExcel", "franceExcel"]

const JSON_FILE_SLOTS: ApplicantProfileFileSlot[] = [
  "franceApplicationJson",
  "franceTlsAccountsJson",
  "usVisaDs160PrecheckJson",
  "usVisaInterviewBriefJson",
]

const MAX_INLINE_JSON_BYTES = 5 * 1024 * 1024

type SupportedParser = "json-file" | "us-visa-excel" | "schengen-excel"

type ParsedJsonPayload =
  | {
      kind: "json"
      value: unknown
    }
  | {
      kind: "text"
      value: string
      note: string
    }

export interface ParsedApplicantProfileFileResult {
  applicantProfileId: string
  slot: ApplicantProfileFileSlot
  parser: SupportedParser | null
  supported: boolean
  note?: string
  file: {
    slot: ApplicantProfileFileSlot
    originalName: string
    storedName: string
    relativePath: string
    mimeType: string
    size: number
    uploadedAt: string
  }
  rawUrl: string
  downloadUrl: string
  parsed?: unknown
}

export interface ApplicantParsedIntakeResult {
  applicantProfileId: string
  profile: ApplicantProfile
  parsedSources: {
    usVisaExcel: ParsedApplicantProfileFileResult | null
    schengenExcel: ParsedApplicantProfileFileResult | null
    jsonFiles: Partial<Record<ApplicantProfileFileSlot, ParsedApplicantProfileFileResult>>
  }
}

export interface AgentApplicantFileDescriptor {
  slot: ApplicantProfileFileSlot
  originalName: string
  storedName: string
  relativePath: string
  mimeType: string
  size: number
  uploadedAt: string
  rawUrl: string
  downloadUrl: string
}

export interface ApplicantUsVisaIntakeView {
  applicantProfileId: string
  applicantLabel: string
  usVisa: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
    slotTime?: string
  } | null
  intake: ApplicantProfile["usVisa"] extends infer T
    ? T extends { fullIntake?: infer U }
      ? U | null
      : null
    : null
  sourceFile: AgentApplicantFileDescriptor | null
  photo: AgentApplicantFileDescriptor | null
}

export interface ApplicantSchengenIntakeView {
  applicantProfileId: string
  applicantLabel: string
  schengen: {
    country?: string
    city?: string
  } | null
  intake: ApplicantProfile["schengen"] extends infer T
    ? T extends { fullIntake?: infer U }
      ? U | null
      : null
    : null
  sourceFile: AgentApplicantFileDescriptor | null
}

function buildAgentFileUrls(applicantProfileId: string, slot: ApplicantProfileFileSlot) {
  const basePath = `/api/agent/applicants/${encodeURIComponent(applicantProfileId)}/files/${encodeURIComponent(slot)}`
  return {
    rawUrl: `${basePath}?raw=1`,
    downloadUrl: `${basePath}?download=1`,
  }
}

function toAgentFileDescriptor(
  applicantProfileId: string,
  file: Awaited<ReturnType<typeof getApplicantProfileFile>>,
): AgentApplicantFileDescriptor | null {
  if (!file) return null
  const urls = buildAgentFileUrls(applicantProfileId, file.meta.slot)
  return {
    ...file.meta,
    rawUrl: urls.rawUrl,
    downloadUrl: urls.downloadUrl,
  }
}

function buildUsVisaIntakeSnapshotFromStoredFile(
  slot: ApplicantProfileFileSlot,
  originalName: string | undefined,
  buffer: Buffer,
): ApplicantUsVisaIntakeSnapshot {
  const fields = extractUsVisaExcelReviewFields(buffer)
  const audit = auditUsVisaExcelBuffer(buffer)
  const items = Object.entries(fields).map(([key, value]) => ({
    key,
    label: getUsVisaExcelFieldLabel(key),
    value,
  }))

  return {
    version: 1,
    sourceSlot: slot,
    sourceOriginalName: originalName || undefined,
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

function buildSchengenIntakeSnapshotFromStoredFile(
  slot: ApplicantProfileFileSlot,
  originalName: string | undefined,
  buffer: Buffer,
): ApplicantSchengenIntakeSnapshot {
  const fields = extractSchengenExcelReviewFields(buffer)
  const audit = auditSchengenExcelBuffer(buffer)
  const items = Object.entries(fields).map(([key, value]) => ({
    key,
    label: getSchengenExcelFieldLabel(key),
    value,
  }))

  return {
    version: 1,
    sourceSlot: slot,
    sourceOriginalName: originalName || undefined,
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

async function resolveUsVisaIntakeSnapshot(
  file: Awaited<ReturnType<typeof getApplicantProfileFileByCandidates>>,
  persisted?: ApplicantUsVisaIntakeSnapshot | null,
) {
  if (persisted) return persisted
  if (!file) return null

  const buffer = await fs.readFile(file.absolutePath)
  return buildUsVisaIntakeSnapshotFromStoredFile(file.meta.slot, file.meta.originalName, buffer)
}

async function resolveSchengenIntakeSnapshot(
  file: Awaited<ReturnType<typeof getApplicantProfileFileByCandidates>>,
  persisted?: ApplicantSchengenIntakeSnapshot | null,
) {
  if (persisted) return persisted
  if (!file) return null

  const buffer = await fs.readFile(file.absolutePath)
  return buildSchengenIntakeSnapshotFromStoredFile(file.meta.slot, file.meta.originalName, buffer)
}

async function readJsonLikeFile(absolutePath: string, size: number): Promise<ParsedJsonPayload> {
  if (size > MAX_INLINE_JSON_BYTES) {
    return {
      kind: "text",
      value: "",
      note: `JSON file is too large to inline (${size} bytes). Use rawUrl if needed.`,
    }
  }

  const text = await fs.readFile(absolutePath, "utf-8")
  try {
    return {
      kind: "json",
      value: JSON.parse(text),
    }
  } catch {
    return {
      kind: "text",
      value: text,
      note: "File is stored in a JSON slot but its content is not valid JSON.",
    }
  }
}

async function parseStoredApplicantProfileFile(
  userId: string,
  applicantProfileId: string,
  slot: ApplicantProfileFileSlot,
  role?: string,
): Promise<ParsedApplicantProfileFileResult | null> {
  const file = await getApplicantProfileFile(userId, applicantProfileId, slot, role)
  if (!file) return null

  const urls = buildAgentFileUrls(applicantProfileId, slot)

  if (JSON_FILE_SLOTS.includes(slot)) {
    const jsonPayload = await readJsonLikeFile(file.absolutePath, file.meta.size)
    return {
      applicantProfileId,
      slot,
      parser: "json-file",
      supported: true,
      note: jsonPayload.kind === "text" ? jsonPayload.note : undefined,
      file: file.meta,
      rawUrl: urls.rawUrl,
      downloadUrl: urls.downloadUrl,
      parsed: jsonPayload.kind === "json" ? jsonPayload.value : { text: jsonPayload.value },
    }
  }

  if (US_VISA_EXCEL_SLOTS.includes(slot)) {
    const buffer = await fs.readFile(file.absolutePath)
    return {
      applicantProfileId,
      slot,
      parser: "us-visa-excel",
      supported: true,
      file: file.meta,
      rawUrl: urls.rawUrl,
      downloadUrl: urls.downloadUrl,
      parsed: {
        details: extractUsVisaApplicantDetailsFromExcelBuffer(buffer),
        audit: auditUsVisaExcelBuffer(buffer),
      },
    }
  }

  if (SCHENGEN_EXCEL_SLOTS.includes(slot)) {
    const buffer = await fs.readFile(file.absolutePath)
    return {
      applicantProfileId,
      slot,
      parser: "schengen-excel",
      supported: true,
      file: file.meta,
      rawUrl: urls.rawUrl,
      downloadUrl: urls.downloadUrl,
      parsed: {
        summary: extractSchengenApplicantSummaryFromExcelBuffer(buffer),
        tlsCity: extractFranceTlsCityFromExcelBuffer(buffer),
        audit: auditSchengenExcelBuffer(buffer),
      },
    }
  }

  return {
    applicantProfileId,
    slot,
    parser: null,
    supported: false,
    note: "No structured parser is registered for this slot yet.",
    file: file.meta,
    rawUrl: urls.rawUrl,
    downloadUrl: urls.downloadUrl,
  }
}

export async function getParsedApplicantProfileFile(
  userId: string,
  applicantProfileId: string,
  slot: ApplicantProfileFileSlot,
  role?: string,
) {
  return parseStoredApplicantProfileFile(userId, applicantProfileId, slot, role)
}

export async function buildApplicantParsedIntake(
  userId: string,
  applicantProfileId: string,
  role?: string,
): Promise<ApplicantParsedIntakeResult | null> {
  const profile = await getApplicantProfile(userId, applicantProfileId, role, {
    includeUsVisaFullIntake: true,
    includeSchengenFullIntake: true,
  })
  if (!profile) return null

  const usVisaSource = await getApplicantProfileFileByCandidates(userId, applicantProfileId, US_VISA_EXCEL_SLOTS, role)
  const schengenSource = await getApplicantProfileFileByCandidates(
    userId,
    applicantProfileId,
    SCHENGEN_EXCEL_SLOTS,
    role,
  )

  const usVisaExcel = usVisaSource
    ? await parseStoredApplicantProfileFile(userId, applicantProfileId, usVisaSource.meta.slot, role)
    : null
  const schengenExcel = schengenSource
    ? await parseStoredApplicantProfileFile(userId, applicantProfileId, schengenSource.meta.slot, role)
    : null

  const jsonFiles: Partial<Record<ApplicantProfileFileSlot, ParsedApplicantProfileFileResult>> = {}
  for (const slot of JSON_FILE_SLOTS) {
    if (!profile.files[slot]) continue
    const parsed = await parseStoredApplicantProfileFile(userId, applicantProfileId, slot, role)
    if (parsed) {
      jsonFiles[slot] = parsed
    }
  }

  return {
    applicantProfileId: profile.id,
    profile,
    parsedSources: {
      usVisaExcel,
      schengenExcel,
      jsonFiles,
    },
  }
}

export async function buildApplicantUsVisaIntakeView(
  userId: string,
  applicantProfileId: string,
  role?: string,
): Promise<ApplicantUsVisaIntakeView | null> {
  const profile = await getApplicantProfile(userId, applicantProfileId, role, {
    includeUsVisaFullIntake: true,
  })
  if (!profile) return null

  const sourceFile = await getApplicantProfileFileByCandidates(userId, applicantProfileId, US_VISA_EXCEL_SLOTS, role)
  const photo = await getApplicantProfileFileByCandidates(userId, applicantProfileId, US_VISA_PHOTO_SLOTS, role)
  const intake = await resolveUsVisaIntakeSnapshot(sourceFile, profile.usVisa?.fullIntake || null)

  return {
    applicantProfileId: profile.id,
    applicantLabel: profile.label,
    usVisa: profile.usVisa
      ? {
          aaCode: profile.usVisa.aaCode,
          surname: profile.usVisa.surname,
          birthYear: profile.usVisa.birthYear,
          passportNumber: profile.usVisa.passportNumber,
          slotTime: profile.usVisa.slotTime,
        }
      : null,
    intake,
    sourceFile: toAgentFileDescriptor(profile.id, sourceFile),
    photo: toAgentFileDescriptor(profile.id, photo),
  }
}

export async function buildApplicantSchengenIntakeView(
  userId: string,
  applicantProfileId: string,
  role?: string,
): Promise<ApplicantSchengenIntakeView | null> {
  const profile = await getApplicantProfile(userId, applicantProfileId, role, {
    includeSchengenFullIntake: true,
  })
  if (!profile) return null

  const sourceFile = await getApplicantProfileFileByCandidates(userId, applicantProfileId, SCHENGEN_EXCEL_SLOTS, role)
  const intake = await resolveSchengenIntakeSnapshot(sourceFile, profile.schengen?.fullIntake || null)

  return {
    applicantProfileId: profile.id,
    applicantLabel: profile.label,
    schengen: profile.schengen
      ? {
          country: profile.schengen.country,
          city: profile.schengen.city,
        }
      : null,
    intake,
    sourceFile: toAgentFileDescriptor(profile.id, sourceFile),
  }
}

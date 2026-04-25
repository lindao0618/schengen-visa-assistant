import fs from "fs/promises"
import path from "path"
import { nanoid } from "nanoid"
import { Prisma } from "@prisma/client"

import { canReadAllApplicants } from "@/lib/access-control"
import { buildApplicantAccessWhere, resolveViewerRole } from "@/lib/access-control-server"
import prisma from "@/lib/db"
import { normalizeFranceTlsCity } from "@/lib/france-tls-city"
import { extractFranceTlsCityFromExcelBuffer } from "@/lib/france-tls-city-excel"

export type ApplicantProfileFileSlot =
  | "usVisaPhoto"
  | "usVisaDs160Excel"
  | "usVisaAisExcel"
  | "usVisaDs160ConfirmationPdf"
  | "usVisaDs160PrecheckJson"
  | "usVisaInterviewBriefJson"
  | "usVisaInterviewBriefDocx"
  | "usVisaInterviewBriefPdf"
  | "schengenPhoto"
  | "schengenExcel"
  | "schengenItineraryPdf"
  | "schengenExplanationLetterCnDocx"
  | "schengenExplanationLetterEnDocx"
  | "schengenExplanationLetterCnPdf"
  | "schengenExplanationLetterEnPdf"
  | "schengenHotelReservation"
  | "schengenFlightReservation"
  | "franceTlsAccountsJson"
  | "franceApplicationJson"
  | "franceReceiptPdf"
  | "franceFinalSubmissionPdf"
  | "photo"
  | "ds160Excel"
  | "aisExcel"
  | "franceExcel"
  | "passportScan"

export interface ApplicantProfileFileMeta {
  slot: ApplicantProfileFileSlot
  originalName: string
  storedName: string
  relativePath: string
  mimeType: string
  size: number
  uploadedAt: string
}

export interface ApplicantUsVisaIntakeAuditIssue {
  field: string
  message: string
  value?: string
}

export interface ApplicantUsVisaIntakeItem {
  key: string
  label: string
  value: string
}

export interface ApplicantUsVisaIntakeSnapshot {
  version: number
  sourceSlot: ApplicantProfileFileSlot
  sourceOriginalName?: string
  extractedAt: string
  fieldCount: number
  fields: Record<string, string>
  items: ApplicantUsVisaIntakeItem[]
  audit: {
    ok: boolean
    errors: ApplicantUsVisaIntakeAuditIssue[]
  }
}

export type ApplicantSchengenIntakeAuditIssue = ApplicantUsVisaIntakeAuditIssue
export type ApplicantSchengenIntakeItem = ApplicantUsVisaIntakeItem
export type ApplicantSchengenIntakeSnapshot = ApplicantUsVisaIntakeSnapshot

export interface ApplicantProfile {
  id: string
  userId: string
  label: string
  name?: string
  groupName?: string
  phone?: string
  email?: string
  wechat?: string
  passportNumber?: string
  passportLast4?: string
  note?: string
  usVisa?: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
    fullIntake?: ApplicantUsVisaIntakeSnapshot
    slotTime?: string // 面签时间
  }
  schengen?: {
    country?: string
    city?: string
    fraNumber?: string
    fullIntake?: ApplicantSchengenIntakeSnapshot
  }
  files: Partial<Record<ApplicantProfileFileSlot, ApplicantProfileFileMeta>>
  createdAt: string
  updatedAt: string

  // Legacy fields kept for backward compatibility with old stored data.
  fullName?: string
  surname?: string
  givenName?: string
  birthYear?: string
  birthDate?: string
  visaCountry?: string
  notes?: string
}

export interface ApplicantFranceAutomationProfile {
  id: string
  label: string
  name?: string
  phone?: string
  schengen?: {
    country?: string
    city?: string
    fraNumber?: string
  }
  files: Partial<Record<"schengenExcel" | "franceExcel" | "franceApplicationJson", ApplicantProfileFileMeta>>
}

export type ApplicantProfileInput = Partial<
  Omit<ApplicantProfile, "id" | "userId" | "files" | "createdAt" | "updatedAt">
>

const STORAGE_ROOT = path.join(process.cwd(), "storage", "applicant-profiles")

/** Slots whose files are Excel workbooks and may be replaced via online editor (PUT). */
const EXCEL_EDITABLE_SLOTS: ApplicantProfileFileSlot[] = [
  "schengenExcel",
  "franceExcel",
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "ds160Excel",
  "aisExcel",
]

export function isApplicantProfileExcelEditableSlot(slot: string): slot is ApplicantProfileFileSlot {
  return EXCEL_EDITABLE_SLOTS.includes(slot as ApplicantProfileFileSlot)
}

const VALID_SLOTS: ApplicantProfileFileSlot[] = [
  "usVisaPhoto",
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "usVisaDs160ConfirmationPdf",
  "usVisaDs160PrecheckJson",
  "usVisaInterviewBriefJson",
  "usVisaInterviewBriefDocx",
  "usVisaInterviewBriefPdf",
  "schengenPhoto",
  "schengenExcel",
  "schengenItineraryPdf",
  "schengenExplanationLetterCnDocx",
  "schengenExplanationLetterEnDocx",
  "schengenExplanationLetterCnPdf",
  "schengenExplanationLetterEnPdf",
  "schengenHotelReservation",
  "schengenFlightReservation",
  "franceTlsAccountsJson",
  "franceApplicationJson",
  "franceReceiptPdf",
  "franceFinalSubmissionPdf",
  "photo",
  "ds160Excel",
  "aisExcel",
  "franceExcel",
  "passportScan",
]

const US_VISA_EXCEL_SLOTS: ApplicantProfileFileSlot[] = [
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "ds160Excel",
  "aisExcel",
]

const SCHENGEN_EXCEL_SLOTS: ApplicantProfileFileSlot[] = [
  "schengenExcel",
  "franceExcel",
]

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function derivePassportLast4(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return undefined
  return normalized.slice(-4)
}

function normalizeName(input: ApplicantProfileInput) {
  return (
    normalizeText(input.name) ||
    normalizeText(input.label) ||
    normalizeText(input.fullName) ||
    "未命名申请人"
  )
}

function normalizeGroupName(value: unknown) {
  const normalized = normalizeText(value)
  return normalized || undefined
}

function normalizeAA(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  return normalized || undefined
}

function normalizeYear(value: unknown) {
  const normalized = normalizeText(value)
  return normalized || undefined
}

function normalizeFranceVisasRef(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  return normalized || undefined
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) return direct

  const normalized = raw
    .replace(/[.]/g, "/")
    .replace(/年/g, "/")
    .replace(/月/g, "/")
    .replace(/日/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const ymd = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (ymd) {
    const [, y, m, d, hh = "0", mm = "0", ss = "0"] = ymd
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  const dmy = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (dmy) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = dmy
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  return null
}

function parseUsVisaSlotTimePreserve(
  value: string | null | undefined,
  fallback: Date | null,
): Date | null {
  if (value == null) return fallback
  const raw = String(value).trim()
  if (!raw) return null
  const parsed = parseDateInput(raw)
  return parsed ?? fallback
}

function normalizeSchengenCity(value: unknown) {
  return normalizeFranceTlsCity(value)
}

function normalizeApplicantUsVisaIntakeSnapshot(value: unknown): ApplicantUsVisaIntakeSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const rawFields =
    record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
      ? (record.fields as Record<string, unknown>)
      : {}
  const fields = Object.fromEntries(
    Object.entries(rawFields)
      .map(([key, rawValue]) => [key, normalizeText(rawValue)])
      .filter(([, normalized]) => Boolean(normalized)),
  )

  const rawItems = Array.isArray(record.items) ? record.items : []
  const items = rawItems
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null
      }

      const current = item as Record<string, unknown>
      const key = normalizeText(current.key)
      const label = normalizeText(current.label)
      if (!key || !label) {
        return null
      }

      return {
        key,
        label,
        value: normalizeText(current.value),
      } satisfies ApplicantUsVisaIntakeItem
    })
    .filter((item): item is ApplicantUsVisaIntakeItem => Boolean(item))

  const rawAudit =
    record.audit && typeof record.audit === "object" && !Array.isArray(record.audit)
      ? (record.audit as Record<string, unknown>)
      : null
  const auditErrors = Array.isArray(rawAudit?.errors)
    ? rawAudit.errors
        .map((issue) => {
          if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
            return null
          }

          const current = issue as Record<string, unknown>
          const field = normalizeText(current.field)
          const message = normalizeText(current.message)
          if (!field || !message) {
            return null
          }

          return {
            field,
            message,
            value: normalizeText(current.value) || undefined,
          } as ApplicantUsVisaIntakeAuditIssue
        })
        .filter((issue): issue is ApplicantUsVisaIntakeAuditIssue => issue !== null)
    : []

  const sourceSlotCandidate = normalizeText(record.sourceSlot)
  const sourceSlot = isApplicantProfileFileSlot(sourceSlotCandidate)
    ? sourceSlotCandidate
    : "usVisaDs160Excel"
  const sourceOriginalName = normalizeText(record.sourceOriginalName) || undefined
  const extractedAt = normalizeText(record.extractedAt) || new Date(0).toISOString()
  const parsedFieldCount = Number(record.fieldCount)
  const fieldCount =
    Number.isFinite(parsedFieldCount) && parsedFieldCount > 0
      ? parsedFieldCount
      : (items.length || Object.keys(fields).length)

  return {
    version: Number(record.version) > 0 ? Number(record.version) : 1,
    sourceSlot,
    sourceOriginalName,
    extractedAt,
    fieldCount,
    fields,
    items,
    audit: {
      ok: Boolean(rawAudit?.ok),
      errors: auditErrors,
    },
  }
}

function toPrismaApplicantUsVisaIntakeSnapshot(snapshot?: ApplicantUsVisaIntakeSnapshot | null) {
  if (!snapshot) {
    return Prisma.DbNull
  }

  return {
    version: snapshot.version,
    sourceSlot: snapshot.sourceSlot,
    ...(snapshot.sourceOriginalName ? { sourceOriginalName: snapshot.sourceOriginalName } : {}),
    extractedAt: snapshot.extractedAt,
    fieldCount: snapshot.fieldCount,
    fields: snapshot.fields,
    items: snapshot.items.map((item) => ({
      key: item.key,
      label: item.label,
      value: item.value,
    })),
    audit: {
      ok: Boolean(snapshot.audit?.ok),
      errors: (snapshot.audit?.errors || []).map((issue) => ({
        field: issue.field,
        message: issue.message,
        ...(issue.value ? { value: issue.value } : {}),
      })),
    },
  } as Prisma.InputJsonValue
}

function extractBirthYear(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return undefined
  const match = normalized.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : undefined
}

function sanitizeFilename(name: string) {
  const ext = path.extname(name)
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${base || "file"}${ext || ""}`
}

async function upsertApplicantProfileFileRecord(params: {
  applicantProfileId: string
  slot: ApplicantProfileFileSlot
  originalName: string
  storedName: string
  relativePath: string
  mimeType: string
  size: number
}) {
  const { applicantProfileId, slot, originalName, storedName, relativePath, mimeType, size } = params

  await prisma.applicantFile.upsert({
    where: {
      applicantProfileId_slot: {
        applicantProfileId,
        slot,
      },
    },
    update: {
      originalName,
      storedName,
      relativePath,
      mimeType,
      size,
      uploadedAt: new Date(),
    },
    create: {
      applicantProfileId,
      slot,
      originalName,
      storedName,
      relativePath,
      mimeType,
      size,
      uploadedAt: new Date(),
    },
  })
}

function mapFiles(
  files: Array<{
    slot: string
    originalName: string
    storedName: string
    relativePath: string
    mimeType: string
    size: number
    uploadedAt: Date
  }>
): Partial<Record<ApplicantProfileFileSlot, ApplicantProfileFileMeta>> {
  const result: Partial<Record<ApplicantProfileFileSlot, ApplicantProfileFileMeta>> = {}
  for (const file of files) {
    if (!isApplicantProfileFileSlot(file.slot)) continue
    result[file.slot] = {
      slot: file.slot,
      originalName: file.originalName,
      storedName: file.storedName,
      relativePath: file.relativePath,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt.toISOString(),
    }
  }
  return result
}

function toApplicantProfile(
  profile: ApplicantProfileRecord,
  options?: { includeUsVisaFullIntake?: boolean; includeSchengenFullIntake?: boolean },
): ApplicantProfile {
  const name = normalizeText(profile.name) || "未命名申请人"
  const passportNumber = normalizeText(profile.passportNumber) || normalizeText(profile.usVisaPassportNumber) || undefined
  const profileWithSlot = profile as ApplicantProfileRecord & {
    usVisaSlotTime?: Date | null
    usVisaIntakeJson?: unknown
    schengenIntakeJson?: unknown
  }
  const usVisaFullIntake = options?.includeUsVisaFullIntake
    ? normalizeApplicantUsVisaIntakeSnapshot(profileWithSlot.usVisaIntakeJson)
    : undefined
  const schengenFullIntake = options?.includeSchengenFullIntake
    ? normalizeApplicantUsVisaIntakeSnapshot(profileWithSlot.schengenIntakeJson)
    : undefined

  return {
    id: profile.id,
    userId: profile.userId,
    label: name,
    name,
    groupName: normalizeGroupName((profile as ApplicantProfileRecord & { groupName?: string | null }).groupName),
    phone: normalizeText(profile.phone) || undefined,
    email: normalizeText(profile.email) || undefined,
    wechat: normalizeText(profile.wechat) || undefined,
    passportNumber,
    passportLast4: normalizeText(profile.passportLast4) || derivePassportLast4(passportNumber),
    note: normalizeText(profile.note) || undefined,
    usVisa: {
      aaCode: normalizeAA(profile.usVisaAaCode),
      surname: normalizeText(profile.usVisaSurname) || undefined,
      birthYear: normalizeYear(profile.usVisaBirthYear),
      passportNumber: normalizeText(profile.usVisaPassportNumber) || undefined,
      fullIntake: usVisaFullIntake,
      slotTime: profileWithSlot.usVisaSlotTime ? profileWithSlot.usVisaSlotTime.toISOString() : undefined,
    },
    schengen: {
      country: normalizeText(profile.schengenCountry) || undefined,
      city: normalizeSchengenCity(profile.schengenVisaCity),
      fraNumber: normalizeFranceVisasRef(profile.schengenFraNumber),
      fullIntake: schengenFullIntake,
    },
    files: mapFiles(profile.files),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

async function hydrateSchengenCityFromStoredExcel(profile: ApplicantProfileRecord) {
  if (normalizeSchengenCity(profile.schengenVisaCity)) {
    return profile
  }

  const excelFile = profile.files.find((file) => file.slot === "schengenExcel" || file.slot === "franceExcel")
  if (!excelFile?.relativePath) {
    return profile
  }

  try {
    const absolutePath = path.join(process.cwd(), excelFile.relativePath)
    const buffer = await fs.readFile(absolutePath)
    const parsedCity = extractFranceTlsCityFromExcelBuffer(buffer)
    if (!parsedCity) {
      return profile
    }

    return prisma.applicantProfile.update({
      where: { id: profile.id },
      data: { schengenVisaCity: parsedCity },
      include: { files: true },
    })
  } catch {
    return profile
  }
}

async function ensureStorageRoot() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true })
}

async function findApplicantProfileRecord(userId: string, id: string, role?: string) {
  const viewerRole = await resolveViewerRole(userId, role)
  return prisma.applicantProfile.findFirst({
    where: {
      id,
      ...buildApplicantAccessWhere(userId, viewerRole),
    },
    include: { files: true },
  })
}

async function findApplicantProfileRecordForDelete(userId: string, id: string, role?: string) {
  const viewerRole = await resolveViewerRole(userId, role)
  return prisma.applicantProfile.findFirst({
    where: canReadAllApplicants(viewerRole) ? { id } : { id, userId },
    include: { files: true },
  })
}

type ApplicantProfileRecord = NonNullable<Awaited<ReturnType<typeof findApplicantProfileRecord>>>
type ApplicantProfileReadOptions = {
  includeUsVisaFullIntake?: boolean
  includeSchengenFullIntake?: boolean
}

export function isApplicantProfileFileSlot(value: string): value is ApplicantProfileFileSlot {
  return VALID_SLOTS.includes(value as ApplicantProfileFileSlot)
}

export async function listApplicantProfiles(userId: string, role?: string) {
  const viewerRole = await resolveViewerRole(userId, role)
  const profiles = await prisma.applicantProfile.findMany({
    where: buildApplicantAccessWhere(userId, viewerRole),
    include: { files: true },
    orderBy: { updatedAt: "desc" },
  })
  const hydratedProfiles = await Promise.all(profiles.map(hydrateSchengenCityFromStoredExcel))
  return hydratedProfiles.map((profile) => toApplicantProfile(profile))
}

export async function listFranceAutomationApplicantProfiles(userId: string, role?: string) {
  const viewerRole = await resolveViewerRole(userId, role)
  const profiles = await prisma.applicantProfile.findMany({
    where: buildApplicantAccessWhere(userId, viewerRole),
    include: {
      files: {
        where: {
          slot: {
            in: ["schengenExcel", "franceExcel", "franceApplicationJson"],
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return profiles.map((profile) => {
    const name = normalizeText(profile.name) || "未命名申请人"
    return {
      id: profile.id,
      label: name,
      name,
      phone: normalizeText(profile.phone) || undefined,
      schengen: {
        country: normalizeText(profile.schengenCountry) || undefined,
        city: normalizeSchengenCity(profile.schengenVisaCity),
        fraNumber: normalizeFranceVisasRef(profile.schengenFraNumber),
      },
      files: mapFiles(profile.files) as ApplicantFranceAutomationProfile["files"],
    } satisfies ApplicantFranceAutomationProfile
  })
}

export async function getApplicantProfile(
  userId: string,
  id: string,
  role?: string,
  options?: ApplicantProfileReadOptions,
) {
  const profile = await findApplicantProfileRecord(userId, id, role)
  if (!profile) return null
  const hydratedProfile = await hydrateSchengenCityFromStoredExcel(profile)
  return toApplicantProfile(hydratedProfile, options)
}

export async function getApplicantProfileUsVisaIntake(
  userId: string,
  id: string,
  role?: string,
) {
  const profile = await getApplicantProfile(userId, id, role, { includeUsVisaFullIntake: true })
  if (!profile) return null
  return profile.usVisa?.fullIntake || null
}

export async function getApplicantProfileSchengenIntake(
  userId: string,
  id: string,
  role?: string,
) {
  const profile = await getApplicantProfile(userId, id, role, { includeSchengenFullIntake: true })
  if (!profile) return null
  return profile.schengen?.fullIntake || null
}

export async function createApplicantProfile(userId: string, input: ApplicantProfileInput) {
  const name = normalizeName(input)
  const passportNumber =
    normalizeText(input.passportNumber) ||
    normalizeText(input.usVisa?.passportNumber) ||
    undefined
  const profile = await prisma.applicantProfile.create({
    data: {
      id: nanoid(12),
      userId,
      name,
      phone: normalizeText(input.phone) || undefined,
      email: normalizeText(input.email) || undefined,
      wechat: normalizeText(input.wechat) || undefined,
      passportNumber: passportNumber || undefined,
      passportLast4: derivePassportLast4(passportNumber) || undefined,
      note: normalizeText(input.note) || undefined,
      usVisaSurname: normalizeText(input.usVisa?.surname) || undefined,
      usVisaBirthYear: normalizeYear(input.usVisa?.birthYear),
      usVisaPassportNumber: normalizeText(input.usVisa?.passportNumber) || undefined,
      usVisaSlotTime: parseDateInput(input.usVisa?.slotTime ?? null),
      schengenCountry: normalizeText(input.schengen?.country) || undefined,
      schengenVisaCity: normalizeSchengenCity(input.schengen?.city),
      schengenFraNumber: normalizeFranceVisasRef(input.schengen?.fraNumber),
      groupName: normalizeGroupName(input.groupName) || undefined,
    },
    include: { files: true },
  })
  return toApplicantProfile(profile)
}

export async function updateApplicantProfile(userId: string, id: string, input: ApplicantProfileInput, role?: string) {
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  const nextName = normalizeName({
    ...toApplicantProfile(current),
    ...input,
    name: normalizeText(input.name) || normalizeText(input.label) || current.name,
  })

  const nextPassportNumber =
    normalizeText(input.passportNumber) ||
    (Object.prototype.hasOwnProperty.call(input, "passportNumber") ? "" : normalizeText(current.passportNumber)) ||
    (
      input.usVisa && Object.prototype.hasOwnProperty.call(input.usVisa, "passportNumber")
        ? normalizeText(input.usVisa.passportNumber)
        : normalizeText(current.usVisaPassportNumber)
    ) ||
    undefined

  const profile = await prisma.applicantProfile.update({
    where: { id: current.id },
    data: {
      name: nextName,
      phone:
        Object.prototype.hasOwnProperty.call(input, "phone")
          ? normalizeText(input.phone) || null
          : current.phone,
      email:
        Object.prototype.hasOwnProperty.call(input, "email")
          ? normalizeText(input.email) || null
          : current.email,
      wechat:
        Object.prototype.hasOwnProperty.call(input, "wechat")
          ? normalizeText(input.wechat) || null
          : current.wechat,
      passportNumber:
        Object.prototype.hasOwnProperty.call(input, "passportNumber") ||
        (input.usVisa && Object.prototype.hasOwnProperty.call(input.usVisa, "passportNumber"))
          ? nextPassportNumber || null
          : current.passportNumber,
      passportLast4:
        Object.prototype.hasOwnProperty.call(input, "passportNumber") ||
        (input.usVisa && Object.prototype.hasOwnProperty.call(input.usVisa, "passportNumber"))
          ? derivePassportLast4(nextPassportNumber) || null
          : current.passportLast4,
      note:
        Object.prototype.hasOwnProperty.call(input, "note")
          ? normalizeText(input.note) || null
          : current.note,
      groupName:
        Object.prototype.hasOwnProperty.call(input, "groupName")
          ? normalizeGroupName(input.groupName) || null
          : current.groupName,
      usVisaAaCode: current.usVisaAaCode,
      usVisaSurname:
        input.usVisa && Object.prototype.hasOwnProperty.call(input.usVisa, "surname")
          ? normalizeText(input.usVisa.surname) || null
          : current.usVisaSurname,
      usVisaBirthYear:
        input.usVisa && Object.prototype.hasOwnProperty.call(input.usVisa, "birthYear")
          ? normalizeYear(input.usVisa.birthYear) || null
          : current.usVisaBirthYear,
      usVisaPassportNumber:
        input.usVisa && Object.prototype.hasOwnProperty.call(input.usVisa, "passportNumber")
          ? normalizeText(input.usVisa.passportNumber) || null
          : current.usVisaPassportNumber,
      usVisaSlotTime:
        input.usVisa && Object.prototype.hasOwnProperty.call(input.usVisa, "slotTime")
          ? parseUsVisaSlotTimePreserve(input.usVisa.slotTime ?? null, current.usVisaSlotTime)
          : current.usVisaSlotTime,
      schengenCountry:
        input.schengen && Object.prototype.hasOwnProperty.call(input.schengen, "country")
          ? normalizeText(input.schengen.country) || null
          : current.schengenCountry,
      schengenVisaCity:
        input.schengen && Object.prototype.hasOwnProperty.call(input.schengen, "city")
          ? normalizeSchengenCity(input.schengen.city) || null
          : current.schengenVisaCity,
      schengenFraNumber:
        input.schengen && Object.prototype.hasOwnProperty.call(input.schengen, "fraNumber")
          ? normalizeFranceVisasRef(input.schengen.fraNumber) || null
          : current.schengenFraNumber,
    },
    include: { files: true },
  })

  return toApplicantProfile(profile)
}

export async function setApplicantProfileUsVisaAAcode(userId: string, id: string, aaCode: string, role?: string) {
  const normalized = normalizeAA(aaCode)
  if (!normalized) return null

  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  const profile = await prisma.applicantProfile.update({
    where: { id: current.id },
    data: { usVisaAaCode: normalized },
    include: { files: true },
  })

  return toApplicantProfile(profile)
}

export async function updateApplicantProfileUsVisaDetails(
  userId: string,
  id: string,
  details: {
    aaCode?: string
    surname?: string
    birthYear?: string
    birthDate?: string
    passportNumber?: string
    fullIntake?: ApplicantUsVisaIntakeSnapshot | null
    slotTime?: string
  },
  role?: string
) {
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  const nextAaCode = normalizeAA(details.aaCode) ?? current.usVisaAaCode ?? undefined
  const nextSurname = normalizeText(details.surname) || current.usVisaSurname || undefined
  const nextBirthYear =
    normalizeYear(details.birthYear) ||
    extractBirthYear(details.birthDate) ||
    current.usVisaBirthYear ||
    undefined
  const nextPassportNumber = normalizeText(details.passportNumber) || current.usVisaPassportNumber || undefined
  const nextSlotTime = Object.prototype.hasOwnProperty.call(details, "slotTime")
    ? parseUsVisaSlotTimePreserve(details.slotTime ?? null, current.usVisaSlotTime)
    : current.usVisaSlotTime

  const profile = await prisma.applicantProfile.update({
    where: { id: current.id },
    data: {
      usVisaAaCode: nextAaCode || null,
      usVisaSurname: nextSurname || null,
      usVisaBirthYear: nextBirthYear || null,
      usVisaPassportNumber: nextPassportNumber || null,
      usVisaIntakeJson:
        Object.prototype.hasOwnProperty.call(details, "fullIntake")
          ? toPrismaApplicantUsVisaIntakeSnapshot(details.fullIntake)
          : (current.usVisaIntakeJson ?? Prisma.DbNull),
      usVisaSlotTime: nextSlotTime,
      passportNumber: normalizeText(current.passportNumber) || nextPassportNumber || null,
      passportLast4: derivePassportLast4(normalizeText(current.passportNumber) || nextPassportNumber) || null,
    },
    include: { files: true },
  })

  return getApplicantProfile(userId, current.id, role, { includeUsVisaFullIntake: true })
}

export async function updateApplicantProfileUsVisaSlotTime(
  userId: string,
  id: string,
  slotTime: string | null,
  role?: string
) {
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  const profile = await prisma.applicantProfile.update({
    where: { id: current.id },
    data: {
      usVisaSlotTime: parseUsVisaSlotTimePreserve(slotTime, current.usVisaSlotTime),
    },
    include: { files: true },
  })

  return toApplicantProfile(profile)
}

export async function updateApplicantProfileSchengenDetails(
  userId: string,
  id: string,
  details: {
    country?: string
    city?: string
    fraNumber?: string
    fullIntake?: ApplicantSchengenIntakeSnapshot | null
  },
  role?: string
) {
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  const nextCountry = normalizeText(details.country) || current.schengenCountry || undefined
  const nextCity = normalizeSchengenCity(details.city) || current.schengenVisaCity || undefined
  const nextFraNumber = Object.prototype.hasOwnProperty.call(details, "fraNumber")
    ? normalizeFranceVisasRef(details.fraNumber) || undefined
    : normalizeFranceVisasRef(current.schengenFraNumber)

  const profile = await prisma.applicantProfile.update({
    where: { id: current.id },
    data: {
      schengenCountry: nextCountry || null,
      schengenVisaCity: nextCity || null,
      schengenFraNumber: nextFraNumber || null,
      schengenIntakeJson:
        Object.prototype.hasOwnProperty.call(details, "fullIntake")
          ? toPrismaApplicantUsVisaIntakeSnapshot(details.fullIntake)
          : (current.schengenIntakeJson ?? Prisma.DbNull),
    },
    include: { files: true },
  })

  return getApplicantProfile(userId, current.id, role, { includeSchengenFullIntake: true })
}

export async function deleteApplicantProfile(userId: string, id: string, role?: string) {
  const current = await findApplicantProfileRecordForDelete(userId, id, role)
  if (!current) return false

  await prisma.applicantProfile.delete({
    where: { id: current.id },
  })

  const profileDir = path.join(STORAGE_ROOT, current.userId, id)
  await fs.rm(profileDir, { recursive: true, force: true })
  return true
}

export async function updateApplicantProfilesGroupName(
  userId: string,
  ids: string[],
  groupName: string | null,
  role?: string,
) {
  const uniqueIds = Array.from(new Set(ids.map((item) => item.trim()).filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { updatedIds: [] }
  }

  const viewerRole = await resolveViewerRole(userId, role)
  const allowedProfiles = await prisma.applicantProfile.findMany({
    where: {
      id: { in: uniqueIds },
      ...buildApplicantAccessWhere(userId, viewerRole),
    },
    select: { id: true },
  })
  const updatedIds = allowedProfiles.map((profile) => profile.id)
  if (updatedIds.length === 0) {
    return { updatedIds: [] }
  }

  await prisma.applicantProfile.updateMany({
    where: { id: { in: updatedIds } },
    data: { groupName: normalizeGroupName(groupName) || null },
  })

  return { updatedIds }
}

export async function deleteApplicantProfilesBatch(userId: string, ids: string[], role?: string) {
  const uniqueIds = Array.from(new Set(ids.map((item) => item.trim()).filter(Boolean)))
  const deletedIds: string[] = []

  for (const id of uniqueIds) {
    const deleted = await deleteApplicantProfile(userId, id, role)
    if (deleted) deletedIds.push(id)
  }

  return { deletedIds }
}

export async function saveApplicantProfileFiles(
  userId: string,
  id: string,
  entries: Array<{ slot: ApplicantProfileFileSlot; file: File }>,
  role?: string
) {
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  await ensureStorageRoot()
  const profileDir = path.join(STORAGE_ROOT, current.userId, id)
  await fs.mkdir(profileDir, { recursive: true })

  for (const entry of entries) {
    const storedName = `${entry.slot}-${Date.now()}-${sanitizeFilename(entry.file.name || "file")}`
    const absolutePath = path.join(profileDir, storedName)
    await fs.writeFile(absolutePath, Buffer.from(await entry.file.arrayBuffer()))
    const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/")

    const existing = current.files.find((file) => file.slot === entry.slot)
    if (existing) {
      const oldPath = path.join(process.cwd(), existing.relativePath)
      if (oldPath !== absolutePath) {
        await fs.rm(oldPath, { force: true }).catch(() => {})
      }
    }

    await upsertApplicantProfileFileRecord({
      applicantProfileId: current.id,
      slot: entry.slot,
      originalName: entry.file.name || storedName,
      storedName,
      relativePath,
      mimeType: entry.file.type || "application/octet-stream",
      size: entry.file.size,
    })
  }

  const profile = await findApplicantProfileRecord(userId, id, role)
  return profile ? toApplicantProfile(profile) : null
}

export async function saveApplicantProfileFileFromAbsolutePath(params: {
  userId: string
  id: string
  slot: ApplicantProfileFileSlot
  sourcePath: string
  originalName?: string
  mimeType?: string
  role?: string
}) {
  const { userId, id, slot, sourcePath, originalName, mimeType, role } = params
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  await ensureStorageRoot()
  const profileDir = path.join(STORAGE_ROOT, current.userId, id)
  await fs.mkdir(profileDir, { recursive: true })

  const sourceStat = await fs.stat(sourcePath)
  const fallbackName = path.basename(sourcePath) || `${slot}.jpg`
  const storedName = `${slot}-${Date.now()}-${sanitizeFilename(originalName || fallbackName)}`
  const absolutePath = path.join(profileDir, storedName)
  await fs.copyFile(sourcePath, absolutePath)
  const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/")

  const existing = current.files.find((file) => file.slot === slot)
  if (existing) {
    const oldPath = path.join(process.cwd(), existing.relativePath)
    if (oldPath !== absolutePath) {
      await fs.rm(oldPath, { force: true }).catch(() => {})
    }
  }

  await upsertApplicantProfileFileRecord({
    applicantProfileId: current.id,
    slot,
    originalName: originalName || fallbackName,
    storedName,
    relativePath,
    mimeType: mimeType || "image/jpeg",
    size: sourceStat.size,
  })

  const profile = await findApplicantProfileRecord(userId, id, role)
  return profile ? toApplicantProfile(profile) : null
}

export async function saveApplicantProfileFileFromBuffer(params: {
  userId: string
  id: string
  slot: ApplicantProfileFileSlot
  buffer: Buffer
  originalName: string
  mimeType?: string
  role?: string
}) {
  const { userId, id, slot, buffer, originalName, mimeType, role } = params
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  await ensureStorageRoot()
  const profileDir = path.join(STORAGE_ROOT, current.userId, id)
  await fs.mkdir(profileDir, { recursive: true })

  const storedName = `${slot}-${Date.now()}-${sanitizeFilename(originalName || "file")}`
  const absolutePath = path.join(profileDir, storedName)
  await fs.writeFile(absolutePath, buffer)
  const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, "/")

  const existing = current.files.find((file) => file.slot === slot)
  if (existing) {
    const oldPath = path.join(process.cwd(), existing.relativePath)
    if (oldPath !== absolutePath) {
      await fs.rm(oldPath, { force: true }).catch(() => {})
    }
  }

  await upsertApplicantProfileFileRecord({
    applicantProfileId: current.id,
    slot,
    originalName,
    storedName,
    relativePath,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.byteLength,
  })

  const profile = await findApplicantProfileRecord(userId, id, role)
  return profile ? toApplicantProfile(profile) : null
}

export async function getApplicantProfileFile(userId: string, id: string, slot: ApplicantProfileFileSlot, role?: string) {
  const profile = await findApplicantProfileRecord(userId, id, role)
  if (!profile) return null

  const meta = profile.files.find((file) => file.slot === slot)
  if (!meta) return null

  const absolutePath = path.join(process.cwd(), meta.relativePath)
  return {
    profile: toApplicantProfile(profile),
    meta: {
      slot,
      originalName: meta.originalName,
      storedName: meta.storedName,
      relativePath: meta.relativePath,
      mimeType: meta.mimeType,
      size: meta.size,
      uploadedAt: meta.uploadedAt.toISOString(),
    },
    absolutePath,
  }
}

export async function getApplicantProfileFileByCandidates(
  userId: string,
  id: string,
  slots: ApplicantProfileFileSlot[],
  role?: string
) {
  for (const slot of slots) {
    const file = await getApplicantProfileFile(userId, id, slot, role)
    if (file) return file
  }
  return null
}

export async function deleteApplicantProfileFile(
  userId: string,
  id: string,
  slot: ApplicantProfileFileSlot,
  role?: string,
) {
  const current = await findApplicantProfileRecord(userId, id, role)
  if (!current) return null

  const existing = current.files.find((file) => file.slot === slot)
  if (!existing) {
    return {
      deleted: false,
      profile: toApplicantProfile(current),
    }
  }

  await prisma.$transaction([
    prisma.applicantFile.delete({
      where: {
        applicantProfileId_slot: {
          applicantProfileId: current.id,
          slot,
        },
      },
    }),
    ...(US_VISA_EXCEL_SLOTS.includes(slot)
      ? [
          prisma.applicantProfile.update({
            where: { id: current.id },
            data: {
              usVisaIntakeJson: Prisma.DbNull,
            },
          }),
        ]
      : []),
    ...(SCHENGEN_EXCEL_SLOTS.includes(slot)
      ? [
          prisma.applicantProfile.update({
            where: { id: current.id },
            data: {
              schengenIntakeJson: Prisma.DbNull,
            },
          }),
        ]
      : []),
  ])

  const absolutePath = path.join(process.cwd(), existing.relativePath)
  await fs.rm(absolutePath, { force: true }).catch(() => {})

  const profile = await findApplicantProfileRecord(userId, id, role)
  return {
    deleted: true,
    profile: profile ? toApplicantProfile(profile) : toApplicantProfile(current),
  }
}

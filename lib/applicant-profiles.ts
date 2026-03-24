import fs from "fs/promises"
import path from "path"
import { nanoid } from "nanoid"
import prisma from "@/lib/db"

export type ApplicantProfileFileSlot =
  | "usVisaPhoto"
  | "usVisaDs160Excel"
  | "usVisaAisExcel"
  | "usVisaDs160ConfirmationPdf"
  | "schengenPhoto"
  | "schengenExcel"
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

export interface ApplicantProfile {
  id: string
  userId: string
  label: string
  name?: string
  usVisa?: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
  }
  schengen?: {
    country?: string
  }
  files: Partial<Record<ApplicantProfileFileSlot, ApplicantProfileFileMeta>>
  createdAt: string
  updatedAt: string

  // Legacy fields kept for backward compatibility with old stored data.
  fullName?: string
  surname?: string
  givenName?: string
  email?: string
  phone?: string
  passportNumber?: string
  birthYear?: string
  birthDate?: string
  visaCountry?: string
  notes?: string
}

export type ApplicantProfileInput = Partial<
  Omit<ApplicantProfile, "id" | "userId" | "files" | "createdAt" | "updatedAt">
>

const STORAGE_ROOT = path.join(process.cwd(), "storage", "applicant-profiles")

const VALID_SLOTS: ApplicantProfileFileSlot[] = [
  "usVisaPhoto",
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "usVisaDs160ConfirmationPdf",
  "schengenPhoto",
  "schengenExcel",
  "franceApplicationJson",
  "franceReceiptPdf",
  "franceFinalSubmissionPdf",
  "photo",
  "ds160Excel",
  "aisExcel",
  "franceExcel",
  "passportScan",
]

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeName(input: ApplicantProfileInput) {
  return (
    normalizeText(input.name) ||
    normalizeText(input.label) ||
    normalizeText(input.fullName) ||
    "未命名申请人"
  )
}

function normalizeAA(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  return normalized || undefined
}

function normalizeYear(value: unknown) {
  const normalized = normalizeText(value)
  return normalized || undefined
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

function toApplicantProfile(profile: ApplicantProfileRecord): ApplicantProfile {
  const name = normalizeText(profile.name) || "未命名申请人"

  return {
    id: profile.id,
    userId: profile.userId,
    label: name,
    name,
    usVisa: {
      aaCode: normalizeAA(profile.usVisaAaCode),
      surname: normalizeText(profile.usVisaSurname) || undefined,
      birthYear: normalizeYear(profile.usVisaBirthYear),
      passportNumber: normalizeText(profile.usVisaPassportNumber) || undefined,
    },
    schengen: {
      country: normalizeText(profile.schengenCountry) || undefined,
    },
    files: mapFiles(profile.files),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}

async function ensureStorageRoot() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true })
}

async function findApplicantProfileRecord(userId: string, id: string) {
  return prisma.applicantProfile.findFirst({
    where: { id, userId },
    include: { files: true },
  })
}

type ApplicantProfileRecord = NonNullable<Awaited<ReturnType<typeof findApplicantProfileRecord>>>

export function isApplicantProfileFileSlot(value: string): value is ApplicantProfileFileSlot {
  return VALID_SLOTS.includes(value as ApplicantProfileFileSlot)
}

export async function listApplicantProfiles(userId: string) {
  const profiles = await prisma.applicantProfile.findMany({
    where: { userId },
    include: { files: true },
    orderBy: { updatedAt: "desc" },
  })
  return profiles.map(toApplicantProfile)
}

export async function getApplicantProfile(userId: string, id: string) {
  const profile = await findApplicantProfileRecord(userId, id)
  return profile ? toApplicantProfile(profile) : null
}

export async function createApplicantProfile(userId: string, input: ApplicantProfileInput) {
  const name = normalizeName(input)
  const profile = await prisma.applicantProfile.create({
    data: {
      id: nanoid(12),
      userId,
      name,
      usVisaSurname: normalizeText(input.usVisa?.surname) || undefined,
      usVisaBirthYear: normalizeYear(input.usVisa?.birthYear),
      usVisaPassportNumber: normalizeText(input.usVisa?.passportNumber) || undefined,
      schengenCountry: normalizeText(input.schengen?.country) || undefined,
    },
    include: { files: true },
  })
  return toApplicantProfile(profile)
}

export async function updateApplicantProfile(userId: string, id: string, input: ApplicantProfileInput) {
  const current = await findApplicantProfileRecord(userId, id)
  if (!current) return null

  const nextName = normalizeName({
    ...toApplicantProfile(current),
    ...input,
    name: normalizeText(input.name) || normalizeText(input.label) || current.name,
  })

  const profile = await prisma.applicantProfile.update({
    where: { id: current.id },
    data: {
      name: nextName,
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
      schengenCountry:
        input.schengen && Object.prototype.hasOwnProperty.call(input.schengen, "country")
          ? normalizeText(input.schengen.country) || null
          : current.schengenCountry,
    },
    include: { files: true },
  })

  return toApplicantProfile(profile)
}

export async function setApplicantProfileUsVisaAAcode(userId: string, id: string, aaCode: string) {
  const normalized = normalizeAA(aaCode)
  if (!normalized) return null

  const current = await findApplicantProfileRecord(userId, id)
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
  }
) {
  const current = await findApplicantProfileRecord(userId, id)
  if (!current) return null

  const nextAaCode = normalizeAA(details.aaCode) ?? current.usVisaAaCode ?? undefined
  const nextSurname = normalizeText(details.surname) || current.usVisaSurname || undefined
  const nextBirthYear =
    normalizeYear(details.birthYear) ||
    extractBirthYear(details.birthDate) ||
    current.usVisaBirthYear ||
    undefined
  const nextPassportNumber = normalizeText(details.passportNumber) || current.usVisaPassportNumber || undefined

  const profile = await prisma.applicantProfile.update({
    where: { id: current.id },
    data: {
      usVisaAaCode: nextAaCode || null,
      usVisaSurname: nextSurname || null,
      usVisaBirthYear: nextBirthYear || null,
      usVisaPassportNumber: nextPassportNumber || null,
    },
    include: { files: true },
  })

  return toApplicantProfile(profile)
}

export async function deleteApplicantProfile(userId: string, id: string) {
  const current = await findApplicantProfileRecord(userId, id)
  if (!current) return false

  await prisma.applicantProfile.delete({
    where: { id: current.id },
  })

  const profileDir = path.join(STORAGE_ROOT, userId, id)
  await fs.rm(profileDir, { recursive: true, force: true })
  return true
}

export async function saveApplicantProfileFiles(
  userId: string,
  id: string,
  entries: Array<{ slot: ApplicantProfileFileSlot; file: File }>
) {
  const current = await findApplicantProfileRecord(userId, id)
  if (!current) return null

  await ensureStorageRoot()
  const profileDir = path.join(STORAGE_ROOT, userId, id)
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

  const profile = await findApplicantProfileRecord(userId, id)
  return profile ? toApplicantProfile(profile) : null
}

export async function saveApplicantProfileFileFromAbsolutePath(params: {
  userId: string
  id: string
  slot: ApplicantProfileFileSlot
  sourcePath: string
  originalName?: string
  mimeType?: string
}) {
  const { userId, id, slot, sourcePath, originalName, mimeType } = params
  const current = await findApplicantProfileRecord(userId, id)
  if (!current) return null

  await ensureStorageRoot()
  const profileDir = path.join(STORAGE_ROOT, userId, id)
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

  const profile = await findApplicantProfileRecord(userId, id)
  return profile ? toApplicantProfile(profile) : null
}

export async function getApplicantProfileFile(userId: string, id: string, slot: ApplicantProfileFileSlot) {
  const profile = await findApplicantProfileRecord(userId, id)
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
  slots: ApplicantProfileFileSlot[]
) {
  for (const slot of slots) {
    const file = await getApplicantProfileFile(userId, id, slot)
    if (file) return file
  }
  return null
}

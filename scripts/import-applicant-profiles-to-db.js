const fs = require("fs/promises")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const STORE_PATH = path.join(process.cwd(), "data", "applicant-profiles.json")

const VALID_SLOTS = new Set([
  "usVisaPhoto",
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "schengenPhoto",
  "schengenExcel",
  "photo",
  "ds160Excel",
  "aisExcel",
  "franceExcel",
  "passportScan",
])

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeAA(value) {
  const normalized = normalizeText(value).toUpperCase()
  return normalized || null
}

function normalizeYear(value) {
  const normalized = normalizeText(value)
  return normalized || null
}

function getProfileName(profile) {
  return (
    normalizeText(profile.name) ||
    normalizeText(profile.label) ||
    normalizeText(profile.fullName) ||
    "未命名申请人"
  )
}

async function readLegacyProfiles() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.profiles) ? parsed.profiles : []
  } catch {
    return []
  }
}

async function importProfiles() {
  const profiles = await readLegacyProfiles()
  let importedProfiles = 0
  let importedFiles = 0

  for (const legacy of profiles) {
    if (!normalizeText(legacy?.id) || !normalizeText(legacy?.userId)) continue

    await prisma.applicantProfile.upsert({
      where: { id: legacy.id },
      update: {
        userId: legacy.userId,
        name: getProfileName(legacy),
        usVisaAaCode: normalizeAA(legacy?.usVisa?.aaCode),
        usVisaSurname: normalizeText(legacy?.usVisa?.surname || legacy?.surname) || null,
        usVisaBirthYear: normalizeYear(legacy?.usVisa?.birthYear || legacy?.birthYear),
        usVisaPassportNumber:
          normalizeText(legacy?.usVisa?.passportNumber || legacy?.passportNumber) || null,
        schengenCountry: normalizeText(legacy?.schengen?.country || legacy?.visaCountry) || null,
        createdAt: legacy?.createdAt ? new Date(legacy.createdAt) : undefined,
        updatedAt: legacy?.updatedAt ? new Date(legacy.updatedAt) : new Date(),
      },
      create: {
        id: legacy.id,
        userId: legacy.userId,
        name: getProfileName(legacy),
        usVisaAaCode: normalizeAA(legacy?.usVisa?.aaCode),
        usVisaSurname: normalizeText(legacy?.usVisa?.surname || legacy?.surname) || null,
        usVisaBirthYear: normalizeYear(legacy?.usVisa?.birthYear || legacy?.birthYear),
        usVisaPassportNumber:
          normalizeText(legacy?.usVisa?.passportNumber || legacy?.passportNumber) || null,
        schengenCountry: normalizeText(legacy?.schengen?.country || legacy?.visaCountry) || null,
        createdAt: legacy?.createdAt ? new Date(legacy.createdAt) : new Date(),
        updatedAt: legacy?.updatedAt ? new Date(legacy.updatedAt) : new Date(),
      },
    })
    importedProfiles += 1

    const files = legacy?.files && typeof legacy.files === "object" ? legacy.files : {}
    for (const [slot, meta] of Object.entries(files)) {
      if (!VALID_SLOTS.has(slot) || !meta || typeof meta !== "object") continue

      await prisma.applicantFile.upsert({
        where: {
          applicantProfileId_slot: {
            applicantProfileId: legacy.id,
            slot,
          },
        },
        update: {
          originalName: normalizeText(meta.originalName) || normalizeText(meta.storedName) || slot,
          storedName: normalizeText(meta.storedName) || normalizeText(meta.originalName) || slot,
          relativePath: normalizeText(meta.relativePath),
          mimeType: normalizeText(meta.mimeType) || "application/octet-stream",
          size: Number.isFinite(meta.size) ? meta.size : 0,
          uploadedAt: meta.uploadedAt ? new Date(meta.uploadedAt) : new Date(),
        },
        create: {
          applicantProfileId: legacy.id,
          slot,
          originalName: normalizeText(meta.originalName) || normalizeText(meta.storedName) || slot,
          storedName: normalizeText(meta.storedName) || normalizeText(meta.originalName) || slot,
          relativePath: normalizeText(meta.relativePath),
          mimeType: normalizeText(meta.mimeType) || "application/octet-stream",
          size: Number.isFinite(meta.size) ? meta.size : 0,
          uploadedAt: meta.uploadedAt ? new Date(meta.uploadedAt) : new Date(),
        },
      })
      importedFiles += 1
    }
  }

  return { importedProfiles, importedFiles }
}

async function backfillTaskApplicantIds() {
  const importedIds = await prisma.applicantProfile.findMany({
    select: { id: true },
  })
  const idList = importedIds.map((item) => item.id)
  if (idList.length === 0) {
    return { usVisaTasks: 0, frenchVisaTasks: 0 }
  }

  const usVisaTasks = await prisma.usVisaTask.findMany({
    where: { applicantProfileId: null },
    select: { id: true, result: true },
  })
  let usUpdated = 0
  for (const task of usVisaTasks) {
    const applicantProfileId =
      task.result && typeof task.result === "object" && typeof task.result.applicantProfileId === "string"
        ? task.result.applicantProfileId
        : null
    if (!applicantProfileId || !idList.includes(applicantProfileId)) continue
    await prisma.usVisaTask.update({
      where: { id: task.id },
      data: { applicantProfileId },
    })
    usUpdated += 1
  }

  const frenchVisaTasks = await prisma.frenchVisaTask.findMany({
    where: { applicantProfileId: null },
    select: { id: true, result: true },
  })
  let frenchUpdated = 0
  for (const task of frenchVisaTasks) {
    const applicantProfileId =
      task.result && typeof task.result === "object" && typeof task.result.applicantProfileId === "string"
        ? task.result.applicantProfileId
        : null
    if (!applicantProfileId || !idList.includes(applicantProfileId)) continue
    await prisma.frenchVisaTask.update({
      where: { id: task.id },
      data: { applicantProfileId },
    })
    frenchUpdated += 1
  }

  return { usVisaTasks: usUpdated, frenchVisaTasks: frenchUpdated }
}

async function main() {
  const imported = await importProfiles()
  const backfilled = await backfillTaskApplicantIds()
  console.log(
    JSON.stringify(
      {
        importedProfiles: imported.importedProfiles,
        importedFiles: imported.importedFiles,
        backfilledUsVisaTasks: backfilled.usVisaTasks,
        backfilledFrenchVisaTasks: backfilled.frenchVisaTasks,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

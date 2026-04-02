import fs from "fs/promises"
import path from "path"
import { nanoid } from "nanoid"

import { getApplicantProfile } from "@/lib/applicant-profiles"
import { WecomDriveItem } from "@/lib/wecom-drive"

export type ApplicantWecomFileBinding = {
  id: string
  fileId: string
  fileName: string
  spaceId: string
  fatherId: string
  fileSize: string
  fileType: string
  rootId: string
  rootLabel: string
  url?: string
  linkedAt: string
  linkedByUserId: string
  createdAt: string
  updatedAt: string
}

const STORAGE_ROOT = path.join(process.cwd(), "storage", "applicant-profiles")
const BINDING_FILENAME = "wecom-drive-bindings.json"

function getBindingFilePath(userId: string, applicantId: string) {
  return path.join(STORAGE_ROOT, userId, applicantId, BINDING_FILENAME)
}

async function ensureBindingDir(userId: string, applicantId: string) {
  await fs.mkdir(path.join(STORAGE_ROOT, userId, applicantId), { recursive: true })
}

async function readBindings(userId: string, applicantId: string) {
  const filePath = getBindingFilePath(userId, applicantId)
  try {
    const content = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) return [] as ApplicantWecomFileBinding[]
    return parsed.filter((item): item is ApplicantWecomFileBinding => Boolean(item && typeof item === "object"))
  } catch {
    return [] as ApplicantWecomFileBinding[]
  }
}

async function writeBindings(userId: string, applicantId: string, bindings: ApplicantWecomFileBinding[]) {
  await ensureBindingDir(userId, applicantId)
  const filePath = getBindingFilePath(userId, applicantId)
  await fs.writeFile(filePath, JSON.stringify(bindings, null, 2), "utf8")
}

async function getApplicantOwner(userId: string, applicantId: string, role?: string) {
  const profile = await getApplicantProfile(userId, applicantId, role)
  if (!profile) return null
  return profile.userId
}

export async function listApplicantWecomFileBindings(userId: string, applicantId: string, role?: string) {
  const ownerUserId = await getApplicantOwner(userId, applicantId, role)
  if (!ownerUserId) return null

  const bindings = await readBindings(ownerUserId, applicantId)
  return bindings.sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1))
}

export async function upsertApplicantWecomFileBinding(params: {
  actorUserId: string
  applicantId: string
  role?: string
  rootId: string
  rootLabel: string
  file: WecomDriveItem
}) {
  const ownerUserId = await getApplicantOwner(params.actorUserId, params.applicantId, params.role)
  if (!ownerUserId) return null

  const now = new Date().toISOString()
  const bindings = await readBindings(ownerUserId, params.applicantId)
  const existing = bindings.find((item) => item.fileId === params.file.fileId)

  const nextRecord: ApplicantWecomFileBinding = {
    id: existing?.id || nanoid(12),
    fileId: params.file.fileId,
    fileName: params.file.fileName,
    spaceId: params.file.spaceId,
    fatherId: params.file.fatherId,
    fileSize: params.file.fileSize,
    fileType: params.file.fileType,
    rootId: params.rootId,
    rootLabel: params.rootLabel,
    url: params.file.url,
    linkedAt: existing?.linkedAt || now,
    linkedByUserId: existing?.linkedByUserId || params.actorUserId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  const nextBindings = existing
    ? bindings.map((item) => (item.id === existing.id ? nextRecord : item))
    : [nextRecord, ...bindings]

  await writeBindings(ownerUserId, params.applicantId, nextBindings)
  return nextBindings.sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1))
}

export async function deleteApplicantWecomFileBinding(params: {
  actorUserId: string
  applicantId: string
  bindingId: string
  role?: string
}) {
  const ownerUserId = await getApplicantOwner(params.actorUserId, params.applicantId, params.role)
  if (!ownerUserId) return null

  const bindings = await readBindings(ownerUserId, params.applicantId)
  const nextBindings = bindings.filter((item) => item.id !== params.bindingId)
  if (nextBindings.length === bindings.length) {
    return null
  }

  await writeBindings(ownerUserId, params.applicantId, nextBindings)
  return nextBindings.sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1))
}

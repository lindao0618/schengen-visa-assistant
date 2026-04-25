import path from "path"
import fs from "fs/promises"

import prisma from "@/lib/db"
import { normalizeAppRole } from "@/lib/access-control"
import { buildApplicantAccessWhere, buildCaseAccessWhere, resolveViewerRole } from "@/lib/access-control-server"
import { getTask as getFrenchVisaTask } from "@/lib/french-visa-tasks"
import { getTaskAccessMetadataAny as getFrenchVisaTaskAccessMetadataAny } from "@/lib/french-visa-tasks"
import { getHotelBookingTask } from "@/lib/hotel-booking-tasks"
import { getMaterialTask, listAllMaterialTasks } from "@/lib/material-tasks"
import { findTaskByResultField, getTask as getUsVisaTask } from "@/lib/usa-visa-tasks"
import {
  findTaskAccessMetadataByResultFieldAny,
  getTaskAccessMetadataAny as getUsVisaTaskAccessMetadataAny,
} from "@/lib/usa-visa-tasks"

const OUTPUT_ACCESS_FILENAME = ".access.json"

interface OutputAccessMetadata {
  userId: string
  taskId?: string
  outputId?: string
  tempId?: string
  preferredFilename?: string
  applicantProfileId?: string
  caseId?: string
  createdAt?: number
}

interface ViewerContext {
  userId: string
  role?: string | null
}

interface LinkedOwnership {
  userId?: string | null
  applicantProfileId?: string | null
  caseId?: string | null
}

export function sanitizeDownloadFilename(rawFilename: string) {
  let filename = rawFilename

  try {
    filename = decodeURIComponent(rawFilename)
  } catch {
    filename = rawFilename
  }

  return path.basename(filename).replace(/\.\./g, "")
}

export function getTaskIdFromOutputId(outputId: string, prefix: string) {
  if (!outputId.startsWith(prefix)) return null
  const taskId = outputId.slice(prefix.length)
  return taskId || null
}

export async function writeOutputAccessMetadata(
  dirPath: string,
  metadata: OutputAccessMetadata,
) {
  const filePath = path.join(dirPath, OUTPUT_ACCESS_FILENAME)
  let existing: OutputAccessMetadata = { userId: metadata.userId }

  try {
    const raw = await fs.readFile(filePath, "utf-8")
    existing = JSON.parse(raw) as OutputAccessMetadata
  } catch {
    // Ignore missing metadata and create a new one.
  }

  const next: OutputAccessMetadata = {
    ...existing,
    ...metadata,
    createdAt: existing.createdAt ?? metadata.createdAt ?? Date.now(),
  }

  await fs.mkdir(dirPath, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf-8")
}

export async function readOutputAccessMetadata(dirPath: string) {
  try {
    const raw = await fs.readFile(path.join(dirPath, OUTPUT_ACCESS_FILENAME), "utf-8")
    return JSON.parse(raw) as OutputAccessMetadata
  } catch {
    return null
  }
}

async function canViewerAccessLinkedOwnership(viewer: ViewerContext, ownership: LinkedOwnership | null | undefined) {
  if (!viewer.userId) return false
  if (!ownership) return false
  if (ownership.userId && ownership.userId === viewer.userId) return true

  const role = await resolveViewerRole(viewer.userId, viewer.role)
  const normalizedRole = normalizeAppRole(role)
  if ((normalizedRole === "boss" || normalizedRole === "supervisor") && !ownership.applicantProfileId && !ownership.caseId) {
    return true
  }

  if (ownership.caseId) {
    const caseMatch = await prisma.visaCase.findFirst({
      where: {
        id: ownership.caseId,
        ...buildCaseAccessWhere(viewer.userId, normalizedRole),
      },
      select: { id: true },
    }).catch(() => null)
    if (caseMatch) return true
  }

  if (ownership.applicantProfileId) {
    const applicantMatch = await prisma.applicantProfile.findFirst({
      where: {
        id: ownership.applicantProfileId,
        ...buildApplicantAccessWhere(viewer.userId, normalizedRole),
      },
      select: { id: true },
    }).catch(() => null)
    if (applicantMatch) return true
  }

  return false
}

export async function canAccessFrenchVisaTaskOutput(
  userId: string,
  outputId: string,
  prefix: string,
  role?: string | null,
) {
  const taskId = getTaskIdFromOutputId(outputId, prefix)
  if (!taskId) return false

  const task = await getFrenchVisaTask(userId, taskId)
  if (task) return true

  const ownership = await getFrenchVisaTaskAccessMetadataAny(taskId)
  return canViewerAccessLinkedOwnership({ userId, role }, ownership)
}

export async function canAccessHotelBookingTaskOutput(userId: string, outputId: string, role?: string | null) {
  const taskId = getTaskIdFromOutputId(outputId, "hotel-")
  if (!taskId) return false

  const task = await getHotelBookingTask(taskId)
  if (!task) return false
  if (task.userId === userId) return true

  const normalizedRole = normalizeAppRole(await resolveViewerRole(userId, role))
  return normalizedRole === "boss" || normalizedRole === "supervisor"
}

export async function canAccessUsVisaTaskOutput(
  userId: string,
  outputId: string,
  prefix: string,
  role?: string | null,
) {
  const taskId = getTaskIdFromOutputId(outputId, prefix)
  if (!taskId) return false

  const task = await getUsVisaTask(userId, taskId)
  if (task) return true

  const ownership = await getUsVisaTaskAccessMetadataAny(taskId)
  return canViewerAccessLinkedOwnership({ userId, role }, ownership)
}

export async function canAccessOutputDirectoryByMetadata(userId: string, dirPath: string, role?: string | null) {
  const metadata = await readOutputAccessMetadata(dirPath)
  return canViewerAccessLinkedOwnership({ userId, role }, metadata)
}

export async function canAccessUsVisaOutputId(userId: string, outputId: string, dirPath: string, role?: string | null) {
  if (await canAccessOutputDirectoryByMetadata(userId, dirPath, role)) {
    return true
  }

  const task = await findTaskByResultField(userId, ["output_id"], outputId)
  if (task) return true

  const ownership = await findTaskAccessMetadataByResultFieldAny(["output_id"], outputId)
  return canViewerAccessLinkedOwnership({ userId, role }, ownership)
}

export async function getAuthorizedDs160SubmitOutput(
  userId: string,
  outputId: string,
  role?: string | null,
) {
  const dirPath = path.join(process.cwd(), "temp", "ds160-submit-outputs", outputId)
  const metadata = await readOutputAccessMetadata(dirPath)
  if (await canViewerAccessLinkedOwnership({ userId, role }, metadata)) {
    return {
      dirPath,
      preferredFilename: metadata?.preferredFilename,
    }
  }

  const task = await findTaskByResultField(userId, ["output_id"], outputId)
  if (task) {
    const preferredFilename =
      typeof task.result?.pdf_file === "string" ? task.result.pdf_file : undefined

    return {
      dirPath,
      preferredFilename,
    }
  }

  const ownership = await findTaskAccessMetadataByResultFieldAny(["output_id"], outputId)
  if (!(await canViewerAccessLinkedOwnership({ userId, role }, ownership))) {
    return null
  }

  return {
    dirPath,
    preferredFilename: metadata?.preferredFilename,
  }
}

export async function getAuthorizedMaterialTask(taskId: string, userId?: string | null, role?: string | null) {
  if (!userId) return null
  const task = await getMaterialTask(taskId)
  if (!task) return null
  if (!(await canViewerAccessLinkedOwnership({ userId, role }, task))) return null
  return task
}

export async function canAccessMaterialReviewResult(userId: string, filename: string, role?: string | null) {
  const tasks = await listAllMaterialTasks()
  const safeFilename = path.basename(filename)

  for (const task of tasks) {
    const result = task.result as Record<string, unknown> | undefined
    const localName = typeof result?.word_download_filename === "string" ? result.word_download_filename : undefined
    const localUrl = typeof result?.word_download_url === "string" ? result.word_download_url : undefined

    const matches =
      localName === safeFilename ||
      localUrl?.endsWith(`/${encodeURIComponent(safeFilename)}`) ||
      localUrl?.endsWith(`/${safeFilename}`)
    if (!matches) continue
    if (await canViewerAccessLinkedOwnership({ userId, role }, task)) {
      return true
    }
  }

  return false
}

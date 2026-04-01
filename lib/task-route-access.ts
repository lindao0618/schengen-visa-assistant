import path from "path"
import fs from "fs/promises"

import { getTask as getFrenchVisaTask } from "@/lib/french-visa-tasks"
import { getHotelBookingTask } from "@/lib/hotel-booking-tasks"
import { getMaterialTask, listAllMaterialTasks } from "@/lib/material-tasks"
import { findTaskByResultField, getTask as getUsVisaTask } from "@/lib/usa-visa-tasks"

const OUTPUT_ACCESS_FILENAME = ".access.json"

interface OutputAccessMetadata {
  userId: string
  taskId?: string
  outputId?: string
  tempId?: string
  preferredFilename?: string
  createdAt?: number
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

export async function canAccessFrenchVisaTaskOutput(userId: string, outputId: string, prefix: string) {
  const taskId = getTaskIdFromOutputId(outputId, prefix)
  if (!taskId) return false

  const task = await getFrenchVisaTask(userId, taskId)
  return Boolean(task)
}

export async function canAccessHotelBookingTaskOutput(userId: string, outputId: string) {
  const taskId = getTaskIdFromOutputId(outputId, "hotel-")
  if (!taskId) return false

  const task = await getHotelBookingTask(taskId)
  return task?.userId === userId
}

export async function canAccessUsVisaTaskOutput(userId: string, outputId: string, prefix: string) {
  const taskId = getTaskIdFromOutputId(outputId, prefix)
  if (!taskId) return false

  const task = await getUsVisaTask(userId, taskId)
  return Boolean(task)
}

export async function canAccessOutputDirectoryByMetadata(userId: string, dirPath: string) {
  const metadata = await readOutputAccessMetadata(dirPath)
  return metadata?.userId === userId
}

export async function canAccessUsVisaOutputId(userId: string, outputId: string, dirPath: string) {
  if (await canAccessOutputDirectoryByMetadata(userId, dirPath)) {
    return true
  }

  const task = await findTaskByResultField(userId, ["output_id"], outputId)
  return Boolean(task)
}

export async function getAuthorizedDs160SubmitOutput(
  userId: string,
  outputId: string,
) {
  const dirPath = path.join(process.cwd(), "temp", "ds160-submit-outputs", outputId)
  const metadata = await readOutputAccessMetadata(dirPath)
  if (metadata?.userId === userId) {
    return {
      dirPath,
      preferredFilename: metadata.preferredFilename,
    }
  }

  const task = await findTaskByResultField(userId, ["output_id"], outputId)
  if (!task) return null

  const preferredFilename =
    typeof task.result?.pdf_file === "string" ? task.result.pdf_file : undefined

  return {
    dirPath,
    preferredFilename,
  }
}

export async function getAuthorizedMaterialTask(taskId: string, userId?: string | null) {
  const task = await getMaterialTask(taskId)
  if (!task) return null
  if (task.userId && task.userId !== userId) return null
  return task
}

export async function canAccessMaterialReviewResult(userId: string, filename: string) {
  const tasks = await listAllMaterialTasks()
  const safeFilename = path.basename(filename)

  return tasks.some((task) => {
    if (!task.userId || task.userId !== userId) return false
    const result = task.result as Record<string, unknown> | undefined
    const localName = typeof result?.word_download_filename === "string" ? result.word_download_filename : undefined
    const localUrl = typeof result?.word_download_url === "string" ? result.word_download_url : undefined

    return (
      localName === safeFilename ||
      localUrl?.endsWith(`/${encodeURIComponent(safeFilename)}`) ||
      localUrl?.endsWith(`/${safeFilename}`)
    )
  })
}

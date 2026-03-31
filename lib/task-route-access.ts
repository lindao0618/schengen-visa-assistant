import path from "path"

import { getTask as getFrenchVisaTask } from "@/lib/french-visa-tasks"
import { getHotelBookingTask } from "@/lib/hotel-booking-tasks"
import { getMaterialTask } from "@/lib/material-tasks"

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

export async function getAuthorizedMaterialTask(taskId: string, userId?: string | null) {
  const task = await getMaterialTask(taskId)
  if (!task) return null
  if (task.userId && task.userId !== userId) return null
  return task
}

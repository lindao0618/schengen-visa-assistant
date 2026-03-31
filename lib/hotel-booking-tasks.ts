import * as path from "path"

import { createJsonRecordStore } from "@/lib/json-record-store"

export type HotelBookingTaskStatus = "pending" | "running" | "completed" | "failed"
export type HotelBookingTaskType = "book-hotel"

export interface HotelBookingTaskResult {
  success?: boolean
  hotel_name?: string
  city?: string
  checkin_date?: string
  checkout_date?: string
  guest_name?: string
  confirmation_number?: string
  confirmation_url?: string
  pdf_path?: string
  pdf_download?: string
  error?: string
  download_artifacts?: Array<{ label: string; filename: string; url: string }>
  download_log?: string
}

export interface HotelBookingTask {
  task_id: string
  type: HotelBookingTaskType
  status: HotelBookingTaskStatus
  progress: number
  message: string
  created_at: number
  updated_at: number
  userId: string
  city?: string
  checkin_date?: string
  checkout_date?: string
  guest_name?: string
  hotel_name?: string
  result?: HotelBookingTaskResult
  error?: string
}

const TASKS_FILE = path.join(process.cwd(), "temp", "hotel-booking-tasks.json")
const taskStore = createJsonRecordStore<HotelBookingTask>({ filePath: TASKS_FILE })

export interface CreateHotelBookingTaskParams {
  userId: string
  city?: string
  checkin_date?: string
  checkout_date?: string
  guest_name?: string
}

export async function createHotelBookingTask(
  params: CreateHotelBookingTaskParams,
  message = "任务已创建",
): Promise<HotelBookingTask> {
  const taskId = `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  const task: HotelBookingTask = {
    task_id: taskId,
    type: "book-hotel",
    status: "pending",
    progress: 0,
    message,
    created_at: now,
    updated_at: now,
    userId: params.userId,
    city: params.city,
    checkin_date: params.checkin_date,
    checkout_date: params.checkout_date,
    guest_name: params.guest_name,
  }

  await taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    tasks[taskId] = task
    await taskStore.writeRecords(tasks)
  })

  return { ...task }
}

export async function updateHotelBookingTask(
  taskId: string,
  updates: Partial<Pick<HotelBookingTask, "status" | "progress" | "message" | "result" | "error" | "hotel_name">>,
): Promise<HotelBookingTask | null> {
  return taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    const task = tasks[taskId]
    if (!task) return null

    Object.assign(task, updates, { updated_at: Date.now() })
    await taskStore.writeRecords(tasks)
    return { ...task }
  })
}

export async function listHotelBookingTasks(
  userId: string,
  limit = 50,
  statusFilter?: string,
): Promise<HotelBookingTask[]> {
  const allTasks = await taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    return Object.values(tasks).filter((task) => task.userId === userId)
  })

  let list = allTasks

  if (statusFilter === "completed") list = list.filter((task) => task.status === "completed")
  else if (statusFilter === "failed") list = list.filter((task) => task.status === "failed")
  else if (statusFilter === "running") {
    list = list.filter((task) => task.status === "running" || task.status === "pending")
  }

  return list.sort((a, b) => b.updated_at - a.updated_at).slice(0, limit)
}

export async function getHotelBookingTask(taskId: string): Promise<HotelBookingTask | null> {
  return taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    return tasks[taskId] ? { ...tasks[taskId] } : null
  })
}

export async function listAllHotelBookingTasks(): Promise<HotelBookingTask[]> {
  return taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    return Object.values(tasks).sort((a, b) => b.updated_at - a.updated_at)
  })
}

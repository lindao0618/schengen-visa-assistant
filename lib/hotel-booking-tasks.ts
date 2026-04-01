import * as fs from "fs/promises"
import * as path from "path"

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
  // booking params snapshot
  city?: string
  checkin_date?: string
  checkout_date?: string
  guest_name?: string
  hotel_name?: string
  result?: HotelBookingTaskResult
  error?: string
}

const TASKS_FILE = path.join(process.cwd(), "temp", "hotel-booking-tasks.json")
let fileOpsQueue = Promise.resolve<unknown>(undefined)

async function readFileTasks(): Promise<Record<string, HotelBookingTask>> {
  try {
    const raw = await fs.readFile(TASKS_FILE, "utf-8")
    return JSON.parse(raw) as Record<string, HotelBookingTask>
  } catch {
    return {}
  }
}

async function writeFileTasks(tasks: Record<string, HotelBookingTask>): Promise<void> {
  await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true })
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8")
}

async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const prev = fileOpsQueue
  let resolveNext!: () => void
  fileOpsQueue = new Promise<void>((r) => {
    resolveNext = r
  })
  try {
    await prev
    return await fn()
  } finally {
    resolveNext()
  }
}

export interface CreateHotelBookingTaskParams {
  userId: string
  city?: string
  checkin_date?: string
  checkout_date?: string
  guest_name?: string
}

export async function createHotelBookingTask(
  params: CreateHotelBookingTaskParams,
  message = "任务已创建"
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

  await runExclusive(async () => {
    const tasks = await readFileTasks()
    tasks[taskId] = task
    await writeFileTasks(tasks)
  })

  return { ...task }
}

export async function updateHotelBookingTask(
  taskId: string,
  updates: Partial<Pick<HotelBookingTask, "status" | "progress" | "message" | "result" | "error" | "hotel_name">>
): Promise<HotelBookingTask | null> {
  return runExclusive(async () => {
    const tasks = await readFileTasks()
    const task = tasks[taskId]
    if (!task) return null
    Object.assign(task, updates, { updated_at: Date.now() })
    await writeFileTasks(tasks)
    return { ...task }
  })
}

export async function listHotelBookingTasks(
  userId: string,
  limit = 50,
  statusFilter?: string
): Promise<HotelBookingTask[]> {
  const allTasks = await runExclusive(async () => {
    const tasks = await readFileTasks()
    return Object.values(tasks).filter((t) => t.userId === userId)
  })

  let list = allTasks

  if (statusFilter === "completed") list = list.filter((t) => t.status === "completed")
  else if (statusFilter === "failed") list = list.filter((t) => t.status === "failed")
  else if (statusFilter === "running") list = list.filter((t) => t.status === "running" || t.status === "pending")

  return list
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, limit)
}

export async function getHotelBookingTask(taskId: string): Promise<HotelBookingTask | null> {
  return runExclusive(async () => {
    const tasks = await readFileTasks()
    return tasks[taskId] ? { ...tasks[taskId] } : null
  })
}

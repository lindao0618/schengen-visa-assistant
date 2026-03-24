/** 法签任务存储：优先 Prisma 数据库，数据库不可用时回退到文件持久化 */

import prisma from "@/lib/db"
import * as fs from "fs/promises"
import * as path from "path"
import { ensureTempCleanup } from "@/lib/temp-cleanup"

export type TaskStatus = "pending" | "running" | "completed" | "failed"
export type TaskType = "extract" | "register" | "create-application" | "fill-receipt" | "submit-final"

export interface FrenchVisaTaskResponse {
  task_id: string
  type: TaskType
  status: TaskStatus
  progress: number
  message: string
  created_at: number
  updated_at?: number
  result?: Record<string, unknown>
  error?: string
}

interface FileTask extends FrenchVisaTaskResponse {
  userId?: string
}

const TASKS_FILE = path.join(process.cwd(), "temp", "french-visa-tasks.json")

let fileOpsQueue = Promise.resolve<unknown>(undefined)

async function readFileTasks(): Promise<Record<string, FileTask>> {
  try {
    const raw = await fs.readFile(TASKS_FILE, "utf-8")
    return JSON.parse(raw) as Record<string, FileTask>
  } catch {
    return {}
  }
}

async function writeFileTasks(tasks: Record<string, FileTask>): Promise<void> {
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

function isPrismaConnectionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /P1001|Can't reach database|connection refused/i.test(msg)
}

function belongsToUser(task: FileTask, userId: string): boolean {
  return task.userId === userId
}

function toResponse(row: {
  taskId: string
  type: string
  status: string
  progress: number
  message: string
  createdAt: Date
  updatedAt: Date
  result: unknown
  error: string | null
}): FrenchVisaTaskResponse {
  return {
    task_id: row.taskId,
    type: row.type as TaskType,
    status: row.status as TaskStatus,
    progress: row.progress,
    message: row.message,
    created_at: row.createdAt.getTime(),
    updated_at: row.updatedAt.getTime(),
    result: row.result as Record<string, unknown> | undefined,
    error: row.error ?? undefined,
  }
}

export async function createTask(
  userId: string,
  type: TaskType,
  message = "任务已创建"
): Promise<FrenchVisaTaskResponse> {
  await ensureTempCleanup().catch(() => {})
  const taskId = `fv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const fileTask: FileTask = {
    task_id: taskId,
    type,
    status: "pending",
    progress: 0,
    message,
    created_at: Date.now(),
    userId,
  }
  try {
    const row = await prisma.frenchVisaTask.create({
      data: {
        taskId,
        userId,
        type,
        status: "pending",
        progress: 0,
        message,
      },
    })
    runExclusive(async () => {
      const tasks = await readFileTasks()
      tasks[taskId] = {
        ...fileTask,
        created_at: row.createdAt.getTime(),
        updated_at: row.updatedAt.getTime(),
      }
      await writeFileTasks(tasks)
    }).catch(() => {})
    return toResponse(row)
  } catch (e) {
    if (isPrismaConnectionError(e)) {
      return runExclusive(async () => {
        const tasks = await readFileTasks()
        tasks[taskId] = fileTask
        await writeFileTasks(tasks)
        return { ...fileTask }
      })
    }
    throw e
  }
}

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<FrenchVisaTaskResponse, "status" | "progress" | "message" | "result" | "error">>
): Promise<FrenchVisaTaskResponse | null> {
  try {
    const data: Record<string, unknown> = {}
    if (updates.status != null) data.status = updates.status
    if (updates.progress != null) data.progress = updates.progress
    if (updates.message != null) data.message = updates.message
    if (updates.result != null) data.result = updates.result
    if (updates.error != null) data.error = updates.error

    const row = await prisma.frenchVisaTask.update({
      where: { taskId },
      data,
    })
    return toResponse(row)
  } catch {
    return runExclusive(async () => {
      const tasks = await readFileTasks()
      const t = tasks[taskId]
      if (!t) return null
      Object.assign(t, updates, { updated_at: Date.now() })
      await writeFileTasks(tasks)
      return { ...t }
    })
  }
}

export async function listTasks(
  userId: string,
  limit = 50,
  statusFilter?: string
): Promise<FrenchVisaTaskResponse[]> {
  const statusWhere =
    statusFilter === "completed"
      ? { status: "completed" }
      : statusFilter === "failed"
        ? { status: "failed" }
        : statusFilter === "running"
          ? { status: { in: ["running", "pending"] } }
          : {}

  const prismaTasks: FrenchVisaTaskResponse[] = []
  const fileTasks: FrenchVisaTaskResponse[] = []

  try {
    const rows = await prisma.frenchVisaTask.findMany({
      where: { userId, ...statusWhere },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      select: {
        taskId: true,
        type: true,
        status: true,
        progress: true,
        message: true,
        createdAt: true,
        updatedAt: true,
        result: true,
        error: true,
      },
    })
    prismaTasks.push(...rows.map(toResponse))
  } catch {
    /* 继续尝试文件 */
  }

  try {
    const fileMap = await runExclusive(async () => {
      const tasks = await readFileTasks()
      return Object.values(tasks).filter((t) => belongsToUser(t, userId))
    })
    fileTasks.push(...fileMap.map((t) => ({ ...t })))
  } catch {
    fileTasks.length = 0
  }

  const merged = new Map<string, FrenchVisaTaskResponse>()
  for (const t of [...prismaTasks, ...fileTasks]) {
    const existing = merged.get(t.task_id)
    const updatedA = t.updated_at ?? t.created_at
    const updatedB = existing?.updated_at ?? existing?.created_at ?? 0
    if (!existing || updatedA > updatedB) {
      merged.set(t.task_id, t)
    }
  }

  let lst = Array.from(merged.values())
  if (statusFilter === "completed") lst = lst.filter((t) => t.status === "completed")
  else if (statusFilter === "failed") lst = lst.filter((t) => t.status === "failed")
  else if (statusFilter === "running")
    lst = lst.filter((t) => t.status === "running" || t.status === "pending")

  return lst
    .sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
    .slice(0, limit)
}

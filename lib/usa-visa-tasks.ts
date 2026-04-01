import { Prisma } from "@prisma/client"
import prisma from "@/lib/db"
import * as fs from "fs/promises"
import * as path from "path"
import { ensureTempCleanup } from "@/lib/temp-cleanup"
import { formatFallbackVisaCaseLabel, formatVisaCaseLabel } from "@/lib/visa-case-labels"

export type TaskStatus = "pending" | "running" | "completed" | "failed"
export type TaskType = "check-photo" | "fill-ds160" | "submit-ds160" | "register-ais"

export interface TaskMeta {
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
}

export interface UsVisaTaskResponse {
  task_id: string
  type: TaskType
  status: TaskStatus
  progress: number
  message: string
  created_at: number
  updated_at?: number
  result?: Record<string, unknown>
  error?: string
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
  caseLabel?: string
}

interface FileTask extends UsVisaTaskResponse {
  userId?: string
}

const TASKS_FILE = path.join(process.cwd(), "temp", "usa-visa-tasks.json")

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

function belongsToUser(task: FileTask | undefined, userId: string): task is FileTask {
  return !!task && task.userId === userId
}

function extractTaskMeta(result: unknown): TaskMeta {
  const record = result && typeof result === "object" ? (result as Record<string, unknown>) : undefined
  return {
    applicantProfileId: typeof record?.applicantProfileId === "string" ? record.applicantProfileId : undefined,
    applicantName: typeof record?.applicantName === "string" ? record.applicantName : undefined,
    caseId: typeof record?.caseId === "string" ? record.caseId : undefined,
  }
}

function mergeMetaIntoResult(result: unknown, meta?: TaskMeta) {
  if (!meta?.applicantProfileId && !meta?.applicantName && !meta?.caseId) {
    return result as Record<string, unknown> | undefined
  }
  const base = result && typeof result === "object" ? { ...(result as Record<string, unknown>) } : {}
  if (meta.applicantProfileId) base.applicantProfileId = meta.applicantProfileId
  if (meta.applicantName) base.applicantName = meta.applicantName
  if (meta.caseId) base.caseId = meta.caseId
  return base
}

function toPrismaJson(result: Record<string, unknown> | undefined) {
  return result as Prisma.InputJsonValue | undefined
}

function toResponse(row: {
  taskId: string
  type: string
  status: string
  progress: number
  message: string
  createdAt: Date
  updatedAt: Date
  applicantProfileId: string | null
  applicantProfile?: { name: string } | null
  result: unknown
  error: string | null
}): UsVisaTaskResponse {
  const result = row.result as Record<string, unknown> | undefined
  const meta = extractTaskMeta(result)
  return {
    task_id: row.taskId,
    type: row.type as TaskType,
    status: row.status as TaskStatus,
    progress: row.progress,
    message: row.message,
    created_at: row.createdAt.getTime(),
    updated_at: row.updatedAt.getTime(),
    result,
    error: row.error ?? undefined,
    applicantProfileId: row.applicantProfileId ?? meta.applicantProfileId,
    applicantName: row.applicantProfile?.name ?? meta.applicantName,
    caseId: meta.caseId,
  }
}

async function attachCaseLabels(tasks: UsVisaTaskResponse[]) {
  const caseIds = Array.from(new Set(tasks.map((task) => task.caseId).filter((value): value is string => Boolean(value))))
  if (caseIds.length === 0) return tasks

  const labelMap = new Map<string, string>()

  try {
    const cases = await prisma.visaCase.findMany({
      where: { id: { in: caseIds } },
      select: { id: true, caseType: true, visaType: true, applyRegion: true },
    })

    for (const item of cases) {
      labelMap.set(item.id, formatVisaCaseLabel(item))
    }
  } catch {
    // Ignore case label lookup errors.
  }

  return tasks.map((task) =>
    task.caseId
      ? {
          ...task,
          caseLabel: labelMap.get(task.caseId) || formatFallbackVisaCaseLabel(task.caseId),
        }
      : task
  )
}

export async function createTask(
  userId: string,
  type: TaskType,
  message = "任务已创建",
  meta?: TaskMeta
): Promise<UsVisaTaskResponse> {
  await ensureTempCleanup().catch(() => {})
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const fileTask: FileTask = {
    task_id: taskId,
    type,
    status: "pending",
    progress: 0,
    message,
    created_at: Date.now(),
    userId,
    applicantProfileId: meta?.applicantProfileId,
    applicantName: meta?.applicantName,
    caseId: meta?.caseId,
    result: mergeMetaIntoResult(undefined, meta),
  }

  try {
    const row = await prisma.usVisaTask.create({
      data: {
        taskId,
        userId,
        applicantProfileId: meta?.applicantProfileId,
        type,
        status: "pending",
        progress: 0,
        message,
        result: toPrismaJson(mergeMetaIntoResult(undefined, meta)),
      },
      include: {
        applicantProfile: {
          select: { name: true },
        },
      },
    })

    await runExclusive(async () => {
      const tasks = await readFileTasks()
      tasks[taskId] = { ...fileTask, created_at: row.createdAt.getTime(), updated_at: row.updatedAt.getTime() }
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
  updates: Partial<Pick<UsVisaTaskResponse, "status" | "progress" | "message" | "result" | "error">>
): Promise<UsVisaTaskResponse | null> {
  const syncToFile = () => {
    runExclusive(async () => {
      const tasks = await readFileTasks()
      const task = tasks[taskId]
      if (!task) return
      Object.assign(task, updates, {
        result: mergeMetaIntoResult(updates.result ?? task.result, {
          applicantProfileId: task.applicantProfileId,
          applicantName: task.applicantName,
          caseId: task.caseId,
        }),
        updated_at: Date.now(),
      })
      await writeFileTasks(tasks)
    }).catch(() => {})
  }

  try {
    const current = await prisma.usVisaTask.findUnique({
      where: { taskId },
      select: { result: true, applicantProfileId: true },
    })
    const data: Record<string, unknown> = {}
    if (updates.status != null) data.status = updates.status
    if (updates.progress != null) data.progress = updates.progress
    if (updates.message != null) data.message = updates.message
    if (updates.result != null || current?.result) {
      const meta = extractTaskMeta(current?.result)
      data.result = toPrismaJson(mergeMetaIntoResult(updates.result ?? current?.result, meta))
    }
    if (updates.error != null) data.error = updates.error

    const row = await prisma.usVisaTask.update({
      where: { taskId },
      data,
      include: {
        applicantProfile: {
          select: { name: true },
        },
      },
    })
    const resp = toResponse(row)
    syncToFile()
    return resp
  } catch {
    const fallback = await runExclusive(async () => {
      const tasks = await readFileTasks()
      const task = tasks[taskId]
      if (!task) return null
      Object.assign(task, updates, {
        result: mergeMetaIntoResult(updates.result ?? task.result, {
          applicantProfileId: task.applicantProfileId,
          applicantName: task.applicantName,
          caseId: task.caseId,
        }),
        updated_at: Date.now(),
      })
      await writeFileTasks(tasks)
      return { ...task }
    })
    return fallback
  }
}

export async function getTask(userId: string, taskId: string): Promise<UsVisaTaskResponse | null> {
  let fromPrisma: UsVisaTaskResponse | null = null
  let fromFile: UsVisaTaskResponse | null = null

  try {
    const row = await prisma.usVisaTask.findFirst({
      where: { taskId, userId },
      include: {
        applicantProfile: {
          select: { name: true },
        },
      },
    })
    if (row) fromPrisma = toResponse(row)
  } catch (e) {
    if (!isPrismaConnectionError(e)) return null
  }

  try {
    fromFile = await runExclusive(async () => {
      const tasks = await readFileTasks()
      const task = tasks[taskId]
      if (belongsToUser(task, userId)) return { ...task }
      return null
    })
  } catch {
    fromFile = null
  }

  if (!fromPrisma && !fromFile) return null
  if (!fromPrisma && fromFile) {
    const enriched = await attachCaseLabels([fromFile])
    return enriched[0] ?? null
  }
  if (!fromFile && fromPrisma) {
    const enriched = await attachCaseLabels([fromPrisma])
    return enriched[0] ?? null
  }

  if (fromPrisma && fromFile) {
    const a = fromPrisma.updated_at ?? fromPrisma.created_at
    const b = fromFile.updated_at ?? fromFile.created_at
    const enriched = await attachCaseLabels([a >= b ? fromPrisma : fromFile])
    return enriched[0] ?? null
  }

  return null
}

export async function listTasks(
  userId: string,
  limit = 50,
  statusFilter?: string,
  applicantProfileId?: string,
  caseId?: string
): Promise<UsVisaTaskResponse[]> {
  const statusWhere =
    statusFilter === "completed"
      ? { status: "completed" }
      : statusFilter === "failed"
        ? { status: "failed" }
        : statusFilter === "running"
          ? { status: { in: ["running", "pending"] } }
          : {}

  const prismaTasks: UsVisaTaskResponse[] = []
  const fileTasks: UsVisaTaskResponse[] = []

  try {
    const rows = await prisma.usVisaTask.findMany({
      where: {
        userId,
        ...statusWhere,
        ...(applicantProfileId
          ? {
              OR: [
                { applicantProfileId },
                {
                  result: {
                    path: ["applicantProfileId"],
                    equals: applicantProfileId,
                  },
                },
              ],
            }
          : {}),
        ...(caseId
          ? {
              AND: [
                {
                  result: {
                    path: ["caseId"],
                    equals: caseId,
                  },
                },
              ],
            }
          : {}),
      },
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
        applicantProfileId: true,
        applicantProfile: {
          select: { name: true },
        },
        result: true,
        error: true,
      },
    })
    prismaTasks.push(...rows.map(toResponse))
  } catch {
    // Ignore Prisma errors and fall back to file tasks.
  }

  try {
    const fileMap = await runExclusive(async () => {
      const tasks = await readFileTasks()
      return Object.values(tasks).filter((task) => belongsToUser(task, userId))
    })
    fileTasks.push(...fileMap.map((task) => ({ ...task })))
  } catch {
    // Ignore file errors if Prisma worked.
  }

  const merged = new Map<string, UsVisaTaskResponse>()
  const staleRunningMs = 5 * 60 * 1000
  const now = Date.now()

  for (const task of [...prismaTasks, ...fileTasks]) {
    const existing = merged.get(task.task_id)
    if (!existing) {
      merged.set(task.task_id, task)
      continue
    }

    const taskTerminal = task.status === "completed" || task.status === "failed"
    const existingTerminal = existing.status === "completed" || existing.status === "failed"
    const taskUpdated = task.updated_at ?? task.created_at
    const existingUpdated = existing.updated_at ?? existing.created_at

    if (taskTerminal && !existingTerminal && now - existingUpdated > staleRunningMs) {
      merged.set(task.task_id, task)
    } else if (!taskTerminal && existingTerminal && now - taskUpdated > staleRunningMs) {
      continue
    } else if (taskUpdated > existingUpdated) {
      merged.set(task.task_id, task)
    }
  }

  let list = Array.from(merged.values())

  if (applicantProfileId) {
    list = list.filter((task) => task.applicantProfileId === applicantProfileId)
  }
  if (caseId) {
    list = list.filter((task) => task.caseId === caseId)
  }

  if (statusFilter === "completed") list = list.filter((task) => task.status === "completed")
  else if (statusFilter === "failed") list = list.filter((task) => task.status === "failed")
  else if (statusFilter === "running") list = list.filter((task) => task.status === "running" || task.status === "pending")

  const staleMs = 20 * 60 * 1000
  const staleError = "任务超时或中断，可能原因：网络不稳、验证码识别超时、服务重启。请检查后重新提交。"
  const staleNow = Date.now()

  for (const task of list) {
    const lastUpdate = task.updated_at ?? task.created_at
    if ((task.status === "pending" || task.status === "running") && staleNow - lastUpdate > staleMs) {
      const hasScreenshot = !!(task.result as { screenshot?: unknown } | undefined)?.screenshot
      const hasRealError = task.error && task.error.trim() && task.error !== staleError
      const finalError = hasRealError || hasScreenshot ? task.error || staleError : staleError

      Object.assign(task, {
        status: "failed" as const,
        progress: 0,
        message: hasRealError ? task.message : "任务超时或已中断",
        error: finalError,
        updated_at: staleNow,
      })

      void updateTask(task.task_id, {
        status: "failed",
        progress: 0,
        message: hasRealError ? task.message : "任务超时或已中断",
        error: finalError,
        ...(task.result ? { result: task.result } : {}),
      })
    }
  }

  return attachCaseLabels(
    list
      .sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
      .slice(0, limit)
  )
}

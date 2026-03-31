import { Prisma } from "@prisma/client"
import prisma from "@/lib/db"
import * as path from "path"
import { createJsonRecordStore } from "@/lib/json-record-store"
import { ensureTempCleanup } from "@/lib/temp-cleanup"
import { formatFallbackVisaCaseLabel, formatVisaCaseLabel } from "@/lib/visa-case-labels"

export type TaskStatus = "pending" | "running" | "completed" | "failed"
export type TaskType =
  | "extract"
  | "extract-register"
  | "register"
  | "create-application"
  | "fill-receipt"
  | "submit-final"
  | "tls-register"
  | "tls-apply"

export interface TaskMeta {
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
}

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
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
  caseLabel?: string
}

interface FileTask extends FrenchVisaTaskResponse {
  userId?: string
}

const TASKS_FILE = path.join(process.cwd(), "temp", "french-visa-tasks.json")
const taskStore = createJsonRecordStore<FileTask>({ filePath: TASKS_FILE })

function isPrismaConnectionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /P1001|Can't reach database|connection refused/i.test(msg)
}

function belongsToUser(task: FileTask, userId: string): boolean {
  return task.userId === userId
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
}): FrenchVisaTaskResponse {
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

async function attachCaseLabels(tasks: FrenchVisaTaskResponse[]) {
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
    applicantProfileId: meta?.applicantProfileId,
    applicantName: meta?.applicantName,
    caseId: meta?.caseId,
    result: mergeMetaIntoResult(undefined, meta),
  }

  try {
    const row = await prisma.frenchVisaTask.create({
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
    taskStore.runExclusive(async () => {
      const tasks = await taskStore.readRecords()
      tasks[taskId] = {
        ...fileTask,
        created_at: row.createdAt.getTime(),
        updated_at: row.updatedAt.getTime(),
      }
      await taskStore.writeRecords(tasks)
    }).catch(() => {})
    return toResponse(row)
  } catch (e) {
    if (isPrismaConnectionError(e)) {
      return taskStore.runExclusive(async () => {
        const tasks = await taskStore.readRecords()
        tasks[taskId] = fileTask
        await taskStore.writeRecords(tasks)
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
    const current = await prisma.frenchVisaTask.findUnique({
      where: { taskId },
      select: { result: true, applicantProfileId: true },
    })
    const data: Record<string, unknown> = {}
    if (updates.status != null) data.status = updates.status
    if (updates.progress != null) data.progress = updates.progress
    if (updates.message != null) data.message = updates.message
    if (updates.result != null || current?.result) {
      data.result = toPrismaJson(mergeMetaIntoResult(updates.result ?? current?.result, extractTaskMeta(current?.result)))
    }
    if (updates.error != null) data.error = updates.error

    const row = await prisma.frenchVisaTask.update({
      where: { taskId },
      data,
      include: {
        applicantProfile: {
          select: { name: true },
        },
      },
    })
    return toResponse(row)
  } catch {
    return taskStore.runExclusive(async () => {
      const tasks = await taskStore.readRecords()
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
      await taskStore.writeRecords(tasks)
      return { ...task }
    })
  }
}

export async function getTask(userId: string, taskId: string): Promise<FrenchVisaTaskResponse | null> {
  let fromPrisma: FrenchVisaTaskResponse | null = null
  let fromFile: FrenchVisaTaskResponse | null = null

  try {
    const row = await prisma.frenchVisaTask.findFirst({
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
    fromFile = await taskStore.runExclusive(async () => {
      const tasks = await taskStore.readRecords()
      const task = tasks[taskId]
      if (task && belongsToUser(task, userId)) return { ...task }
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
    const prismaUpdated = fromPrisma.updated_at ?? fromPrisma.created_at
    const fileUpdated = fromFile.updated_at ?? fromFile.created_at
    const enriched = await attachCaseLabels([prismaUpdated >= fileUpdated ? fromPrisma : fromFile])
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
    // Ignore Prisma errors and continue with file fallback.
  }

  try {
    const fileMap = await taskStore.runExclusive(async () => {
      const tasks = await taskStore.readRecords()
      return Object.values(tasks).filter((task) => belongsToUser(task, userId))
    })
    fileTasks.push(...fileMap.map((task) => ({ ...task })))
  } catch {
    // Ignore file errors when Prisma works.
  }

  const merged = new Map<string, FrenchVisaTaskResponse>()
  for (const task of [...prismaTasks, ...fileTasks]) {
    const existing = merged.get(task.task_id)
    const updatedTask = task.updated_at ?? task.created_at
    const updatedExisting = existing?.updated_at ?? existing?.created_at ?? 0
    if (!existing || updatedTask > updatedExisting) {
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

  return attachCaseLabels(
    list
      .sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
      .slice(0, limit)
  )
}

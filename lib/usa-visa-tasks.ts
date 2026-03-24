/** 美签任务存储：优先 Prisma 数据库，数据库不可用时回退到文件持久化 */

import prisma from '@/lib/db'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ensureTempCleanup } from '@/lib/temp-cleanup'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'
export type TaskType = 'check-photo' | 'fill-ds160' | 'submit-ds160' | 'register-ais'

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
}

// 文件回退存储（数据库不可用时使用，刷新/切换页面后仍保留）
interface FileTask extends UsVisaTaskResponse {
  userId?: string
}

const TASKS_FILE = path.join(process.cwd(), 'temp', 'usa-visa-tasks.json')

/** Serialize file operations to avoid race conditions when multiple updateTask calls run concurrently */
let fileOpsQueue = Promise.resolve<unknown>(undefined)

async function readFileTasks(): Promise<Record<string, FileTask>> {
  try {
    const raw = await fs.readFile(TASKS_FILE, 'utf-8')
    return JSON.parse(raw) as Record<string, FileTask>
  } catch {
    return {}
  }
}

async function writeFileTasks(tasks: Record<string, FileTask>): Promise<void> {
  await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true })
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8')
}

/** Run a file operation exclusively (prevents concurrent read-modify-write races) */
async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const prev = fileOpsQueue
  let resolveNext!: () => void
  fileOpsQueue = new Promise<void>((r) => { resolveNext = r })
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
}): UsVisaTaskResponse {
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

/** 创建任务，需要 userId。数据库不可用时自动回退到文件；成功时也写入文件作为备份，以便 updateTask 在 DB 不可用时能回退 */
export async function createTask(
  userId: string,
  type: TaskType,
  message = '任务已创建'
): Promise<UsVisaTaskResponse> {
  await ensureTempCleanup().catch(() => {})
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const fileTask: FileTask = {
    task_id: taskId,
    type,
    status: 'pending',
    progress: 0,
    message,
    created_at: Date.now(),
    userId,
  }
  try {
    const row = await prisma.usVisaTask.create({
      data: {
        taskId,
        userId,
        type,
        status: 'pending',
        progress: 0,
        message,
      },
    })
    // 等待文件写入完成，确保 updateTask 回退到文件时能找到任务
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

/** 更新任务。数据库优先，成功时同步写入文件备份；失败时回退到文件 */
export async function updateTask(
  taskId: string,
  updates: Partial<Pick<UsVisaTaskResponse, 'status' | 'progress' | 'message' | 'result' | 'error'>>
): Promise<UsVisaTaskResponse | null> {
  const syncToFile = () => {
    runExclusive(async () => {
      const tasks = await readFileTasks()
      const t = tasks[taskId]
      if (!t) return
      Object.assign(t, updates, { updated_at: Date.now() })
      await writeFileTasks(tasks)
    }).catch(() => {})
  }
  try {
    const data: Record<string, unknown> = {}
    if (updates.status != null) data.status = updates.status
    if (updates.progress != null) data.progress = updates.progress
    if (updates.message != null) data.message = updates.message
    if (updates.result != null) data.result = updates.result
    if (updates.error != null) data.error = updates.error

    const row = await prisma.usVisaTask.update({
      where: { taskId },
      data,
    })
    const resp = toResponse(row)
    syncToFile()
    return resp
  } catch {
    const fallback = await runExclusive(async () => {
      const tasks = await readFileTasks()
      const t = tasks[taskId]
      if (!t) return null
      Object.assign(t, updates, { updated_at: Date.now() })
      await writeFileTasks(tasks)
      return { ...t }
    })
    return fallback
  }
}

/** 获取单个任务（需校验 userId），合并 Prisma + 文件取最新 */
export async function getTask(
  userId: string,
  taskId: string
): Promise<UsVisaTaskResponse | null> {
  let fromPrisma: UsVisaTaskResponse | null = null
  let fromFile: UsVisaTaskResponse | null = null
  try {
    const row = await prisma.usVisaTask.findFirst({
      where: { taskId, userId },
    })
    if (row) fromPrisma = toResponse(row)
  } catch (e) {
    if (!isPrismaConnectionError(e)) return null
  }
  try {
    fromFile = await runExclusive(async () => {
      const tasks = await readFileTasks()
      const t = tasks[taskId]
      if (belongsToUser(t, userId)) return { ...t }
      return null
    })
  } catch {
    fromFile = null
  }
  if (!fromPrisma && !fromFile) return null
  if (!fromPrisma) return fromFile
  if (!fromFile) return fromPrisma
  const a = fromPrisma.updated_at ?? fromPrisma.created_at
  const b = fromFile.updated_at ?? fromFile.created_at
  return a >= b ? fromPrisma : fromFile
}

/** 列出用户任务。statusFilter: 'completed' | 'failed' | 'running' 可筛选状态 */
export async function listTasks(
  userId: string,
  limit = 50,
  statusFilter?: string
): Promise<UsVisaTaskResponse[]> {
  const statusWhere =
    statusFilter === 'completed'
      ? { status: 'completed' }
      : statusFilter === 'failed'
        ? { status: 'failed' }
        : statusFilter === 'running'
          ? { status: { in: ['running', 'pending'] } }
          : {}

  // 同时从 Prisma 和文件读取并合并，避免 DB/文件切换时成功任务消失
  const prismaTasks: UsVisaTaskResponse[] = []
  const fileTasks: UsVisaTaskResponse[] = []

  try {
    const rows = await prisma.usVisaTask.findMany({
      where: { userId, ...statusWhere },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // 多取一些以便合并后筛选
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
    // Prisma 失败时继续尝试文件，合并后返回
  }

  try {
    const fileMap = await runExclusive(async () => {
      const tasks = await readFileTasks()
      return Object.values(tasks).filter((t) => belongsToUser(t, userId))
    })
    fileTasks.push(...fileMap.map((t) => ({ ...t })))
  } catch {
    // 文件读取失败时仅用 Prisma 结果
  }

  // 合并：按 task_id 去重。优先取 terminal 状态（completed/failed），避免「DB 有旧进度 + 文件有失败」时丢失真实错误
  const merged = new Map<string, UsVisaTaskResponse>()
  const STALE_RUNNING_MS = 5 * 60 * 1000
  const now = Date.now()
  for (const t of [...prismaTasks, ...fileTasks]) {
    const existing = merged.get(t.task_id)
    if (!existing) {
      merged.set(t.task_id, t)
      continue
    }
    const a = t
    const b = existing
    const aTerminal = a.status === 'completed' || a.status === 'failed'
    const bTerminal = b.status === 'completed' || b.status === 'failed'
    const aUpdated = a.updated_at ?? a.created_at
    const bUpdated = b.updated_at ?? b.created_at
    if (aTerminal && !bTerminal && now - bUpdated > STALE_RUNNING_MS) {
      merged.set(t.task_id, t)
    } else if (bTerminal && !aTerminal && now - aUpdated > STALE_RUNNING_MS) {
    } else if (aUpdated > bUpdated) {
      merged.set(t.task_id, t)
    }
  }

  let lst = Array.from(merged.values())
  if (statusFilter === 'completed') lst = lst.filter((t) => t.status === 'completed')
  else if (statusFilter === 'failed') lst = lst.filter((t) => t.status === 'failed')
  else if (statusFilter === 'running')
    lst = lst.filter((t) => t.status === 'running' || t.status === 'pending')

  // 过期任务清理：等待中/进行中超过 20 分钟视为超时（如服务重启、进程异常中断、验证码超时）
  const STALE_MS = 20 * 60 * 1000
  const staleError = '任务超时或中断，可能原因：网络不稳、验证码识别超时、服务重启。请检查网络后重新提交'
  const staleNow = Date.now()
  for (const t of lst) {
    const lastUpdate = t.updated_at ?? t.created_at
    if ((t.status === 'pending' || t.status === 'running') && staleNow - lastUpdate > STALE_MS) {
      const hasScreenshot = !!(t.result as { screenshot?: unknown } | undefined)?.screenshot
      const hasRealError = t.error && t.error.trim() && t.error !== staleError
      const keepError = hasRealError || hasScreenshot
      const finalError = keepError ? (t.error || staleError) : staleError
      Object.assign(t, {
        status: 'failed' as const,
        progress: 0,
        message: hasRealError ? t.message : '任务超时或已中断',
        error: finalError,
        updated_at: staleNow,
      })
      void updateTask(t.task_id, {
        status: 'failed',
        progress: 0,
        message: hasRealError ? t.message : '任务超时或已中断',
        error: finalError,
        ...(t.result ? { result: t.result } : {}),
      })
    }
  }

  return lst
    .sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
    .slice(0, limit)
}

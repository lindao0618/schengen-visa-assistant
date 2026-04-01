/** Material generation tasks for itinerary / explanation letter / material review. */

import * as fs from "fs/promises"
import * as path from "path"
import { ensureTempCleanup } from "@/lib/temp-cleanup"

export type MaterialTaskStatus = "pending" | "running" | "completed" | "failed"
export type MaterialTaskType = "itinerary" | "explanation-letter" | "material-review"

export interface MaterialTaskResponse {
  task_id: string
  type: MaterialTaskType
  status: MaterialTaskStatus
  progress: number
  message: string
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
  caseLabel?: string
  created_at: number
  updated_at?: number
  result?: Record<string, unknown>
  error?: string
}

interface MaterialTask extends MaterialTaskResponse {
  outputDir?: string
}

const TASKS_FILE = path.join(process.cwd(), "temp", "material-tasks.json")
const OUTPUT_BASE = path.join(process.cwd(), "temp", "material-tasks-output")

let fileOpsQueue = Promise.resolve<unknown>(undefined)

async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const prev = fileOpsQueue
  let resolveNext!: () => void
  fileOpsQueue = new Promise<void>((resolve) => {
    resolveNext = resolve
  })

  try {
    await prev
    return await fn()
  } finally {
    resolveNext()
  }
}

async function readTasks(): Promise<Record<string, MaterialTask>> {
  try {
    const raw = await fs.readFile(TASKS_FILE, "utf-8")
    return JSON.parse(raw) as Record<string, MaterialTask>
  } catch {
    return {}
  }
}

async function writeTasks(tasks: Record<string, MaterialTask>): Promise<void> {
  await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true })
  const toWrite: Record<string, Omit<MaterialTask, "outputDir">> = {}

  for (const [taskId, task] of Object.entries(tasks)) {
    const { outputDir, ...rest } = task
    toWrite[taskId] = rest
  }

  await fs.writeFile(TASKS_FILE, JSON.stringify(toWrite, null, 2), "utf-8")
}

export async function createMaterialTask(
  type: MaterialTaskType,
  message = "任务已创建",
  meta?: {
    applicantProfileId?: string
    applicantName?: string
    caseId?: string
  }
): Promise<MaterialTaskResponse> {
  await ensureTempCleanup().catch(() => {})

  const taskId = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const outputDir = path.join(OUTPUT_BASE, taskId)

  const task: MaterialTask = {
    task_id: taskId,
    type,
    status: "pending",
    progress: 0,
    message,
    applicantProfileId: meta?.applicantProfileId,
    applicantName: meta?.applicantName,
    caseId: meta?.caseId,
    created_at: Date.now(),
    outputDir,
  }

  return runExclusive(async () => {
    await fs.mkdir(outputDir, { recursive: true })
    const tasks = await readTasks()
    tasks[taskId] = task
    await writeTasks(tasks)
    const { outputDir: _outputDir, ...response } = task
    return response
  })
}

export async function updateMaterialTask(
  taskId: string,
  updates: Partial<Pick<MaterialTaskResponse, "status" | "progress" | "message" | "result" | "error">>
): Promise<MaterialTaskResponse | null> {
  return runExclusive(async () => {
    const tasks = await readTasks()
    const current = tasks[taskId]
    if (!current) return null

    Object.assign(current, updates, { updated_at: Date.now() })
    await writeTasks(tasks)

    const { outputDir: _outputDir, ...response } = current
    return response
  })
}

export async function getMaterialTask(taskId: string): Promise<MaterialTaskResponse | null> {
  return runExclusive(async () => {
    const tasks = await readTasks()
    const current = tasks[taskId]
    if (!current) return null

    const { outputDir: _outputDir, ...response } = current
    return response
  })
}

export async function listMaterialTasks(
  taskIds: string[],
  typeFilter?: MaterialTaskType
): Promise<MaterialTaskResponse[]> {
  return runExclusive(async () => {
    const tasks = await readTasks()
    const idSet = new Set(taskIds)
    let list = Object.values(tasks).filter((task) => idSet.has(task.task_id))

    if (typeFilter) {
      list = list.filter((task) => task.type === typeFilter)
    }

    list.sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
    return list.map(({ outputDir: _outputDir, ...response }) => response)
  })
}

export async function listAllMaterialTasks(): Promise<MaterialTaskResponse[]> {
  return runExclusive(async () => {
    const list = Object.values(await readTasks())
    list.sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
    return list.map(({ outputDir: _outputDir, ...response }) => response)
  })
}

export function getMaterialTaskOutputDir(taskId: string): string {
  return path.join(OUTPUT_BASE, taskId)
}

export async function deleteMaterialTasks(taskIds: string[]): Promise<number> {
  if (!taskIds.length) return 0

  return runExclusive(async () => {
    const tasks = await readTasks()
    let removed = 0
    const outputDirsToDelete: string[] = []

    for (const taskId of taskIds) {
      if (tasks[taskId]) {
        delete tasks[taskId]
        removed += 1
        outputDirsToDelete.push(path.join(OUTPUT_BASE, taskId))
      }
    }

    await writeTasks(tasks)

    await Promise.all(
      outputDirsToDelete.map((dir) =>
        fs.rm(dir, { recursive: true, force: true }).catch(() => {})
      )
    )

    return removed
  })
}

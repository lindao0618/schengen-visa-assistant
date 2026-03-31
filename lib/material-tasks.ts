/** Material generation tasks for itinerary / explanation letter / material review. */

import fs from "fs/promises"
import * as path from "path"

import { createJsonRecordStore } from "@/lib/json-record-store"
import { ensureTempCleanup } from "@/lib/temp-cleanup"

export type MaterialTaskStatus = "pending" | "running" | "completed" | "failed"
export type MaterialTaskType = "itinerary" | "explanation-letter" | "material-review"

export interface MaterialTaskResponse {
  task_id: string
  type: MaterialTaskType
  status: MaterialTaskStatus
  progress: number
  message: string
  userId?: string
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

const taskStore = createJsonRecordStore<MaterialTask, Omit<MaterialTask, "outputDir">>({
  filePath: TASKS_FILE,
  toStoredRecord: (task) => {
    const { outputDir, ...persisted } = task
    return persisted
  },
})

export async function createMaterialTask(
  type: MaterialTaskType,
  message = "任务已创建",
  meta?: {
    userId?: string
    applicantProfileId?: string
    applicantName?: string
    caseId?: string
  },
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
    userId: meta?.userId,
    applicantProfileId: meta?.applicantProfileId,
    applicantName: meta?.applicantName,
    caseId: meta?.caseId,
    created_at: Date.now(),
    outputDir,
  }

  return taskStore.runExclusive(async () => {
    await fs.mkdir(outputDir, { recursive: true })
    const tasks = await taskStore.readRecords()
    tasks[taskId] = task
    await taskStore.writeRecords(tasks)
    const { outputDir: _outputDir, ...response } = task
    return response
  })
}

export async function updateMaterialTask(
  taskId: string,
  updates: Partial<Pick<MaterialTaskResponse, "status" | "progress" | "message" | "result" | "error">>,
): Promise<MaterialTaskResponse | null> {
  return taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    const current = tasks[taskId]
    if (!current) return null

    Object.assign(current, updates, { updated_at: Date.now() })
    await taskStore.writeRecords(tasks)

    const { outputDir: _outputDir, ...response } = current
    return response
  })
}

export async function getMaterialTask(taskId: string): Promise<MaterialTaskResponse | null> {
  return taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    const current = tasks[taskId]
    if (!current) return null

    const { outputDir: _outputDir, ...response } = current
    return response
  })
}

export async function listMaterialTasks(
  taskIds: string[],
  typeFilter?: MaterialTaskType,
  userId?: string,
): Promise<MaterialTaskResponse[]> {
  return taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    const idSet = new Set(taskIds)
    let list = Object.values(tasks).filter((task) => idSet.has(task.task_id))

    if (userId) {
      list = list.filter((task) => !task.userId || task.userId === userId)
    }

    if (typeFilter) {
      list = list.filter((task) => task.type === typeFilter)
    }

    list.sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
    return list.map(({ outputDir: _outputDir, ...response }) => response)
  })
}

export async function listAllMaterialTasks(): Promise<MaterialTaskResponse[]> {
  return taskStore.runExclusive(async () => {
    const list = Object.values(await taskStore.readRecords())
    list.sort((a, b) => (b.updated_at ?? b.created_at) - (a.updated_at ?? a.created_at))
    return list.map(({ outputDir: _outputDir, ...response }) => response)
  })
}

export function getMaterialTaskOutputDir(taskId: string): string {
  return path.join(OUTPUT_BASE, taskId)
}

export async function deleteMaterialTasks(taskIds: string[]): Promise<number> {
  if (!taskIds.length) return 0

  return taskStore.runExclusive(async () => {
    const tasks = await taskStore.readRecords()
    let removed = 0
    const outputDirsToDelete: string[] = []

    for (const taskId of taskIds) {
      if (tasks[taskId]) {
        delete tasks[taskId]
        removed += 1
        outputDirsToDelete.push(path.join(OUTPUT_BASE, taskId))
      }
    }

    await taskStore.writeRecords(tasks)

    await Promise.all(
      outputDirsToDelete.map((dir) =>
        fs.rm(dir, { recursive: true, force: true }).catch(() => {}),
      ),
    )

    return removed
  })
}

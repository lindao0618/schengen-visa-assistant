"use client"

export type QuickWorkflowPhase = "idle" | "running" | "completed" | "failed"
export type QuickStepStatus = "idle" | "running" | "completed" | "failed"

export interface QuickTaskSnapshot {
  task_id: string
  type: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  message: string
  created_at: number
  updated_at?: number
  error?: string
  result?: Record<string, unknown>
}

export interface QuickStepState {
  status: QuickStepStatus
  taskId?: string
  message?: string
  error?: string
  startedAt?: number
  finishedAt?: number
}

export function readStoredWorkflow<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeStoredWorkflow<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function clearStoredWorkflow(key: string) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(key)
}

export function syncStepWithTask(step: QuickStepState, task: QuickTaskSnapshot | undefined): QuickStepState {
  if (!task) return step
  const status: QuickStepStatus = task.status === "completed" ? "completed" : task.status === "failed" ? "failed" : "running"
  return {
    ...step,
    taskId: task.task_id,
    status,
    message: task.message,
    error: task.error,
    startedAt: step.startedAt ?? task.created_at,
    finishedAt: status === "completed" || status === "failed" ? task.updated_at ?? task.created_at : undefined,
  }
}

export function workflowPercent(steps: QuickStepState[]) {
  if (!steps.length) return 0
  const completed = steps.filter((step) => step.status === "completed").length
  const running = steps.some((step) => step.status === "running")
  const base = Math.round((completed / steps.length) * 100)
  if (running && completed < steps.length) {
    return Math.min(95, base + Math.round(100 / steps.length / 2))
  }
  return base
}

export function formatWorkflowTime(ts?: number) {
  if (!ts) return ""
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function getStepStatusText(step: QuickStepState) {
  if (step.status === "completed") return "已完成"
  if (step.status === "failed") return "失败"
  if (step.status === "running") return "进行中"
  return "未开始"
}

export function getStepStatusClass(step: QuickStepState) {
  if (step.status === "completed") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
  if (step.status === "failed") return "border-red-400/20 bg-red-400/10 text-red-300"
  if (step.status === "running") return "border-blue-400/20 bg-blue-400/10 text-blue-300"
  return "border-white/5 bg-white/[0.02] text-white/40"
}

export async function fetchFranceTasksForApplicant(applicantProfileId: string) {
  const res = await fetch(
    `/api/schengen/france/tasks-list?limit=100&applicantProfileId=${encodeURIComponent(applicantProfileId)}&t=${Date.now()}`,
    {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    },
  )
  if (!res.ok) {
    throw new Error("加载法签任务失败")
  }
  const data = (await res.json()) as { tasks?: QuickTaskSnapshot[] }
  return data.tasks || []
}

export async function fetchUsVisaTasksForApplicant(applicantProfileId: string) {
  const res = await fetch(
    `/api/usa-visa/tasks-list?limit=100&applicantProfileId=${encodeURIComponent(applicantProfileId)}&t=${Date.now()}`,
    {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    },
  )
  if (!res.ok) {
    throw new Error("加载美签任务失败")
  }
  const data = (await res.json()) as { tasks?: QuickTaskSnapshot[] }
  return data.tasks || []
}

export function findTaskById(tasks: QuickTaskSnapshot[], taskId?: string) {
  if (!taskId) return undefined
  return tasks.find((task) => task.task_id === taskId)
}

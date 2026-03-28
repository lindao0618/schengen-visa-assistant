"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, PlayCircle, RotateCcw } from "lucide-react"

import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  QuickStepState,
  QuickWorkflowPhase,
  clearStoredWorkflow,
  fetchFranceTasksForApplicant,
  findTaskById,
  formatWorkflowTime,
  readStoredWorkflow,
  syncStepWithTask,
  workflowPercent,
  writeStoredWorkflow,
} from "@/components/quick-start/workflow-utils"

type FranceWorkflowStage = "registrations" | "create-application" | "tls-apply" | "completed" | "failed"

interface FranceQuickWorkflow {
  applicantProfileId: string
  applicantName?: string
  phase: QuickWorkflowPhase
  stage: FranceWorkflowStage
  startedAt: number
  updatedAt: number
  lastError?: string
  steps: {
    extractRegister: QuickStepState
    tlsRegister: QuickStepState
    createApplication: QuickStepState
    tlsApply: QuickStepState
  }
}

const STORAGE_PREFIX = "franceQuickStartWorkflow:"

function createInitialWorkflow(applicantProfileId: string, applicantName?: string): FranceQuickWorkflow {
  const now = Date.now()
  return {
    applicantProfileId,
    applicantName,
    phase: "running",
    stage: "registrations",
    startedAt: now,
    updatedAt: now,
    steps: {
      extractRegister: { status: "idle" },
      tlsRegister: { status: "idle" },
      createApplication: { status: "idle" },
      tlsApply: { status: "idle" },
    },
  }
}

function hasFranceExcel(profile: ReturnType<typeof useActiveApplicantProfile>) {
  return Boolean(profile?.files?.schengenExcel || profile?.files?.franceExcel)
}

function statusText(step: QuickStepState) {
  if (step.status === "completed") return "已完成"
  if (step.status === "failed") return "失败"
  if (step.status === "running") return "运行中"
  return "未开始"
}

function statusColor(step: QuickStepState) {
  if (step.status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (step.status === "failed") return "border-red-200 bg-red-50 text-red-700"
  if (step.status === "running") return "border-blue-200 bg-blue-50 text-blue-700"
  return "border-gray-200 bg-gray-50 text-gray-500"
}

function StepBadge({ label, step }: { label: string; step: QuickStepState }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${statusColor(step)}`}>
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs">{statusText(step)}</div>
      {step.finishedAt && <div className="mt-1 text-[11px] opacity-80">{formatWorkflowTime(step.finishedAt)}</div>}
    </div>
  )
}

export function FranceQuickStartCard() {
  const activeApplicant = useActiveApplicantProfile()
  const [workflow, setWorkflow] = useState<FranceQuickWorkflow | null>(null)
  const [loading, setLoading] = useState(false)
  const launchLockRef = useRef(false)

  const storageKey = activeApplicant?.id ? `${STORAGE_PREFIX}${activeApplicant.id}` : ""
  const canStart = Boolean(activeApplicant?.id && hasFranceExcel(activeApplicant))

  const persistWorkflow = useCallback(
    (next: FranceQuickWorkflow | null) => {
      setWorkflow(next)
      if (!storageKey) return
      if (next) writeStoredWorkflow(storageKey, next)
      else clearStoredWorkflow(storageKey)
    },
    [storageKey],
  )

  useEffect(() => {
    if (!storageKey) {
      setWorkflow(null)
      return
    }
    const stored = readStoredWorkflow<FranceQuickWorkflow>(storageKey)
    setWorkflow(stored)
  }, [storageKey])

  const updateWorkflow = useCallback(
    (updater: (current: FranceQuickWorkflow) => FranceQuickWorkflow) => {
      setWorkflow((current) => {
        if (!current) return current
        const next = updater(current)
        if (storageKey) writeStoredWorkflow(storageKey, next)
        return next
      })
    },
    [storageKey],
  )

  const startExtractRegister = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    const res = await fetch("/api/schengen/france/extract-register", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; task_id?: string; error?: string; message?: string }
    if (!res.ok || !data.success || !data.task_id) {
      throw new Error(data.error || data.message || "FV 注册启动失败")
    }
    return data.task_id
  }, [activeApplicant?.id])

  const startTlsRegister = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    const res = await fetch("/api/schengen/france/tls-register", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; task_id?: string; error?: string; message?: string }
    if (!res.ok || !data.success || !data.task_id) {
      throw new Error(data.error || data.message || "TLS 注册启动失败")
    }
    return data.task_id
  }, [activeApplicant?.id])

  const startCreateApplication = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    const res = await fetch("/api/schengen/france/create-application", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      task_id?: string
      task_ids?: string[]
      error?: string
      message?: string
    }
    const taskId = data.task_id || data.task_ids?.[0]
    if (!res.ok || !data.success || !taskId) {
      throw new Error(data.error || data.message || "生成新申请启动失败")
    }
    return taskId
  }, [activeApplicant?.id])

  const startTlsApply = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    const res = await fetch("/api/schengen/france/tls-apply", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; task_id?: string; error?: string; message?: string }
    if (!res.ok || !data.success || !data.task_id) {
      throw new Error(data.error || data.message || "TLS 填表提交启动失败")
    }
    return data.task_id
  }, [activeApplicant?.id])

  const handleStart = useCallback(async () => {
    if (!activeApplicant?.id || !canStart || launchLockRef.current) return
    launchLockRef.current = true
    setLoading(true)
    const base = createInitialWorkflow(activeApplicant.id, activeApplicant.name || activeApplicant.label)
    try {
      const [extractResult, tlsResult] = await Promise.allSettled([startExtractRegister(), startTlsRegister()])
      const next = { ...base }

      if (extractResult.status === "fulfilled") {
        next.steps.extractRegister = {
          status: "running",
          taskId: extractResult.value,
          startedAt: Date.now(),
          message: "FV 注册已启动",
        }
      } else {
        next.steps.extractRegister = {
          status: "failed",
          error: extractResult.reason instanceof Error ? extractResult.reason.message : "FV 注册启动失败",
          finishedAt: Date.now(),
        }
      }

      if (tlsResult.status === "fulfilled") {
        next.steps.tlsRegister = {
          status: "running",
          taskId: tlsResult.value,
          startedAt: Date.now(),
          message: "TLS 注册已启动",
        }
      } else {
        next.steps.tlsRegister = {
          status: "failed",
          error: tlsResult.reason instanceof Error ? tlsResult.reason.message : "TLS 注册启动失败",
          finishedAt: Date.now(),
        }
      }

      if (extractResult.status === "rejected" || tlsResult.status === "rejected") {
        next.phase = "failed"
        next.stage = "failed"
        next.lastError = [next.steps.extractRegister.error, next.steps.tlsRegister.error].filter(Boolean).join("；")
      }
      next.updatedAt = Date.now()
      persistWorkflow(next)
    } finally {
      launchLockRef.current = false
      setLoading(false)
    }
  }, [activeApplicant?.id, activeApplicant?.label, activeApplicant?.name, canStart, persistWorkflow, startExtractRegister, startTlsRegister])

  const launchCreateApplication = useCallback(
    async (current: FranceQuickWorkflow) => {
      if (launchLockRef.current) return
      launchLockRef.current = true
      try {
        const taskId = await startCreateApplication()
        persistWorkflow({
          ...current,
          phase: "running",
          stage: "create-application",
          updatedAt: Date.now(),
          steps: {
            ...current.steps,
            createApplication: {
              status: "running",
              taskId,
              startedAt: Date.now(),
              message: "生成新申请已启动",
            },
          },
        })
      } catch (error) {
        persistWorkflow({
          ...current,
          phase: "failed",
          stage: "failed",
          updatedAt: Date.now(),
          lastError: error instanceof Error ? error.message : "生成新申请启动失败",
          steps: {
            ...current.steps,
            createApplication: {
              status: "failed",
              error: error instanceof Error ? error.message : "生成新申请启动失败",
              finishedAt: Date.now(),
            },
          },
        })
      } finally {
        launchLockRef.current = false
      }
    },
    [persistWorkflow, startCreateApplication],
  )

  const launchTlsApply = useCallback(
    async (current: FranceQuickWorkflow) => {
      if (launchLockRef.current) return
      launchLockRef.current = true
      try {
        const taskId = await startTlsApply()
        persistWorkflow({
          ...current,
          phase: "running",
          stage: "tls-apply",
          updatedAt: Date.now(),
          steps: {
            ...current.steps,
            tlsApply: {
              status: "running",
              taskId,
              startedAt: Date.now(),
              message: "TLS 填表提交已启动",
            },
          },
        })
      } catch (error) {
        persistWorkflow({
          ...current,
          phase: "failed",
          stage: "failed",
          updatedAt: Date.now(),
          lastError: error instanceof Error ? error.message : "TLS 填表提交启动失败",
          steps: {
            ...current.steps,
            tlsApply: {
              status: "failed",
              error: error instanceof Error ? error.message : "TLS 填表提交启动失败",
              finishedAt: Date.now(),
            },
          },
        })
      } finally {
        launchLockRef.current = false
      }
    },
    [persistWorkflow, startTlsApply],
  )

  useEffect(() => {
    if (!activeApplicant?.id || !workflow || workflow.applicantProfileId !== activeApplicant.id) return
    if (workflow.phase === "completed" || workflow.phase === "failed") return

    let cancelled = false

    const tick = async () => {
      try {
        const tasks = await fetchFranceTasksForApplicant(activeApplicant.id)
        if (cancelled) return

        const extractRegister = syncStepWithTask(workflow.steps.extractRegister, findTaskById(tasks, workflow.steps.extractRegister.taskId))
        const tlsRegister = syncStepWithTask(workflow.steps.tlsRegister, findTaskById(tasks, workflow.steps.tlsRegister.taskId))
        const createApplication = syncStepWithTask(workflow.steps.createApplication, findTaskById(tasks, workflow.steps.createApplication.taskId))
        const tlsApply = syncStepWithTask(workflow.steps.tlsApply, findTaskById(tasks, workflow.steps.tlsApply.taskId))

        const next: FranceQuickWorkflow = {
          ...workflow,
          updatedAt: Date.now(),
          steps: { extractRegister, tlsRegister, createApplication, tlsApply },
        }

        const failedStep = Object.values(next.steps).find((step) => step.status === "failed")
        if (failedStep) {
          next.phase = "failed"
          next.stage = "failed"
          next.lastError = failedStep.error || "自动链路执行失败"
          persistWorkflow(next)
          return
        }

        const registrationsDone = extractRegister.status === "completed" && tlsRegister.status === "completed"
        if (registrationsDone && createApplication.status === "idle") {
          persistWorkflow(next)
          await launchCreateApplication(next)
          return
        }

        if (createApplication.status === "completed" && tlsApply.status === "idle") {
          persistWorkflow(next)
          await launchTlsApply(next)
          return
        }

        if (tlsApply.status === "completed") {
          next.phase = "completed"
          next.stage = "completed"
          persistWorkflow(next)
          return
        }

        if (createApplication.status === "running") {
          next.stage = "create-application"
        } else if (tlsApply.status === "running") {
          next.stage = "tls-apply"
        } else {
          next.stage = "registrations"
        }
        persistWorkflow(next)
      } catch (error) {
        if (!cancelled) {
          updateWorkflow((current) => ({
            ...current,
            phase: "failed",
            stage: "failed",
            updatedAt: Date.now(),
            lastError: error instanceof Error ? error.message : "加载法签任务失败",
          }))
        }
      }
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, 1500)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeApplicant?.id, launchCreateApplication, launchTlsApply, persistWorkflow, updateWorkflow, workflow])

  const overallPercent = workflow
    ? workflowPercent([
        workflow.steps.extractRegister,
        workflow.steps.tlsRegister,
        workflow.steps.createApplication,
        workflow.steps.tlsApply,
      ])
    : 0

  const canReset = Boolean(workflow)

  return (
    <Card className="mb-6 border-blue-200/60 bg-gradient-to-r from-blue-50 to-white shadow-xl dark:border-blue-900/40 dark:from-blue-950/20 dark:to-gray-950">
      <CardHeader className="border-b border-blue-100/80 dark:border-blue-900/30">
        <CardTitle className="text-xl text-gray-900 dark:text-white">法签一键启动</CardTitle>
        <CardDescription>
          自动执行到“TLS 填表提交”为止，后续抢号、回执单、最终表保留给人工审核。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {!activeApplicant?.id ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>请先选择申请人档案</AlertTitle>
            <AlertDescription>顶部先选中一个申请人，系统才知道要复用哪份申根资料。</AlertDescription>
          </Alert>
        ) : !canStart ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>缺少申根 Excel</AlertTitle>
            <AlertDescription>当前申请人档案里还没有申根 Excel，先去申请人档案上传后再启动。</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>当前申请人：{activeApplicant.name || activeApplicant.label}</AlertTitle>
            <AlertDescription>将自动复用档案里的申根 Excel，并按“注册准备 → 生成新申请 → TLS 填表提交”顺序推进。</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>自动链路进度</span>
            <span>{overallPercent}%</span>
          </div>
          <Progress value={overallPercent} className="h-2.5" />
        </div>

        <div className="grid gap-3 md:grid-cols-[1.35fr,1fr,1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">阶段 1：注册准备</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <StepBadge label="FV 注册" step={workflow?.steps.extractRegister ?? { status: "idle" }} />
              <StepBadge label="TLS 注册" step={workflow?.steps.tlsRegister ?? { status: "idle" }} />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">阶段 2：生成新申请</div>
            <div className="mt-3">
              <StepBadge label="France-visas 新申请 JSON" step={workflow?.steps.createApplication ?? { status: "idle" }} />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">阶段 3：TLS 填表提交</div>
            <div className="mt-3">
              <StepBadge label="TLS 页面填表与提交" step={workflow?.steps.tlsApply ?? { status: "idle" }} />
            </div>
          </div>
        </div>

        {workflow?.phase === "completed" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>自动阶段已完成</AlertTitle>
            <AlertDescription>
              已自动执行到 TLS 填表提交。现在可以人工审核资料，再继续后面的抢号、回执单和最终表流程。
            </AlertDescription>
          </Alert>
        )}

        {workflow?.phase === "failed" && workflow.lastError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>自动链路已停止</AlertTitle>
            <AlertDescription>{workflow.lastError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleStart} disabled={!canStart || loading || workflow?.phase === "running"} className="gap-2">
            {loading || workflow?.phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {workflow?.phase === "running" ? "自动执行中" : "开始自动运行"}
          </Button>
          <Button
            variant="outline"
            disabled={!canReset}
            onClick={() => {
              persistWorkflow(null)
            }}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            清空本轮状态
          </Button>
          {workflow?.startedAt && <span className="text-xs text-gray-500">开始于 {formatWorkflowTime(workflow.startedAt)}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

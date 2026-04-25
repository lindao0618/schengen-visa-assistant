"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, PlayCircle, RotateCcw, Sparkles } from "lucide-react"

import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { usePageVisibility } from "@/hooks/use-page-visibility"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { QUICK_WORKFLOW_POLL_INTERVAL_MS } from "@/lib/polling"
import {
  QuickStepState,
  QuickWorkflowPhase,
  clearStoredWorkflow,
  fetchFranceTasksForApplicant,
  findTaskById,
  formatWorkflowTime,
  getStepStatusClass,
  getStepStatusText,
  readStoredWorkflow,
  syncStepWithTask,
  workflowPercent,
  writeStoredWorkflow,
} from "@/components/quick-start/workflow-utils"

type FranceWorkflowStage = "registrations" | "create-application" | "tls-apply" | "review" | "failed"

interface FranceQuickWorkflow {
  applicantProfileId: string
  caseId?: string
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

function getWorkflowScopeId(profile: ReturnType<typeof useActiveApplicantProfile>) {
  return profile?.activeCaseId || profile?.id || ""
}

function createInitialWorkflow(
  applicantProfileId: string,
  applicantName?: string,
  caseId?: string | null,
): FranceQuickWorkflow {
  const now = Date.now()
  return {
    applicantProfileId,
    caseId: caseId || undefined,
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

function scrollToTaskList(id: string) {
  if (typeof window === "undefined") return
  const node = document.getElementById(id)
  if (!node) return
  node.scrollIntoView({ behavior: "smooth", block: "start" })
}

function StepBadge({ label, step }: { label: string; step: QuickStepState }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${getStepStatusClass(step)}`}>
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs">{getStepStatusText(step)}</div>
      {step.finishedAt && <div className="mt-1 text-[11px] opacity-80">{formatWorkflowTime(step.finishedAt)}</div>}
    </div>
  )
}

function StepMeta({
  step,
  taskListId,
  taskLabel,
}: {
  step: QuickStepState
  taskListId: string
  taskLabel: string
}) {
  if (!step.taskId && !step.error) return null

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
      {step.taskId && (
        <div>
          最近任务 ID：
          <span className="ml-1 font-mono text-[11px] text-gray-800 dark:text-gray-100">{step.taskId}</span>
        </div>
      )}
      {step.error && <div className="break-all text-red-600 dark:text-red-400">失败摘要：{step.error}</div>}
      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => scrollToTaskList(taskListId)}>
        <ExternalLink className="h-3.5 w-3.5" />
        查看{taskLabel}任务
      </Button>
    </div>
  )
}

function getFranceCurrentStepLabel(workflow: FranceQuickWorkflow | null) {
  if (!workflow) return "未开始"
  if (workflow.phase === "failed") return "已停止，等待处理失败步骤"
  if (workflow.phase === "completed") return "自动阶段已完成，等待人工审核"
  if (workflow.steps.tlsApply.status === "running") return "步骤 3：TLS 填表提交"
  if (workflow.steps.createApplication.status === "running") return "步骤 2：生成新申请"
  if (workflow.steps.extractRegister.status === "running" || workflow.steps.tlsRegister.status === "running") {
    return "步骤 1：注册准备"
  }
  if (workflow.stage === "create-application") return "步骤 2：生成新申请"
  if (workflow.stage === "tls-apply") return "步骤 3：TLS 填表提交"
  return "步骤 1：注册准备"
}

function canResumeFranceWorkflow(workflow: FranceQuickWorkflow | null) {
  return Boolean(workflow && workflow.phase === "failed")
}

export function FranceQuickStartCard() {
  const activeApplicant = useActiveApplicantProfile()
  const isPageVisible = usePageVisibility()
  const [workflow, setWorkflow] = useState<FranceQuickWorkflow | null>(null)
  const [loading, setLoading] = useState(false)
  const launchLockRef = useRef(false)

  const workflowScopeId = getWorkflowScopeId(activeApplicant)
  const storageKey = workflowScopeId ? `${STORAGE_PREFIX}${workflowScopeId}` : ""
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
    setWorkflow(readStoredWorkflow<FranceQuickWorkflow>(storageKey))
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
    if (activeApplicant?.activeCaseId) {
      formData.append("caseId", activeApplicant.activeCaseId)
    }
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
  }, [activeApplicant?.activeCaseId, activeApplicant?.id])

  const startTlsRegister = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    if (activeApplicant?.activeCaseId) {
      formData.append("caseId", activeApplicant.activeCaseId)
    }
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
  }, [activeApplicant?.activeCaseId, activeApplicant?.id])

  const startCreateApplication = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    if (activeApplicant?.activeCaseId) {
      formData.append("caseId", activeApplicant.activeCaseId)
    }
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
  }, [activeApplicant?.activeCaseId, activeApplicant?.id])

  const startTlsApply = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    if (activeApplicant?.activeCaseId) {
      formData.append("caseId", activeApplicant.activeCaseId)
    }
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
  }, [activeApplicant?.activeCaseId, activeApplicant?.id])

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

  const handleStart = useCallback(async () => {
    if (!activeApplicant?.id || !canStart || launchLockRef.current) return
    launchLockRef.current = true
    setLoading(true)
    const base = createInitialWorkflow(
      activeApplicant.id,
      activeApplicant.name || activeApplicant.label,
      activeApplicant.activeCaseId,
    )
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
  }, [activeApplicant?.activeCaseId, activeApplicant?.id, activeApplicant?.label, activeApplicant?.name, canStart, persistWorkflow, startExtractRegister, startTlsRegister])

  const handleResume = useCallback(async () => {
    if (!workflow || !activeApplicant?.id || launchLockRef.current) return
    launchLockRef.current = true
    setLoading(true)
    try {
      const next = {
        ...workflow,
        phase: "running" as QuickWorkflowPhase,
        stage: workflow.stage === "failed" ? "registrations" : workflow.stage,
        updatedAt: Date.now(),
        lastError: undefined,
      }

      const launchers: Promise<void>[] = []

      if (next.steps.extractRegister.status === "failed" || next.steps.extractRegister.status === "idle") {
        launchers.push(
          startExtractRegister().then((taskId) => {
            next.steps.extractRegister = {
              status: "running",
              taskId,
              startedAt: Date.now(),
              message: "FV 注册已重新启动",
            }
          }),
        )
      }

      if (next.steps.tlsRegister.status === "failed" || next.steps.tlsRegister.status === "idle") {
        launchers.push(
          startTlsRegister().then((taskId) => {
            next.steps.tlsRegister = {
              status: "running",
              taskId,
              startedAt: Date.now(),
              message: "TLS 注册已重新启动",
            }
          }),
        )
      }

      if (!launchers.length && next.steps.createApplication.status !== "completed") {
        const taskId = await startCreateApplication()
        next.stage = "create-application"
        next.steps.createApplication = {
          status: "running",
          taskId,
          startedAt: Date.now(),
          message: "生成新申请已重新启动",
        }
      } else if (!launchers.length && next.steps.tlsApply.status !== "completed") {
        const taskId = await startTlsApply()
        next.stage = "tls-apply"
        next.steps.tlsApply = {
          status: "running",
          taskId,
          startedAt: Date.now(),
          message: "TLS 填表提交已重新启动",
        }
      } else if (launchers.length) {
        next.stage = "registrations"
        const results = await Promise.allSettled(launchers)
        const rejected = results.find((result) => result.status === "rejected")
        if (rejected?.status === "rejected") {
          throw rejected.reason
        }
      }

      persistWorkflow(next)
    } catch (error) {
      persistWorkflow({
        ...workflow,
        phase: "failed",
        stage: "failed",
        updatedAt: Date.now(),
        lastError: error instanceof Error ? error.message : "续跑失败",
      })
    } finally {
      launchLockRef.current = false
      setLoading(false)
    }
  }, [activeApplicant?.id, persistWorkflow, startCreateApplication, startExtractRegister, startTlsApply, startTlsRegister, workflow])

  useEffect(() => {
    if (!activeApplicant?.id || !workflow || workflow.applicantProfileId !== activeApplicant.id) return
    if (workflow.phase === "completed" || workflow.phase === "failed") return
    if (!isPageVisible) return

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
          next.stage = "review"
          persistWorkflow(next)
          return
        }

        if (tlsApply.status === "running") {
          next.stage = "tls-apply"
        } else if (createApplication.status === "running") {
          next.stage = "create-application"
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
    }, QUICK_WORKFLOW_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeApplicant?.id, isPageVisible, launchCreateApplication, launchTlsApply, persistWorkflow, updateWorkflow, workflow])

  const overallPercent = workflow
    ? workflowPercent([
        workflow.steps.extractRegister,
        workflow.steps.tlsRegister,
        workflow.steps.createApplication,
        workflow.steps.tlsApply,
      ])
    : 0

  const currentStepText = useMemo(() => getFranceCurrentStepLabel(workflow), [workflow])
  const canReset = Boolean(workflow)
  const canResume = canResumeFranceWorkflow(workflow)

  return (
    <Card className="mb-6 border-blue-200/60 bg-gradient-to-r from-blue-50 to-white shadow-xl dark:border-blue-900/40 dark:from-blue-950/20 dark:to-gray-950">
      <CardHeader className="border-b border-blue-100/80 dark:border-blue-900/30">
        <CardTitle className="text-xl text-gray-900 dark:text-white">法签一键启动</CardTitle>
        <CardDescription>自动执行到 “TLS 填表提交” 为止，之后故意停下来，方便你人工审核数据是否正确。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {!activeApplicant?.id ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>请先选择申请人档案</AlertTitle>
            <AlertDescription>先在顶部选中一个申请人，系统才能复用对应的申根资料。</AlertDescription>
          </Alert>
        ) : !canStart ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>缺少申根 Excel</AlertTitle>
            <AlertDescription>当前申请人档案里还没有申根 Excel，请先去档案页上传后再启动。</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>当前申请人：{activeApplicant.name || activeApplicant.label}</AlertTitle>
            <AlertDescription>系统会自动按 “注册准备 → 生成新申请 → TLS 填表提交” 顺序执行。</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-black/20">
            <div className="text-xs text-gray-500">当前步骤</div>
            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{currentStepText}</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-black/20">
            <div className="text-xs text-gray-500">审核状态</div>
            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
              {workflow?.phase === "completed" ? "等待人工审核" : workflow?.phase === "failed" ? "存在失败步骤" : "自动执行中"}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 dark:border-blue-900/40 dark:bg-black/20">
            <div className="text-xs text-gray-500">自动进度</div>
            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{overallPercent}%</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>自动链路进度</span>
            <span>{overallPercent}%</span>
          </div>
          <Progress value={overallPercent} className="h-2.5" />
        </div>

        <div className="grid gap-3 md:grid-cols-[1.4fr,1fr,1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">步骤 1：注册准备</div>
            <div className="mt-1 text-xs text-gray-500">只有 FV 注册和 TLS 注册都成功，才会继续下一步。</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <StepBadge label="FV 注册" step={workflow?.steps.extractRegister ?? { status: "idle" }} />
                <StepMeta step={workflow?.steps.extractRegister ?? { status: "idle" }} taskListId="france-extract-register-tasks" taskLabel="FV 注册" />
              </div>
              <div>
                <StepBadge label="TLS 注册" step={workflow?.steps.tlsRegister ?? { status: "idle" }} />
                <StepMeta step={workflow?.steps.tlsRegister ?? { status: "idle" }} taskListId="france-tls-register-tasks" taskLabel="TLS 注册" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">步骤 2：生成新申请</div>
            <div className="mt-1 text-xs text-gray-500">生成 France-visas 新申请 JSON。</div>
            <div className="mt-3">
              <StepBadge label="France-visas 新申请" step={workflow?.steps.createApplication ?? { status: "idle" }} />
              <StepMeta
                step={workflow?.steps.createApplication ?? { status: "idle" }}
                taskListId="france-create-application-tasks"
                taskLabel="生成新申请"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">步骤 3：TLS 填表提交</div>
            <div className="mt-1 text-xs text-gray-500">提交完成后自动停止，留给人工检查。</div>
            <div className="mt-3">
              <StepBadge label="TLS 页面填表与提交" step={workflow?.steps.tlsApply ?? { status: "idle" }} />
              <StepMeta step={workflow?.steps.tlsApply ?? { status: "idle" }} taskListId="france-tls-apply-tasks" taskLabel="TLS 填表提交" />
            </div>
          </div>
        </div>

        {workflow?.phase === "completed" && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>自动阶段已完成</AlertTitle>
            <AlertDescription>现在建议人工审核资料和页面结果，确认无误后再继续抢号、回执单和最终表流程。</AlertDescription>
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
            {workflow ? "重新开始本轮自动化" : "开始自动运行"}
          </Button>
          <Button variant="secondary" disabled={!canResume || loading} onClick={handleResume} className="gap-2">
            <PlayCircle className="h-4 w-4" />
            从失败步骤续跑
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

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
  fetchUsVisaTasksForApplicant,
  findTaskById,
  formatWorkflowTime,
  readStoredWorkflow,
  syncStepWithTask,
  workflowPercent,
  writeStoredWorkflow,
} from "@/components/quick-start/workflow-utils"

interface UsVisaQuickWorkflow {
  applicantProfileId: string
  applicantName?: string
  phase: QuickWorkflowPhase
  startedAt: number
  updatedAt: number
  lastError?: string
  steps: Record<string, QuickStepState>
}

const PREP_STORAGE_PREFIX = "usVisaQuickPrepWorkflow:"
const SUBMIT_STORAGE_PREFIX = "usVisaQuickSubmitWorkflow:"

function createWorkflow(applicantProfileId: string, applicantName: string | undefined, stepKeys: string[]) {
  const steps = Object.fromEntries(stepKeys.map((key) => [key, { status: "idle" as QuickStepState["status"] }])) as Record<
    string,
    QuickStepState
  >
  return {
    applicantProfileId,
    applicantName,
    phase: "running" as QuickWorkflowPhase,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    steps,
  } as UsVisaQuickWorkflow
}

function hasUsVisaExcel(profile: ReturnType<typeof useActiveApplicantProfile>) {
  return Boolean(profile?.files?.usVisaDs160Excel || profile?.files?.ds160Excel || profile?.files?.usVisaAisExcel || profile?.files?.aisExcel)
}

function hasUsVisaPhoto(profile: ReturnType<typeof useActiveApplicantProfile>) {
  return Boolean(profile?.files?.usVisaPhoto || profile?.files?.photo)
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

export function UsVisaQuickStartCard() {
  const activeApplicant = useActiveApplicantProfile()
  const [prepWorkflow, setPrepWorkflow] = useState<UsVisaQuickWorkflow | null>(null)
  const [submitWorkflow, setSubmitWorkflow] = useState<UsVisaQuickWorkflow | null>(null)
  const [prepLoading, setPrepLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const prepLockRef = useRef(false)
  const submitLockRef = useRef(false)

  const prepStorageKey = activeApplicant?.id ? `${PREP_STORAGE_PREFIX}${activeApplicant.id}` : ""
  const submitStorageKey = activeApplicant?.id ? `${SUBMIT_STORAGE_PREFIX}${activeApplicant.id}` : ""

  const canStartPrep = Boolean(activeApplicant?.id && hasUsVisaExcel(activeApplicant) && hasUsVisaPhoto(activeApplicant))
  const canStartSubmit = Boolean(
    activeApplicant?.id &&
      hasUsVisaExcel(activeApplicant) &&
      activeApplicant?.usVisa?.aaCode &&
      activeApplicant?.usVisa?.surname &&
      activeApplicant?.usVisa?.birthYear &&
      activeApplicant?.usVisa?.passportNumber,
  )

  useEffect(() => {
    setPrepWorkflow(prepStorageKey ? readStoredWorkflow<UsVisaQuickWorkflow>(prepStorageKey) : null)
    setSubmitWorkflow(submitStorageKey ? readStoredWorkflow<UsVisaQuickWorkflow>(submitStorageKey) : null)
  }, [prepStorageKey, submitStorageKey])

  const persistPrepWorkflow = useCallback(
    (next: UsVisaQuickWorkflow | null) => {
      setPrepWorkflow(next)
      if (!prepStorageKey) return
      if (next) writeStoredWorkflow(prepStorageKey, next)
      else clearStoredWorkflow(prepStorageKey)
    },
    [prepStorageKey],
  )

  const persistSubmitWorkflow = useCallback(
    (next: UsVisaQuickWorkflow | null) => {
      setSubmitWorkflow(next)
      if (!submitStorageKey) return
      if (next) writeStoredWorkflow(submitStorageKey, next)
      else clearStoredWorkflow(submitStorageKey)
    },
    [submitStorageKey],
  )

  const updatePrepWorkflow = useCallback(
    (updater: (current: UsVisaQuickWorkflow) => UsVisaQuickWorkflow) => {
      setPrepWorkflow((current) => {
        if (!current) return current
        const next = updater(current)
        if (prepStorageKey) writeStoredWorkflow(prepStorageKey, next)
        return next
      })
    },
    [prepStorageKey],
  )

  const updateSubmitWorkflow = useCallback(
    (updater: (current: UsVisaQuickWorkflow) => UsVisaQuickWorkflow) => {
      setSubmitWorkflow((current) => {
        if (!current) return current
        const next = updater(current)
        if (submitStorageKey) writeStoredWorkflow(submitStorageKey, next)
        return next
      })
    },
    [submitStorageKey],
  )

  const startPhotoCheck = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    formData.append("async", "true")
    const res = await fetch("/api/usa-visa/photo-check", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { task_id?: string; message?: string; error?: string }
    if (!res.ok || !data.task_id) {
      throw new Error(data.error || data.message || "照片检测启动失败")
    }
    return data.task_id
  }, [activeApplicant?.id])

  const startDs160Fill = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    formData.append("async", "true")
    const res = await fetch("/api/usa-visa/ds160/auto-fill", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { task_id?: string; message?: string; error?: string }
    if (!res.ok || !data.task_id) {
      throw new Error(data.error || data.message || "DS-160 填表启动失败")
    }
    return data.task_id
  }, [activeApplicant?.id])

  const startSubmitDs160 = useCallback(async () => {
    const res = await fetch("/api/usa-visa/ds160/submit", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantProfileId: activeApplicant?.id }),
    })
    const data = (await res.json().catch(() => ({}))) as { task_id?: string; message?: string; error?: string }
    if (!res.ok || !data.task_id) {
      throw new Error(data.error || data.message || "提交 DS-160 启动失败")
    }
    return data.task_id
  }, [activeApplicant?.id])

  const startAisRegister = useCallback(async () => {
    const formData = new FormData()
    formData.append("applicantProfileId", activeApplicant?.id || "")
    const res = await fetch("/api/usa-visa/register-ais", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; task_ids?: string[]; message?: string; error?: string }
    const taskId = data.task_ids?.[0]
    if (!res.ok || !data.success || !taskId) {
      throw new Error(data.error || data.message || "AIS 注册启动失败")
    }
    return taskId
  }, [activeApplicant?.id])

  const handleStartPrep = useCallback(async () => {
    if (!activeApplicant?.id || !canStartPrep || prepLockRef.current) return
    prepLockRef.current = true
    setPrepLoading(true)
    try {
      const workflow = createWorkflow(activeApplicant.id, activeApplicant.name || activeApplicant.label, ["photoCheck", "ds160Fill"])
      const photoTaskId = await startPhotoCheck()
      workflow.steps.photoCheck = {
        status: "running",
        taskId: photoTaskId,
        startedAt: Date.now(),
        message: "照片检测已启动",
      }
      persistPrepWorkflow(workflow)
    } catch (error) {
      persistPrepWorkflow({
        ...createWorkflow(activeApplicant.id, activeApplicant.name || activeApplicant.label, ["photoCheck", "ds160Fill"]),
        phase: "failed",
        updatedAt: Date.now(),
        lastError: error instanceof Error ? error.message : "照片检测启动失败",
        steps: {
          photoCheck: {
            status: "failed",
            error: error instanceof Error ? error.message : "照片检测启动失败",
            finishedAt: Date.now(),
          },
          ds160Fill: { status: "idle" },
        },
      })
    } finally {
      prepLockRef.current = false
      setPrepLoading(false)
    }
  }, [activeApplicant?.id, activeApplicant?.label, activeApplicant?.name, canStartPrep, persistPrepWorkflow, startPhotoCheck])

  const handleStartSubmit = useCallback(async () => {
    if (!activeApplicant?.id || !canStartSubmit || submitLockRef.current) return
    submitLockRef.current = true
    setSubmitLoading(true)
    const base = createWorkflow(activeApplicant.id, activeApplicant.name || activeApplicant.label, ["submitDs160", "registerAis"])
    try {
      const [submitResult, aisResult] = await Promise.allSettled([startSubmitDs160(), startAisRegister()])
      const next = { ...base }

      if (submitResult.status === "fulfilled") {
        next.steps.submitDs160 = {
          status: "running",
          taskId: submitResult.value,
          startedAt: Date.now(),
          message: "提交 DS-160 已启动",
        }
      } else {
        next.steps.submitDs160 = {
          status: "failed",
          error: submitResult.reason instanceof Error ? submitResult.reason.message : "提交 DS-160 启动失败",
          finishedAt: Date.now(),
        }
      }

      if (aisResult.status === "fulfilled") {
        next.steps.registerAis = {
          status: "running",
          taskId: aisResult.value,
          startedAt: Date.now(),
          message: "AIS 注册已启动",
        }
      } else {
        next.steps.registerAis = {
          status: "failed",
          error: aisResult.reason instanceof Error ? aisResult.reason.message : "AIS 注册启动失败",
          finishedAt: Date.now(),
        }
      }

      if (submitResult.status === "rejected" || aisResult.status === "rejected") {
        next.phase = "failed"
        next.lastError = [next.steps.submitDs160.error, next.steps.registerAis.error].filter(Boolean).join("；")
      }
      persistSubmitWorkflow(next)
    } finally {
      submitLockRef.current = false
      setSubmitLoading(false)
    }
  }, [activeApplicant?.id, activeApplicant?.label, activeApplicant?.name, canStartSubmit, persistSubmitWorkflow, startAisRegister, startSubmitDs160])

  const launchDs160Fill = useCallback(
    async (current: UsVisaQuickWorkflow) => {
      if (prepLockRef.current) return
      prepLockRef.current = true
      try {
        const taskId = await startDs160Fill()
        persistPrepWorkflow({
          ...current,
          updatedAt: Date.now(),
          steps: {
            ...current.steps,
            ds160Fill: {
              status: "running",
              taskId,
              startedAt: Date.now(),
              message: "DS-160 填表已启动",
            },
          },
        })
      } catch (error) {
        persistPrepWorkflow({
          ...current,
          phase: "failed",
          updatedAt: Date.now(),
          lastError: error instanceof Error ? error.message : "DS-160 填表启动失败",
          steps: {
            ...current.steps,
            ds160Fill: {
              status: "failed",
              error: error instanceof Error ? error.message : "DS-160 填表启动失败",
              finishedAt: Date.now(),
            },
          },
        })
      } finally {
        prepLockRef.current = false
      }
    },
    [persistPrepWorkflow, startDs160Fill],
  )

  useEffect(() => {
    if (!activeApplicant?.id || !prepWorkflow || prepWorkflow.applicantProfileId !== activeApplicant.id) return
    if (prepWorkflow.phase === "completed" || prepWorkflow.phase === "failed") return

    let cancelled = false
    const tick = async () => {
      try {
        const tasks = await fetchUsVisaTasksForApplicant(activeApplicant.id)
        if (cancelled) return

        const photoCheck = syncStepWithTask(prepWorkflow.steps.photoCheck, findTaskById(tasks, prepWorkflow.steps.photoCheck.taskId))
        const ds160Fill = syncStepWithTask(prepWorkflow.steps.ds160Fill, findTaskById(tasks, prepWorkflow.steps.ds160Fill.taskId))
        const next: UsVisaQuickWorkflow = {
          ...prepWorkflow,
          updatedAt: Date.now(),
          steps: { photoCheck, ds160Fill },
        }

        if (photoCheck.status === "failed" || ds160Fill.status === "failed") {
          next.phase = "failed"
          next.lastError = photoCheck.error || ds160Fill.error || "美签预处理失败"
          persistPrepWorkflow(next)
          return
        }

        if (photoCheck.status === "completed" && ds160Fill.status === "idle") {
          persistPrepWorkflow(next)
          await launchDs160Fill(next)
          return
        }

        if (ds160Fill.status === "completed") {
          next.phase = "completed"
          persistPrepWorkflow(next)
          return
        }

        persistPrepWorkflow(next)
      } catch (error) {
        if (!cancelled) {
          updatePrepWorkflow((current) => ({
            ...current,
            phase: "failed",
            updatedAt: Date.now(),
            lastError: error instanceof Error ? error.message : "加载美签任务失败",
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
  }, [activeApplicant?.id, launchDs160Fill, persistPrepWorkflow, prepWorkflow, updatePrepWorkflow])

  useEffect(() => {
    if (!activeApplicant?.id || !submitWorkflow || submitWorkflow.applicantProfileId !== activeApplicant.id) return
    if (submitWorkflow.phase === "completed" || submitWorkflow.phase === "failed") return

    let cancelled = false
    const tick = async () => {
      try {
        const tasks = await fetchUsVisaTasksForApplicant(activeApplicant.id)
        if (cancelled) return

        const submitDs160 = syncStepWithTask(submitWorkflow.steps.submitDs160, findTaskById(tasks, submitWorkflow.steps.submitDs160.taskId))
        const registerAis = syncStepWithTask(submitWorkflow.steps.registerAis, findTaskById(tasks, submitWorkflow.steps.registerAis.taskId))
        const next: UsVisaQuickWorkflow = {
          ...submitWorkflow,
          updatedAt: Date.now(),
          steps: { submitDs160, registerAis },
        }

        const allDone = submitDs160.status === "completed" && registerAis.status === "completed"
        const anyRunning = submitDs160.status === "running" || registerAis.status === "running"
        const anyFailed = submitDs160.status === "failed" || registerAis.status === "failed"

        if (allDone) {
          next.phase = "completed"
        } else if (anyFailed && !anyRunning) {
          next.phase = "failed"
          next.lastError = submitDs160.error || registerAis.error || "提交阶段存在失败任务"
        }

        persistSubmitWorkflow(next)
      } catch (error) {
        if (!cancelled) {
          updateSubmitWorkflow((current) => ({
            ...current,
            phase: "failed",
            updatedAt: Date.now(),
            lastError: error instanceof Error ? error.message : "加载美签任务失败",
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
  }, [activeApplicant?.id, persistSubmitWorkflow, submitWorkflow, updateSubmitWorkflow])

  const prepPercent = prepWorkflow ? workflowPercent([prepWorkflow.steps.photoCheck, prepWorkflow.steps.ds160Fill]) : 0
  const submitPercent = submitWorkflow ? workflowPercent([submitWorkflow.steps.submitDs160, submitWorkflow.steps.registerAis]) : 0

  const prepReadyMessage = useMemo(() => {
    if (!activeApplicant?.id) return "请先选择申请人档案。"
    if (!hasUsVisaPhoto(activeApplicant)) return "当前申请人档案还没有美签照片。"
    if (!hasUsVisaExcel(activeApplicant)) return "当前申请人档案还没有 DS-160 / AIS Excel。"
    return "将自动执行“照片检测 → DS-160 填表”，跑完后停下来，给人工审核留空档。"
  }, [activeApplicant])

  const submitReadyMessage = useMemo(() => {
    if (!activeApplicant?.id) return "请先选择申请人档案。"
    if (!hasUsVisaExcel(activeApplicant)) return "当前申请人档案还没有 DS-160 / AIS Excel。"
    if (!activeApplicant?.usVisa?.aaCode) return "还没有 AA 码，先完成 DS-160 填表。"
    if (!activeApplicant?.usVisa?.surname || !activeApplicant?.usVisa?.birthYear || !activeApplicant?.usVisa?.passportNumber) {
      return "提交阶段还缺少姓、出生年份或护照号，请先确认档案信息已自动回写。"
    }
    return "这一段会并行启动“提交 DS-160”和“AIS 注册”，适合人工审核信息无误后再点。"
  }, [activeApplicant])

  return (
    <Card className="mb-6 border-blue-200/60 bg-gradient-to-r from-blue-50 to-white shadow-xl dark:border-blue-900/40 dark:from-blue-950/20 dark:to-gray-950">
      <CardHeader className="border-b border-blue-100/80 dark:border-blue-900/30">
        <CardTitle className="text-xl text-gray-900 dark:text-white">美签一键启动</CardTitle>
        <CardDescription>按你的业务节奏拆成两段：先做资料预处理，审核无误后再做提交阶段并行处理。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 pt-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">阶段一：照片检测 → DS-160 填表</div>
              <div className="mt-1 text-xs text-gray-500">{prepReadyMessage}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>进度</span>
              <span>{prepPercent}%</span>
            </div>
            <Progress value={prepPercent} className="h-2.5" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <StepBadge label="照片检测" step={prepWorkflow?.steps.photoCheck ?? { status: "idle" }} />
            <StepBadge label="DS-160 填表" step={prepWorkflow?.steps.ds160Fill ?? { status: "idle" }} />
          </div>
          {prepWorkflow?.phase === "completed" && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>阶段一完成</AlertTitle>
              <AlertDescription>照片检测和 DS-160 填表都已完成，现在可以人工审核数据，再决定是否启动提交阶段。</AlertDescription>
            </Alert>
          )}
          {prepWorkflow?.phase === "failed" && prepWorkflow.lastError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>阶段一已停止</AlertTitle>
              <AlertDescription>{prepWorkflow.lastError}</AlertDescription>
            </Alert>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleStartPrep} disabled={!canStartPrep || prepLoading || prepWorkflow?.phase === "running"} className="gap-2">
              {prepLoading || prepWorkflow?.phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {prepWorkflow?.phase === "running" ? "自动执行中" : "启动阶段一"}
            </Button>
            <Button variant="outline" disabled={!prepWorkflow} onClick={() => persistPrepWorkflow(null)} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              清空状态
            </Button>
            {prepWorkflow?.startedAt && <span className="text-xs text-gray-500">开始于 {formatWorkflowTime(prepWorkflow.startedAt)}</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-black/20">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">阶段二：提交 DS-160 + AIS 注册</div>
              <div className="mt-1 text-xs text-gray-500">{submitReadyMessage}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>进度</span>
              <span>{submitPercent}%</span>
            </div>
            <Progress value={submitPercent} className="h-2.5" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <StepBadge label="提交 DS-160" step={submitWorkflow?.steps.submitDs160 ?? { status: "idle" }} />
            <StepBadge label="AIS 注册" step={submitWorkflow?.steps.registerAis ?? { status: "idle" }} />
          </div>
          {submitWorkflow?.phase === "completed" && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>阶段二完成</AlertTitle>
              <AlertDescription>提交 DS-160 和 AIS 注册都已经完成，可以继续人工跟进后续预约流程。</AlertDescription>
            </Alert>
          )}
          {submitWorkflow?.phase === "failed" && submitWorkflow.lastError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>阶段二已停止</AlertTitle>
              <AlertDescription>{submitWorkflow.lastError}</AlertDescription>
            </Alert>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleStartSubmit} disabled={!canStartSubmit || submitLoading || submitWorkflow?.phase === "running"} className="gap-2">
              {submitLoading || submitWorkflow?.phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {submitWorkflow?.phase === "running" ? "并行执行中" : "启动阶段二"}
            </Button>
            <Button variant="outline" disabled={!submitWorkflow} onClick={() => persistSubmitWorkflow(null)} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              清空状态
            </Button>
            {submitWorkflow?.startedAt && <span className="text-xs text-gray-500">开始于 {formatWorkflowTime(submitWorkflow.startedAt)}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

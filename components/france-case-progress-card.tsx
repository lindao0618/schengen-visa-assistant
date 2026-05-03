"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, Clock3, XCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  formatFranceExceptionLabel,
  formatFranceStatusLabel,
} from "@/lib/france-case-labels"
import { FRANCE_MAIN_STATUS_RANK, type FranceMainStatus } from "@/lib/france-case-machine"

type FranceCaseRecord = {
  id: string
  mainStatus: string
  subStatus?: string | null
  exceptionCode?: string | null
  updatedAt: string
}

type FranceCaseHistoryRecord = {
  id: string
  fromMainStatus?: string | null
  fromSubStatus?: string | null
  toMainStatus: string
  toSubStatus?: string | null
  exceptionCode?: string | null
  reason?: string | null
  createdAt: string
}

type FranceTaskRecord = {
  task_id: string
  type: string
  status: string
  created_at?: number
  updated_at?: number
}

type FranceCaseApiResponse = {
  case?: FranceCaseRecord | null
  history?: FranceCaseHistoryRecord[]
}

type VisaCaseDetailResponse = {
  case?: {
    id: string
    mainStatus: string
    subStatus?: string | null
    exceptionCode?: string | null
    updatedAt: string
    statusHistory?: FranceCaseHistoryRecord[]
  } | null
}

type StepStatus = "completed" | "active" | "pending" | "failed"

type ProgressStep = {
  key: string
  title: string
  description: string
  status: StepStatus
  timeLabel?: string
  extra?: ReactNode
}

function formatDate(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("zh-CN", { hour12: false })
}

function formatStepTime(value?: number | string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function getStatusMeta(status: StepStatus) {
  if (status === "completed") {
    return {
      dotClassName: "border-emerald-400 bg-emerald-400 text-black",
      lineClassName: "bg-emerald-400",
      titleClassName: "text-white",
      descriptionClassName: "text-white/[0.48]",
      badgeClassName: "border border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: "已完成",
    }
  }

  if (status === "failed") {
    return {
      dotClassName: "border-red-400 bg-red-400 text-black",
      lineClassName: "bg-red-400/70",
      titleClassName: "text-red-200",
      descriptionClassName: "text-red-200/[0.65]",
      badgeClassName: "border border-red-400/25 bg-red-400/10 text-red-300",
      icon: <XCircle className="h-4 w-4" />,
      text: "失败",
    }
  }

  if (status === "active") {
    return {
      dotClassName: "border-cyan-300 bg-cyan-300/12 text-cyan-200",
      lineClassName: "bg-cyan-300/70",
      titleClassName: "text-white",
      descriptionClassName: "text-cyan-100/[0.58]",
      badgeClassName: "border border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
      icon: <Clock3 className="h-4 w-4" />,
      text: "进行中",
    }
  }

  return {
    dotClassName: "border-white/[0.18] bg-white/[0.035] text-white/35",
    lineClassName: "bg-white/10",
    titleClassName: "text-white/42",
    descriptionClassName: "text-white/30",
    badgeClassName: "border border-white/10 bg-white/[0.035] text-white/[0.38]",
    icon: null,
    text: "未开始",
  }
}

function StepDot({
  status,
  stepNumber,
  compact = false,
}: {
  status: StepStatus
  stepNumber: number
  compact?: boolean
}) {
  const meta = getStatusMeta(status)
  const sizeClassName = compact ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm"

  return (
    <div
      className={[
        "flex items-center justify-center rounded-full border-2 font-semibold transition-colors",
        sizeClassName,
        meta.dotClassName,
      ].join(" ")}
    >
      {status === "completed" || status === "failed" ? meta.icon : stepNumber}
    </div>
  )
}

function RegistrationChip({
  label,
  status,
}: {
  label: string
  status: StepStatus
}) {
  const meta = getStatusMeta(status)

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs shadow-sm shadow-black/20">
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClassName}`} />
      <span className="font-medium text-white/70">{label}</span>
      <span className={meta.descriptionClassName}>{meta.text}</span>
    </div>
  )
}

function getLatestTaskByType(tasks: FranceTaskRecord[]) {
  const latest = new Map<string, FranceTaskRecord>()

  for (const task of tasks) {
    const current = latest.get(task.type)
    const taskTime = task.updated_at ?? task.created_at ?? 0
    const currentTime = current ? current.updated_at ?? current.created_at ?? 0 : 0
    if (!current || taskTime >= currentTime) {
      latest.set(task.type, task)
    }
  }

  return latest
}

function getTaskStatus(task?: FranceTaskRecord): StepStatus {
  if (!task) return "pending"
  if (task.status === "completed") return "completed"
  if (task.status === "failed") return "failed"
  if (task.status === "running" || task.status === "pending") return "active"
  return "pending"
}

function getSingleTaskStepStatus(
  latestTasks: Map<string, FranceTaskRecord>,
  type: string,
  fallbackActive = false,
): StepStatus {
  const status = getTaskStatus(latestTasks.get(type))
  if (status !== "pending") return status
  return fallbackActive ? "active" : "pending"
}

function getTaskTimestamp(task?: FranceTaskRecord) {
  const value = task?.updated_at ?? task?.created_at
  return typeof value === "number" && value > 0 ? value : null
}

function findHistoryTimestamp(
  history: FranceCaseHistoryRecord[],
  matcher: (item: FranceCaseHistoryRecord) => boolean,
) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index]
    if (matcher(item)) {
      return item.createdAt
    }
  }
  return null
}

function getHistorySummary(item: FranceCaseHistoryRecord) {
  const target = formatFranceStatusLabel(item.toMainStatus, item.toSubStatus)
  const source = item.fromMainStatus
    ? formatFranceStatusLabel(item.fromMainStatus, item.fromSubStatus)
    : "初始状态"

  return `${source} -> ${target}`
}

function buildRegistrationStatus(
  fvRegisterStatus: StepStatus,
  tlsRegisterStatus: StepStatus,
): StepStatus {
  if (fvRegisterStatus === "failed" || tlsRegisterStatus === "failed") return "failed"
  if (fvRegisterStatus === "completed" && tlsRegisterStatus === "completed") return "completed"
  if (
    fvRegisterStatus === "active" ||
    tlsRegisterStatus === "active" ||
    fvRegisterStatus === "completed" ||
    tlsRegisterStatus === "completed"
  ) {
    return "active"
  }
  return "pending"
}

type ProgressStepKey =
  | "registration"
  | "create-application"
  | "tls-apply"
  | "slot-submit"
  | "slot-booked"
  | "fill-receipt"
  | "submit-final"

function isKnownFranceMainStatus(status?: string | null): status is FranceMainStatus {
  return !!status && status in FRANCE_MAIN_STATUS_RANK
}

function isMainStatusAtLeast(currentStatus: string | null | undefined, targetStatus: FranceMainStatus) {
  if (!isKnownFranceMainStatus(currentStatus)) return false
  return FRANCE_MAIN_STATUS_RANK[currentStatus] >= FRANCE_MAIN_STATUS_RANK[targetStatus]
}

function getManualCaseStepStatus(caseRecord: FranceCaseRecord | null, stepKey: ProgressStepKey): StepStatus | null {
  if (!caseRecord) return null
  const mainStatus = caseRecord.mainStatus
  const subStatus = caseRecord.subStatus

  if (stepKey === "registration") {
    if (isMainStatusAtLeast(mainStatus, "SLOT_BOOKED") || ["SLOT_HUNTING", "PENDING_SUBMISSION", "WAITING_TLS_PAYMENT", "PACKAGE_SENT"].includes(subStatus || "")) return "completed"
    if (mainStatus === "TLS_PROCESSING" || subStatus === "TLS_REGISTERING" || subStatus === "FV_FILLING") return "active"
    return null
  }

  if (stepKey === "create-application") {
    if (isMainStatusAtLeast(mainStatus, "SLOT_BOOKED") || ["FV_FILLING", "SLOT_HUNTING", "PENDING_SUBMISSION", "WAITING_TLS_PAYMENT", "PACKAGE_SENT"].includes(subStatus || "")) return "completed"
    if (mainStatus === "TLS_PROCESSING" || subStatus === "TLS_REGISTERING") return "active"
    return null
  }

  if (stepKey === "tls-apply") {
    if (isMainStatusAtLeast(mainStatus, "SLOT_BOOKED") || ["SLOT_HUNTING", "PENDING_SUBMISSION", "WAITING_TLS_PAYMENT", "PACKAGE_SENT"].includes(subStatus || "")) return "completed"
    if (mainStatus === "TLS_PROCESSING" || subStatus === "FV_FILLING" || subStatus === "TLS_REGISTERING") return "active"
    return null
  }

  if (stepKey === "slot-submit") {
    if (isMainStatusAtLeast(mainStatus, "SLOT_BOOKED") || ["PENDING_SUBMISSION", "WAITING_TLS_PAYMENT", "PACKAGE_SENT"].includes(subStatus || "")) return "completed"
    if (subStatus === "SLOT_HUNTING") return "active"
    return null
  }

  if (stepKey === "slot-booked") {
    if (isMainStatusAtLeast(mainStatus, "SLOT_BOOKED")) return "completed"
    if (subStatus === "PACKAGE_SENT" || subStatus === "WAITING_TLS_PAYMENT" || subStatus === "PENDING_SUBMISSION") return "active"
    return null
  }

  if (stepKey === "fill-receipt") {
    if (isMainStatusAtLeast(mainStatus, "SUBMITTED")) return "completed"
    if (mainStatus === "SLOT_BOOKED") return "active"
    return null
  }

  if (stepKey === "submit-final") {
    if (isMainStatusAtLeast(mainStatus, "COMPLETED")) return "completed"
    if (mainStatus === "SUBMITTED") return "active"
  }

  return null
}

export function FranceCaseProgressCard({
  applicantProfileId,
  applicantName,
  caseId,
  caseOverride,
  historyOverride,
}: {
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
  caseOverride?: FranceCaseRecord | null
  historyOverride?: FranceCaseHistoryRecord[] | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [caseRecord, setCaseRecord] = useState<FranceCaseRecord | null>(null)
  const [history, setHistory] = useState<FranceCaseHistoryRecord[]>([])
  const [tasks, setTasks] = useState<FranceTaskRecord[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (!applicantProfileId && !caseId) {
      setCaseRecord(null)
      setHistory([])
      setTasks([])
      setError("")
      return
    }

    let cancelled = false
    if (caseOverride?.id === caseId && caseOverride) {
      setCaseRecord(caseOverride)
      setHistory(historyOverride || [])
    }

    const load = async () => {
      setLoading(true)
      setError("")

      try {
        const caseRequest = caseId
          ? fetch(`/api/cases/${caseId}`, {
              cache: "no-store",
              credentials: "include",
            })
          : fetch(`/api/applicants/${applicantProfileId}/france-case`, {
              cache: "no-store",
              credentials: "include",
            })

        const taskRequest = applicantProfileId
          ? fetch(
              `/api/schengen/france/tasks-list?limit=100&applicantProfileId=${encodeURIComponent(applicantProfileId)}`,
              {
                cache: "no-store",
                credentials: "include",
              },
            )
          : Promise.resolve(null)

        const [caseRes, taskRes] = await Promise.all([caseRequest, taskRequest])

        if (!caseRes.ok) {
          throw new Error("加载法签案件进度失败")
        }

        if (caseId) {
          const caseData = (await caseRes.json()) as VisaCaseDetailResponse
          if (cancelled) return

          setCaseRecord(
            caseOverride?.id === caseId && caseOverride
              ? caseOverride
              : caseData.case
              ? {
                  id: caseData.case.id,
                  mainStatus: caseData.case.mainStatus,
                  subStatus: caseData.case.subStatus,
                  exceptionCode: caseData.case.exceptionCode,
                  updatedAt: caseData.case.updatedAt,
                }
              : null,
          )
          setHistory(caseOverride?.id === caseId && caseOverride ? historyOverride || [] : caseData.case?.statusHistory || [])
        } else {
          const caseData = (await caseRes.json()) as FranceCaseApiResponse
          if (cancelled) return

          setCaseRecord((caseData.case || null) as FranceCaseRecord | null)
          setHistory((caseData.history || []) as FranceCaseHistoryRecord[])
        }

        if (!cancelled) {
          if (taskRes?.ok) {
            const taskData = await taskRes.json().catch(() => ({ tasks: [] }))
            setTasks((taskData?.tasks || []) as FranceTaskRecord[])
          } else {
            setTasks([])
          }
        }
      } catch (fetchError) {
        if (cancelled) return
        setError(fetchError instanceof Error ? fetchError.message : "加载法签案件进度失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [applicantProfileId, caseId, caseOverride, historyOverride])

  const latestTasks = useMemo(() => getLatestTaskByType(tasks), [tasks])
  const recentHistory = useMemo(() => history.slice(-5).reverse(), [history])

  const exceptionLabel = useMemo(() => {
    if (!caseRecord?.exceptionCode) return ""
    return formatFranceExceptionLabel(caseRecord.exceptionCode)
  }, [caseRecord?.exceptionCode])

  const fvRegisterStatus = useMemo(() => {
    const fvTask = latestTasks.get("extract-register") ?? latestTasks.get("register")
    return getTaskStatus(fvTask)
  }, [latestTasks])

  const tlsRegisterStatus = useMemo(() => getTaskStatus(latestTasks.get("tls-register")), [latestTasks])

  const registrationStatus = useMemo(() => {
    return getManualCaseStepStatus(caseRecord, "registration") ?? buildRegistrationStatus(fvRegisterStatus, tlsRegisterStatus)
  }, [caseRecord?.mainStatus, caseRecord?.subStatus, fvRegisterStatus, tlsRegisterStatus])

  const registrationTimeLabel = useMemo(() => {
    const fvTime = getTaskTimestamp(latestTasks.get("extract-register") ?? latestTasks.get("register"))
    const tlsTime = getTaskTimestamp(latestTasks.get("tls-register"))
    const latestTime = Math.max(fvTime ?? 0, tlsTime ?? 0)
    if (registrationStatus === "completed" && latestTime > 0) {
      return `完成于 ${formatStepTime(latestTime)}`
    }
    if (registrationStatus === "failed" && latestTime > 0) {
      return `失败于 ${formatStepTime(latestTime)}`
    }
    return ""
  }, [latestTasks, registrationStatus])

  const createApplicationStatus = useMemo(() => {
    return (
      getManualCaseStepStatus(caseRecord, "create-application") ??
      getSingleTaskStepStatus(
        latestTasks,
        "create-application",
        registrationStatus === "completed" || registrationStatus === "active",
      )
    )
  }, [caseRecord?.mainStatus, caseRecord?.subStatus, latestTasks, registrationStatus])

  const createApplicationTimeLabel = useMemo(() => {
    const time = getTaskTimestamp(latestTasks.get("create-application"))
    if (createApplicationStatus === "completed" && time) return `完成于 ${formatStepTime(time)}`
    if (createApplicationStatus === "failed" && time) return `失败于 ${formatStepTime(time)}`
    return ""
  }, [createApplicationStatus, latestTasks])

  const tlsApplyStatus = useMemo(() => {
    return (
      getManualCaseStepStatus(caseRecord, "tls-apply") ??
      getSingleTaskStepStatus(latestTasks, "tls-apply", createApplicationStatus === "completed")
    )
  }, [caseRecord?.mainStatus, caseRecord?.subStatus, latestTasks, createApplicationStatus])

  const tlsApplyTimeLabel = useMemo(() => {
    const time = getTaskTimestamp(latestTasks.get("tls-apply"))
    if (tlsApplyStatus === "completed" && time) return `完成于 ${formatStepTime(time)}`
    if (tlsApplyStatus === "failed" && time) return `失败于 ${formatStepTime(time)}`
    return ""
  }, [latestTasks, tlsApplyStatus])

  const slotSubmissionStatus: StepStatus = useMemo(() => {
    const manualStatus = getManualCaseStepStatus(caseRecord, "slot-submit")
    if (manualStatus) return manualStatus

    if (
      caseRecord?.subStatus === "PACKAGE_SENT" ||
      caseRecord?.subStatus === "WAITING_TLS_PAYMENT" ||
      caseRecord?.subStatus === "PENDING_SUBMISSION" ||
      caseRecord?.mainStatus === "SLOT_BOOKED" ||
      caseRecord?.mainStatus === "SUBMITTED" ||
      caseRecord?.mainStatus === "COMPLETED"
    ) {
      return "completed"
    }

    if (caseRecord?.exceptionCode === "TLS_PAYMENT_TIMEOUT" || caseRecord?.exceptionCode === "DOCS_INCOMPLETE") {
      return "failed"
    }

    if (tlsApplyStatus === "failed") return "failed"
    if (tlsApplyStatus === "completed") return "active"
    return "pending"
  }, [caseRecord?.exceptionCode, caseRecord?.mainStatus, caseRecord?.subStatus, tlsApplyStatus])

  const slotSubmissionTimeLabel = useMemo(() => {
    const time = findHistoryTimestamp(
      history,
      (item) =>
        item.toSubStatus === "PACKAGE_SENT" ||
        item.toSubStatus === "WAITING_TLS_PAYMENT" ||
        item.toSubStatus === "PENDING_SUBMISSION",
    )
    if (slotSubmissionStatus === "completed" && time) return `完成于 ${formatStepTime(time)}`
    if (slotSubmissionStatus === "failed" && caseRecord?.updatedAt) {
      return `异常于 ${formatStepTime(caseRecord.updatedAt)}`
    }
    return ""
  }, [caseRecord?.updatedAt, history, slotSubmissionStatus])

  const slotBookedStatus: StepStatus = useMemo(() => {
    const manualStatus = getManualCaseStepStatus(caseRecord, "slot-booked")
    if (manualStatus) return manualStatus

    if (
      caseRecord?.mainStatus === "SLOT_BOOKED" ||
      caseRecord?.mainStatus === "SUBMITTED" ||
      caseRecord?.mainStatus === "COMPLETED"
    ) {
      return "completed"
    }

    if (caseRecord?.exceptionCode === "SLOT_TIMEOUT") return "failed"
    if (slotSubmissionStatus === "failed") return "failed"
    if (slotSubmissionStatus === "completed") return "active"
    return "pending"
  }, [caseRecord?.exceptionCode, caseRecord?.mainStatus, slotSubmissionStatus])

  const slotBookedTimeLabel = useMemo(() => {
    const time = findHistoryTimestamp(
      history,
      (item) =>
        item.toMainStatus === "SLOT_BOOKED" ||
        item.toMainStatus === "SUBMITTED" ||
        item.toMainStatus === "COMPLETED",
    )
    if (slotBookedStatus === "completed" && time) return `完成于 ${formatStepTime(time)}`
    if (slotBookedStatus === "failed" && caseRecord?.updatedAt) {
      return `异常于 ${formatStepTime(caseRecord.updatedAt)}`
    }
    return ""
  }, [caseRecord?.updatedAt, history, slotBookedStatus])

  const fillReceiptStatus = useMemo(() => {
    return (
      getManualCaseStepStatus(caseRecord, "fill-receipt") ??
      getSingleTaskStepStatus(latestTasks, "fill-receipt", slotBookedStatus === "completed")
    )
  }, [caseRecord?.mainStatus, caseRecord?.subStatus, latestTasks, slotBookedStatus])

  const fillReceiptTimeLabel = useMemo(() => {
    const time = getTaskTimestamp(latestTasks.get("fill-receipt"))
    if (fillReceiptStatus === "completed" && time) return `完成于 ${formatStepTime(time)}`
    if (fillReceiptStatus === "failed" && time) return `失败于 ${formatStepTime(time)}`
    return ""
  }, [fillReceiptStatus, latestTasks])

  const submitFinalStatus = useMemo(() => {
    return (
      getManualCaseStepStatus(caseRecord, "submit-final") ??
      getSingleTaskStepStatus(latestTasks, "submit-final", fillReceiptStatus === "completed")
    )
  }, [caseRecord?.mainStatus, caseRecord?.subStatus, latestTasks, fillReceiptStatus])

  const submitFinalTimeLabel = useMemo(() => {
    const time = getTaskTimestamp(latestTasks.get("submit-final"))
    if (submitFinalStatus === "completed" && time) return `完成于 ${formatStepTime(time)}`
    if (submitFinalStatus === "failed" && time) return `失败于 ${formatStepTime(time)}`
    return ""
  }, [latestTasks, submitFinalStatus])

  const steps: ProgressStep[] = useMemo(
    () => [
      {
        key: "registration",
        title: "1. 注册准备",
        description: "先完成 France-visas 和 TLS 两端注册，两个都成功后才算进入下一步。",
        status: registrationStatus,
        timeLabel: registrationTimeLabel,
        extra: (
          <div className="flex flex-wrap gap-2">
            <RegistrationChip label="France-visas 注册" status={fvRegisterStatus} />
            <RegistrationChip label="TLS 注册" status={tlsRegisterStatus} />
          </div>
        ),
      },
      {
        key: "create-application",
        title: "2. 生成新申请",
        description: "生成 France-visas 新申请 JSON，并归档到申请人材料中。",
        status: createApplicationStatus,
        timeLabel: createApplicationTimeLabel,
      },
      {
        key: "tls-apply",
        title: "3. TLS 填表提交",
        description: "完成 TLS 页面资料填写与提交，进入抢号资料流转。",
        status: tlsApplyStatus,
        timeLabel: tlsApplyTimeLabel,
      },
      {
        key: "slot-submit",
        title: "4. 提交给 Slot 外包商",
        description: "把抢号资料交给外包商处理，等待回传 Slot 进度。",
        status: slotSubmissionStatus,
        timeLabel: slotSubmissionTimeLabel,
      },
      {
        key: "slot-booked",
        title: "5. 已获取 Slot 信息",
        description: "系统确认已经抢到 Slot，可以进入后续递签环节。",
        status: slotBookedStatus,
        timeLabel: slotBookedTimeLabel,
      },
      {
        key: "fill-receipt",
        title: "6. 填写回执单",
        description: "根据已抢到的 Slot 信息生成并填写回执 PDF。",
        status: fillReceiptStatus,
        timeLabel: fillReceiptTimeLabel,
      },
      {
        key: "submit-final",
        title: "7. 提交最终表",
        description: "最终表 PDF 已生成并归档，法签前置流程完成。",
        status: submitFinalStatus,
        timeLabel: submitFinalTimeLabel,
      },
    ],
    [
      createApplicationStatus,
      createApplicationTimeLabel,
      fillReceiptStatus,
      fillReceiptTimeLabel,
      fvRegisterStatus,
      registrationStatus,
      registrationTimeLabel,
      slotBookedStatus,
      slotBookedTimeLabel,
      slotSubmissionStatus,
      slotSubmissionTimeLabel,
      submitFinalStatus,
      submitFinalTimeLabel,
      tlsApplyStatus,
      tlsApplyTimeLabel,
      tlsRegisterStatus,
    ],
  )

  return (
    <Card className="overflow-hidden rounded-[32px] border border-white/[0.06] bg-[#111714] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_34%),linear-gradient(180deg,#111714,#0d0f0e)] text-white shadow-2xl shadow-black/25">
      <CardHeader className="pb-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/60">France Case Progress</div>
        <CardTitle className="mt-2 text-xl font-bold tracking-tight text-white">法签案件进度</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!applicantProfileId && !caseId && (
          <p className="text-sm text-white/45">
            先选择申请人或案件，这里就会显示对应的法签案件进度。
          </p>
        )}

        {(applicantProfileId || caseId) && loading && (
          <p className="text-sm text-white/45">正在加载当前法签案件进度...</p>
        )}

        {(applicantProfileId || caseId) && !loading && error && (
          <p className="text-sm text-red-300">{error}</p>
        )}

        {(applicantProfileId || caseId) && !loading && !error && !caseRecord && (
          <p className="text-sm text-white/45">
            当前还没有可展示的法签案件，开始跑法国自动化流程后系统会自动生成。
          </p>
        )}

        {caseRecord && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">申请人</div>
                <div className="mt-2 text-sm font-bold text-white">{applicantName || "未命名申请人"}</div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">当前状态</div>
                <div className="mt-2 text-sm font-bold text-white">
                  {formatFranceStatusLabel(caseRecord.mainStatus, caseRecord.subStatus)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">最近更新时间</div>
                <div className="mt-2 font-mono text-sm font-bold text-white">{formatDate(caseRecord.updatedAt) || "未知"}</div>
              </div>
            </div>

            {exceptionLabel && (
              <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">
                当前异常：{exceptionLabel}
              </div>
            )}

            <div className="space-y-3">
              <div className="text-sm font-semibold text-white">业务进度条</div>

              <div className="hidden overflow-x-auto lg:block">
                <div className="min-w-[1260px]">
                  <div className="flex items-center">
                    {steps.map((step, index) => {
                      const meta = getStatusMeta(step.status)
                      return (
                        <div key={step.key} className="flex w-[180px] items-center">
                          <StepDot status={step.status} stepNumber={index + 1} />
                          {index < steps.length - 1 && (
                            <div className={`mx-3 h-1 flex-1 rounded-full ${meta.lineClassName}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex">
                    {steps.map((step) => {
                      const meta = getStatusMeta(step.status)
                      return (
                        <div key={step.key} className="w-[180px] pr-5">
                          <div className={["text-base font-semibold", meta.titleClassName].join(" ")}>
                            {step.title}
                          </div>
                          {step.timeLabel && (
                            <div className="mt-1 font-mono text-xs font-medium text-white/35">{step.timeLabel}</div>
                          )}
                          <div className={["mt-2 text-sm leading-6", meta.descriptionClassName].join(" ")}>
                            {step.description}
                          </div>
                          {step.extra && <div className="mt-3">{step.extra}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:hidden">
                {steps.map((step, index) => {
                  const meta = getStatusMeta(step.status)
                  return (
                    <div key={step.key} className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                      <div className="flex flex-col items-center">
                        <StepDot status={step.status} stepNumber={index + 1} compact />
                        {index < steps.length - 1 && (
                          <div className={`mt-2 h-10 w-1 rounded-full ${meta.lineClassName}`} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className={["text-sm font-semibold", meta.titleClassName].join(" ")}>
                            {step.title}
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${meta.badgeClassName}`}>
                            {meta.text}
                          </span>
                        </div>
                        {step.timeLabel && <div className="mt-1 font-mono text-xs text-white/35">{step.timeLabel}</div>}
                        <div className={["mt-2 text-sm leading-6", meta.descriptionClassName].join(" ")}>
                          {step.description}
                        </div>
                        {step.extra && <div className="mt-3">{step.extra}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">最近流转</div>
                  {recentHistory.length > 0 ? (
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
                      >
                        <span>{historyOpen ? "收起" : `展开 ${recentHistory.length} 条`}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                  ) : null}
                </div>
                {recentHistory.length === 0 ? (
                  <p className="text-sm text-white/42">还没有可展示的状态变更记录。</p>
                ) : (
                  <CollapsibleContent className="space-y-2 pt-1">
                    {recentHistory.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3">
                        <div className="text-sm font-medium text-white">{getHistorySummary(item)}</div>
                        <div className="mt-1 font-mono text-xs text-white/35">{formatDate(item.createdAt)}</div>
                        {item.reason && <div className="mt-2 text-sm text-white/55">原因：{item.reason}</div>}
                        {item.exceptionCode && (
                          <div className="mt-2 text-sm text-red-300">
                            异常：{formatFranceExceptionLabel(item.exceptionCode)}
                          </div>
                        )}
                      </div>
                    ))}
                  </CollapsibleContent>
                )}
              </Collapsible>
            </div>

            <div className="hidden space-y-3">
              <div className="text-sm font-semibold text-gray-900">最近流转</div>
              {recentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">还没有可展示的状态变更记录。</p>
              ) : (
                <div className="space-y-2">
                  {recentHistory.map((item) => (
                    <div key={item.id} className="rounded-xl border border-gray-200 bg-white/90 px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{getHistorySummary(item)}</div>
                      <div className="mt-1 text-xs text-gray-500">{formatDate(item.createdAt)}</div>
                      {item.reason && <div className="mt-2 text-sm text-gray-600">原因：{item.reason}</div>}
                      {item.exceptionCode && (
                        <div className="mt-2 text-sm text-red-600">
                          异常：{formatFranceExceptionLabel(item.exceptionCode)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

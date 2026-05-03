"use client"

import { useEffect, useState } from "react"

import { FranceCaseProgressCard } from "@/components/france-case-progress-card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  formatFranceExceptionLabel,
  formatFranceMainStatusLabel,
  formatFranceStatusLabel,
  formatFranceSubStatusLabel,
} from "@/lib/france-case-labels"
import { FRANCE_EXCEPTION_CODES, FRANCE_MAIN_STATUSES, FRANCE_SUB_STATUSES } from "@/lib/france-case-machine"
import { formatUsaExceptionLabel, formatUsaMainStatusLabel, formatUsaStatusLabel, formatUsaSubStatusLabel } from "@/lib/usa-case-labels"
import { USA_EXCEPTION_CODES, USA_MAIN_STATUSES, USA_SUB_STATUSES } from "@/lib/usa-case-machine"
import { formatDateTime } from "@/app/applicants/[id]/detail/detail-ui"
import type { VisaCaseRecord } from "@/app/applicants/[id]/detail/types"

type ProgressCaseRecord = VisaCaseRecord

type CaseActivityState = {
  caseId: string
  loading: boolean
  error: string
  caseRecord: ProgressCaseRecord | null
}

type ManualStatusForm = {
  mainStatus: string
  subStatus: string
  exceptionCode: string
  reason: string
}

const NONE_VALUE = "__none__"
const progressLabelClass = "text-[10px] font-bold uppercase tracking-[0.18em] text-white/35"
const progressSelectTriggerClass = "min-h-12 border-white/10 bg-white/[0.055] text-white hover:border-emerald-300/30"

function getPriorityLabel(value?: string | null) {
  if (!value) return "-"
  if (value === "urgent") return "紧急"
  if (value === "high") return "高优先级"
  return "普通"
}

function formatCaseStatus(mainStatus?: string | null, subStatus?: string | null, caseType?: string | null) {
  if (caseType === "france-schengen") {
    return formatFranceStatusLabel(mainStatus, subStatus)
  }
  if (caseType === "usa-visa") {
    return formatUsaStatusLabel(mainStatus, subStatus)
  }
  return `${mainStatus || "-"}${subStatus ? ` / ${subStatus}` : ""}`
}

function getMainStatusOptions(caseType?: string | null, currentStatus?: string | null) {
  if (caseType === "france-schengen") return [...FRANCE_MAIN_STATUSES]
  if (caseType === "usa-visa") return [...USA_MAIN_STATUSES]
  return currentStatus ? [currentStatus] : []
}

function getSubStatusOptions(caseType?: string | null, currentStatus?: string | null) {
  if (caseType === "france-schengen") return [...FRANCE_SUB_STATUSES]
  if (caseType === "usa-visa") return [...USA_SUB_STATUSES]
  return currentStatus ? [currentStatus] : []
}

function getExceptionOptions(caseType?: string | null, currentCode?: string | null) {
  if (caseType === "france-schengen") return [...FRANCE_EXCEPTION_CODES]
  if (caseType === "usa-visa") return [...USA_EXCEPTION_CODES]
  return currentCode ? [currentCode] : []
}

function formatMainStatusOption(value: string, caseType?: string | null) {
  if (caseType === "france-schengen") return formatFranceMainStatusLabel(value)
  if (caseType === "usa-visa") return formatUsaMainStatusLabel(value)
  return value
}

function formatSubStatusOption(value: string, caseType?: string | null) {
  if (caseType === "france-schengen") return formatFranceSubStatusLabel(value)
  if (caseType === "usa-visa") return formatUsaSubStatusLabel(value)
  return value
}

function formatExceptionOption(value: string, caseType?: string | null) {
  if (caseType === "france-schengen") return formatFranceExceptionLabel(value)
  if (caseType === "usa-visa") return formatUsaExceptionLabel(value)
  return value
}

export function ProgressTab({
  applicantProfileId,
  applicantName,
  selectedCase,
  canEditApplicant,
  onCaseStatusUpdated,
}: {
  applicantProfileId: string
  applicantName: string
  selectedCase?: ProgressCaseRecord | null
  canEditApplicant: boolean
  onCaseStatusUpdated: (updatedCase: ProgressCaseRecord) => void
}) {
  const [activity, setActivity] = useState<CaseActivityState>({
    caseId: "",
    loading: false,
    error: "",
    caseRecord: null,
  })
  const [manualStatusForm, setManualStatusForm] = useState<ManualStatusForm>({
    mainStatus: "",
    subStatus: NONE_VALUE,
    exceptionCode: NONE_VALUE,
    reason: "",
  })
  const [savingManualStatus, setSavingManualStatus] = useState(false)
  const [manualStatusMessage, setManualStatusMessage] = useState("")
  const activeCase = activity.caseId === selectedCase?.id && activity.caseRecord ? activity.caseRecord : selectedCase
  const activityIsLoading = Boolean(activeCase && activity.caseId === activeCase.id && activity.loading)
  const activityError = activeCase && activity.caseId === activeCase.id ? activity.error : ""

  useEffect(() => {
    if (!selectedCase?.id) {
      setActivity({ caseId: "", loading: false, error: "", caseRecord: null })
      return
    }

    const hasActivity = selectedCase.statusHistory.length > 0 || selectedCase.reminderLogs.length > 0
    if (hasActivity) {
      setActivity({ caseId: selectedCase.id, loading: false, error: "", caseRecord: selectedCase })
      return
    }

    let cancelled = false
    setActivity({ caseId: selectedCase.id, loading: true, error: "", caseRecord: null })

    fetch(`/api/cases/${selectedCase.id}`, { credentials: "include" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { case?: ProgressCaseRecord; error?: string }
        if (!response.ok || !data.case) {
          throw new Error(data.error || "加载案件日志失败")
        }
        if (!cancelled) {
          setActivity({ caseId: selectedCase.id, loading: false, error: "", caseRecord: data.case })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setActivity({
            caseId: selectedCase.id,
            loading: false,
            error: error instanceof Error ? error.message : "加载案件日志失败",
            caseRecord: null,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedCase])

  useEffect(() => {
    if (!activeCase?.id) {
      setManualStatusForm({ mainStatus: "", subStatus: NONE_VALUE, exceptionCode: NONE_VALUE, reason: "" })
      return
    }

    setManualStatusForm({
      mainStatus: activeCase.mainStatus || "",
      subStatus: activeCase.subStatus || NONE_VALUE,
      exceptionCode: activeCase.exceptionCode || NONE_VALUE,
      reason: "",
    })
  }, [activeCase?.id, activeCase?.mainStatus, activeCase?.subStatus, activeCase?.exceptionCode])

  useEffect(() => {
    setManualStatusMessage("")
  }, [activeCase?.id])

  const saveManualStatus = async () => {
    if (!activeCase?.id) return
    if (!canEditApplicant) {
      setManualStatusMessage("当前角色为只读，不能人工调整进度")
      return
    }

    setSavingManualStatus(true)
    setManualStatusMessage("")
    try {
      const response = await fetch(`/api/cases/${activeCase.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mainStatus: manualStatusForm.mainStatus || activeCase.mainStatus,
          subStatus: manualStatusForm.subStatus === NONE_VALUE ? null : manualStatusForm.subStatus,
          exceptionCode: manualStatusForm.exceptionCode === NONE_VALUE ? null : manualStatusForm.exceptionCode,
          clearException: manualStatusForm.exceptionCode === NONE_VALUE,
          reason: manualStatusForm.reason.trim() || "人工调整进度",
          allowRegression: true,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { case?: ProgressCaseRecord; error?: string }
      if (!response.ok || !data.case) {
        throw new Error(data.error || "人工调整进度失败")
      }

      setActivity({ caseId: data.case.id, loading: false, error: "", caseRecord: data.case })
      onCaseStatusUpdated(data.case)
      setManualStatusForm({
        mainStatus: data.case.mainStatus || "",
        subStatus: data.case.subStatus || NONE_VALUE,
        exceptionCode: data.case.exceptionCode || NONE_VALUE,
        reason: "",
      })
      setManualStatusMessage("进度已人工更新，并已写入状态日志")
    } catch (error) {
      setManualStatusMessage(error instanceof Error ? error.message : "人工调整进度失败")
    } finally {
      setSavingManualStatus(false)
    }
  }

  const mainStatusOptions = getMainStatusOptions(activeCase?.caseType, activeCase?.mainStatus)
  const subStatusOptions = getSubStatusOptions(activeCase?.caseType, activeCase?.subStatus)
  const exceptionOptions = getExceptionOptions(activeCase?.caseType, activeCase?.exceptionCode)

  return (
    <TabsContent value="progress" className="space-y-6">
      {activeCase ? (
        <>
          <section
            data-progress-panel="manual-status"
            className="overflow-hidden rounded-[32px] border border-white/[0.06] bg-[#151518] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_34%),linear-gradient(180deg,#151518,#101012)] shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
          >
            <div className="border-b border-white/[0.06] p-6 md:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Manual Progress Override</p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">人工调整进度</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                    实际业务进度和自动化程序不一致时，可在这里手动校正；保存后会写入状态日志。
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4 py-3 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/70">Current Status</div>
                  <div className="mt-1 text-sm font-bold text-white">
                    {formatCaseStatus(activeCase.mainStatus, activeCase.subStatus, activeCase.caseType)}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 md:p-7">
              <div className="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_280px]">
                <div className="space-y-2">
                  <div className={progressLabelClass}>主状态</div>
                  <Select
                    value={manualStatusForm.mainStatus}
                    onValueChange={(value) => setManualStatusForm((prev) => ({ ...prev, mainStatus: value }))}
                    disabled={!canEditApplicant || savingManualStatus}
                  >
                    <SelectTrigger className={progressSelectTriggerClass}>
                      <SelectValue placeholder="选择主状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {mainStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {formatMainStatusOption(status, activeCase.caseType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className={progressLabelClass}>子状态</div>
                  <Select
                    value={manualStatusForm.subStatus}
                    onValueChange={(value) => setManualStatusForm((prev) => ({ ...prev, subStatus: value }))}
                    disabled={!canEditApplicant || savingManualStatus}
                  >
                    <SelectTrigger className={progressSelectTriggerClass}>
                      <SelectValue placeholder="选择子状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>不设置子状态</SelectItem>
                      {subStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {formatSubStatusOption(status, activeCase.caseType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className={progressLabelClass}>异常状态</div>
                  <Select
                    value={manualStatusForm.exceptionCode}
                    onValueChange={(value) => setManualStatusForm((prev) => ({ ...prev, exceptionCode: value }))}
                    disabled={!canEditApplicant || savingManualStatus}
                  >
                    <SelectTrigger className={progressSelectTriggerClass}>
                      <SelectValue placeholder="选择异常状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>清除异常</SelectItem>
                      {exceptionOptions.map((code) => (
                        <SelectItem key={code} value={code}>
                          {formatExceptionOption(code, activeCase.caseType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-[24px] border border-cyan-300/10 bg-cyan-300/[0.06] p-4 text-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/60">页面显示</div>
                  <div className="mt-2 font-bold text-cyan-50">
                    {formatCaseStatus(activeCase.mainStatus, activeCase.subStatus, activeCase.caseType)}
                  </div>
                  <div className="mt-1 text-xs text-cyan-50/45">最近更新：{formatDateTime(activeCase.updatedAt)}</div>
                </div>
              </div>

              <Textarea
                value={manualStatusForm.reason}
                onChange={(event) => setManualStatusForm((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="备注原因，例如：客户已线下付款 / TLS 已由人工处理完成 / 实际已提交给外包商"
                disabled={!canEditApplicant || savingManualStatus}
                className="min-h-[104px] border-white/10 bg-white/[0.045] text-white placeholder:text-white/25 focus-visible:ring-emerald-500/15"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-white/42">
                  {canEditApplicant ? "允许手动前进或回退，程序日志不会被改写。" : "当前角色为只读，只能查看进度。"}
                </div>
                <Button
                  onClick={() => void saveManualStatus()}
                  disabled={!canEditApplicant || savingManualStatus}
                  className="rounded-2xl bg-white text-black shadow-lg shadow-white/10 hover:bg-white/90"
                >
                  {savingManualStatus ? "保存中..." : "保存人工进度"}
                </Button>
              </div>

              {manualStatusMessage ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {manualStatusMessage}
                </div>
              ) : null}
            </div>
          </section>

          {activeCase.caseType === "france-schengen" ? (
            <div className="rounded-[32px] border border-emerald-400/15 bg-[#101714] p-2 shadow-2xl shadow-emerald-950/20">
              <FranceCaseProgressCard
                applicantProfileId={applicantProfileId}
                applicantName={applicantName}
                caseId={activeCase.id}
                caseOverride={activeCase}
                historyOverride={activeCase.statusHistory}
              />
            </div>
          ) : (
            <NonFranceProgressPanel activeCase={activeCase} />
          )}

          <StatusHistoryPanel
            activeCase={activeCase}
            activityIsLoading={activityIsLoading}
            activityError={activityError}
          />
        </>
      ) : (
        <EmptyProgressPanel />
      )}
    </TabsContent>
  )
}

function NonFranceProgressPanel({ activeCase }: { activeCase: ProgressCaseRecord }) {
  return (
    <section className="rounded-[32px] border border-white/[0.06] bg-[#151518] p-6 shadow-2xl shadow-black/25">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Case Progress</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-white">当前案件进度</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <ProgressMeta label="状态" value={formatCaseStatus(activeCase.mainStatus, activeCase.subStatus, activeCase.caseType)} />
        <ProgressMeta label="异常" value={activeCase.exceptionCode || "-"} />
        <ProgressMeta label="优先级" value={getPriorityLabel(activeCase.priority)} />
        <ProgressMeta label="最近更新" value={formatDateTime(activeCase.updatedAt)} />
      </div>
    </section>
  )
}

function StatusHistoryPanel({
  activeCase,
  activityIsLoading,
  activityError,
}: {
  activeCase: ProgressCaseRecord
  activityIsLoading: boolean
  activityError: string
}) {
  return (
    <section className="rounded-[32px] border border-white/[0.06] bg-[#111214] p-6 shadow-2xl shadow-black/25">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Status History</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-white">状态日志</h2>
      <p className="mt-2 text-sm leading-6 text-white/45">进入本页签时才读取 VisaCaseStatusHistory，避免拖慢申请人详情首屏。</p>

      <div className="mt-6">
        {activityIsLoading ? (
          <div className="rounded-2xl border border-dashed border-emerald-400/25 bg-emerald-400/[0.08] p-4 text-sm text-emerald-100/80">正在加载案件日志...</div>
        ) : activityError ? (
          <div className="rounded-2xl border border-dashed border-red-400/25 bg-red-400/[0.08] p-4 text-sm text-red-100/85">{activityError}</div>
        ) : activeCase.statusHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-4 text-sm text-white/45">当前案件还没有状态日志。</div>
        ) : (
          <div className="space-y-3">
            {activeCase.statusHistory.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-mono text-sm font-bold uppercase tracking-wide text-emerald-100">
                    {item.toMainStatus}
                    {item.toSubStatus ? ` / ${item.toSubStatus}` : ""}
                  </div>
                  <div className="font-mono text-xs text-white/45">{formatDateTime(item.createdAt)}</div>
                </div>
                {item.reason ? <div className="mt-2 text-sm text-white/65">原因：{item.reason}</div> : null}
                {item.exceptionCode ? <div className="mt-2 text-sm text-red-300">异常：{item.exceptionCode}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyProgressPanel() {
  return (
    <section className="rounded-[32px] border border-white/[0.06] bg-[#151518] p-8 text-white shadow-2xl shadow-black/25">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Progress Console</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight">进度与日志</h2>
      <div className="mt-6 rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-6 text-sm text-white/45">
        先在 Case 标签页中创建或选择一个案件。
      </div>
    </section>
  )
}

function ProgressMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</div>
      <div className="mt-2 min-h-5 break-words text-sm font-bold text-white">{value}</div>
    </div>
  )
}

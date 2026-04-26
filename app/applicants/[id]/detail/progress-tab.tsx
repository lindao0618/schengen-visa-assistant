"use client"

import { useEffect, useState } from "react"

import { FranceCaseProgressCard } from "@/components/france-case-progress-card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"
import { formatFranceStatusLabel } from "@/lib/france-case-labels"
import { formatDateTime, ReadOnlyField, Section } from "@/app/applicants/[id]/detail/detail-ui"

type ReminderLogRecord = {
  id: string
  ruleCode: string
  channel: string
  automationMode: string
  sendStatus: string
  renderedContent?: string | null
  errorMessage?: string | null
  triggeredAt: string
}

type StatusHistoryRecord = {
  id: string
  toMainStatus: string
  toSubStatus?: string | null
  exceptionCode?: string | null
  reason?: string | null
  createdAt: string
}

type ProgressCaseRecord = {
  id: string
  caseType: string
  mainStatus: string
  subStatus?: string | null
  exceptionCode?: string | null
  priority: string
  updatedAt: string
  statusHistory: StatusHistoryRecord[]
  reminderLogs: ReminderLogRecord[]
}

type CaseActivityState = {
  caseId: string
  loading: boolean
  error: string
  caseRecord: ProgressCaseRecord | null
}

function getPriorityLabel(value?: string | null) {
  if (!value) return "-"
  if (value === "urgent") return "紧急"
  if (value === "high") return "高优先级"
  return "普通"
}

function getSendStatusBadge(status?: string | null) {
  if (status === "sent") return "success" as const
  if (status === "failed") return "destructive" as const
  if (status === "processing") return "info" as const
  return "outline" as const
}

function formatCaseStatus(mainStatus?: string | null, subStatus?: string | null, caseType?: string | null) {
  if (caseType === "france-schengen") {
    return formatFranceStatusLabel(mainStatus, subStatus)
  }
  return `${mainStatus || "-"}${subStatus ? ` / ${subStatus}` : ""}`
}

export function ProgressTab({
  applicantProfileId,
  applicantName,
  selectedCase,
}: {
  applicantProfileId: string
  applicantName: string
  selectedCase?: ProgressCaseRecord | null
}) {
  const [activity, setActivity] = useState<CaseActivityState>({
    caseId: "",
    loading: false,
    error: "",
    caseRecord: null,
  })
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

  return (
    <TabsContent value="progress" className="space-y-6">
      {activeCase ? (
        <>
          {activeCase.caseType === "france-schengen" ? (
            <div className="rounded-3xl border border-emerald-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(236,253,245,0.92))] p-2 shadow-sm">
              <FranceCaseProgressCard applicantProfileId={applicantProfileId} applicantName={applicantName} caseId={activeCase.id} />
            </div>
          ) : (
            <Section title="当前案件进度" description="当前选中的是非 France Case，这里先展示基础案件信息。" tone="emerald">
              <div className="grid gap-4 md:grid-cols-4">
                <ReadOnlyField label="状态" value={formatCaseStatus(activeCase.mainStatus, activeCase.subStatus, activeCase.caseType)} />
                <ReadOnlyField label="异常" value={activeCase.exceptionCode || "-"} />
                <ReadOnlyField label="优先级" value={getPriorityLabel(activeCase.priority)} />
                <ReadOnlyField label="最近更新" value={formatDateTime(activeCase.updatedAt)} />
              </div>
            </Section>
          )}

          <Section title="状态日志" description="进入本页签时才读取 VisaCaseStatusHistory，避免拖慢申请人详情首屏。" tone="emerald">
            {activityIsLoading ? (
              <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-4 text-sm text-emerald-800">正在加载案件日志...</div>
            ) : activityError ? (
              <div className="rounded-2xl border border-dashed border-red-300 bg-red-50/70 p-4 text-sm text-red-700">{activityError}</div>
            ) : activeCase.statusHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-4 text-sm text-emerald-800">当前案件还没有状态日志。</div>
            ) : (
              <div className="space-y-3">
                {activeCase.statusHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-sm">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-semibold text-emerald-950">
                        {item.toMainStatus}
                        {item.toSubStatus ? ` / ${item.toSubStatus}` : ""}
                      </div>
                      <div className="text-xs text-emerald-800/70">{formatDateTime(item.createdAt)}</div>
                    </div>
                    {item.reason ? <div className="mt-2 text-sm text-slate-700">原因：{item.reason}</div> : null}
                    {item.exceptionCode ? <div className="mt-2 text-sm text-red-600">异常：{item.exceptionCode}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Reminder 日志" description="进入本页签时才读取 ReminderLog，当前仍是模拟发送。" tone="slate">
            {activityIsLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">正在加载 Reminder 日志...</div>
            ) : activityError ? (
              <div className="rounded-2xl border border-dashed border-red-300 bg-red-50/70 p-4 text-sm text-red-700">{activityError}</div>
            ) : activeCase.reminderLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">当前案件还没有 Reminder 日志。</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50/90">
                    <TableRow>
                      <TableHead>触发时间</TableHead>
                      <TableHead>规则</TableHead>
                      <TableHead>渠道</TableHead>
                      <TableHead>方式</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>摘要</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCase.reminderLogs.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDateTime(item.triggeredAt)}</TableCell>
                        <TableCell>{item.ruleCode}</TableCell>
                        <TableCell>{item.channel}</TableCell>
                        <TableCell>{item.automationMode}</TableCell>
                        <TableCell>
                          <Badge variant={getSendStatusBadge(item.sendStatus)}>{item.sendStatus}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate text-sm text-slate-500">{item.renderedContent || item.errorMessage || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </>
      ) : (
        <Section title="进度与日志" description="先在 Case 标签页中创建或选择一个案件。" tone="emerald">
          <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-6 text-sm text-emerald-800">
            当前还没有可展示的案件进度。
          </div>
        </Section>
      )}
    </TabsContent>
  )
}

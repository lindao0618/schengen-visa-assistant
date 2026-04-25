"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, CheckCircle2, XCircle, Clock, ListTodo, RefreshCw, Search, Download, ExternalLink } from "lucide-react"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { usePageVisibility } from "@/hooks/use-page-visibility"
import { useTaskStatusReminder } from "@/hooks/use-task-status-reminder"
import { getAdaptivePollInterval } from "@/lib/polling"

export interface FranceVisaTask {
  task_id: string
  type: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  message: string
  created_at: number
  updated_at?: number
  result?: Record<string, unknown>
  error?: string
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
  caseLabel?: string
}

function getTaskFilename(task: FranceVisaTask): string {
  const r = task.result
  if (!r) {
    const bracket = task.message.match(/\[([^\]]+)\]/)
    if (bracket) return bracket[1]
    return task.task_id.slice(-12)
  }
  const msg = (r.message as string) || ""
  const bracket = msg.match(/\[([^\]]+)\]/)
  if (bracket) return bracket[1]
  const dot = task.message.match(/·\s*([^\s]+(?:\.\w+)?)\s*$/)
  if (dot) return dot[1]
  return task.task_id.slice(-12)
}

function formatTimestamp(ts?: number) {
  if (!ts) return "-"
  const d = new Date(ts)
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusRank(status: FranceVisaTask["status"]) {
  return status === "running" || status === "pending" ? 0 : 1
}

const TYPE_LABELS: Record<string, string> = {
  "extract-register": "FV账号注册",
  extract: "提取注册信息",
  register: "账号注册",
  "create-application": "生成新申请",
  "fill-receipt": "填写回执单",
  "submit-final": "提交最终表",
  "tls-register": "TLS 账户注册",
  "tls-apply": "TLS 提交申请",
}

function FranceTaskDetailBody({ task }: { task: FranceVisaTask }) {
  return (
    <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
      {task.caseLabel && <p>所属案件: {task.caseLabel}</p>}
      <p>任务ID: {task.task_id}</p>
      <p>任务类型: {TYPE_LABELS[task.type] || task.type}</p>
      <p>状态: {task.status}</p>
      {task.applicantName && <p>申请人: {task.applicantName}</p>}
      <p>创建时间: {formatTimestamp(task.created_at)}</p>
      <p>最近更新时间: {formatTimestamp(task.updated_at || task.created_at)}</p>
      {task.error && <p className="text-red-600 dark:text-red-400">错误: {task.error}</p>}
      <div className="rounded border bg-gray-50 dark:bg-gray-900/50 p-2">
        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(task.result ?? {}, null, 2)}</pre>
      </div>
    </div>
  )
}

interface FranceTaskListProps {
  filterTaskTypes?: string[]
  title?: string
  pollInterval?: number
  autoRefresh?: boolean
}

export function FranceTaskList({
  filterTaskTypes,
  title = "法签任务列表",
  pollInterval = 2000,
  autoRefresh = true,
}: FranceTaskListProps) {
  const [tasks, setTasks] = useState<FranceVisaTask[]>([])
  const [loading, setLoading] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "failed" | "running">("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [onlyCurrentApplicant, setOnlyCurrentApplicant] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const activeApplicant = useActiveApplicantProfile()
  const isPageVisible = usePageVisibility()
  const inFlightRef = useRef(false)
  const filterTaskTypesKey = useMemo(() => (filterTaskTypes ?? []).join(","), [filterTaskTypes])

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (showLoading) setLoading(true)
    setNeedsLogin(false)
    try {
      const params = new URLSearchParams({ limit: "50", t: String(Date.now()) })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (onlyCurrentApplicant && activeApplicant?.id) {
        params.set("applicantProfileId", activeApplicant.id)
        if (activeApplicant.activeCaseId) params.set("caseId", activeApplicant.activeCaseId)
      }
      const res = await fetch("/api/schengen/france/tasks-list?" + params.toString(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
      if (res.status === 401) {
        setNeedsLogin(true)
        setTasks([])
        return
      }
      const data = await res.json()
      let list: FranceVisaTask[] = data.tasks || []
      const normalizedTaskTypes = filterTaskTypesKey ? filterTaskTypesKey.split(",").filter(Boolean) : []
      if (normalizedTaskTypes.length > 0) {
        const typeSet = new Set(normalizedTaskTypes)
        list = list.filter((t) => typeSet.has(t.type))
      }
      setTasks(list)
    } catch (e) {
      console.error("Fetch France tasks failed:", e)
    } finally {
      inFlightRef.current = false
      if (showLoading) setLoading(false)
    }
  }, [filterTaskTypesKey, statusFilter, onlyCurrentApplicant, activeApplicant])

  const interval = getAdaptivePollInterval(
    pollInterval,
    tasks.some((task) => task.status === "running" || task.status === "pending"),
  )

  const displayedTasks = useMemo(() => {
    let list = tasks
    if (statusFilter !== "all") {
      list = list.filter((t) => {
        if (statusFilter === "completed") return t.status === "completed"
        if (statusFilter === "failed") return t.status === "failed"
        if (statusFilter === "running") return t.status === "running" || t.status === "pending"
        return true
      })
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase()
      list = list.filter((t) => {
        const filename = getTaskFilename(t).toLowerCase()
        const msg = (t.message || "").toLowerCase()
        const tid = (t.task_id || "").toLowerCase()
        return filename.includes(kw) || msg.includes(kw) || tid.includes(kw)
      })
    }
    const sorted = [...list].sort((a, b) => {
      const rankDiff = statusRank(a.status) - statusRank(b.status)
      if (rankDiff !== 0) return rankDiff
      const timeA = a.updated_at ?? a.created_at ?? 0
      const timeB = b.updated_at ?? b.created_at ?? 0
      return timeB - timeA
    })
    return sorted
  }, [tasks, statusFilter, searchKeyword])

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.task_id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  )

  useTaskStatusReminder(tasks, {
    getSuccessTitle: (task) => `${TYPE_LABELS[task.type] || task.type}已完成`,
    getFailureTitle: (task) => `${TYPE_LABELS[task.type] || task.type}失败`,
    getDescription: (task) =>
      [task.applicantName ? `申请人：${task.applicantName}` : "", getTaskFilename(task)]
        .filter(Boolean)
        .join(" · "),
  })

  useEffect(() => {
    void fetchTasks(tasks.length === 0)
    if (!autoRefresh || !isPageVisible) return
    const id = window.setInterval(() => {
      void fetchTasks(false)
    }, interval)
    return () => window.clearInterval(id)
  }, [fetchTasks, interval, autoRefresh, isPageVisible, tasks.length])

  return (
    <Card className="border-[#e5e5ea] dark:border-gray-800">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => void fetchTasks()} disabled={loading} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件名、任务ID..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-full sm:w-[120px] h-9">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
              <SelectItem value="running">进行中</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {activeApplicant?.id && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              id="fr-only-current-applicant"
              type="checkbox"
              checked={onlyCurrentApplicant}
              onChange={(e) => setOnlyCurrentApplicant(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="fr-only-current-applicant" className="cursor-pointer">
              只看当前申请人：{activeApplicant.name || activeApplicant.label}
            </label>
          </div>
        )}
        {activeApplicant?.id && activeApplicant.activeCaseId && onlyCurrentApplicant && (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            当前已按所选案件过滤任务列表。
          </p>
        )}
        {(tasks.length === 0 || displayedTasks.length === 0) && (
          <div className="py-4 text-center">
            {needsLogin ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">登录后查看您的任务列表</p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/login?callbackUrl=/schengen-visa/france/automation">登录</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/signup">注册</Link>
                  </Button>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">暂无任务</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">无匹配结果</p>
            )}
          </div>
        )}
        <ScrollArea className="h-[220px] pr-4">
          <div className="space-y-3">
            {displayedTasks.map((task) => (
              <div
                key={task.task_id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {TYPE_LABELS[task.type] || task.type}
                    {" · "}
                    {getTaskFilename(task)}
                  </span>
                  <StatusBadge status={task.status} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{task.message}</p>
                {task.applicantName && (
                  <p className="text-xs text-blue-600 dark:text-blue-300">申请人: {task.applicantName}</p>
                )}
                {task.caseLabel && (
                  <p className="text-xs text-violet-600 dark:text-violet-300">所属案件: {task.caseLabel}</p>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                  <span>创建时间: {formatTimestamp(task.created_at)}</span>
                  <span>最近更新时间: {formatTimestamp(task.updated_at || task.created_at)}</span>
                </div>
                <div className="space-y-1">
                  <Progress
                    value={task.status === "completed" ? 100 : task.progress || 0}
                    className="h-2"
                  />
                  {(task.status === "running" || task.status === "pending") && (
                    <p className="text-xs text-gray-400">进度: {task.progress || 0}%</p>
                  )}
                </div>
                {task.status === "failed" && task.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">{task.error}</p>
                )}
                {task.result && (
                  <FranceResultSummary taskType={task.type} result={task.result} />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setDetailTaskId(task.task_id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    查看详情
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <Dialog open={detailTaskId !== null} onOpenChange={(open) => !open && setDetailTaskId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>任务详情</DialogTitle>
            </DialogHeader>
            {detailTask ? (
              <FranceTaskDetailBody task={detailTask} />
            ) : (
              <p className="text-sm text-muted-foreground">任务已不在当前列表中，请关闭后刷新重试。</p>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    pending: { icon: <Clock className="h-3 w-3" />, label: "等待中", variant: "secondary" },
    running: { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "进行中", variant: "default" },
    completed: { icon: <CheckCircle2 className="h-3 w-3" />, label: "完成", variant: "default" },
    failed: { icon: <XCircle className="h-3 w-3" />, label: "失败", variant: "destructive" },
  }
  const c = config[status] || { icon: null, label: status, variant: "outline" as const }
  return (
    <Badge variant={c.variant} className="gap-1 text-xs">
      {c.icon}
      {c.label}
    </Badge>
  )
}

function FranceResultSummary({ taskType, result }: { taskType: string; result: Record<string, unknown> }) {
  const download_excel = result.download_excel as string | undefined
  const rawDownloadJson = result.download_json as string | undefined
  const download_json = ["extract", "create-application"].includes(taskType)
    ? rawDownloadJson
    : undefined
  const download_pdf = result.download_pdf as string | undefined
  const download_log = result.download_log as string | undefined
  const download_artifacts = Array.isArray(result.download_artifacts)
    ? (result.download_artifacts as Array<Record<string, unknown>>).filter(
        (item) => typeof item?.url === "string" && typeof item?.label === "string",
      )
        .filter((item) => item.url !== download_log)
    : []
  const msg = result.message as string | undefined
  const success = result.success as boolean | undefined
  const resultItems = Array.isArray(result.results) ? (result.results as Array<Record<string, unknown>>) : []
  const itemSummaries = resultItems
    .map((item) => {
      const email = typeof item.email === "string" ? item.email.trim() : ""
      const status = typeof item.status === "string" ? item.status.trim() : ""
      const itemMessage =
        (typeof item.error === "string" && item.error.trim()) ||
        (typeof item.message === "string" && item.message.trim()) ||
        ""
      if (!email && !itemMessage) return null
      if (status === "success") {
        return {
          tone: "success" as const,
          text: email ? `${email} 注册成功` : itemMessage || "注册成功",
        }
      }
      return {
        tone: "error" as const,
        text: email ? `${email} 注册失败：${itemMessage || "未知原因"}` : itemMessage || "注册失败",
      }
    })
    .filter((item): item is { tone: "success" | "error"; text: string } => Boolean(item))
  const shouldShowMsg = Boolean(msg) && itemSummaries.length === 0

  if (!success && !download_excel && !download_json && !download_pdf && !download_log && download_artifacts.length === 0) {
    return null
  }

  return (
    <div className="text-xs space-y-2">
      {shouldShowMsg && (
        <p className={success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {msg}
        </p>
      )}
      {itemSummaries.length > 0 && (
        <div className="space-y-1">
          {itemSummaries.map((item, index) => (
            <p
              key={`${item.text}-${index}`}
              className={item.tone === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
            >
              {item.text}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {download_excel && (
          <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href={download_excel} download target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              下载 Excel
            </a>
          </Button>
        )}
        {download_json && (
          <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href={download_json} download target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              下载 JSON
            </a>
          </Button>
        )}
        {download_pdf && (
          <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href={download_pdf} download target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              下载 PDF
            </a>
          </Button>
        )}
        {download_log && (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href={download_log} download target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              下载日志
            </a>
          </Button>
        )}
        {download_artifacts.map((item) => {
          const url = item.url as string
          const label = item.label as string
          return (
            <Button key={`${label}-${url}`} variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
              <a href={url} download target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                {label}
              </a>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

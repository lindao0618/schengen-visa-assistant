"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, ExternalLink, ListTodo, Loader2, RefreshCw, Search, Trash2, XCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { usePageVisibility } from "@/hooks/use-page-visibility"
import { useTaskStatusReminder } from "@/hooks/use-task-status-reminder"
import { getAdaptivePollInterval } from "@/lib/polling"

const MaterialResultSummary = dynamic(
  () => import("@/components/material-task-result-summary").then((mod) => mod.MaterialResultSummary),
  {
    ssr: false,
    loading: () => <div className="h-8 animate-pulse rounded border bg-gray-50 dark:bg-gray-900/50" />,
  },
)

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

function statusRank(status: MaterialTask["status"]) {
  return status === "running" || status === "pending" ? 0 : 1
}

export interface MaterialTask {
  task_id: string
  type: string
  status: "pending" | "running" | "completed" | "failed"
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

function getTaskDisplayName(task: MaterialTask): string {
  const dot = task.message.match(/·\s*(.+)$/)
  if (dot) return dot[1]
  return task.task_id.slice(-12)
}

const TYPE_LABELS: Record<string, string> = {
  itinerary: "行程单",
  "explanation-letter": "解释信",
  "material-review": "材料审核",
}

function MaterialTaskDetailBody({ task }: { task: MaterialTask }) {
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
      <div className="rounded border bg-gray-50 p-2 dark:bg-gray-900/50">
        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(task.result ?? {}, null, 2)}</pre>
      </div>
    </div>
  )
}

interface MaterialTaskListProps {
  taskIds: string[]
  filterTaskTypes?: ("itinerary" | "explanation-letter" | "material-review")[]
  title?: string
  pollInterval?: number
  autoRefresh?: boolean
}

export function MaterialTaskList({
  taskIds,
  filterTaskTypes,
  title = "任务列表",
  pollInterval = 2000,
  autoRefresh = true,
}: MaterialTaskListProps) {
  const [tasks, setTasks] = useState<MaterialTask[]>([])
  const [loading, setLoading] = useState(false)
  const [clearingFailed, setClearingFailed] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "failed" | "running">("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [onlyCurrentApplicant, setOnlyCurrentApplicant] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const activeApplicant = useActiveApplicantProfile()
  const isPageVisible = usePageVisibility()
  const inFlightRef = useRef(false)
  const taskIdsKey = useMemo(() => taskIds.join(","), [taskIds])
  const filterTaskTypesKey = useMemo(() => (filterTaskTypes ?? []).join(","), [filterTaskTypes])

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (!taskIdsKey) {
      setTasks([])
      return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (showLoading) setLoading(true)
    try {
      const params = new URLSearchParams({
        task_ids: taskIdsKey,
        t: String(Date.now()),
      })
      const normalizedTaskTypes = filterTaskTypesKey ? filterTaskTypesKey.split(",").filter(Boolean) : []
      if (normalizedTaskTypes.length) params.set("type", normalizedTaskTypes[0])
      const res = await fetch("/api/material-tasks?" + params.toString(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
      const data = await res.json()
      let list: MaterialTask[] = data.tasks || []
      if (normalizedTaskTypes.length > 0) {
        const typeSet = new Set(normalizedTaskTypes)
        list = list.filter((task) =>
          typeSet.has(task.type as "itinerary" | "explanation-letter" | "material-review")
        )
      }
      setTasks(list)
    } catch (error) {
      console.error("Fetch material tasks failed:", error)
    } finally {
      inFlightRef.current = false
      if (showLoading) setLoading(false)
    }
  }, [filterTaskTypesKey, taskIdsKey])

  const interval = getAdaptivePollInterval(
    pollInterval,
    tasks.some((task) => task.status === "running" || task.status === "pending"),
  )

  const displayedTasks = useMemo(() => {
    let list = tasks
    if (onlyCurrentApplicant && activeApplicant?.id) {
      list = list.filter((task) => {
        if (activeApplicant.activeCaseId) return task.caseId === activeApplicant.activeCaseId
        return task.applicantProfileId === activeApplicant.id
      })
    }
    if (statusFilter !== "all") {
      list = list.filter((task) => {
        if (statusFilter === "completed") return task.status === "completed"
        if (statusFilter === "failed") return task.status === "failed"
        if (statusFilter === "running") return task.status === "running" || task.status === "pending"
        return true
      })
    }
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase()
      list = list.filter((task) => {
        const name = getTaskDisplayName(task).toLowerCase()
        const message = (task.message || "").toLowerCase()
        const taskId = (task.task_id || "").toLowerCase()
        return name.includes(keyword) || message.includes(keyword) || taskId.includes(keyword)
      })
    }
    return [...list].sort((a, b) => {
      const rankDiff = statusRank(a.status) - statusRank(b.status)
      if (rankDiff !== 0) return rankDiff
      const timeA = a.updated_at ?? a.created_at ?? 0
      const timeB = b.updated_at ?? b.created_at ?? 0
      return timeB - timeA
    })
  }, [tasks, statusFilter, searchKeyword, onlyCurrentApplicant, activeApplicant])

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((task) => task.task_id === detailTaskId) ?? null : null),
    [detailTaskId, tasks],
  )

  const failedTaskIds = useMemo(
    () => tasks.filter((task) => task.status === "failed").map((task) => task.task_id),
    [tasks],
  )

  useTaskStatusReminder(tasks, {
    getSuccessTitle: (task) => `${TYPE_LABELS[task.type] || task.type}已完成`,
    getFailureTitle: (task) => `${TYPE_LABELS[task.type] || task.type}失败`,
    getDescription: (task) =>
      [task.applicantName ? `申请人：${task.applicantName}` : "", getTaskDisplayName(task)]
        .filter(Boolean)
        .join(" · "),
  })

  const clearFailedTasks = useCallback(async () => {
    if (!failedTaskIds.length || clearingFailed) return
    if (!window.confirm(`确认清理 ${failedTaskIds.length} 条失败任务吗？`)) return

    setClearingFailed(true)
    try {
      const res = await fetch("/api/material-tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: failedTaskIds }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || "清理失败任务失败")
      }

      setTasks((prev) => prev.filter((task) => task.status !== "failed"))
      await fetchTasks()
    } catch (error) {
      console.error("Clear failed material tasks failed:", error)
      window.alert(error instanceof Error ? error.message : "清理失败任务失败")
    } finally {
      setClearingFailed(false)
    }
  }, [clearingFailed, failedTaskIds, fetchTasks])

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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-5 w-5" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {failedTaskIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFailedTasks}
              disabled={clearingFailed}
              className="gap-1"
            >
              <Trash2 className={`h-4 w-4 ${clearingFailed ? "animate-pulse" : ""}`} />
              {clearingFailed ? "清理中" : `清理失败任务 (${failedTaskIds.length})`}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void fetchTasks()} disabled={loading} className="gap-1">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索任务..."
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-[120px]">
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
              id="material-only-current-applicant"
              type="checkbox"
              checked={onlyCurrentApplicant}
              onChange={(event) => setOnlyCurrentApplicant(event.target.checked)}
              className="rounded"
            />
            <label htmlFor="material-only-current-applicant" className="cursor-pointer">
              {activeApplicant.activeCaseId
                ? `只看当前申请人所选案件：${activeApplicant.name || activeApplicant.label}`
                : `只看当前申请人：${activeApplicant.name || activeApplicant.label}`}
            </label>
          </div>
        )}
        {(tasks.length === 0 || displayedTasks.length === 0) && (
          <div className="py-4 text-center">
            {taskIds.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">暂无任务，提交后将在此显示进度</p>
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
                className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {task.type === "material-review"
                      ? task.message || `${TYPE_LABELS[task.type] || task.type} · ${getTaskDisplayName(task)}`
                      : `${TYPE_LABELS[task.type] || task.type} · ${getTaskDisplayName(task)}`}
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
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
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
                {task.status === "completed" && task.result && (
                  <MaterialResultSummary result={task.result} taskType={task.type} />
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
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>任务详情</DialogTitle>
            </DialogHeader>
            {detailTask ? (
              <MaterialTaskDetailBody task={detailTask} />
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
  const badge = config[status] || { icon: null, label: status, variant: "outline" as const }
  return (
    <Badge variant={badge.variant} className="gap-1 text-xs">
      {badge.icon}
      {badge.label}
    </Badge>
  )
}

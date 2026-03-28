"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, Clock, ListTodo, RefreshCw, Search, Download, Maximize2, ExternalLink, Trash2, Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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
  const taskIdsKey = useMemo(() => taskIds.join(","), [taskIds])
  const filterTaskTypesKey = useMemo(() => (filterTaskTypes ?? []).join(","), [filterTaskTypes])

  const fetchTasks = useCallback(async () => {
    if (!taskIdsKey) {
      setTasks([])
      return
    }
    setLoading(true)
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
        list = list.filter((t) =>
          typeSet.has(t.type as "itinerary" | "explanation-letter" | "material-review")
        )
      }
      setTasks(list)
    } catch (e) {
      console.error("Fetch material tasks failed:", e)
    } finally {
      setLoading(false)
    }
  }, [filterTaskTypesKey, taskIdsKey])

  const interval = tasks.some((t) => t.status === "running") ? 500 : pollInterval

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
        const name = getTaskDisplayName(t).toLowerCase()
        const msg = (t.message || "").toLowerCase()
        const tid = (t.task_id || "").toLowerCase()
        return name.includes(kw) || msg.includes(kw) || tid.includes(kw)
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

  const failedTaskIds = useMemo(
    () => tasks.filter((task) => task.status === "failed").map((task) => task.task_id),
    [tasks]
  )

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
    fetchTasks()
    if (!autoRefresh) return
    const id = setInterval(fetchTasks, interval)
    return () => clearInterval(id)
  }, [fetchTasks, interval, autoRefresh])

  return (
    <Card className="border-[#e5e5ea] dark:border-gray-800">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
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
        <Button variant="ghost" size="sm" onClick={fetchTasks} disabled={loading} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索任务..."
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
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
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
                {task.status === "completed" && task.result && (
                  <MaterialResultSummary result={task.result} taskType={task.type} />
                )}
                <div className="flex flex-wrap gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                        <ExternalLink className="h-3.5 w-3.5" />
                        查看详情
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>任务详情</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                        <p>任务ID: {task.task_id}</p>
                        <p>任务类型: {TYPE_LABELS[task.type] || task.type}</p>
                        <p>状态: {task.status}</p>
                        <p>创建时间: {formatTimestamp(task.created_at)}</p>
                        <p>最近更新时间: {formatTimestamp(task.updated_at || task.created_at)}</p>
                        {task.error && <p className="text-red-600 dark:text-red-400">错误: {task.error}</p>}
                        <div className="rounded border bg-gray-50 dark:bg-gray-900/50 p-2">
                          <pre className="whitespace-pre-wrap break-all">
                            {JSON.stringify(task.result ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
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

function PreviewPdfButton({ href, label = "预览 PDF" }: { href: string; label?: string }) {
  const previewHref = href.includes("?") ? `${href}&inline=1` : `${href}?inline=1`
  const viewerHref = `${previewHref}#view=FitH&zoom=page-width&pagemode=none`

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            榛樿鎸夐〉瀹介瑙堬紝濡傛灉鎯崇湅寰楁洿鑸掓湇锛屽彲浠ョ洿鎺ュ湪鏂扮獥鍙ｆ墦寮€鎴栦笅杞藉悗鏌ョ湅銆?
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 border-b bg-muted/30 px-6 py-3">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={previewHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              鏂扮獥鍙ｆ墦寮€
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={href} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              涓嬭浇 PDF
            </a>
          </Button>
        </div>
        <iframe
          src={viewerHref}
          title={label}
          className="min-h-0 flex-1 bg-white"
          allow="fullscreen"
        />
      </DialogContent>
    </Dialog>
  )
}

function CleanPreviewPdfButton({
  href,
  label = "\u9884\u89c8 PDF",
}: {
  href: string
  label?: string
}) {
  const previewHref = href.includes("?") ? `${href}&inline=1` : `${href}?inline=1`
  const viewerHref = `${previewHref}#view=FitH&zoom=page-width&pagemode=none`

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {"\u9ed8\u8ba4\u6309\u9875\u5bbd\u9884\u89c8\uff0c\u5982\u679c\u60f3\u770b\u5f97\u66f4\u8212\u670d\uff0c\u53ef\u4ee5\u76f4\u63a5\u5728\u65b0\u7a97\u53e3\u6253\u5f00\u6216\u4e0b\u8f7d\u540e\u67e5\u770b\u3002"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 border-b bg-muted/30 px-6 py-3">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={previewHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              {"\u65b0\u7a97\u53e3\u6253\u5f00"}
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={href} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              {"\u4e0b\u8f7d PDF"}
            </a>
          </Button>
        </div>
        <iframe
          src={viewerHref}
          title={label}
          className="min-h-0 flex-1 bg-white"
          allow="fullscreen"
        />
      </DialogContent>
    </Dialog>
  )
}

function MaterialResultSummary({
  result,
  taskType,
}: {
  result: Record<string, unknown>
  taskType: string
}) {
  const download_pdf = result.download_pdf as string | undefined
  const download_word_chinese = result.download_word_chinese as string | undefined
  const download_word_english = result.download_word_english as string | undefined
  const download_pdf_chinese = result.download_pdf_chinese as string | undefined
  const download_pdf_english = result.download_pdf_english as string | undefined
  const word_download_url = result.word_download_url as string | undefined
  const analysis_result = result.analysis_result as Record<string, unknown> | undefined
  const archivedToApplicantProfile = Boolean(result.archivedToApplicantProfile)
  const archiveNote = archivedToApplicantProfile ? (
    <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">已自动归档到当前申请人档案</p>
  ) : null

  if (taskType === "material-review") {
    const aiObj = analysis_result?.ai_analysis
    const aiAnalysis =
      typeof aiObj === "string"
        ? aiObj
        : (aiObj as Record<string, unknown>)?.ai_analysis as string | undefined
    const bookingVerification = analysis_result?.booking_verification as
      | { checked?: boolean; found?: boolean | null; error?: string }
      | undefined
    if (!aiAnalysis) return null
    return (
      <div className="space-y-2">
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="w-full text-left text-xs text-gray-600 dark:text-gray-400 max-h-20 overflow-y-auto rounded border p-2 bg-gray-50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors group relative"
            >
              <div className="pr-6">{aiAnalysis}</div>
              <div className="absolute right-2 top-2 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex items-center gap-1">
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="text-[10px]">查看完整</span>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>审核详情</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-y-auto flex-1 min-h-0 rounded border p-4 bg-gray-50 dark:bg-gray-900/50">
              {aiAnalysis}
            </div>
          </DialogContent>
        </Dialog>
        {bookingVerification && (
          <div className="text-xs text-gray-600 dark:text-gray-400 rounded border p-2 bg-gray-50 dark:bg-gray-900/50">
            Booking.com 订单验证：
            {bookingVerification.found === true ? (
              <span className="ml-1 text-green-600 dark:text-green-400">已找到订单</span>
            ) : bookingVerification.found === false ? (
              <span className="ml-1 text-red-600 dark:text-red-400">未找到订单</span>
            ) : bookingVerification.error ? (
              <span className="ml-1 text-amber-600 dark:text-amber-400">{bookingVerification.error}</span>
            ) : (
              <span className="ml-1">未验证/结果不明确</span>
            )}
          </div>
        )}
      </div>
    )
  }

  if (taskType === "itinerary" && download_pdf) {
    return (
      <div className="text-xs flex flex-wrap gap-2">
        <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
          <a href={download_pdf} download target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5" />
            下载 PDF
          </a>
        </Button>
        <CleanPreviewPdfButton href={download_pdf} />
        <div className="basis-full">{archiveNote}</div>
      </div>
    )
  }

  if (taskType === "explanation-letter") {
    const links: { href: string; label: string }[] = []
    if (download_word_chinese) links.push({ href: download_word_chinese, label: "Word 中文" })
    if (download_word_english) links.push({ href: download_word_english, label: "Word 英文" })
    if (download_pdf_chinese) links.push({ href: download_pdf_chinese, label: "PDF 中文" })
    if (download_pdf_english) links.push({ href: download_pdf_english, label: "PDF 英文" })
    if (links.length === 0) return null
    return (
      <div className="text-xs flex flex-wrap gap-2">
        {links.map(({ href, label }) => (
          <div key={label} className="flex flex-wrap gap-2">
            <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
              <a href={href} download target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                {label}
              </a>
            </Button>
            {label.startsWith("PDF") && <CleanPreviewPdfButton href={href} label={`预览 ${label}`} />}
          </div>
        ))}
        <div className="basis-full">{archiveNote}</div>
      </div>
    )
  }

  return null
}

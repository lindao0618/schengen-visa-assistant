"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2, XCircle, Clock, ListTodo, RefreshCw, Search, Download, ImageIcon, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { usePageVisibility } from "@/hooks/use-page-visibility"
import { useTaskStatusReminder } from "@/hooks/use-task-status-reminder"
import { getAdaptivePollInterval } from "@/lib/polling"

function getTaskFilename(task: UsVisaTask): string {
  if (task.type === "check-photo") {
    const orig = (task.result as { originalFilename?: string } | undefined)?.originalFilename
    if (orig) return orig
    const proc = (task.result as { processed_photo_file?: string } | undefined)?.processed_photo_file
    if (proc) return proc
  }
  if (task.type === "submit-ds160") {
    const appId = (task.result as { application_id?: string } | undefined)?.application_id
    if (appId) return appId
  }
  const src = (task.result as { sourceFile?: string } | undefined)?.sourceFile
  if (src) return src
  const bracket = task.message.match(/^\[([^\]]+)\]/)
  if (bracket) return bracket[1]
  const msgName = task.message.match(/·\s*([^\s]+(?:\.\w+)?)\s*$/)
  if (msgName) return msgName[1]
  if (/\.xlsx?$/i.test(task.message)) return task.message
  return task.task_id.slice(-8)
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

function statusRank(status: UsVisaTask["status"]) {
  return status === "running" || status === "pending" ? 0 : 1
}

const TYPE_LABELS: Record<string, string> = {
  "check-photo": "照片检测",
  "fill-ds160": "DS-160 填表",
  "submit-ds160": "提交 DS160",
  "register-ais": "AIS 注册",
}

export interface UsVisaTask {
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

interface TaskListProps {
  /** 仅显示这些 task_id（可选，不传则显示全部） */
  filterTaskIds?: string[]
  /** 仅显示这些 task.type（可选，不传则显示全部） */
  filterTaskTypes?: string[]
  /** 卡片标题，默认「任务列表」 */
  title?: string
  /** 轮询间隔 ms，默认 2000 */
  pollInterval?: number
  /** 是否自动刷新，默认 true */
  autoRefresh?: boolean
}

type StatusFilter = "all" | "completed" | "failed" | "running"

export function TaskList({ filterTaskIds, filterTaskTypes, title = "任务列表", pollInterval = 2000, autoRefresh = true }: TaskListProps) {
  const [tasks, setTasks] = useState<UsVisaTask[]>([])
  const [loading, setLoading] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [onlyCurrentApplicant, setOnlyCurrentApplicant] = useState(false)
  const { status } = useSession()
  const activeApplicant = useActiveApplicantProfile()
  const isPageVisible = usePageVisibility()
  const inFlightRef = useRef(false)
  const filterTaskIdsKey = useMemo(() => (filterTaskIds ?? []).join(","), [filterTaskIds])
  const filterTaskTypesKey = useMemo(() => (filterTaskTypes ?? []).join(","), [filterTaskTypes])

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (status === "loading") return
    if (inFlightRef.current) return
    if (status === "unauthenticated") {
      setNeedsLogin(true)
      setTasks([])
      return
    }
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
      const res = await fetch("/api/usa-visa/tasks-list?" + params.toString(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
      if (res.status === 401) {
        setNeedsLogin(true)
        setTasks([])
        return
      }
      const data = await res.json()
      let list: UsVisaTask[] = data.tasks || []
      const normalizedTaskIds = filterTaskIdsKey ? filterTaskIdsKey.split(",").filter(Boolean) : []
      const normalizedTaskTypes = filterTaskTypesKey ? filterTaskTypesKey.split(",").filter(Boolean) : []
      if (normalizedTaskIds.length > 0) {
        const set = new Set(normalizedTaskIds)
        list = list.filter((t) => set.has(t.task_id))
        // 乐观显示：API 暂无数据时，用占位任务避免空白
        const foundIds = new Set(list.map((t) => t.task_id))
        const missingIds = normalizedTaskIds.filter((id) => !foundIds.has(id))
        for (const id of missingIds) {
          list.push({
            task_id: id,
            type: "fill-ds160",
            status: "pending",
            progress: 0,
            message: "任务创建中，请稍候...",
            created_at: Date.now(),
          } as UsVisaTask)
        }
        list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      }
      if (normalizedTaskTypes.length > 0) {
        const typeSet = new Set(normalizedTaskTypes)
        list = list.filter((t) => typeSet.has(t.type))
        list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      }
      setTasks(list)
    } catch (e) {
      console.error("Fetch tasks failed:", e)
    } finally {
      inFlightRef.current = false
      if (showLoading) setLoading(false)
    }
  }, [filterTaskIdsKey, filterTaskTypesKey, statusFilter, status, onlyCurrentApplicant, activeApplicant])

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
    if (!autoRefresh || status !== "authenticated" || !isPageVisible) return
    const id = window.setInterval(() => {
      void fetchTasks(false)
    }, interval)
    return () => window.clearInterval(id)
  }, [fetchTasks, interval, autoRefresh, status, isPageVisible, tasks.length])

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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
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
              id="us-only-current-applicant"
              type="checkbox"
              checked={onlyCurrentApplicant}
              onChange={(e) => setOnlyCurrentApplicant(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="us-only-current-applicant" className="cursor-pointer">
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
                    <Link href="/login?callbackUrl=/usa-visa">登录</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/signup">注册</Link>
                  </Button>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">暂无任务</p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">无匹配结果，可尝试调整筛选或搜索条件</p>
            )}
          </div>
        )}
        <ScrollArea className="min-h-[220px] max-h-[min(55vh,650px)] pr-4">
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
                {task.status === "failed" && (
                  <div className="space-y-2">
                    {task.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 break-words whitespace-pre-wrap max-h-24 overflow-y-auto">{task.error}</p>
                    )}
                    {(() => {
                      const errorResult = task.result as {
                        screenshot?: { downloadUrl?: string; filename?: string }
                        errorHtml?: { downloadUrl?: string; filename?: string }
                      } | undefined
                      const screenshot = errorResult?.screenshot
                      const errorHtml = errorResult?.errorHtml
                      if (screenshot?.downloadUrl || errorHtml?.downloadUrl) {
                        return (
                          <div className="flex flex-wrap gap-2">
                            {screenshot?.downloadUrl && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    查看错误截图
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 overflow-hidden flex items-center justify-center">
                                  <div className="relative h-[85vh] w-full">
                                    <Image
                                      src={screenshot.downloadUrl}
                                      alt={screenshot.filename || "错误截图"}
                                      fill
                                      unoptimized
                                      sizes="100vw"
                                      className="object-contain rounded"
                                    />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            {errorHtml?.downloadUrl && (
                              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                                <a href={errorHtml.downloadUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  下载错误 HTML
                                </a>
                              </Button>
                            )}
                          </div>
                        )
                      }
                      return null
                    })()}
                    {!task.error && !(task.result as { screenshot?: unknown } | undefined)?.screenshot && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">无详细错误信息，请重新提交任务</p>
                    )}
                  </div>
                )}
                {task.status === "completed" && task.result && (
                  <ResultSummary result={task.result} taskType={task.type} />
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
                        {task.caseLabel && <p>所属案件: {task.caseLabel}</p>}
                        <p>任务ID: {task.task_id}</p>
                        <p>任务类型: {TYPE_LABELS[task.type] || task.type}</p>
                        <p>状态: {task.status}</p>
                        {task.applicantName && <p>申请人: {task.applicantName}</p>}
                        <p>创建时间: {formatTimestamp(task.created_at)}</p>
                        <p>最近更新时间: {formatTimestamp(task.updated_at || task.created_at)}</p>
                        {task.status === "failed" && (
                          <div className="space-y-2">
                            {task.error && (
                              <p className="text-red-600 dark:text-red-400 break-words whitespace-pre-wrap">错误: {task.error}</p>
                            )}
                            {(() => {
                              const errorResult = task.result as {
                                screenshot?: { downloadUrl?: string; filename?: string }
                                errorHtml?: { downloadUrl?: string; filename?: string }
                              } | undefined
                              const screenshot = errorResult?.screenshot
                              const errorHtml = errorResult?.errorHtml
                              if (screenshot?.downloadUrl || errorHtml?.downloadUrl) {
                                return (
                                  <div className="flex flex-wrap gap-2">
                                    {screenshot?.downloadUrl && (
                                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                                        <a href={screenshot.downloadUrl} target="_blank" rel="noopener noreferrer">
                                          <ImageIcon className="h-3.5 w-3.5" />
                                          查看错误截图
                                        </a>
                                      </Button>
                                    )}
                                    {errorHtml?.downloadUrl && (
                                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                                        <a href={errorHtml.downloadUrl} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                          下载错误 HTML
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                )
                              }
                              return null
                            })()}
                            {!task.error && !(task.result as { screenshot?: unknown } | undefined)?.screenshot && (
                              <p className="text-amber-600 dark:text-amber-400">无详细错误信息</p>
                            )}
                          </div>
                        )}
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
  const config: Record<string, { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
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

function ResultSummary({ result, taskType }: { result: Record<string, unknown>; taskType?: string }) {
  const files = result.files as Array<{ filename: string; downloadUrl: string }> | undefined
  const guideScreenshots = result.guideScreenshots as Array<{ filename: string; downloadUrl: string }> | undefined
  const guideScreenshotsZip = result.guideScreenshotsZip as { filename: string; downloadUrl: string } | undefined
  const aaCode = result.aaCode as string | undefined
  const emailTo = result.emailTo as string | undefined
  const emailSent = result.emailSent as boolean | undefined
  const processedUrl = result.processed_photo_download_url as string | undefined
  const photoSuccess = result.success as boolean | undefined
  const [previewOpen, setPreviewOpen] = useState(false)

  if (taskType === "check-photo") {
    return (
      <div className="text-xs space-y-2">
        {photoSuccess ? (
          <p className="text-green-600 dark:text-green-400">{result.message as string}</p>
        ) : (
          <p className="text-red-600 dark:text-red-400">{result.message as string}</p>
        )}
        {processedUrl && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setPreviewOpen(true)}>
                <ImageIcon className="h-3.5 w-3.5" />
                查看图片
              </Button>
              <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                <a href={processedUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5" />
                  下载照片
                </a>
              </Button>
            </div>
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 overflow-hidden flex items-center justify-center">
                <div className="relative h-[85vh] w-full">
                  <Image
                    src={processedUrl}
                    alt="处理后的照片"
                    fill
                    unoptimized
                    sizes="100vw"
                    className="object-contain rounded"
                  />
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    )
  }
  if (taskType === "register-ais") {
    const email = result.email as string | undefined
    const msg = result.message as string | undefined
    const success = result.success as boolean | undefined
    return (
      <div className="text-xs space-y-1">
        {success ? (
          <>
            <p className="text-green-600 dark:text-green-400">{msg || "AIS 账号注册完成"}</p>
            {email && <p className="text-gray-600 dark:text-gray-400">邮箱: {email}</p>}
          </>
        ) : (
          <p className="text-red-600 dark:text-red-400">{msg || (result.error as string) || "注册失败"}</p>
        )}
      </div>
    )
  }
  if (taskType === "submit-ds160") {
    const outputId = result.output_id as string | undefined
    const fullUrl = result.download_url as string | undefined
    const extractOutputId = fullUrl?.match(/\/submit\/download\/([^/]+)\//)?.[1]
    const simpleUrl = outputId || extractOutputId
      ? `/api/usa-visa/ds160/submit/download/${outputId || extractOutputId}`
      : undefined
    const downloadUrl = (fullUrl as string) || (result.download_url_simple as string) || simpleUrl
    const appId = result.application_id as string | undefined
    const pdfFile = result.pdf_file as string | undefined
    if (!downloadUrl) return null
    const handleDownload = async () => {
      if (!downloadUrl) return
      try {
        const res = await fetch(downloadUrl, { credentials: 'include' })
        if (!res.ok) {
          if (res.status === 401) throw new Error('请先登录后再下载')
          if (res.status === 404) throw new Error('文件不存在或已清理')
          throw new Error(`下载失败（${res.status}）`)
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = pdfFile || `ds160_${appId || 'confirm'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '下载失败'
        alert(`${msg}，请刷新页面后重试`)
      }
    }
    return (
      <div className="text-xs space-y-2">
        <p className="text-green-600 dark:text-green-400">{result.message as string || "提交成功"}</p>
        {appId && <p className="text-gray-600 dark:text-gray-400">AA码: {appId}</p>}
        <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
          下载 PDF 确认页
        </Button>
      </div>
    )
  }
  if (!files?.length && !guideScreenshots?.length && !aaCode && !emailTo) return null
  return (
    <div className="text-xs text-green-600 dark:text-green-400 space-y-0.5">
      {aaCode && <p>AA码: {aaCode}</p>}
      {files?.length && <p>{files.length} 个 PDF 已生成</p>}
      {guideScreenshots?.length && <p>{guideScreenshots.length} 张 DS-160 页面截图已生成</p>}
      {emailSent && emailTo && <p>已发送至 {emailTo}</p>}
      {!!guideScreenshots?.length && (
        <div className="flex flex-wrap gap-2 pt-1">
          {guideScreenshotsZip?.downloadUrl && (
            <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
              <a href={guideScreenshotsZip.downloadUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" />
                全部截图
              </a>
            </Button>
          )}
          {guideScreenshots.map((file) => (
            <Button key={file.filename} variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
              <a href={file.downloadUrl} download target="_blank" rel="noopener noreferrer">
                <ImageIcon className="h-3.5 w-3.5" />
                {file.filename.replace(/^guide_\d+_/, "").replace(/\.png$/i, "")}
              </a>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

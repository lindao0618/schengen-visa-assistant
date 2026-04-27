"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  formatUsaExceptionLabel,
  formatUsaStatusLabel,
  formatReminderAutomationModeLabel,
  formatReminderChannelLabel,
  formatReminderSeverityLabel,
} from "@/lib/usa-case-labels"
import { USA_EXCEPTION_CODES, USA_MAIN_STATUSES } from "@/lib/usa-case-machine"
import { AlertTriangle, BellRing, Clock3, PlayCircle, RefreshCw, Search } from "lucide-react"

type AdminCaseSummary = {
  activeCaseCount: number
  exceptionCaseCount: number
  pendingReminderCount: number
  dueReminderCount: number
  urgentReminderCount: number
}

type AdminCaseRow = {
  id: string
  mainStatus: string
  subStatus?: string | null
  exceptionCode?: string | null
  updatedAt: string
  applicantProfile: { id: string; name: string }
  user: { id: string; email: string; name?: string | null }
  pendingReminderCount: number
  dueReminderCount: number
  nextReminderAt?: string | null
}

type ReminderLogRow = {
  id: string
  ruleCode: string
  templateCode: string
  channel: string
  automationMode: string
  severity: string
  sendStatus: string
  triggeredAt: string
  sentAt?: string | null
  errorMessage?: string | null
  renderedContent?: string | null
  isDue: boolean
  visaCase: {
    id: string
    mainStatus: string
    subStatus?: string | null
    exceptionCode?: string | null
    applicantProfile: { id: string; name: string }
  }
  user: { id: string; email: string; name?: string | null }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function ReminderStatusBadge({ value }: { value: string }) {
  if (value === "sent") return <Badge>已发送</Badge>
  if (value === "failed") return <Badge variant="destructive">发送失败</Badge>
  if (value === "processing") return <Badge variant="secondary">处理中</Badge>
  if (value === "skipped") return <Badge variant="outline">已跳过</Badge>
  return <Badge variant="outline">待触发</Badge>
}

function previewContent(value?: string | null) {
  if (!value) return "-"
  if (value.length <= 80) return value
  return `${value.slice(0, 80)}...`
}

export default function AdminUsaCasesClientPage() {
  const [summary, setSummary] = useState<AdminCaseSummary | null>(null)
  const [cases, setCases] = useState<AdminCaseRow[]>([])
  const [reminderLogs, setReminderLogs] = useState<ReminderLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingDueLogs, setProcessingDueLogs] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState("")
  const [bannerMessage, setBannerMessage] = useState("")
  const [search, setSearch] = useState("")
  const [mainStatus, setMainStatus] = useState("all")
  const [exceptionCode, setExceptionCode] = useState("all")
  const [reminderStatus, setReminderStatus] = useState("all")
  const [severity, setSeverity] = useState("all")
  const [automationMode, setAutomationMode] = useState("all")
  const [channel, setChannel] = useState("all")

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({
        search,
        mainStatus,
        exceptionCode,
        reminderStatus,
        severity,
        automationMode,
        channel,
        caseLimit: "80",
        logLimit: "120",
      })

      const response = await fetch(`/api/admin/usa-cases?${params.toString()}`, {
        cache: "no-store",
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data?.message || "加载美签案件后台失败")
      }

      setSummary(data.summary || null)
      setCases(data.cases || [])
      setReminderLogs(data.reminderLogs || [])
    } catch (error) {
      console.error("加载美签案件后台失败:", error)
      setBannerMessage(error instanceof Error ? error.message : "加载美签案件后台失败")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [automationMode, channel, exceptionCode, mainStatus, reminderStatus, search, severity])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const dueLogs = useMemo(() => reminderLogs.filter((item) => item.isDue), [reminderLogs])

  const updateReminderStatus = async (logId: string, sendStatus: string) => {
    setActionLoadingId(logId)

    try {
      const errorMessage =
        sendStatus === "failed"
          ? window.prompt("请输入失败原因，留空则使用默认值：")?.trim() || "手动标记为发送失败"
          : null

      const response = await fetch("/api/admin/usa-cases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId,
          sendStatus,
          errorMessage,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data?.message || "更新提醒日志状态失败")
      }

      setBannerMessage(`提醒日志已更新为「${sendStatus}」`)
      await fetchData(true)
    } catch (error) {
      console.error("更新提醒日志状态失败:", error)
      setBannerMessage(error instanceof Error ? error.message : "更新提醒日志状态失败")
    } finally {
      setActionLoadingId("")
    }
  }

  const processDueLogs = async () => {
    setProcessingDueLogs(true)

    try {
      const response = await fetch("/api/admin/usa-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process_due_logs",
          limit: 30,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data?.message || "处理到期提醒失败")
      }

      const result = data.result
      setBannerMessage(
        `已扫描 ${result.scanned} 条到期提醒，模拟发送 ${result.sent} 条，失败 ${result.failed} 条，跳过 ${result.skipped} 条。`,
      )
      await fetchData(true)
    } catch (error) {
      console.error("处理到期提醒失败:", error)
      setBannerMessage(error instanceof Error ? error.message : "处理到期提醒失败")
    } finally {
      setProcessingDueLogs(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">美签案件与提醒</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            查看美签案件进度、异常状态，以及 ReminderLog 触发后的待处理提醒。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void fetchData(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button onClick={() => void processDueLogs()} disabled={processingDueLogs || dueLogs.length === 0}>
            <PlayCircle className={`mr-2 h-4 w-4 ${processingDueLogs ? "animate-spin" : ""}`} />
            处理到期提醒
          </Button>
        </div>
      </div>

      {bannerMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {bannerMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">活跃案件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary?.activeCaseCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">异常案件</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{summary?.exceptionCaseCount ?? 0}</div>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">待触发提醒</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{summary?.pendingReminderCount ?? 0}</div>
            <BellRing className="h-5 w-5 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">已到期提醒</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{summary?.dueReminderCount ?? 0}</div>
            <Clock3 className="h-5 w-5 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">紧急提醒</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary?.urgentReminderCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>这一版先打通规则触发、后台查看和模拟发送。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索申请人、邮箱、规则编码"
                className="pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Select value={mainStatus} onValueChange={setMainStatus}>
              <SelectTrigger>
                <SelectValue placeholder="案件主状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {USA_MAIN_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatUsaStatusLabel(status, null)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={exceptionCode} onValueChange={setExceptionCode}>
              <SelectTrigger>
                <SelectValue placeholder="异常状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部异常</SelectItem>
                <SelectItem value="with_exception">仅看异常案件</SelectItem>
                <SelectItem value="none">无异常案件</SelectItem>
                {USA_EXCEPTION_CODES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {formatUsaExceptionLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={reminderStatus} onValueChange={setReminderStatus}>
              <SelectTrigger>
                <SelectValue placeholder="提醒状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部提醒状态</SelectItem>
                <SelectItem value="pending">待触发</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="sent">已发送</SelectItem>
                <SelectItem value="failed">发送失败</SelectItem>
                <SelectItem value="skipped">已跳过</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="优先级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部优先级</SelectItem>
                <SelectItem value="NORMAL">普通</SelectItem>
                <SelectItem value="URGENT">紧急</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-4 xl:col-span-2">
              <Select value={automationMode} onValueChange={setAutomationMode}>
                <SelectTrigger>
                  <SelectValue placeholder="执行方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方式</SelectItem>
                  <SelectItem value="AUTO">全自动</SelectItem>
                  <SelectItem value="MANUAL">人工介入</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="渠道" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部渠道</SelectItem>
                  <SelectItem value="WECHAT">微信</SelectItem>
                  <SelectItem value="EMAIL">邮件</SelectItem>
                  <SelectItem value="INTERNAL">内部提醒</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>美签案件</CardTitle>
          <CardDescription>当前展示 {cases.length} 个活跃案件。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">申请人</TableHead>
                  <TableHead className="min-w-[180px]">用户</TableHead>
                  <TableHead className="min-w-[220px]">当前状态</TableHead>
                  <TableHead className="min-w-[140px]">异常</TableHead>
                  <TableHead className="min-w-[120px]">待触发提醒</TableHead>
                  <TableHead className="min-w-[120px]">已到期</TableHead>
                  <TableHead className="min-w-[160px]">最近更新</TableHead>
                  <TableHead className="min-w-[160px]">下一条提醒</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.applicantProfile.name}</TableCell>
                    <TableCell>{item.user.name || item.user.email}</TableCell>
                    <TableCell>{formatUsaStatusLabel(item.mainStatus, item.subStatus)}</TableCell>
                    <TableCell>
                      {item.exceptionCode ? (
                        <Badge variant="destructive">{formatUsaExceptionLabel(item.exceptionCode)}</Badge>
                      ) : (
                        <Badge variant="outline">无</Badge>
                      )}
                    </TableCell>
                    <TableCell>{item.pendingReminderCount}</TableCell>
                    <TableCell>
                      {item.dueReminderCount > 0 ? (
                        <Badge variant="destructive">{item.dueReminderCount}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                    <TableCell>{formatDateTime(item.nextReminderAt)}</TableCell>
                  </TableRow>
                ))}
                {cases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      当前没有符合筛选条件的美签案件。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提醒日志</CardTitle>
          <CardDescription>
            当前展示 {reminderLogs.length} 条日志，其中 {dueLogs.length} 条已经到触发时间。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">触发时间</TableHead>
                  <TableHead className="min-w-[120px]">申请人</TableHead>
                  <TableHead className="min-w-[180px]">规则</TableHead>
                  <TableHead className="min-w-[140px]">渠道</TableHead>
                  <TableHead className="min-w-[110px]">方式</TableHead>
                  <TableHead className="min-w-[100px]">优先级</TableHead>
                  <TableHead className="min-w-[120px]">发送状态</TableHead>
                  <TableHead className="min-w-[220px]">关联案件</TableHead>
                  <TableHead className="min-w-[260px]">模拟内容</TableHead>
                  <TableHead className="min-w-[180px]">错误信息</TableHead>
                  <TableHead className="min-w-[220px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminderLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>{formatDateTime(log.triggeredAt)}</div>
                      {log.isDue && log.sendStatus === "pending" && (
                        <div className="mt-1 text-xs font-medium text-red-500">已到触发时间</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{log.visaCase.applicantProfile.name}</TableCell>
                    <TableCell>
                      <div className="font-medium">{log.ruleCode}</div>
                      <div className="text-xs text-muted-foreground">{log.templateCode}</div>
                    </TableCell>
                    <TableCell>{formatReminderChannelLabel(log.channel)}</TableCell>
                    <TableCell>{formatReminderAutomationModeLabel(log.automationMode)}</TableCell>
                    <TableCell>{formatReminderSeverityLabel(log.severity)}</TableCell>
                    <TableCell>
                      <ReminderStatusBadge value={log.sendStatus} />
                    </TableCell>
                    <TableCell>{formatUsaStatusLabel(log.visaCase.mainStatus, log.visaCase.subStatus)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {previewContent(log.renderedContent)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.errorMessage || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === log.id || log.sendStatus === "sent"}
                          onClick={() => void updateReminderStatus(log.id, "sent")}
                        >
                          标记已发送
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === log.id || log.sendStatus === "skipped"}
                          onClick={() => void updateReminderStatus(log.id, "skipped")}
                        >
                          跳过
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoadingId === log.id || log.sendStatus === "processing"}
                          onClick={() => void updateReminderStatus(log.id, "processing")}
                        >
                          处理中
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={actionLoadingId === log.id || log.sendStatus === "failed"}
                          onClick={() => void updateReminderStatus(log.id, "failed")}
                        >
                          标记失败
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {reminderLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                      当前没有符合筛选条件的提醒日志。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

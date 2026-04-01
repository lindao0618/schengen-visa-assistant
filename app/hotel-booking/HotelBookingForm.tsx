"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Hotel,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

interface BookingFormData {
  booking_email: string
  booking_password: string
  // IMAP 自动验证码
  imap_server: string
  imap_port: string
  imap_username: string
  imap_password: string
  imap_max_wait_sec: string
  city: string
  checkin_date: string
  checkout_date: string
  adults: number
  rooms: number
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  credit_card_number: string
  credit_card_expiry_month: string
  credit_card_expiry_year: string
  credit_card_cvv: string
  credit_card_holder: string
  filter_no_prepayment: boolean
  max_price_per_night: string
  headless: boolean
  pause_before_payment: boolean
}

interface TaskArtifact {
  label: string
  filename: string
  url: string
}

interface BookingTask {
  task_id: string
  type: string
  status: "pending" | "running" | "completed" | "failed"
  progress: number
  message: string
  created_at: number
  updated_at: number
  city?: string
  checkin_date?: string
  checkout_date?: string
  guest_name?: string
  hotel_name?: string
  error?: string
  result?: {
    success?: boolean
    paused_before_payment?: boolean
    payment_handoff_ready?: boolean
    hotel_name?: string
    confirmation_number?: string
    confirmation_url?: string
    payment_url?: string
    pdf_download?: string
    download_log?: string
    download_artifacts?: TaskArtifact[]
    error?: string
    message?: string
  }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: BookingTask["status"] }) {
  if (status === "completed") return <Badge className="bg-green-600 text-white">已完成</Badge>
  if (status === "failed") return <Badge variant="destructive">失败</Badge>
  if (status === "running") return <Badge className="bg-blue-600 text-white">运行中</Badge>
  return <Badge variant="secondary">等待中</Badge>
}

function TaskCard({ task, onRefresh }: { task: BookingTask; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(task.status === "running" || task.status === "failed")
  const artifacts = task.result?.download_artifacts || []
  const pdfDownload = task.result?.pdf_download
  const confirmationNumber = task.result?.confirmation_number
  const pausedBeforePayment = Boolean(task.result?.paused_before_payment)
  const paymentHandoffReady = Boolean(task.result?.payment_handoff_ready)

  return (
    <div className="rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={task.status} />
            {task.hotel_name || task.result?.hotel_name ? (
              <span className="font-semibold text-sm truncate">
                {task.hotel_name || task.result?.hotel_name}
              </span>
            ) : null}
            <span className="text-xs text-gray-500">{task.city}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {task.checkin_date} → {task.checkout_date}
            {task.guest_name ? ` · ${task.guest_name}` : ""}
          </div>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">{task.message}</div>
          {confirmationNumber && (
            <div className="mt-1 text-sm font-semibold text-green-700 dark:text-green-400">
              预订号：{confirmationNumber}
            </div>
          )}
          {task.status === "running" && (
            <Progress value={task.progress} className="mt-2 h-1.5" />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{formatDate(task.updated_at)}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t pt-3 dark:border-gray-800">
          {task.error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs break-all">{task.error}</AlertDescription>
            </Alert>
          )}

          {pdfDownload && (
            <a href={pdfDownload} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                <Download className="h-4 w-4" />
                下载预订确认单 PDF
              </Button>
            </a>
          )}

          {task.result?.confirmation_url && (
            <a href={task.result.confirmation_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                {pausedBeforePayment ? "打开支付页" : "查看 Booking.com 确认页"}
              </Button>
            </a>
          )}

          {pausedBeforePayment && paymentHandoffReady && (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              宸插繚瀛樻敮浠橀〉 HTML銆佹埅鍥惧拰瀛楁娓呭崟锛屽彲鐩存帴浜哄伐鎺ユ墜銆?
            </div>
          )}

          {artifacts.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">调试文件</div>
              <div className="grid gap-1">
                {artifacts.map((a) => (
                  <a
                    key={a.filename}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {a.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-gray-400 font-mono">task_id: {task.task_id}</div>
        </div>
      )}
    </div>
  )
}

function BinaryChoice({
  label,
  description,
  value,
  onChange,
  trueLabel,
  falseLabel,
}: {
  label: string
  description?: string
  value: boolean
  onChange: (value: boolean) => void
  trueLabel: string
  falseLabel: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {description ? <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant={value ? "default" : "outline"}
          className={`justify-start rounded-xl px-4 py-5 text-left ${
            value ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white text-slate-700"
          }`}
          onClick={() => onChange(true)}
        >
          {trueLabel}
        </Button>
        <Button
          type="button"
          variant={!value ? "default" : "outline"}
          className={`justify-start rounded-xl px-4 py-5 text-left ${
            !value ? "bg-white text-slate-900 hover:bg-slate-100 border-slate-300" : "bg-white text-slate-700"
          }`}
          onClick={() => onChange(false)}
        >
          {falseLabel}
        </Button>
      </div>
    </div>
  )
}

const defaultForm: BookingFormData = {
  booking_email: "",
  booking_password: "",
  imap_server: "imap.163.com",
  imap_port: "993",
  imap_username: "",
  imap_password: "",
  imap_max_wait_sec: "90",
  city: "",
  checkin_date: "",
  checkout_date: "",
  adults: 1,
  rooms: 1,
  guest_first_name: "",
  guest_last_name: "",
  guest_email: "",
  credit_card_number: "",
  credit_card_expiry_month: "",
  credit_card_expiry_year: "",
  credit_card_cvv: "",
  credit_card_holder: "",
  filter_no_prepayment: true,
  max_price_per_night: "",
  headless: false,
  pause_before_payment: true,
}

export function HotelBookingForm() {
  const [form, setForm] = useState<BookingFormData>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [tasks, setTasks] = useState<BookingTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const set = (key: keyof BookingFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await fetch("/api/hotel-booking/tasks-list?limit=20", { credentials: "include" })
      const data = await res.json()
      if (data.success) setTasks(data.tasks)
    } catch { /* ignore */ }
    finally { setTasksLoading(false) }
  }, [])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  // 轮询：有运行中的任务时自动刷新
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === "running" || t.status === "pending")
    if (hasRunning && !pollingRef.current) {
      pollingRef.current = setInterval(() => void fetchTasks(), 3000)
    } else if (!hasRunning && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [tasks, fetchTasks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMsg("")
    setLoading(true)

    try {
      const payload = {
        ...form,
        adults: Number(form.adults),
        rooms: Number(form.rooms),
        max_price_per_night: form.max_price_per_night ? Number(form.max_price_per_night) : null,
      }
      const res = await fetch("/api/hotel-booking/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "提交失败")
        return
      }
      setSuccessMsg(data.message || "任务已启动")
      void fetchTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hotel className="h-5 w-5 text-blue-600" />
            Booking.com 自动预约酒店
          </CardTitle>
          <CardDescription>
            自动登录 Booking.com、搜索并预订无需预付款的酒店，完成后生成预订确认单。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Alert className="border-slate-200 bg-slate-50">
              <CheckCircle2 className="h-4 w-4 text-slate-700" />
              <AlertTitle>默认账号已接管</AlertTitle>
              <AlertDescription className="text-slate-600">
                Booking.com 登录邮箱、密码和验证码接收邮箱已使用系统默认配置，这里不再手动填写。
              </AlertDescription>
            </Alert>

            <Separator />

            {/* 搜索条件 */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">搜索条件</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label>目的城市</Label>
                  <Input
                    placeholder="如：Paris, 巴黎, London"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>入住日期</Label>
                  <Input
                    type="date"
                    value={form.checkin_date}
                    onChange={(e) => set("checkin_date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>离店日期</Label>
                  <Input
                    type="date"
                    value={form.checkout_date}
                    onChange={(e) => set("checkout_date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>成人人数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={form.adults}
                    onChange={(e) => set("adults", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>房间数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={form.rooms}
                    onChange={(e) => set("rooms", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>最高每晚价格（留空不限）</Label>
                  <Input
                    type="number"
                    placeholder="如：300"
                    value={form.max_price_per_night}
                    onChange={(e) => set("max_price_per_night", e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4">
                <BinaryChoice
                  label="酒店筛选"
                  description="默认优先筛选无需预付款、到店付款的酒店。"
                  value={form.filter_no_prepayment}
                  onChange={(v) => set("filter_no_prepayment", v)}
                  trueLabel="只看无需预付款酒店"
                  falseLabel="不限制预付条件"
                />
              </div>
            </div>

            <Separator />

            {/* 入住人信息 */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">入住人信息</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>名（First Name）</Label>
                  <Input
                    placeholder="John"
                    value={form.guest_first_name}
                    onChange={(e) => set("guest_first_name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>姓（Last Name）</Label>
                  <Input
                    placeholder="Doe"
                    value={form.guest_last_name}
                    onChange={(e) => set("guest_last_name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>联系邮箱</Label>
                  <Input
                    type="email"
                    placeholder="入住人邮箱（可与账号相同）"
                    value={form.guest_email}
                    onChange={(e) => set("guest_email", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 信用卡信息 */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                信用卡信息
                <span className="ml-2 text-xs font-normal text-gray-400">（无需预付款时仍需填写以担保预订）</span>
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label>卡号</Label>
                  <Input
                    placeholder="1234 5678 9012 3456"
                    value={form.credit_card_number}
                    onChange={(e) => set("credit_card_number", e.target.value.replace(/\s/g, ""))}
                    maxLength={19}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>持卡人姓名</Label>
                  <Input
                    placeholder="JOHN DOE"
                    value={form.credit_card_holder}
                    onChange={(e) => set("credit_card_holder", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>有效期（MM/YY）</Label>
                  <Input
                    placeholder="08/29"
                    value={
                      form.credit_card_expiry_month && form.credit_card_expiry_year
                        ? `${form.credit_card_expiry_month.padStart(2, "0")}/${form.credit_card_expiry_year.slice(-2)}`
                        : form.credit_card_expiry_month || ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d/]/g, "")
                      // 自动插入斜杠
                      let v = raw.replace(/\//g, "")
                      if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2, 4)
                      const parts = v.split("/")
                      set("credit_card_expiry_month", parts[0] ?? "")
                      if (parts[1] !== undefined) {
                        const yy = parts[1]
                        set("credit_card_expiry_year", yy.length === 2 ? `20${yy}` : yy)
                      } else {
                        set("credit_card_expiry_year", "")
                      }
                    }}
                    maxLength={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CVV / CVC</Label>
                  <Input
                    type="password"
                    placeholder="123"
                    value={form.credit_card_cvv}
                    onChange={(e) => set("credit_card_cvv", e.target.value)}
                    maxLength={4}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 高级选项 */}
            <div className="space-y-4">
              <BinaryChoice
                label="支付前暂停"
                description="推荐开启。到达 Payment 页面后自动暂停，方便人工核对和接手后续操作。"
                value={form.pause_before_payment}
                onChange={(v) => set("pause_before_payment", v)}
                trueLabel="开启，到支付页先暂停"
                falseLabel="关闭，继续自动执行"
              />
              <BinaryChoice
                label="运行方式"
                description="推荐显示浏览器窗口，便于观察过程和排查问题。"
                value={!form.headless}
                onChange={(v) => set("headless", !v)}
                trueLabel="显示浏览器窗口"
                falseLabel="后台无头运行"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {successMsg && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>已启动</AlertTitle>
                <AlertDescription>{successMsg}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="gap-2 w-full sm:w-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {loading ? "正在启动..." : "开始自动预订"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">预订任务记录</CardTitle>
            <CardDescription className="text-xs mt-0.5">点击任务可展开查看详情和下载确认单</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void fetchTasks()}
            disabled={tasksLoading}
          >
            <RefreshCw className={`h-4 w-4 ${tasksLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              暂无预订记录，填写上方表单开始预订。
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard key={task.task_id} task={task} onRefresh={fetchTasks} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

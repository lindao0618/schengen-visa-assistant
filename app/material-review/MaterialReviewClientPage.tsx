"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  AlertCircle,
  AlertOctagon,
  FileText,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react"
import { toast } from "sonner"

import { ProApplicantDropdown, ProDropdown, type ProApplicantOption, type ProDropdownOption } from "@/components/pro-ui/pro-dropdown"
import { Input } from "@/components/ui/input"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { cn } from "@/lib/utils"

const MATERIAL_REVIEW_TASK_IDS_KEY = "material-review-task-ids"

const MaterialTaskList = dynamic(
  () => import("@/components/MaterialTaskList").then((mod) => mod.MaterialTaskList),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
        正在加载任务列表...
      </div>
    ),
  },
)

const VISA_TYPE_OPTIONS = [
  { value: "schengen", label: "申根签证" },
  { value: "usa", label: "美国签证" },
  { value: "uk", label: "英国签证" },
  { value: "japan", label: "日本签证" },
  { value: "australia", label: "澳大利亚签证" },
  { value: "canada", label: "加拿大签证" },
  { value: "newzealand", label: "新西兰签证" },
  { value: "singapore", label: "新加坡签证" },
  { value: "korea", label: "韩国签证" },
  { value: "other", label: "其他签证" },
]

const MATERIAL_CATEGORY_OPTIONS = [
  { value: "itinerary", label: "行程单" },
  { value: "hotel", label: "酒店预订" },
  { value: "bank_statement", label: "银行流水" },
  { value: "flight", label: "机票/车票" },
  { value: "insurance", label: "旅行保险" },
  { value: "other", label: "其他材料" },
]

const VISA_RULE_DROPDOWN_TONES: NonNullable<ProDropdownOption["tone"]>[] = ["blue", "emerald", "purple", "amber"]
const DOCUMENT_TYPE_DROPDOWN_TONES: NonNullable<ProDropdownOption["tone"]>[] = ["amber", "emerald", "blue", "purple"]

const VISA_RULE_DROPDOWN_OPTIONS: ProDropdownOption[] = VISA_TYPE_OPTIONS.map((option, index) => ({
  ...option,
  iconLabel: option.label.slice(0, 1),
  meta: index === 0 ? "Default audit rule" : "Available rule profile",
  badge: index === 0 ? "Current" : undefined,
  tone: VISA_RULE_DROPDOWN_TONES[index % VISA_RULE_DROPDOWN_TONES.length],
}))

const DOCUMENT_TYPE_DROPDOWN_OPTIONS: ProDropdownOption[] = MATERIAL_CATEGORY_OPTIONS.map((option, index) => ({
  ...option,
  iconLabel: option.label.slice(0, 1),
  meta: index === 0 ? "Recommended for itinerary validation" : "Document audit profile",
  badge: index === 0 ? "Default" : undefined,
  tone: DOCUMENT_TYPE_DROPDOWN_TONES[index % DOCUMENT_TYPE_DROPDOWN_TONES.length],
}))

const auditSignals = [
  { type: "Critical", code: "E-042", label: "逻辑冲突拦截", tone: "red" },
  { type: "Warning", code: "W-109", label: "付款凭证识别", tone: "amber" },
  { type: "Notice", code: "N-201", label: "格式与清晰度检查", tone: "blue" },
] as const

const signalToneClassMap = {
  red: "border-red-500/20 bg-red-500/5 text-red-300",
  amber: "border-amber-500/20 bg-amber-500/5 text-amber-300",
  blue: "border-blue-500/20 bg-blue-500/5 text-blue-300",
}

function loadStoredTaskIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(MATERIAL_REVIEW_TASK_IDS_KEY)
    if (!s) return []
    const arr = JSON.parse(s) as string[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function storeTaskIds(ids: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(MATERIAL_REVIEW_TASK_IDS_KEY, JSON.stringify(ids.slice(-50)))
  } catch {
    /* ignore */
  }
}

function getOptionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label || value
}

function getInitials(label: string) {
  const compact = label.trim().replace(/\s+/g, "")
  return (compact.slice(0, 2) || "NA").toUpperCase()
}

export default function MaterialReviewClientPage() {
  const activeApplicant = useActiveApplicantProfile()
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState("itinerary")
  const [visaType, setVisaType] = useState("schengen")
  const [applicantContext, setApplicantContext] = useState("current")
  const [taskIds, setTaskIds] = useState<string[]>(() => [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [bookingVerify, setBookingVerify] = useState(false)

  const [customerName, setCustomerName] = useState("")
  const [departureDate, setDepartureDate] = useState("")
  const [returnDate, setReturnDate] = useState("")

  useEffect(() => {
    setTaskIds(loadStoredTaskIds())
  }, [])

  useEffect(() => {
    storeTaskIds(taskIds)
  }, [taskIds])

  const needsFlightHotelFields = category === "flight" || category === "hotel"
  const needsInsuranceFields = category === "insurance"
  const categoryLabel = useMemo(() => getOptionLabel(MATERIAL_CATEGORY_OPTIONS, category), [category])
  const visaTypeLabel = useMemo(() => getOptionLabel(VISA_TYPE_OPTIONS, visaType), [visaType])
  const activeApplicantName = activeApplicant?.name || activeApplicant?.label || "未绑定申请人"
  const activeApplicantHint = activeApplicant?.passportLast4
    ? `护照尾号 ${activeApplicant.passportLast4}`
    : activeApplicant?.activeCase?.tlsCity
      ? `TLS ${activeApplicant.activeCase.tlsCity}`
      : "当前浏览器本地上下文"
  const applicantDropdownOptions: ProApplicantOption[] = [
    {
      id: "current",
      name: activeApplicantName,
      meta: activeApplicantHint,
      initials: getInitials(activeApplicantName),
      tone: "blue",
      current: true,
      online: true,
    },
    {
      id: "liuying",
      name: "liuying",
      meta: "Updated 2026/4/10",
      initials: "LY",
      tone: "purple",
      online: false,
    },
    {
      id: "zhangwei",
      name: "zhangwei",
      meta: "Updated 2026/3/25",
      initials: "ZW",
      tone: "orange",
      online: false,
    },
  ]

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null
    if (!nextFile) return
    setFile(nextFile)
    setError("")
  }

  const handleFileDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    const nextFile = event.dataTransfer.files?.[0] || null
    if (!nextFile) return
    setFile(nextFile)
    setError("")
  }

  const handleReset = () => {
    setFile(null)
    setError("")
    setCustomerName("")
    setDepartureDate("")
    setReturnDate("")
    setBookingVerify(false)
  }

  const handleUpload = async () => {
    if (!file) {
      setError("请选择文件")
      return
    }
    if (category === "hotel") {
      if (!customerName?.trim()) {
        setError("酒店审核需填写客户姓名")
        return
      }
      if (!departureDate) {
        setError("酒店审核需填写入住日期")
        return
      }
      if (!returnDate) {
        setError("酒店审核需填写退房日期")
        return
      }
    }
    setLoading(true)
    setError("")
    toast.info("正在创建任务，请在下方的任务列表中查看进度...")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("document_type", category)
      formData.append("visa_type", visaType)
      if (activeApplicant?.id) {
        formData.append("applicantProfileId", activeApplicant.id)
        if (activeApplicant.activeCaseId) {
          formData.append("caseId", activeApplicant.activeCaseId)
        }
      }
      if (needsFlightHotelFields || needsInsuranceFields) {
        if (customerName) formData.append("customer_name", customerName)
        if (departureDate) formData.append("departure_date", departureDate)
        if (needsFlightHotelFields && returnDate) formData.append("return_date", returnDate)
      }
      if (category === "hotel" && bookingVerify) {
        formData.append("booking_verify", "true")
      }

      const response = await fetch("/api/material-review/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: 上传失败`)
      }

      if (data.task_id) {
        setTaskIds((prev) => [...prev, data.task_id])
        toast.success("任务已创建，请在下方的任务列表中查看进度与结果。")
        handleReset()
      } else {
        throw new Error("API 响应异常")
      }
    } catch (err) {
      console.error("Upload error:", err)
      if (err instanceof Error) {
        setError(`上传失败: ${err.message}`)
        toast.error(err.message)
      } else {
        setError("上传失败，请重试")
        toast.error("上传失败，请重试")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] pt-28 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_22%_4%,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_78%_0%,rgba(16,185,129,0.14),transparent_30%)]" />
      <main className="relative mx-auto max-w-[1600px] space-y-8 px-4 pb-16 md:px-8">
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1">
              <ShieldCheck className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                AI Audit Engine v4.0
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">智能材料审核</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 tracking-wide text-white/50">
              通过 AI 深度比对行程单、机票与酒店确认函，精准拦截 214(b) 拒签风险。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-xs font-medium text-white transition hover:bg-white/[0.08] active:scale-95"
            >
              <FileText className="h-4 w-4 text-white/65" />
              历史审核报告
            </button>
            <Link
              href="/material-review/comprehensive"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-5 text-xs font-bold text-amber-100 transition hover:border-amber-300/25 hover:bg-amber-300/[0.10] active:scale-95"
            >
              <Layers className="h-4 w-4 text-amber-300/80" />
              切换多文件审核
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-12">
          <div className="space-y-6 md:space-y-8 lg:col-span-8">
            <label
              htmlFor="fileInput"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleFileDrop}
              className="pro-spotlight pro-spotlight-amber group relative flex h-[320px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[32px] border border-white/5 bg-[#0f0f12] p-8 text-center transition-all hover:border-white/10 md:p-12"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent opacity-20 transition-opacity duration-700 group-hover:opacity-40" />
              <div className="relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.05] shadow-2xl backdrop-blur-xl transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-110">
                <UploadCloud className="h-8 w-8 text-amber-400" />
              </div>
              <h2 className="relative z-10 text-2xl font-bold tracking-tight text-white">拖拽文件进行深度核验</h2>
              <p className="relative z-10 mt-3 max-w-sm text-sm leading-7 text-white/42">
                支持 PDF、JPG 或 ZIP 打包上传。核心引擎将自动分类、提取、交叉比对逻辑漏洞。
              </p>
              {file ? (
                <div className="relative z-10 mt-5 flex max-w-full items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="max-w-[260px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      setFile(null)
                    }}
                    className="text-white/45 transition hover:text-white"
                  >
                    删除
                  </button>
                </div>
              ) : null}
              <span
                className={cn(
                  "pro-cta-glow relative z-10 mt-8 inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold transition-all shadow-xl active:scale-95",
                  loading
                    ? "cursor-not-allowed border border-white/5 bg-white/10 text-white/50"
                    : "bg-amber-500 text-black shadow-amber-500/20 hover:scale-105 hover:bg-amber-400",
                )}
              >
                {loading ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  "点击选择文件"
                )}
              </span>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.txt,.zip"
                className="sr-only"
                id="fileInput"
              />
            </label>

            <section className="overflow-hidden rounded-[32px] border border-white/5 bg-[#0f0f12]">
              <div className="flex items-center justify-between border-b border-white/5 px-6 py-5 md:px-8 md:py-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05]">
                    <Layers className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <h2 className="font-bold tracking-tight text-white">核验结果数据流</h2>
                    <p className="mt-1 text-xs text-white/35">AI 审核任务创建后会在下方持续轮询结果。</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-md bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE STREAM
                </span>
              </div>

              <div className="space-y-5 p-6 md:p-8">
                {loading ? (
                  <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#1a1a1c] p-6">
                    <div className="absolute inset-0 -translate-x-[100%] bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.08),transparent)] animate-[sweep_2s_ease-in-out_infinite]" />
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                        <RotateCcw className="h-5 w-5 animate-spin text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">正在交叉比对 {categoryLabel}...</div>
                        <div className="mt-1 font-mono text-xs text-white/35">RUNNING_EXPERT_HEURISTICS_V4</div>
                      </div>
                    </div>
                  </div>
                ) : taskIds.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center rounded-3xl border border-dashed border-white/8 bg-white/[0.015]">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
                      <Search className="h-5 w-5 text-white/20" />
                    </div>
                    <p className="text-sm text-white/30">等待系统灌入数据...</p>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-3">
                  {auditSignals.map((signal) => (
                    <div
                      key={signal.code}
                      className={cn("rounded-2xl border p-4", signalToneClassMap[signal.tone])}
                    >
                      <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest">
                        {signal.tone === "red" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                        ) : null}
                        {signal.type} - {signal.code}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{signal.label}</p>
                    </div>
                  ))}
                </div>

                {error ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                ) : null}

                <MaterialTaskList
                  taskIds={taskIds}
                  filterTaskTypes={["material-review"]}
                  title="材料审核任务"
                  pollInterval={2000}
                  autoRefresh={true}
                  surface="dark"
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={loading || !file}
                    className={cn(
                      "pro-cta-glow inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold transition-all active:scale-95",
                      loading || !file
                        ? "cursor-not-allowed border border-white/5 bg-white/10 text-white/35"
                        : "bg-white text-black hover:bg-white/90",
                    )}
                  >
                    {loading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4" />}
                    {loading ? "上传分析中..." : "上传并分析文件"}
                  </button>
                  {file ? (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white active:scale-95"
                    >
                      <RefreshCw className="h-4 w-4" />
                      重置
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6 md:space-y-8 lg:col-span-4">
            <section className="rounded-[32px] border border-white/5 bg-[#0f0f12] p-6 md:p-8">
              <h2 className="mb-6 flex items-center gap-2 font-bold text-white">
                <Settings2 className="h-4 w-4 text-white/40" />
                核验环境配置
              </h2>

              <div className="relative space-y-5">
                <div className="absolute left-4 top-4 bottom-4 w-px bg-white/5" />

                <div className="relative pl-10">
                  <div className="absolute left-[13px] top-3 h-2 w-2 rounded-full bg-white/20 ring-4 ring-[#0f0f12]" />
                  <ProDropdown
                    label="Target Visa Rule"
                    value={visaType}
                    onChange={setVisaType}
                    options={VISA_RULE_DROPDOWN_OPTIONS}
                    triggerClassName="min-h-12"
                  />
                </div>

                <div className="relative pl-10">
                  <div className="absolute left-[13px] top-3 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-[#0f0f12]" />
                  <ProApplicantDropdown
                    label="Target Individual"
                    value={applicantContext}
                    onChange={setApplicantContext}
                    options={applicantDropdownOptions}
                  />
                </div>

                <div className="relative pl-10">
                  <div className="absolute left-[13px] top-3 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-[#0f0f12]" />
                  <ProDropdown
                    label="Document Type"
                    value={category}
                    onChange={setCategory}
                    options={DOCUMENT_TYPE_DROPDOWN_OPTIONS}
                    triggerClassName="min-h-12"
                  />
                </div>
              </div>
            </section>

            {needsFlightHotelFields || needsInsuranceFields ? (
              <section className="rounded-[32px] border border-amber-500/15 bg-amber-500/[0.04] p-6 md:p-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Context Addendum</p>
                <h2 className="mt-2 text-lg font-bold text-white">补充核验参数</h2>
                <div className="mt-5 grid gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/55">
                      {needsInsuranceFields ? "投保人姓名" : "客户姓名"}
                    </label>
                    <Input
                      placeholder="如：ZHANG San"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      className="pro-focus-glow border-white/10 bg-black/20 text-white placeholder:text-white/25 focus-visible:ring-0"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/55">
                        {needsInsuranceFields ? "出发时间" : "入住日期"}
                      </label>
                      <Input
                        type="date"
                        value={departureDate}
                        onChange={(event) => setDepartureDate(event.target.value)}
                        className="pro-focus-glow border-white/10 bg-black/20 text-white focus-visible:ring-0"
                      />
                    </div>
                    {needsFlightHotelFields ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-white/55">退房日期</label>
                        <Input
                          type="date"
                          value={returnDate}
                          onChange={(event) => setReturnDate(event.target.value)}
                          className="pro-focus-glow border-white/10 bg-black/20 text-white focus-visible:ring-0"
                        />
                      </div>
                    ) : null}
                  </div>
                  {category === "hotel" ? (
                    <label className="flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-black/20 p-4 text-sm text-amber-100">
                      <input
                        type="checkbox"
                        checked={bookingVerify}
                        onChange={(event) => setBookingVerify(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-amber-300 bg-black text-amber-500 focus:ring-amber-500"
                      />
                      <span>
                        验证 Booking.com 订单
                        <span className="mt-1 block text-xs leading-5 text-amber-100/55">
                          将从 OCR 中提取确认号与 PIN，并在 Booking.com 进行核验。
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="group relative overflow-hidden rounded-[32px] border border-white/5 bg-[#0f0f12] p-8 shadow-2xl shadow-black/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-white/5">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-[80px] transition-all duration-700 group-hover:bg-white/20" />
              <div className="relative z-10">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold leading-tight text-white">
                  遇到疑难杂症?
                  <br />
                  邀请资深顾问介入
                </h2>
                <p className="mt-4 text-[13px] leading-7 text-white/70">
                  顾问团队直接查看系统提取的报错日志，针对 Critical 点位提供 1v1 方案。
                </p>
                <button
                  type="button"
                  className="mt-8 h-12 w-full rounded-xl bg-white text-sm font-bold text-gray-900 shadow-lg transition hover:bg-gray-100 active:scale-95"
                >
                  发送协助请求
                </button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["Visa Rule", visaTypeLabel],
                ["Document", categoryLabel],
                ["Queue", `${taskIds.length} tasks`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</p>
                  <p className="mt-2 text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </section>
          </aside>
        </section>
      </main>
    </div>
  )
}

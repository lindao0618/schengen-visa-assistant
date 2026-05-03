"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  UserPlus,
  FilePlus,
  ClipboardList,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  RefreshCw,
  Wallet,
  FolderOpen,
  Settings,
  Play,
  RotateCcw,
  Trash2,
  Search,
  SlidersHorizontal,
  Terminal,
  CircleDot,
} from "lucide-react"
import { toast } from "sonner"
import { AuthPromptProvider, useAuthPrompt } from "@/app/usa-visa/contexts/AuthPromptContext"
import { ApplicantProfileSelector } from "@/components/applicant-profile-selector"
import { FranceCaseProgressCard } from "@/components/france-case-progress-card"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import {
  FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX,
  FRANCE_AUTOMATION_PROFILES_CACHE_TTL_MS,
  clearClientCacheByPrefix,
  getFranceAutomationProfilesCacheKey,
  readClientCache,
  writeClientCache,
} from "@/lib/applicant-client-cache"
import { getFranceTlsCityLabel, normalizeFranceTlsCity } from "@/lib/france-tls-city"

const FranceTaskList = dynamic(() => import("./FranceTaskList").then((mod) => mod.FranceTaskList), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
      正在加载任务列表...
    </div>
  ),
})

const FranceQuickStartCard = dynamic(() => import("./FranceQuickStartCard").then((mod) => mod.FranceQuickStartCard), {
  ssr: false,
  loading: () => (
    <div className="mb-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
      正在加载快速上手...
    </div>
  ),
})

interface ApplicantProfileOption {
  id: string
  label: string
  name?: string
  phone?: string
  schengen?: {
    country?: string
    city?: string
    fraNumber?: string
  }
  files?: Record<string, { originalName?: string; uploadedAt?: string }>
}

type FranceAutomationProfilesResponse = {
  profiles?: ApplicantProfileOption[]
}

interface FranceApplicantGroup {
  id: string
  applicantProfileId: string
  excelFile: File | null
}

function createFranceGroup(applicantProfileId = ""): FranceApplicantGroup {
  return {
    id: `fr-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    applicantProfileId,
    excelFile: null,
  }
}

function getProfileFranceExcel(profile: ApplicantProfileOption | undefined) {
  if (!profile?.files) return null
  return profile.files.schengenExcel || profile.files.franceExcel || null
}

function getProfileFranceApplicationJson(profile: ApplicantProfileOption | undefined) {
  if (!profile?.files) return null
  return profile.files.franceApplicationJson || null
}

function getProfileFranceTlsCity(profile: ApplicantProfileOption | undefined) {
  return normalizeFranceTlsCity(profile?.schengen?.city)
}

function formatUploadedAt(uploadedAt?: string) {
  if (!uploadedAt) return ""
  const d = new Date(uploadedAt)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("zh-CN", { hour12: false })
}

type TlsApplyClipboardPayload = {
  name?: string
  bookingWindow?: string
  acceptVip?: string
  city?: string
  phone?: string
  paymentAccount?: string
  paymentPassword?: string
  paymentLink?: string
}

type TlsApplyPreviewCase = {
  id: string
  tlsCity?: string | null
  bookingWindow?: string | null
  acceptVip?: string | null
  isActive?: boolean
}

type TlsApplyPreviewResponse = {
  profile?: {
    label?: string
    name?: string
    phone?: string
  } | null
  cases?: TlsApplyPreviewCase[]
  activeCaseId?: string | null
}

type FranceReviewApplicant = {
  familyName?: string
  firstName?: string
  dateOfBirth?: string
  nationality?: string
  passportType?: string
  passportNumber?: string
  passportIssueDate?: string
  passportExpiryDate?: string
  mobileNumber?: string
}

function extractFranceReviewApplicants(input: unknown): FranceReviewApplicant[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    const personalInfo =
      item && typeof item === "object" && "personalInfo" in item && item.personalInfo && typeof item.personalInfo === "object"
        ? (item.personalInfo as Record<string, unknown>)
        : {}

    return {
      familyName: typeof personalInfo.familyName === "string" ? personalInfo.familyName : "",
      firstName: typeof personalInfo.firstName === "string" ? personalInfo.firstName : "",
      dateOfBirth: typeof personalInfo.dateOfBirth === "string" ? personalInfo.dateOfBirth : "",
      nationality: typeof personalInfo.nationality === "string" ? personalInfo.nationality : "",
      passportType: typeof personalInfo.passportType === "string" ? personalInfo.passportType : "",
      passportNumber: typeof personalInfo.passportNumber === "string" ? personalInfo.passportNumber : "",
      passportIssueDate: typeof personalInfo.passportIssueDate === "string" ? personalInfo.passportIssueDate : "",
      passportExpiryDate: typeof personalInfo.passportExpiryDate === "string" ? personalInfo.passportExpiryDate : "",
      mobileNumber: typeof personalInfo.mobileNumber === "string" ? personalInfo.mobileNumber : "",
    }
  })
}

function formatReviewDate(value?: string) {
  return (value || "").replace(/-/g, "/")
}

function buildFranceReviewClipboardText(applicants: FranceReviewApplicant[]) {
  const normalizedApplicants = applicants.length > 0 ? applicants : [{}]
  const reviewBlocks = normalizedApplicants.map((applicant, index) => {
    const lines = [
      normalizedApplicants.length > 1 ? `申请人 ${index + 1} / Applicant ${index + 1}` : "审核信息 / Review Copy",
      `1. 姓 / Family name: ${applicant.familyName || ""}`,
      `2. 名 / First name(s): ${applicant.firstName || ""}`,
      `3. 出生日期 / Date of birth: ${formatReviewDate(applicant.dateOfBirth)}`,
      `4. 当前国籍 / Current nationality: ${applicant.nationality || ""}`,
      `5. 护照类型 / Passport type: ${applicant.passportType || ""}`,
      `6. 护照号 / Travel document number: ${applicant.passportNumber || ""}`,
      `7. 护照签发日期 / Travel document issue date: ${formatReviewDate(applicant.passportIssueDate)}`,
      `8. 护照到期日期 / Travel document expiration date: ${formatReviewDate(applicant.passportExpiryDate)}`,
      `9. 手机号码 / Mobile number: ${applicant.mobileNumber || ""}`,
    ]
    return lines.join("\n")
  })

  const notes = [
    "审核建议 / Review Notes",
    "1. 姓和名绝对不能反 / Family name and First name(s) must not be swapped.",
    "2. 出生日期一定不能错，重点检查月和日有没有反 / Date of birth must be checked carefully, especially month/day order.",
    "3. 国籍信息不能出错 / Nationality must be correct.",
    "4. 护照类型统一检查为 Ordinary passport / Passport type should be Ordinary passport.",
    "5. 护照号重点检查易混字符，例如 I、L、1、O、0 / Carefully check confusing passport characters such as I, L, 1, O, 0.",
    "6. 签发日期和到期日期要一起核对，通常为签发日后 10 年减 1 天 / Check issue date and expiry date together; it is usually 10 years minus 1 day.",
    "7. 手机号码格式不要错，应为 10 位且不带前导 0 / Mobile number should be 10 digits without a leading 0.",
  ]

  return [...reviewBlocks, notes.join("\n")].join("\n\n")
}

function buildTlsApplyClipboardText(payload: TlsApplyClipboardPayload) {
  const bookingWindow = payload.bookingWindow?.trim() || "没有填"
  const acceptVip = payload.acceptVip?.trim() || "没有填"
  const city = payload.city?.trim() || "没有填"
  const phone = payload.phone?.trim() || "没有填"
  const paymentAccount = payload.paymentAccount?.trim() || ""
  const paymentPassword = payload.paymentPassword?.trim() || ""
  const paymentLink = payload.paymentLink?.trim() || "https://visas-fr.tlscontact.com/en-us/"

  return [
    `1. 姓名：${payload.name?.trim() || ""}`,
    `2. 抢号区间再次确认：${bookingWindow}`,
    "⚠注意：这个区间内任意一天都有可能",
    "抢到后不可更改，有特殊要求现在和我说哦",
    "以此次汇报为准",
    `3. 是否接受 VIP：${acceptVip}`,
    `4. 递签城市：${city}`,
    "5. 人数：1",
    `6. 电话：${phone}`,
    `7. 付款账号：${paymentAccount}`,
    `8. 付款密码：${paymentPassword}`,
    `9. 付款链接：${paymentLink}`,
  ].join("\n")
}

function hasMissingTlsBookingWindow(payload: TlsApplyClipboardPayload) {
  return !payload.bookingWindow?.trim()
}

function selectTlsPreviewCase(
  cases: TlsApplyPreviewCase[],
  preferredCaseId?: string | null,
  fallbackCaseId?: string | null,
) {
  if (preferredCaseId) {
    const preferredCase = cases.find((item) => item.id === preferredCaseId)
    if (preferredCase) return preferredCase
  }
  if (fallbackCaseId) {
    const fallbackCase = cases.find((item) => item.id === fallbackCaseId)
    if (fallbackCase) return fallbackCase
  }
  return cases.find((item) => item.isActive) || cases[0] || null
}

async function copyTextToClipboard(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("当前浏览器不支持自动复制")
  }
  await navigator.clipboard.writeText(text)
}

interface CaptchaBalanceInfo {
  configured: boolean
  balance: number | null
  error: string | null
}
interface CaptchaBalance {
  capsolver: CaptchaBalanceInfo
  twocaptcha: CaptchaBalanceInfo
}

function CaptchaBalanceCard() {
  const [data, setData] = useState<CaptchaBalance | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchBalance = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/captcha-balance", { cache: "no-store" })
      if (res.ok) setData(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchBalance() }, [])

  const renderItem = (label: string, info: CaptchaBalanceInfo | undefined) => {
    if (!info) return null
    if (!info.configured) return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="font-medium">{label}</span>
        <span>未配置</span>
      </div>
    )
    if (info.error) return (
      <div className="flex items-center gap-2 text-xs text-red-500">
        <span className="font-medium">{label}</span>
        <AlertCircle className="h-3.5 w-3.5" />
        <span>查询失败: {info.error}</span>
      </div>
    )
    const low = info.balance !== null && info.balance < 1
    return (
      <div className={`flex items-center gap-2 text-xs ${low ? "text-orange-500" : "text-green-600 dark:text-green-400"}`}>
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <Wallet className="h-3.5 w-3.5" />
        <span className="font-semibold">${info.balance?.toFixed(2)}</span>
        {low && <span className="text-orange-500">（余额不足，请充值）</span>}
      </div>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 shadow-none">
      <div className="flex items-center gap-2 text-sm font-medium text-white/45">
        <Wallet className="h-4 w-4" />
        验证码余额
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : data ? (
        <div className="flex flex-wrap gap-4">
          {renderItem("Capsolver", data.capsolver)}
          {renderItem("2Captcha", data.twocaptcha)}
        </div>
      ) : (
        <span className="text-xs text-gray-400">查询失败</span>
      )}
      <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={fetchBalance} disabled={loading}>
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        刷新
      </Button>
    </div>
  )
}

const franceStopPresets = [
  "01. 注册",
  "02. 生成申请",
  "03. TLS填表",
  "04. 交外包商",
] as const

const francePipelineSteps = [
  { code: "01", title: "注册准备", detail: "FV & TLS 双边注册" },
  { code: "02", title: "生成新申请", detail: "France-visas 申请 JSON" },
  { code: "03", title: "TLS 填表提交", detail: "TLS 面签资料填写" },
  { code: "04", title: "提交外包商", detail: "交由外包商抢取 Slot" },
]

function getFrancePassportTail(activeApplicant: ReturnType<typeof useActiveApplicantProfile>) {
  const passport = activeApplicant?.passportLast4 || activeApplicant?.passportNumber || ""
  return passport ? passport.slice(-4) : "----"
}

function FranceAutomationContextBanner({
  activeApplicant,
  activeApplicantName,
}: {
  activeApplicant: ReturnType<typeof useActiveApplicantProfile>
  activeApplicantName?: string
}) {
  const activeCase = activeApplicant?.activeCase
  const status = activeCase?.mainStatus || "PENDING_PAYMENT"
  const tlsCity = activeCase?.tlsCity || activeApplicant?.schengen?.city || "TLS-LON"

  return (
    <section className="pro-spotlight pro-spotlight-blue relative overflow-hidden rounded-[32px] border border-white/5 bg-[#080808] p-6 md:p-8">
      <div className="pointer-events-none absolute bottom-0 left-16 h-px w-1/2 bg-white/10" />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-7 md:flex-row md:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] font-mono text-2xl font-bold text-white">
            FR
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                Dashboard Hero Banner
              </span>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                待付款 / 报价已发送
              </span>
            </div>
            <h1 className="truncate text-3xl font-bold tracking-tight text-white md:text-4xl">
              {activeApplicantName || "林志（测试）"}
            </h1>
            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                ["护照尾号", getFrancePassportTail(activeApplicant)],
                ["当前状态", status],
                ["TLS 递签城市", tlsCity],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</div>
                  <div className="mt-2 font-mono text-lg font-bold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={activeApplicant?.id ? `/applicants/${activeApplicant.id}?tab=materials` : "/applicants"}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-5 text-sm font-bold text-white/85 transition active:scale-95"
          >
            <FolderOpen className="h-4 w-4" />
            管理档案
          </Link>
          <button
            type="button"
            className="pro-cta-glow inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition active:scale-95"
          >
            <Settings className="h-4 w-4" />
            配置参数
          </button>
        </div>
      </div>
    </section>
  )
}

function FranceExecutionPanel({
  stopStep,
  onStopStepChange,
}: {
  stopStep: string
  onStopStepChange: (value: string) => void
}) {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.85fr]">
      <div className="pro-spotlight pro-spotlight-emerald rounded-[32px] border border-white/5 bg-white/[0.02] p-6 md:p-8">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-white">
          <Terminal className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">法签一键启动</h2>
        <p className="mt-3 text-sm leading-6 text-white/45">配置自动化卡点并一键执行任务流。</p>

        <label className="mt-8 block rounded-2xl border border-white/5 bg-black/30 p-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/38">自动化卡点预设</span>
          <select
            value={stopStep}
            onChange={(event) => onStopStepChange(event.target.value)}
            className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-transparent px-3 font-bold text-white outline-none"
          >
            {franceStopPresets.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <div className="pro-status-glow-success mt-5 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/38">当前状态</div>
          <div className="mt-3 flex items-center gap-2 text-base font-bold text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            就绪待发
          </div>
        </div>

        <button
          type="button"
          className="pro-cta-glow mt-8 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white text-base font-bold text-black transition active:scale-95"
        >
          <Play className="h-4 w-4 fill-black" />
          开始自动运行
        </button>
      </div>

      <div className="pro-spotlight pro-spotlight-blue rounded-[32px] border border-white/5 bg-white/[0.02] p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">法签案件进度</h2>
            <p className="mt-2 text-sm text-white/42">Updated: <span className="font-mono">2026/05/01 22:30:00</span></p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-white/72 transition active:scale-95">
              <RotateCcw className="h-4 w-4" />
              续跑
            </button>
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-red-400/20 px-4 text-sm text-red-300 transition active:scale-95">
              <Trash2 className="h-4 w-4" />
              清空
            </button>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-4">
          {francePipelineSteps.map((step, index) => {
            const active = index === 0
            return (
              <div key={step.code} className="relative">
                {index < francePipelineSteps.length - 1 ? <div className="absolute left-14 right-0 top-7 hidden h-px bg-white/10 md:block" /> : null}
                <div className={active ? "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white font-mono text-lg font-bold text-black" : "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] font-mono text-lg font-bold text-white/35"}>
                  {step.code}
                </div>
                <div className="mt-5 font-bold text-white">{step.title}</div>
                <div className="mt-2 text-xs text-white/38">{step.detail}</div>
              </div>
            )
          })}
        </div>

        <div className="mt-10 grid gap-4 rounded-3xl border border-white/5 bg-black/25 p-5 sm:grid-cols-2">
          {["FV 注册预备", "TLS 注册预备"].map((item) => (
            <div key={item}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{item}</div>
              <div className="mt-2 font-mono text-lg font-bold text-white">未开始</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FranceResultOutputCard() {
  return (
    <div className="pro-status-glow-success rounded-3xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-sm font-bold text-white">TASK-9920-6OZJG9</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              success
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-xs text-white/44 sm:grid-cols-3">
            <span>案件号 <strong className="font-mono text-white/75">FR-2026-0448</strong></span>
            <span>执行时间 <strong className="font-mono text-white/75">03m 42s</strong></span>
            <span>网关邮箱 <strong className="font-mono text-white/75">tls-lon@vistoria.pro</strong></span>
          </div>
        </div>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm font-bold text-white/72 transition active:scale-95">
          <Terminal className="h-4 w-4" />
          输出日志
        </button>
      </div>
    </div>
  )
}

function FranceAutomationContent() {
  const { showLoginPrompt } = useAuthPrompt()
  const { data: session } = useSession()
  const activeApplicant = useActiveApplicantProfile()
  const [profiles, setProfiles] = useState<ApplicantProfileOption[]>([])
  const viewerCacheScope = useMemo(
    () => `${session?.user?.id || "anon"}:${session?.user?.role || ""}`,
    [session?.user?.id, session?.user?.role],
  )
  const franceProfilesCacheKey = useMemo(
    () => getFranceAutomationProfilesCacheKey(viewerCacheScope),
    [viewerCacheScope],
  )

  const hasSchengenProfileExcel = Boolean(activeApplicant?.files?.schengenExcel || activeApplicant?.files?.franceExcel)
  const activeApplicantName = activeApplicant?.name || activeApplicant?.label
  const [stopStep, setStopStep] = useState<(typeof franceStopPresets)[number]>("03. TLS填表")

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const cached = readClientCache<FranceAutomationProfilesResponse>(franceProfilesCacheKey)
        if (cached?.profiles) {
          setProfiles(cached.profiles)
        }

        const res = await fetch("/api/applicants/france-automation", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as FranceAutomationProfilesResponse
        setProfiles((data.profiles || []) as ApplicantProfileOption[])
        writeClientCache(franceProfilesCacheKey, data, FRANCE_AUTOMATION_PROFILES_CACHE_TTL_MS)
      } catch (error) {
        console.error("Failed to load applicant profiles for France automation:", error)
      }
    }

    void loadProfiles()
    const handleRefresh = () => {
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
      void loadProfiles()
    }

    window.addEventListener("active-applicant-profile-refresh", handleRefresh)
    return () => {
      window.removeEventListener("active-applicant-profile-refresh", handleRefresh)
    }
  }, [franceProfilesCacheKey])
  return (
    <div className="pro-task-surface min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.055),transparent_28rem)]" />
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-40 sm:px-6 lg:px-8">
        <div className="space-y-7">
          <FranceAutomationContextBanner activeApplicant={activeApplicant} activeApplicantName={activeApplicantName} />
          <FranceExecutionPanel
            stopStep={stopStep}
            onStopStepChange={(value) => setStopStep(value as (typeof franceStopPresets)[number])}
          />
          <ApplicantProfileSelector scope="france-schengen" />
          <CaptchaBalanceCard />
          <div>
            <FranceCaseProgressCard
              applicantProfileId={activeApplicant?.id}
              applicantName={activeApplicantName}
              caseId={activeApplicant?.activeCaseId || undefined}
            />
          </div>
          <FranceQuickStartCard />

            <section className="pro-spotlight pro-spotlight-blue rounded-[32px] border border-white/5 bg-[#080808] p-5 md:p-7">
            <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Data Modules & Logs</div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">法签自动化业务看板</h2>
                <p className="mt-2 text-sm text-white/42">细粒度控制 France-visas 注册信息提取、账号注册、生成申请、填写回执、提交最终表与 TLS Contact 输出。</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black">France-Visas (FV)</span>
                <span className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-bold text-white/45">TLS Contact</span>
              </div>
            </div>

            <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                    className="pro-input pro-focus-glow h-12 w-full rounded-2xl border border-white/5 bg-white/[0.02] pl-11 pr-20 text-sm text-white outline-none placeholder:text-white/25"
                  placeholder="搜索任务号、申请人、模块或网关邮箱..."
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-white/35">
                  Cmd K
                </span>
              </div>
              <label className="inline-flex h-12 items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 text-sm text-white/55">
                <input type="checkbox" className="h-4 w-4 rounded border-white/20" />
                仅看当前申请人
                <SlidersHorizontal className="h-4 w-4 text-white/30" />
              </label>
            </div>

            <FranceResultOutputCard />

            <Tabs defaultValue="extract" className="mt-6 w-full">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
                <CircleDot className="h-4 w-4 text-white/50" />
                Pipeline Modules
              </div>
              <div className="mb-6 flex flex-col gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                    France-Visas (FV)
                  </p>
                  <TabsList className="grid h-12 w-full grid-cols-2 rounded-[24px] border border-white/5 bg-white/[0.02] p-1 sm:grid-cols-4">
                    <TabsTrigger value="extract" className="flex items-center justify-center gap-2 rounded-2xl data-[state=active]:bg-white data-[state=active]:text-black">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">01.FV注册</span>
                    </TabsTrigger>
                    <TabsTrigger value="create-app" className="flex items-center justify-center gap-2 rounded-2xl data-[state=active]:bg-white data-[state=active]:text-black">
                      <FilePlus className="h-4 w-4 shrink-0" />
                      <span className="truncate">02.生成新申请</span>
                    </TabsTrigger>
                    <TabsTrigger value="fill-receipt" className="flex items-center justify-center gap-2 rounded-2xl data-[state=active]:bg-white data-[state=active]:text-black">
                      <ClipboardList className="h-4 w-4 shrink-0" />
                      <span className="truncate">03.填写回执单</span>
                    </TabsTrigger>
                    <TabsTrigger value="submit-final" className="flex items-center justify-center gap-2 rounded-2xl data-[state=active]:bg-white data-[state=active]:text-black">
                      <Send className="h-4 w-4 shrink-0" />
                      <span className="truncate">04.提交最终表</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                    TLS Contact
                  </p>
                  <TabsList className="grid h-12 w-full grid-cols-2 rounded-[24px] border border-white/5 bg-white/[0.02] p-1">
                    <TabsTrigger value="tls-register" className="flex items-center justify-center gap-2 rounded-2xl data-[state=active]:bg-white data-[state=active]:text-black">
                      <UserPlus className="h-4 w-4 shrink-0" />
                      <span className="truncate">TLS 账户注册</span>
                    </TabsTrigger>
                    <TabsTrigger value="tls-apply" className="flex items-center justify-center gap-2 rounded-2xl data-[state=active]:bg-white data-[state=active]:text-black">
                      <Send className="h-4 w-4 shrink-0" />
                      <span className="truncate">TLS 填表提交</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

          <TabsContent value="extract">
            <StepCard
              title="FV注册"
              description="按申请组提交，系统直接使用原始 Excel 里的信息注册 France-visas 账号，不再单独产出中间 JSON。"
              apiPath="/api/schengen/france/extract-register"
              accept=".xlsx,.xls"
              buttonLabel="开始 FV注册"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div id="france-extract-register-tasks" className="mt-6">
              <FranceTaskList filterTaskTypes={["extract-register", "register"]} title="FV注册任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="create-app">
            <StepCard
              title="生成新申请"
              description="上传 Excel，在 France-visas 中创建新的申请。"
              apiPath="/api/schengen/france/create-application"
              accept=".xlsx,.xls"
              buttonLabel="生成申请"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div className="mt-6">
              <FranceReviewClipboardCard
                showLoginPrompt={showLoginPrompt}
                activeApplicantId={activeApplicant?.id}
                activeApplicantName={activeApplicantName}
                profiles={profiles}
              />
            </div>
            <div id="france-create-application-tasks" className="mt-6">
              <FranceTaskList filterTaskTypes={["create-application"]} title="生成新申请任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="fill-receipt">
            <StepCard
              title="填写回执单"
              description="上传 Excel，填写回执单并下载 PDF。"
              apiPath="/api/schengen/france/fill-receipt"
              accept=".xlsx,.xls"
              buttonLabel="填写回执单"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div id="france-fill-receipt-tasks" className="mt-6">
              <FranceTaskList filterTaskTypes={["fill-receipt"]} title="填写回执单任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="tls-register">
            <TlsRegisterCard
              showLoginPrompt={showLoginPrompt}
              locationDefault=""
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div id="france-tls-register-tasks" className="mt-6">
              <FranceTaskList filterTaskTypes={["tls-register"]} title="TLS 账户注册任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="tls-apply">
            <TlsApplyCard
              showLoginPrompt={showLoginPrompt}
              locationDefault=""
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div id="france-tls-apply-tasks" className="mt-6">
              <FranceTaskList filterTaskTypes={["tls-apply"]} title="TLS 填表提交任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="submit-final">
            <StepCard
              title="提交最终表"
              description="上传 Excel，提交最终申请表。"
              apiPath="/api/schengen/france/submit-final"
              accept=".xlsx,.xls"
              buttonLabel="提交最终表"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div id="france-submit-final-tasks" className="mt-6">
              <FranceTaskList filterTaskTypes={["submit-final"]} title="提交最终表任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>
        </Tabs>
          </section>
        </div>
      </main>
    </div>
  )
}

function StepCard({
  title,
  description,
  apiPath,
  accept,
  buttonLabel,
  showLoginPrompt,
  activeApplicantId,
  activeApplicantName,
  profiles,
  canUseApplicantProfile,
}: {
  title: string
  description: string
  apiPath: string
  accept: string
  buttonLabel: string
  showLoginPrompt: () => void
  activeApplicantId?: string
  activeApplicantName?: string
  profiles: ApplicantProfileOption[]
  canUseApplicantProfile: boolean
}) {
  const activeApplicant = useActiveApplicantProfile()
  const [groups, setGroups] = useState<FranceApplicantGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message?: string
    error?: string
    task_id?: string
    task_ids?: string[]
    download_excel?: string
    download_json?: string
    download_pdf?: string
  } | null>(null)

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles])

  const suggestProfileId = () => {
    const used = new Set(groups.map((group) => group.applicantProfileId).filter(Boolean))
    if (activeApplicantId && !used.has(activeApplicantId)) {
      return activeApplicantId
    }
    const unused = profiles.find((profile) => !used.has(profile.id))
    return unused?.id || activeApplicantId || ""
  }

  const addGroup = (prefillProfileId?: string) => {
    setGroups((current) => [...current, createFranceGroup(prefillProfileId ?? suggestProfileId())])
    setResult(null)
  }

  const updateGroup = (id: string, updates: Partial<FranceApplicantGroup>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...updates } : group)))
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
    setResult(null)
  }

  const getGroupProfile = (group: FranceApplicantGroup) =>
    group.applicantProfileId ? profileMap.get(group.applicantProfileId) : undefined

  const groupHasExcel = (group: FranceApplicantGroup) => !!group.excelFile || !!getProfileFranceExcel(getGroupProfile(group))

  const getGroupDisplayName = (group: FranceApplicantGroup, index: number) => {
    const profile = getGroupProfile(group)
    return profile?.name || profile?.label || `${title}申请组 ${index + 1}`
  }

  const submitOne = async (group: FranceApplicantGroup) => {
    const formData = new FormData()
    if (group.excelFile) {
      formData.append("file", group.excelFile)
    }
    if (group.applicantProfileId) {
      formData.append("applicantProfileId", group.applicantProfileId)
      if (activeApplicantId && group.applicantProfileId === activeApplicantId && activeApplicant?.activeCaseId) {
        formData.append("caseId", activeApplicant.activeCaseId)
      }
    }

    const res = await fetch(apiPath, { method: "POST", body: formData, credentials: "include" })
    if (res.status === 401) {
      showLoginPrompt()
      throw new Error("AUTH_REQUIRED")
    }
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || "处理失败")
    }
    return Array.isArray(data.task_ids) ? data.task_ids.length : data.task_id ? 1 : 0
  }

  const handleSubmit = async () => {
    const valid = groups.filter(groupHasExcel)
    if (valid.length === 0) {
      setResult({
        success: false,
        error: "请至少填写一组任务：上传 Excel，或选择带有可用 Excel 的申请人档案。",
      })
      return
    }

    setLoading(true)
    setResult(null)
    const errors: string[] = []
    let createdTasks = 0

    try {
      const responses = await Promise.allSettled(valid.map((group) => submitOne(group)))
      responses.forEach((response, index) => {
        const group = valid[index]
        if (response.status === "fulfilled") {
          createdTasks += response.value
          return
        }
        if (response.reason?.message === "AUTH_REQUIRED") return
        errors.push(`${getGroupDisplayName(group, index)}: ${response.reason?.message || "未知错误"}`)
      })

      if (responses.some((response) => response.status === "rejected" && response.reason?.message === "AUTH_REQUIRED")) {
        return
      }

      if (createdTasks > 0 && errors.length === 0) {
        setResult({
          success: true,
          message: `已创建 ${createdTasks} 个任务，可在下方任务列表追踪进度。`,
        })
        return
      }

      if (createdTasks > 0) {
        setResult({
          success: false,
          error: `已创建 ${createdTasks} 个任务，但部分任务失败：${errors.join("；")}`,
        })
        return
      }

      setResult({
        success: false,
        error: errors.join("；") || "处理失败",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="pro-spotlight pro-spotlight-blue overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] text-white shadow-none backdrop-blur-md">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-white/42">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {canUseApplicantProfile && activeApplicantId && (
          <Alert className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20">
            <AlertDescription className="text-sm">
              当前顶部已选档案“{activeApplicantName || "申请人"}”，不上传文件时会自动使用对应档案里的 Excel。
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {groups.map((group, index) => {
            const profile = getGroupProfile(group)
            const autoExcel = getProfileFranceExcel(profile)
            return (
              <div key={group.id} className="rounded-2xl border border-white/5 bg-black/25 p-4 shadow-none">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{title}申请组 {index + 1}</div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(group.id)} disabled={groups.length === 1}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>申请人档案</Label>
                    {profiles.length === 0 ? (
                      <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">暂无申请人档案，请先创建档案或手动上传 Excel。</p>
                    ) : (
                      <Select value={group.applicantProfileId || undefined} onValueChange={(value) => updateGroup(group.id, { applicantProfileId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择申请人档案（可选）" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name || item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{buttonLabel} Excel</Label>
                    <input type="file" accept={accept} onChange={(event) => updateGroup(group.id, { excelFile: event.target.files?.[0] || null })} className="block w-full text-sm" />
                    {group.excelFile ? (
                      <p className="text-xs text-muted-foreground">已手动选择：{group.excelFile.name}</p>
                    ) : autoExcel ? (
                      <p className="text-xs text-muted-foreground">
                        自动匹配：将使用档案 Excel {autoExcel.originalName || "申根 Excel"}
                        {autoExcel.uploadedAt ? `（更新于 ${formatUploadedAt(autoExcel.uploadedAt)}）` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-400">当前档案没有可用 Excel，请先上传。</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => addGroup()}>
            <Plus className="mr-2 h-4 w-4" />
            新增申请组
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="h-10 min-w-[180px] gap-2 bg-white text-black hover:bg-white/90 active:scale-95">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{loading ? "处理中..." : buttonLabel}</span>
          </Button>
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{result.success ? result.message : result.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function FranceReviewClipboardCard({
  showLoginPrompt,
  activeApplicantId,
  activeApplicantName,
  profiles,
}: {
  showLoginPrompt: () => void
  activeApplicantId?: string
  activeApplicantName?: string
  profiles: ApplicantProfileOption[]
}) {
  const [applicantProfileId, setApplicantProfileId] = useState(activeApplicantId || "")
  const [preview, setPreview] = useState("")
  const [previewApplicants, setPreviewApplicants] = useState<FranceReviewApplicant[]>([])
  const [loading, setLoading] = useState(false)
  const [exportingImage, setExportingImage] = useState(false)
  const [error, setError] = useState("")
  const captureRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (activeApplicantId) setApplicantProfileId(activeApplicantId)
  }, [activeApplicantId])

  const selectedProfile = useMemo(
    () => (applicantProfileId ? profiles.find((item) => item.id === applicantProfileId) : undefined),
    [applicantProfileId, profiles],
  )
  const selectedAutoApplicantsJson = getProfileFranceApplicationJson(selectedProfile)

  useEffect(() => {
    let cancelled = false

    const loadPreview = async () => {
      setPreview("")
      setPreviewApplicants([])
      setError("")
      if (!applicantProfileId.trim()) return
      if (!selectedAutoApplicantsJson) {
        setError("当前档案还没有“生成新申请”产出的 applicants JSON。")
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/applicants/${applicantProfileId.trim()}/files/franceApplicationJson`, {
          cache: "no-store",
          credentials: "include",
        })
        if (response.status === 401) {
          showLoginPrompt()
          throw new Error("AUTH_REQUIRED")
        }
        if (!response.ok) {
          throw new Error("无法读取档案中的 applicants JSON")
        }
        const parsed = JSON.parse(await response.text())
        const applicants = extractFranceReviewApplicants(parsed)
        const text = buildFranceReviewClipboardText(applicants)
        if (!cancelled) {
          setPreview(text)
          setPreviewApplicants(applicants.length > 0 ? applicants : [{}])
        }
      } catch (loadError) {
        if ((loadError as Error)?.message === "AUTH_REQUIRED") return
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "加载复制模板失败")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [applicantProfileId, selectedAutoApplicantsJson, showLoginPrompt])

  const handleCopy = async () => {
    if (!preview) {
      toast.warning("当前没有可复制的个人信息模板")
      return
    }
    try {
      await copyTextToClipboard(preview)
      toast.success("个人信息模板已复制到剪贴板")
    } catch (copyError) {
      toast.error(copyError instanceof Error ? copyError.message : "复制失败")
    }
  }

  const getCaptureDataUrl = async () => {
    if (!captureRef.current) {
      throw new Error("未找到可导出的内容区域")
    }
    const { toPng } = await import("html-to-image")
    return toPng(captureRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    })
  }

  const handleCopyAsImage = async () => {
    if (!previewApplicants.length) {
      toast.warning("当前没有可复制的内容")
      return
    }
    if (typeof window === "undefined" || typeof navigator === "undefined" || !(window as any).ClipboardItem) {
      toast.error("当前浏览器不支持复制图片，请使用下载 PNG")
      return
    }
    setExportingImage(true)
    try {
      const dataUrl = await getCaptureDataUrl()
      const blob = await (await fetch(dataUrl)).blob()
      await navigator.clipboard.write([new (window as any).ClipboardItem({ "image/png": blob })])
      toast.success("已复制图片到剪贴板")
    } catch (imageError) {
      toast.error(imageError instanceof Error ? imageError.message : "复制图片失败")
    } finally {
      setExportingImage(false)
    }
  }

  const handleDownloadPng = async () => {
    if (!previewApplicants.length) {
      toast.warning("当前没有可下载的内容")
      return
    }
    setExportingImage(true)
    try {
      const dataUrl = await getCaptureDataUrl()
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `france-review-${Date.now()}.png`
      link.click()
      toast.success("已下载 PNG")
    } catch (imageError) {
      toast.error(imageError instanceof Error ? imageError.message : "下载 PNG 失败")
    } finally {
      setExportingImage(false)
    }
  }

  const reviewTips = [
    "姓和名绝对不能反",
    "出生日期重点检查月和日",
    "国籍信息必须准确",
    "护照类型统一检查为 Ordinary passport",
    "护照号重点检查 I/L/1/O/0",
    "签发日期和到期日期要一起核对",
    "手机号码应为 10 位且不带前导 0",
  ]

  return (
    <Card className="pro-spotlight pro-spotlight-blue overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] text-white shadow-none backdrop-blur-md">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="text-white">个人信息复制模板</CardTitle>
        <CardDescription className="text-white/42">自动读取“生成新申请”产出的 applicants JSON，生成可复制的审核信息模板。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {activeApplicantId && (
          <Alert className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20">
            <AlertDescription className="text-sm">
              当前顶部已选档案“{activeApplicantName || "申请人"}”，可直接读取该档案的 applicants JSON。
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>申请人档案</Label>
          {profiles.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">暂无申请人档案。</p>
          ) : (
            <Select value={applicantProfileId || undefined} onValueChange={setApplicantProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="选择申请人档案" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name || item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {applicantProfileId && (
            <p className="text-xs text-muted-foreground">
              {selectedAutoApplicantsJson
                ? `自动匹配：${selectedAutoApplicantsJson.originalName || "franceApplicationJson"}${
                    selectedAutoApplicantsJson.uploadedAt ? `（更新于 ${formatUploadedAt(selectedAutoApplicantsJson.uploadedAt)}）` : ""
                  }`
                : "当前档案暂无 applicants JSON，请先执行“生成新申请”。"}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCopyAsImage} disabled={!previewApplicants.length || loading || exportingImage}>
            {exportingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            复制为图片
          </Button>
          <Button type="button" variant="outline" onClick={handleDownloadPng} disabled={!previewApplicants.length || loading || exportingImage}>
            {exportingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            下载 PNG
          </Button>
          <Button type="button" variant="outline" onClick={handleCopy} disabled={!preview || loading || exportingImage}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            复制个人信息模板
          </Button>
        </div>

        <div ref={captureRef} className="rounded-xl border border-gray-200 bg-white p-4">
          {previewApplicants.length > 0 ? (
            <div className="space-y-4">
            {previewApplicants.map((applicant, index) => (
              <div key={`review-applicant-${index}`} className="overflow-hidden rounded-xl border border-gray-200">
                <div className="bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                  {previewApplicants.length > 1 ? `申请人 ${index + 1}` : "申请人信息"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {[
                    ["姓 / Family name", applicant.familyName || "-"],
                    ["名 / First name(s)", applicant.firstName || "-"],
                    ["出生日期 / Date of birth", formatReviewDate(applicant.dateOfBirth) || "-"],
                    ["当前国籍 / Current nationality", applicant.nationality || "-"],
                    ["护照类型 / Passport type", applicant.passportType || "-"],
                    ["护照号 / Travel document number", applicant.passportNumber || "-"],
                    ["护照签发日期 / Issue date", formatReviewDate(applicant.passportIssueDate) || "-"],
                    ["护照到期日期 / Expiry date", formatReviewDate(applicant.passportExpiryDate) || "-"],
                    ["手机号码 / Mobile number", applicant.mobileNumber || "-"],
                  ].map(([label, value]) => (
                    <div key={`${index}-${label}`} className="border-t border-gray-100 px-3 py-2">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm font-semibold text-amber-900">审核建议</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900/90">
                {reviewTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
              {error ? `预览加载失败：${error}` : "这里会显示个人信息表格预览。请选择档案后自动生成。"}
            </div>
          )}
          {previewApplicants.length > 0 ? (
            <div className="mt-3 text-[11px] text-gray-400">导出时间：{new Date().toLocaleString("zh-CN", { hour12: false })}</div>
          ) : null}
        </div>

        <details className="rounded-md border border-gray-200 bg-gray-50/50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-gray-600">查看原始复制文本</summary>
          <Textarea
            readOnly
            className="mt-3 min-h-[180px] font-mono text-xs"
            value={preview || ""}
          />
        </details>
      </CardContent>
    </Card>
  )
}

function TlsRegisterCard({
  showLoginPrompt,
  locationDefault,
  activeApplicantId,
  activeApplicantName,
  profiles,
  canUseApplicantProfile,
}: {
  showLoginPrompt: () => void
  locationDefault: string
  activeApplicantId?: string
  activeApplicantName?: string
  profiles: ApplicantProfileOption[]
  canUseApplicantProfile: boolean
}) {
  const activeApplicant = useActiveApplicantProfile()
  const [location, setLocation] = useState<string>(locationDefault)
  const [applicantProfileId, setApplicantProfileId] = useState<string>(activeApplicantId || "")
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; task_id?: string; task_ids?: string[] } | null>(null)

  useEffect(() => {
    if (activeApplicantId) setApplicantProfileId(activeApplicantId)
  }, [activeApplicantId])

  const selectedProfile = useMemo(
    () => (applicantProfileId ? profiles.find((p) => p.id === applicantProfileId) : undefined),
    [applicantProfileId, profiles],
  )
  const selectedProfileExcel = getProfileFranceExcel(selectedProfile)
  const selectedHasSchengenExcel = Boolean(selectedProfileExcel)
  const selectedProfileCity = getProfileFranceTlsCity(selectedProfile) || ""
  const resolvedLocation = selectedProfileCity || location
  const selectedProfileCityLabel = getFranceTlsCityLabel(selectedProfileCity)
  const autoExcelLabel = selectedProfileExcel?.originalName || "schengenExcel"
  const autoExcelUploadedAt = formatUploadedAt(selectedProfileExcel?.uploadedAt)

  useEffect(() => {
    if (selectedProfileCity) {
      setLocation(selectedProfileCity)
    }
  }, [selectedProfileCity])

  const handleSubmit = async () => {
    if (!excelFile && !applicantProfileId.trim()) {
      setResult({ success: false, error: "请上传 Excel，或选择申请人档案自动匹配" })
      return
    }
    if (!excelFile && !selectedHasSchengenExcel) {
      setResult({ success: false, error: "所选档案没有申根 Excel，请先在“申请人”页上传申根表，或手动上传 Excel。" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      if (excelFile) formData.append("excel", excelFile)
      if (applicantProfileId.trim()) formData.append("applicantProfileId", applicantProfileId.trim())
      if (activeApplicantId && applicantProfileId.trim() === activeApplicantId && activeApplicant?.activeCaseId) {
        formData.append("caseId", activeApplicant.activeCaseId)
      }
      formData.append("location", resolvedLocation)

      const res = await fetch("/api/schengen/france/tls-register", { method: "POST", body: formData, credentials: "include" })
      if (res.status === 401) {
        showLoginPrompt()
        throw new Error("AUTH_REQUIRED")
      }
      const data = await res.json()
      if (!res.ok || !data.success) {
        setResult({ success: false, error: data.error || data.message || "TLS 注册失败" })
        return
      }
      setResult({ success: true, message: data.message, task_id: data.task_id, task_ids: data.task_ids })
    } catch (e) {
      if ((e as Error)?.message === "AUTH_REQUIRED") return
      setResult({ success: false, error: e instanceof Error ? e.message : "TLS 注册失败" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="pro-spotlight pro-spotlight-blue overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] text-white shadow-none backdrop-blur-md">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="text-white">TLS 账户注册</CardTitle>
        <CardDescription className="text-white/42">
          默认只用原始 Excel：可直接上传 Excel，或自动使用申请人档案里的申根 Excel，系统内部直接读取注册所需信息，不再要求单独准备中间 JSON。
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {canUseApplicantProfile && activeApplicantId && (
          <Alert className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20">
            <AlertDescription className="text-sm">
              当前顶部已选档案“{activeApplicantName || "申请人"}”。不上传文件时会自动使用该档案的申根 Excel 生成注册账号数据。
            </AlertDescription>
          </Alert>
        )}

        {selectedProfileCity && (
          <Alert className="border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <AlertDescription className="text-sm">
              已从申请人档案自动匹配 TLS 递签城市：{selectedProfileCity} - {selectedProfileCityLabel || selectedProfileCity}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2" hidden={Boolean(selectedProfileCity)}>
          <Label htmlFor="tls-location">TLS 地点（location）</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger id="tls-location">
              <SelectValue placeholder="选择 location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LON">LON - 伦敦</SelectItem>
              <SelectItem value="MNC">MNC - 曼彻斯特</SelectItem>
              <SelectItem value="EDI">EDI - 爱丁堡</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-register-profile">申请人档案（自动匹配来源）</Label>
          {profiles.length === 0 ? (
            <p id="tls-register-profile" className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              暂无申请人档案，可先手动上传 Excel。
            </p>
          ) : (
            <Select value={applicantProfileId || undefined} onValueChange={setApplicantProfileId}>
              <SelectTrigger id="tls-register-profile">
                <SelectValue placeholder="选择申请人档案（可选）" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name || item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-excel">Excel（可选）</Label>
          <input id="tls-excel" type="file" accept=".xlsx,.xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {excelFile && <p className="text-xs text-muted-foreground">已手动选择：{excelFile.name}</p>}
          {!excelFile && applicantProfileId && (
            <p className="text-xs text-muted-foreground">
              自动匹配：
              {selectedProfileExcel
                ? ` 将使用档案 Excel ${autoExcelLabel}${autoExcelUploadedAt ? `（更新于 ${autoExcelUploadedAt}）` : ""}`
                : " 当前档案没有申根 Excel，请先上传后再试。"}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || (!excelFile && !applicantProfileId.trim())}
            className="h-10 min-w-[180px] gap-2 bg-white text-black hover:bg-white/90 active:scale-95"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{loading ? "处理中..." : "开始 TLS 注册"}</span>
          </Button>
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {result.success ? result.message : result.error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function TlsApplyCard({
  showLoginPrompt,
  locationDefault,
  activeApplicantId,
  activeApplicantName,
  profiles,
  canUseApplicantProfile,
}: {
  showLoginPrompt: () => void
  locationDefault: string
  activeApplicantId?: string
  activeApplicantName?: string
  profiles: ApplicantProfileOption[]
  canUseApplicantProfile: boolean
}) {
  const activeApplicant = useActiveApplicantProfile()
  const [location, setLocation] = useState<string>(locationDefault)
  const [applicantProfileId, setApplicantProfileId] = useState<string>(activeApplicantId || "")
  const [applicantsFile, setApplicantsFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [reviewPreview, setReviewPreview] = useState("")
  const [reviewPreviewLoading, setReviewPreviewLoading] = useState(false)
  const [reviewPreviewError, setReviewPreviewError] = useState("")
  const [result, setResult] = useState<{
    success: boolean
    message?: string
    error?: string
    task_id?: string
    task_ids?: string[]
  } | null>(null)

  useEffect(() => {
    if (activeApplicantId) setApplicantProfileId(activeApplicantId)
  }, [activeApplicantId])

  const selectedProfile = useMemo(
    () => (applicantProfileId ? profiles.find((p) => p.id === applicantProfileId) : undefined),
    [applicantProfileId, profiles],
  )
  const selectedHasSchengenExcel = Boolean(selectedProfile && getProfileFranceExcel(selectedProfile))
  const selectedProfileCity = getProfileFranceTlsCity(selectedProfile) || ""
  const resolvedLocation = selectedProfileCity || location
  const selectedProfileCityLabel = getFranceTlsCityLabel(selectedProfileCity)
  const selectedAutoApplicantsJson = getProfileFranceApplicationJson(selectedProfile)
  const autoApplicantsLabel = selectedAutoApplicantsJson?.originalName || "franceApplicationJson"
  const autoApplicantsUploadedAt = formatUploadedAt(selectedAutoApplicantsJson?.uploadedAt)
  const preferredPreviewCaseId =
    activeApplicantId && applicantProfileId.trim() === activeApplicantId ? activeApplicant?.activeCaseId : undefined
  const legacyReviewPreviewEnabled = false

  useEffect(() => {
    if (selectedProfileCity) {
      setLocation(selectedProfileCity)
    }
  }, [selectedProfileCity])

  useEffect(() => {
    let cancelled = false

    const loadReviewPreview = async () => {
      setReviewPreview("")
      setReviewPreviewError("")

      if (!legacyReviewPreviewEnabled) {
        return
      }

      if (applicantsFile) {
        setReviewPreviewLoading(true)
        try {
          const raw = await applicantsFile.text()
          const parsed = JSON.parse(raw)
          const applicants = extractFranceReviewApplicants(parsed)
          if (!cancelled) {
            setReviewPreview(buildFranceReviewClipboardText(applicants))
          }
        } catch (error) {
          if (!cancelled) {
            setReviewPreviewError(error instanceof Error ? error.message : "无法解析 applicants JSON")
          }
        } finally {
          if (!cancelled) setReviewPreviewLoading(false)
        }
        return
      }

      if (!applicantProfileId.trim() || !selectedAutoApplicantsJson) {
        return
      }

      setReviewPreviewLoading(true)
      try {
        const response = await fetch(`/api/applicants/${applicantProfileId.trim()}/files/franceApplicationJson`, {
          cache: "no-store",
          credentials: "include",
        })
        if (!response.ok) {
          throw new Error("无法读取已存档的 France-visas JSON")
        }
        const parsed = JSON.parse(await response.text())
        const applicants = extractFranceReviewApplicants(parsed)
        if (!cancelled) {
          setReviewPreview(buildFranceReviewClipboardText(applicants))
        }
      } catch (error) {
        if (!cancelled) {
          setReviewPreviewError(error instanceof Error ? error.message : "加载审核预览失败")
        }
      } finally {
        if (!cancelled) setReviewPreviewLoading(false)
      }
    }

    void loadReviewPreview()

    return () => {
      cancelled = true
    }
  }, [applicantProfileId, applicantsFile, legacyReviewPreviewEnabled, selectedAutoApplicantsJson])

  useEffect(() => {
    let cancelled = false

    const loadTlsTemplatePreview = async () => {
      if (!applicantProfileId.trim()) return

      setReviewPreviewLoading(true)
      try {
        const response = await fetch(`/api/applicants/${applicantProfileId.trim()}`, {
          cache: "no-store",
          credentials: "include",
        })
        if (!response.ok) {
          throw new Error("无法读取申请人档案信息")
        }

        const parsed = (await response.json()) as TlsApplyPreviewResponse
        const cases = Array.isArray(parsed.cases) ? parsed.cases : []
        const previewCase = selectTlsPreviewCase(cases, preferredPreviewCaseId, parsed.activeCaseId)
        const previewPayload: TlsApplyClipboardPayload = {
          name: parsed.profile?.name || parsed.profile?.label || selectedProfile?.name || selectedProfile?.label || "",
          bookingWindow: previewCase?.bookingWindow || "",
          acceptVip: previewCase?.acceptVip || "",
          city: previewCase?.tlsCity || resolvedLocation || "",
          phone: parsed.profile?.phone || selectedProfile?.phone || "",
          paymentAccount: "",
          paymentPassword: "",
          paymentLink: "https://visas-fr.tlscontact.com/en-us/",
        }

        if (!cancelled) {
          setReviewPreview(buildTlsApplyClipboardText(previewPayload))
          setReviewPreviewError("")
        }
      } catch (error) {
        if (!cancelled) {
          setReviewPreviewError(error instanceof Error ? error.message : "加载 TLS 模板预览失败")
        }
      } finally {
        if (!cancelled) setReviewPreviewLoading(false)
      }
    }

    void loadTlsTemplatePreview()

    return () => {
      cancelled = true
    }
  }, [applicantProfileId, preferredPreviewCaseId, resolvedLocation, selectedProfile])

  const handleCopyTlsPreview = async () => {
    if (!reviewPreview) {
      toast.warning("当前没有可复制的 TLS 模板")
      return
    }

    try {
      await copyTextToClipboard(reviewPreview)
      if (reviewPreview.includes("2. 预约时间段：")) {
        toast.warning("该 Case 尚未配置预约时间段")
      }
      toast.success("TLS 模板已复制到剪贴板")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制 TLS 模板失败")
    }
  }

  const handleSubmitTls = async () => {
    if (!applicantProfileId.trim()) {
      setResult({ success: false, error: "请选择申请人档案" })
      return
    }
    if (!selectedHasSchengenExcel) {
      setResult({ success: false, error: "所选档案缺少申根 Excel，无法读取 TLS 账号信息" })
      return
    }
    if (!resolvedLocation) {
      setResult({ success: false, error: "未识别到 TLS 递签城市，请先在档案中设置城市" })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      if (applicantsFile) formData.append("applicants", applicantsFile)
      formData.append("location", resolvedLocation)
      formData.append("applicantProfileId", applicantProfileId.trim())
      if (activeApplicantId && applicantProfileId.trim() === activeApplicantId && activeApplicant?.activeCaseId) {
        formData.append("caseId", activeApplicant.activeCaseId)
      }

      const res = await fetch("/api/schengen/france/tls-apply", { method: "POST", body: formData, credentials: "include" })
      if (res.status === 401) {
        showLoginPrompt()
        throw new Error("AUTH_REQUIRED")
      }
      const data = await res.json()
      if (!res.ok || !data.success) {
        setResult({ success: false, error: data.error || data.message || "TLS 提交失败" })
        return
      }

      const clipboard = (data.clipboard || {}) as TlsApplyClipboardPayload
      const clipboardText = buildTlsApplyClipboardText(clipboard)
      setReviewPreview(clipboardText)
      setReviewPreviewError("")

      try {
        await copyTextToClipboard(clipboardText)
        if (hasMissingTlsBookingWindow(clipboard)) {
          toast.warning("该 Case 尚未配置预约时间段")
        }
        toast.success("TLS 模板已复制到剪贴板")
      } catch (clipboardError) {
        toast.error(clipboardError instanceof Error ? clipboardError.message : "复制模板失败")
      }

      setResult({
        success: true,
        message: `${data.message || "TLS 提交任务已创建"}，并已复制 TLS 模板`,
        task_id: data.task_id,
        task_ids: data.task_ids,
      })
    } catch (error) {
      if ((error as Error)?.message === "AUTH_REQUIRED") return
      setResult({ success: false, error: error instanceof Error ? error.message : "TLS 提交失败" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="pro-spotlight pro-spotlight-blue overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] text-white shadow-none backdrop-blur-md">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="text-white">TLS 填表提交</CardTitle>
        <CardDescription className="text-white/42">
          与填写回执单相同，TLS 登录邮箱、密码从所选档案的<strong className="font-medium text-foreground">申根 Excel</strong>自动读取；applicants 可手动上传，不上传时自动使用“生成新申请”已存档 JSON。
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {canUseApplicantProfile && activeApplicantId && (
          <Alert className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20">
            <AlertDescription className="text-sm">
              当前顶部已选档案“{activeApplicantName || "申请人"}”，账号信息会从对应档案的 Excel 自动解析。
            </AlertDescription>
          </Alert>
        )}

        {selectedProfileCity && (
          <Alert className="border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <AlertDescription className="text-sm">
              已从申请人档案自动匹配 TLS 递签城市：{selectedProfileCity} - {selectedProfileCityLabel || selectedProfileCity}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2" hidden={Boolean(selectedProfileCity)}>
          <Label htmlFor="tls-apply-location">TLS 地点（location）</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger id="tls-apply-location">
              <SelectValue placeholder="选择 location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LON">LON - 伦敦</SelectItem>
              <SelectItem value="MNC">MNC - 曼彻斯特</SelectItem>
              <SelectItem value="EDI">EDI - 爱丁堡</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-apply-profile">申请人档案（用于读取 Excel 中的邮箱/密码）</Label>
          {profiles.length === 0 ? (
            <p id="tls-apply-profile" className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              暂无申请人档案，请先在“申请人”页创建并上传申根 Excel。
            </p>
          ) : (
            <Select value={applicantProfileId || undefined} onValueChange={setApplicantProfileId}>
              <SelectTrigger id="tls-apply-profile">
                <SelectValue placeholder="选择申请人档案" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name || item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {applicantProfileId && !selectedHasSchengenExcel && (
            <p className="text-sm text-amber-700 dark:text-amber-400">该档案尚未上传申根 Excel。</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-apply-applicants">applicants 数组 json（可选，留空则自动使用档案里的生成新申请 JSON）</Label>
          <input id="tls-apply-applicants" type="file" accept=".json" onChange={(e) => setApplicantsFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {!applicantsFile && applicantProfileId && (
            <p className="text-xs text-muted-foreground">
              自动匹配：
              {selectedAutoApplicantsJson
                ? ` 将使用档案文件 ${autoApplicantsLabel}${autoApplicantsUploadedAt ? `（更新于 ${autoApplicantsUploadedAt}）` : ""}`
                : " 当前档案还没有生成新申请 JSON，请先执行“生成新申请”或手动上传 applicants 文件。"}
            </p>
          )}
          {applicantsFile && <p className="text-xs text-muted-foreground">已手动选择：{applicantsFile.name}（本次优先使用手动文件）</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="tls-apply-review-preview">TLS 信息预览</Label>
            <div className="flex items-center gap-2">
              {reviewPreviewLoading ? <span className="text-xs text-muted-foreground">加载中...</span> : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopyTlsPreview()}
                disabled={!reviewPreview}
                className="h-8 gap-2"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>复制 TLS 信息</span>
              </Button>
            </div>
          </div>
          <Textarea
            id="tls-apply-review-preview"
            value={
              reviewPreview ||
              (reviewPreviewError
                ? `预览加载失败：${reviewPreviewError}`
                : "这里会显示最终复制到剪贴板的 TLS 模板内容。提交前可先检查抢号区间、VIP、城市和电话。")
            }
            readOnly
            className="min-h-[320px] font-mono text-xs"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSubmitTls}
            disabled={loading || !applicantProfileId.trim() || !selectedHasSchengenExcel}
            className="h-10 min-w-[180px] gap-2 bg-white text-black hover:bg-white/90 active:scale-95"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{loading ? "处理中..." : "开始 TLS 填表"}</span>
          </Button>
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {result.success ? result.message : result.error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default function FranceAutomationClientPage() {
  return (
    <AuthPromptProvider>
      <FranceAutomationContent />
    </AuthPromptProvider>
  )
}

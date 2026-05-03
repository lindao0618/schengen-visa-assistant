"use client"

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import dynamic from "next/dynamic"
import {
  AtSign,
  BookOpen,
  Copy,
  Database,
  FileClock,
  FileText,
  Fingerprint,
  Globe2,
  Hash,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ProDropdown } from "@/components/pro-ui/pro-dropdown"
import type { ApplicantProfileDetail, BasicFormState } from "@/app/applicants/[id]/detail/types"
import { FRANCE_TLS_CITY_OPTIONS } from "@/lib/france-tls-city"

const ParsedIntakeAccordion = dynamic(
  () => import("@/app/applicants/[id]/detail/parsed-intake-accordion").then((mod) => mod.ParsedIntakeAccordion),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/45">
        完整 intake 模块加载中...
      </div>
    ),
  },
)

type BasicWorkspaceKey = "crm" | "usVisa" | "schengen"
type WorkspaceTone = "emerald" | "amber" | "red"

function displayValue(value?: string | null, fallback = "-") {
  return value && value.trim() ? value : fallback
}

function shortDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
}

function getDefaultBasicPanel(selectedCaseType?: string): BasicWorkspaceKey {
  if (selectedCaseType === "usa-visa") return "usVisa"
  if (selectedCaseType === "france-schengen") return "schengen"
  return "crm"
}

function calculateHealthScore({
  basicForm,
  profile,
  selectedCaseType,
}: {
  basicForm: BasicFormState
  profile: ApplicantProfileDetail
  selectedCaseType?: string
}) {
  const identityFields = [basicForm.name, basicForm.phone, basicForm.email, basicForm.passportNumber].filter(Boolean).length
  const visaBoost = profile.usVisa?.fullIntake || profile.schengen?.fullIntake ? 10 : 0
  const caseBoost = selectedCaseType ? 6 : 0

  return Math.min(96, 52 + identityFields * 8 + visaBoost + caseBoost)
}

function statusToneClasses(tone: WorkspaceTone) {
  if (tone === "emerald") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
  if (tone === "amber") return "border-amber-400/20 bg-amber-400/10 text-amber-300"
  return "border-red-400/20 bg-red-400/10 text-red-300"
}

function BasicWorkspaceNav({
  activeValue,
  onValueChange,
  items,
}: {
  activeValue: BasicWorkspaceKey
  onValueChange: (value: BasicWorkspaceKey) => void
  items: Array<{
    value: BasicWorkspaceKey
    label: string
    status: string
    tone: WorkspaceTone
    icon: ReactNode
  }>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => {
        const active = item.value === activeValue
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(item.value)}
            className={`group relative overflow-hidden rounded-[28px] border px-5 py-4 text-left shadow-2xl shadow-black/20 transition-all active:scale-[0.98] ${
              active
                ? "border-white/22 bg-white/[0.10] ring-1 ring-white/10"
                : "border-white/6 bg-[#101012]/70 hover:border-white/14 hover:bg-white/[0.04]"
            }`}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-emerald-400/6 blur-3xl opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-white/50">
                  {item.icon}
                </span>
                <span className={`text-sm font-black ${active ? "text-white" : "text-white/45"}`}>{item.label}</span>
              </div>
              <span
                className={`rounded-lg border px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-widest ${statusToneClasses(item.tone)}`}
              >
                {item.status}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function BasicSystemStatusBar({
  activeValue,
  onValueChange,
  hasUsVisaIntake,
  hasSchengenIntake,
  hasTlsAccountHints,
}: {
  activeValue: BasicWorkspaceKey
  onValueChange: (value: BasicWorkspaceKey) => void
  hasUsVisaIntake: boolean
  hasSchengenIntake: boolean
  hasTlsAccountHints: boolean
}) {
  return (
    <BasicWorkspaceNav
      activeValue={activeValue}
      onValueChange={onValueChange}
      items={[
        {
          value: "crm",
          label: "CRM 数据中心",
          status: "SYNCHRONIZED",
          tone: "emerald",
          icon: <Database className="h-4 w-4" />,
        },
        {
          value: "usVisa",
          label: "美国签证基础",
          status: hasUsVisaIntake ? "SYNCHRONIZED" : "WAITING_UPLOAD",
          tone: hasUsVisaIntake ? "emerald" : "amber",
          icon: <Target className="h-4 w-4" />,
        },
        {
          value: "schengen",
          label: "申根基础信息",
          status: hasSchengenIntake ? "SYNCHRONIZED" : hasTlsAccountHints ? "SYNC_READY" : "INCOMPLETE",
          tone: hasSchengenIntake ? "emerald" : hasTlsAccountHints ? "amber" : "red",
          icon: <Globe2 className="h-4 w-4" />,
        },
      ]}
    />
  )
}

function IdentityField({
  label,
  icon,
  value,
  onChange,
  placeholder,
  disabled,
  readOnly = false,
}: {
  label: string
  icon: ReactNode
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
}) {
  return (
    <div className="group flex flex-col gap-3">
      <Label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/20 transition-colors group-focus-within:text-emerald-400">
        <span className="text-white/25 transition-colors group-focus-within:text-emerald-400">{icon}</span>
        {label}
      </Label>
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly || !onChange}
        className="h-[58px] w-full rounded-[24px] border-2 border-white/5 bg-white/[0.03] px-6 text-sm font-semibold text-white outline-none transition-all placeholder:text-white/10 hover:border-white/10 hover:bg-white/[0.04] focus:border-emerald-500/30 focus:bg-white/[0.05] focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      />
    </div>
  )
}

function ExtractedContactField({
  label,
  icon,
  value,
  fallback,
}: {
  label: string
  icon: ReactNode
  value: string
  fallback: string
}) {
  const display = displayValue(value, fallback)

  return (
    <div className="group flex flex-col gap-3">
      <Label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/20">
        <span className="text-white/25">{icon}</span>
        {label}
      </Label>
      <div className="min-h-[58px] rounded-[24px] border border-white/6 bg-white/[0.025] px-5 py-3 shadow-inner shadow-white/[0.02]">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-mono text-sm font-bold text-white/78">{display}</div>
          <span className="shrink-0 rounded-md border border-emerald-400/15 bg-emerald-400/8 px-2 py-1 font-mono text-[9px] font-black uppercase tracking-widest text-emerald-300/70">
            Excel/JSON
          </span>
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/24">auto extracted field</div>
      </div>
    </div>
  )
}

function StaticMetric({
  label,
  value,
  icon,
  tone = "slate",
}: {
  label: string
  value: string
  icon: ReactNode
  tone?: "slate" | "emerald" | "blue" | "amber"
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-400/10 text-emerald-300"
      : tone === "blue"
        ? "bg-blue-400/10 text-blue-300"
        : tone === "amber"
          ? "bg-amber-400/10 text-amber-300"
          : "bg-white/[0.05] text-white/50"

  return (
    <div className="rounded-[28px] border border-white/5 bg-white/[0.025] p-5">
      <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</div>
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/24">{label}</div>
      <div className="mt-2 break-all font-mono text-sm font-bold text-white/78">{value}</div>
    </div>
  )
}

function ReadOnlySelectLikeField({
  label,
  value,
  meta,
  icon,
  tone = "slate",
}: {
  label: string
  value: string
  meta?: string
  icon: ReactNode
  tone?: "slate" | "emerald" | "blue" | "amber"
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-400/10 text-emerald-300"
      : tone === "blue"
        ? "bg-blue-400/10 text-blue-300"
        : tone === "amber"
          ? "bg-amber-400/10 text-amber-300"
          : "bg-white/[0.05] text-white/50"

  return (
    <div className="group flex flex-col gap-2">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</Label>
      <div className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1a1c] p-2.5 shadow-sm">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 shadow-inner ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-bold leading-none text-white">{value}</div>
          {meta ? <div className="mt-1 truncate text-[10px] leading-none text-gray-400">{meta}</div> : null}
        </div>
      </div>
    </div>
  )
}

function ComplianceHealthCard({ score }: { score: number }) {
  const progress = Math.max(0, Math.min(100, score))
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (progress / 100) * circumference

  return (
    <section className="relative overflow-hidden rounded-[44px] border border-white/5 bg-[#111113]/90 p-8 shadow-2xl shadow-black/35">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/8 blur-[60px]" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-white/28">
          <ShieldCheck className="h-4 w-4" />
          合规健康度
        </div>
        <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">
          OPTIMAL
        </span>
      </div>
      <div className="relative z-10 mt-10 flex justify-center">
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="12" fill="none" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="rgb(16 185 129)"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-black tracking-tight text-white">{score}</div>
            <div className="font-mono text-[9px] font-black uppercase tracking-widest text-white/30">score</div>
          </div>
        </div>
      </div>
      <p className="relative z-10 mt-7 text-center text-[12px] font-medium leading-6 text-white/42">
        基础字段完整度较高，系统正在对邮箱、护照号和签证系统字段进行关联校验。
      </p>
    </section>
  )
}

function ArchiveTraceTimeline({ profile }: { profile: ApplicantProfileDetail }) {
  const latestFile = Object.values(profile.files || {}).sort((a, b) => {
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  })[0]

  const traces = [
    { title: "创建档案", meta: "System Alpha", date: "04/13" },
    { title: "更新基础字段", meta: "CRM Operator", date: "04/13" },
    { title: latestFile ? "上传材料记录" : "护照号校验通过", meta: latestFile?.originalName || "AI Inspector", date: shortDate(latestFile?.uploadedAt) },
  ]

  return (
    <section className="rounded-[44px] border border-white/5 bg-[#111113]/90 p-8 shadow-2xl shadow-black/35">
      <div className="mb-8 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-white/28">
        <FileClock className="h-4 w-4" />
        档案追溯
      </div>
      <div className="space-y-7">
        {traces.map((trace, index) => (
          <div key={`${trace.title}-${index}`} className="relative flex gap-4 pl-1">
            {index < traces.length - 1 ? <div className="absolute left-[7px] top-5 h-[calc(100%+14px)] w-px bg-white/8" /> : null}
            <span className="relative z-10 mt-1 h-3.5 w-3.5 rounded-full bg-white/25 ring-4 ring-[#111113]" />
            <div className="min-w-0">
              <div className="text-sm font-black text-white">{trace.title}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-white/30">
                <span>{trace.date}</span>
                <span>{trace.meta}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AiSuggestionBlock() {
  return (
    <div className="mt-12 flex flex-col gap-5 rounded-[36px] border border-indigo-400/20 bg-indigo-500/10 p-6 shadow-2xl shadow-indigo-950/20 md:flex-row md:items-center">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black text-white">智能后续补全建议</div>
        <p className="mt-1 text-[12px] font-medium leading-5 text-white/50">
          检测到该姓名在每项签证系统中已有过往记录，是否自动关联历史护照与联系方式？
        </p>
      </div>
      <Button
        type="button"
        className="rounded-2xl bg-white px-6 py-3 text-sm font-black text-black shadow-xl shadow-white/10 transition-all hover:bg-emerald-300 active:scale-95"
      >
        一键关联
      </Button>
    </div>
  )
}

function AuditNodeCard({
  title,
  description,
  tone,
  children,
}: {
  title: string
  description: string
  tone: "emerald" | "amber"
  children: ReactNode
}) {
  const iconClass = tone === "emerald" ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-400/12 text-amber-300"
  const progressClass = tone === "emerald" ? "bg-emerald-400" : "bg-amber-400"

  return (
    <div className="rounded-[32px] border border-dashed border-white/10 bg-white/[0.025] p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-black tracking-tight text-white">{title}</div>
            <p className="mt-1 text-sm text-white/40">{description}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white/60">
          展开后加载
        </div>
      </div>
      <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div className={`h-full w-[72%] rounded-full ${progressClass}`} />
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function TlsAccountSyncCenter({
  tlsAccountTemplateText,
  hasTlsAccountHints,
  onCopyTlsAccountTemplate,
}: {
  tlsAccountTemplateText: string
  hasTlsAccountHints: boolean
  onCopyTlsAccountTemplate: () => void | Promise<void>
}) {
  return (
    <div id="tls-account" className="rounded-[32px] border border-white/8 bg-white/[0.035] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-300">
            <Copy className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-black text-white">TLS 账号信息自动同步</div>
              <Badge variant="info" className="bg-blue-400/12 text-blue-200">
                {hasTlsAccountHints ? "可复制" : "待补充"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-white/42">接申根基础内容实时生成，和 TLS 城市、FRA 信息一站式维护。</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl border-white/10 bg-white/[0.04] px-5 py-3 text-white hover:bg-white/[0.08]"
          onClick={() => void onCopyTlsAccountTemplate()}
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          一键同步剪贴板
        </Button>
      </div>
      <pre className="mt-6 min-h-[190px] overflow-auto whitespace-pre-wrap rounded-[24px] bg-black/55 p-6 font-mono text-[12px] leading-7 text-emerald-200/80">
        {tlsAccountTemplateText || "1. 姓名: Wait for Applicant\n2. 账号区间: [AI Sync Pending]\n3. 受理中心: Wait for TLS City\n...\n8. 付款凭证: Wait for Capture"}
      </pre>
    </div>
  )
}

export function BasicTabContent({
  applicantId,
  profile,
  selectedCaseType,
  basicForm,
  setBasicForm,
  tlsAccountTemplateText,
  isReadOnlyViewer,
  savingProfile,
  canEditApplicant,
  onCopyTlsAccountTemplate,
  onSaveProfile,
}: {
  applicantId: string
  profile: ApplicantProfileDetail
  selectedCaseType?: string
  basicForm: BasicFormState
  setBasicForm: Dispatch<SetStateAction<BasicFormState>>
  tlsAccountTemplateText: string
  isReadOnlyViewer: boolean
  savingProfile: boolean
  canEditApplicant: boolean
  onCopyTlsAccountTemplate: () => void | Promise<void>
  onSaveProfile: () => Promise<void>
}) {
  const files = profile.files || {}
  const usVisaIntakePhotoSlot = files.usVisaPhoto ? "usVisaPhoto" : files.photo ? "photo" : undefined
  const hasUsVisaIntake = Boolean(profile.usVisa?.fullIntake)
  const hasSchengenIntake = Boolean(profile.schengen?.fullIntake)
  const hasTlsAccountHints = Boolean(basicForm.email || basicForm.schengenVisaCity || profile.schengen?.fraNumber)
  const healthScore = calculateHealthScore({ basicForm, profile, selectedCaseType })
  const disabled = isReadOnlyViewer || !canEditApplicant
  const [activeBasicPanel, setActiveBasicPanel] = useState<BasicWorkspaceKey>(() => getDefaultBasicPanel(selectedCaseType))

  function renderBasicWorkspacePanel() {
    if (activeBasicPanel === "usVisa") {
      return (
        <section
          id="us-visa-basic"
          className="relative overflow-hidden rounded-[56px] border border-white/5 bg-[#161619] p-8 shadow-2xl shadow-black/40 md:p-12 xl:p-16"
        >
          <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-amber-400/8 blur-[90px]" />
          <div className="relative z-10 mb-14 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.055] text-white/48">
                <Target className="h-7 w-7" />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white">美签基础信息</h2>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/36">
                这块信息将继续为 DS-160 表格、AIS 账号注册及最终递交单提供复用数据及校验支撑。
              </p>
            </div>
            <span className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-6 py-3 font-mono text-[11px] font-black uppercase tracking-widest text-amber-300">
              {hasUsVisaIntake ? "SYNCHRONIZED" : "WAITING UPLOAD"}
            </span>
          </div>

          <div className="relative z-10 grid gap-7 lg:grid-cols-4">
            <StaticMetric label="AA 码" value={displayValue(profile.usVisa?.aaCode, "仅 DS-160 成功后自动生成")} icon={<Hash className="h-5 w-5" />} tone="amber" />
            <IdentityField
              label="姓 (Surname)"
              icon={<AtSign className="h-3.5 w-3.5" />}
              value={basicForm.usVisaSurname}
              onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaSurname: value }))}
              placeholder="ZHANG"
              disabled={disabled}
            />
            <IdentityField
              label="出生年份"
              icon={<FileClock className="h-3.5 w-3.5" />}
              value={basicForm.usVisaBirthYear}
              onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaBirthYear: value }))}
              placeholder="19XX"
              disabled={disabled}
            />
            <IdentityField
              label="美签护照号"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              value={basicForm.usVisaPassportNumber}
              onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaPassportNumber: value }))}
              placeholder="输入护照号..."
              disabled={disabled}
            />
          </div>

          <div className="relative z-10 mt-12">
            <AuditNodeCard
              title="完整美签 Intake 报告"
              description="展开后直接查看 Excel 智能抽取的个人信息、审计结果与配套照片。"
              tone="amber"
            >
              <ParsedIntakeAccordion
                applicantId={applicantId}
                scope="usVisa"
                title="完整美签 intake"
                subtitle="展开后直接查看 Excel 已提取的完整个人信息、审计结果和照片。"
                tone="sky"
                intake={profile.usVisa?.fullIntake}
                photoSlot={usVisaIntakePhotoSlot}
                photoLabel="美签照片"
                emptyMessage="还没有可用的美签 intake。先上传 DS-160 / AIS Excel，系统会自动解析并在这里沉淀完整结构化信息。"
              />
            </AuditNodeCard>
          </div>
        </section>
      )
    }

    if (activeBasicPanel === "schengen") {
      return (
        <section
          id="schengen-basic"
          className="relative overflow-visible rounded-[56px] border border-white/5 bg-[#161619] p-8 shadow-2xl shadow-black/40 md:p-12 xl:p-16"
        >
          <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-emerald-400/8 blur-[90px]" />
          <div className="relative z-10 mb-14">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.055] text-white/48">
              <Globe2 className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white">申根基础信息集成</h2>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/36">
              申根国家、TLS/VFS 递签城市和系统账号是自动化链路的底层中枢，服务于法签/德签等申根自动化工单。
            </p>
          </div>

          <div className="relative z-30 grid items-end gap-7 md:grid-cols-3">
            <ProDropdown
              label="申根国家"
              value={basicForm.schengenCountry || "france"}
              onChange={(value) => setBasicForm((prev) => ({ ...prev, schengenCountry: value }))}
              disabled={disabled}
              options={[
                { value: "france", label: "法国", meta: "自动化链路就绪", iconLabel: "🇫🇷", tone: "emerald" },
              ]}
            />
            <ProDropdown
              label="TLS 递签城市"
              value={basicForm.schengenVisaCity || "__unset__"}
              onChange={(value) => setBasicForm((prev) => ({ ...prev, schengenVisaCity: value === "__unset__" ? "" : value }))}
              disabled={disabled}
              options={[
                { value: "__unset__", label: "未设置", meta: "等待申根 Excel / 手动选择", iconLabel: "--", tone: "amber" },
                ...FRANCE_TLS_CITY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: `${option.value} - ${option.label}`,
                  meta: "签证受理中心",
                  iconLabel: option.value.slice(0, 2),
                  tone: "emerald" as const,
                })),
              ]}
            />
            <ReadOnlySelectLikeField
              label="FRA Number"
              value={displayValue(profile.schengen?.fraNumber)}
              meta="申根 Excel / TLS 自动识别"
              icon={<Fingerprint className="h-4 w-4" />}
              tone="emerald"
            />
          </div>

          <div className="relative z-10 mt-12 space-y-8">
            <AuditNodeCard
              title="申根 Intake 结构化审计"
              description="展开后查看申根 Excel 结构化结果和关键审计提示，不再来回翻原始表。"
              tone="emerald"
            >
              <ParsedIntakeAccordion
                applicantId={applicantId}
                scope="schengen"
                title="完整申根 intake"
                subtitle="展开后直接查看申根 Excel 的完整结构化结果和审计提示。"
                tone="emerald"
                intake={profile.schengen?.fullIntake}
                emptyMessage="还没有可用的申根 intake。上传申根 Excel 后，这里会自动出现完整结构化信息。"
              />
            </AuditNodeCard>

            <TlsAccountSyncCenter
              tlsAccountTemplateText={tlsAccountTemplateText}
              hasTlsAccountHints={hasTlsAccountHints}
              onCopyTlsAccountTemplate={onCopyTlsAccountTemplate}
            />
          </div>
        </section>
      )
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8">
          <section
            id="crm-basic"
            className="relative overflow-hidden rounded-[56px] border border-white/5 bg-[#161619] p-8 shadow-2xl shadow-black/40 md:p-12 xl:p-16"
          >
            <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-emerald-400/8 blur-[90px]" />
            <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-indigo-500/8 blur-[90px]" />

            <div className="relative z-10 mb-12 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.045] text-white/45">
                  <Fingerprint className="h-7 w-7" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-black tracking-tight text-white">身份信息录入</h2>
                  <Badge variant="success" className="rounded-full border-emerald-400/25 bg-emerald-400/10 px-4 py-1 font-mono text-[9px] tracking-widest text-emerald-300">
                    PRIMARY RECORD
                  </Badge>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
                  申请人主实体信息会作为全局唯一索引，并自动映射至后续搜索、案件建立及材料归档链路。
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/25">Current System</div>
                <div className="mt-1 text-sm font-bold text-white">CRM 数据中心</div>
              </div>
            </div>

            <div className="relative z-10 grid gap-7 md:grid-cols-2">
              <IdentityField
                label="申请人姓名"
                icon={<UserRound className="h-3.5 w-3.5" />}
                value={basicForm.name}
                onChange={(value) => setBasicForm((prev) => ({ ...prev, name: value }))}
                placeholder="请输入真实姓名"
                disabled={disabled}
              />
              <ExtractedContactField
                label="手机号"
                icon={<Phone className="h-3.5 w-3.5" />}
                value={basicForm.phone}
                fallback="等待 Excel / JSON 抽取"
              />
              <ExtractedContactField
                label="电子邮箱"
                icon={<Mail className="h-3.5 w-3.5" />}
                value={basicForm.email}
                fallback="等待 Excel / JSON 抽取"
              />
              <IdentityField
                label="微信"
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                value={basicForm.wechat}
                onChange={(value) => setBasicForm((prev) => ({ ...prev, wechat: value }))}
                placeholder="WeChat ID / 微信昵称"
                disabled={disabled}
              />
              <IdentityField
                label="通用护照号"
                icon={<BookOpen className="h-3.5 w-3.5" />}
                value={basicForm.passportNumber}
                onChange={(value) => setBasicForm((prev) => ({ ...prev, passportNumber: value }))}
                placeholder="E-XXXXXXXXX"
                disabled={disabled}
              />
              <IdentityField
                label="护照尾号 / 特征"
                icon={<Hash className="h-3.5 w-3.5" />}
                value={profile.passportLast4 || ""}
                placeholder="后四位校验"
                readOnly
              />
            </div>

            <div className="relative z-10 mt-8 space-y-3">
              <Label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/20">
                <FileText className="h-3.5 w-3.5" />
                内部沟通与办理备注
              </Label>
              <Textarea
                rows={6}
                value={basicForm.note}
                onChange={(event) => setBasicForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="记录客户沟通、特殊说明或内部备注..."
                disabled={disabled}
                className="min-h-[170px] rounded-[28px] border-2 border-white/5 bg-white/[0.03] px-6 py-5 text-sm leading-7 text-white outline-none transition-all placeholder:text-white/12 hover:border-white/10 focus:border-emerald-500/30 focus:bg-white/[0.05] focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-40"
              />
            </div>

            <div className="relative z-10">
              <AiSuggestionBlock />
            </div>

            <div className="relative z-10 mt-10 flex justify-end">
              <Button
                type="button"
                onClick={() => void onSaveProfile()}
                disabled={savingProfile || disabled}
                className="rounded-2xl bg-white px-7 py-3.5 text-sm font-black text-black shadow-2xl shadow-white/10 transition-all hover:bg-emerald-300 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
              >
                {savingProfile ? "保存中..." : "保存基础资料"}
              </Button>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-10">
          <ComplianceHealthCard score={healthScore} />
          <ArchiveTraceTimeline profile={profile} />
        </aside>
      </div>
    )
  }

  return (
    <TabsContent value="basic" className="space-y-10">
      <BasicSystemStatusBar
        activeValue={activeBasicPanel}
        onValueChange={setActiveBasicPanel}
        hasUsVisaIntake={hasUsVisaIntake}
        hasSchengenIntake={hasSchengenIntake}
        hasTlsAccountHints={hasTlsAccountHints}
      />

      {renderBasicWorkspacePanel()}
    </TabsContent>
  )
}

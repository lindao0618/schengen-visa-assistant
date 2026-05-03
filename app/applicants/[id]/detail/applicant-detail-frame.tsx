"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  FolderOpen,
  Mail,
  PencilLine,
  Phone,
  Plane,
  Save,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAppRoleLabel } from "@/lib/access-control"
import {
  ApplicantDetailWorkRail,
  type ApplicantDetailActiveCaseTracker,
} from "@/app/applicants/[id]/detail/applicant-detail-work-rail"

import type { ApplicantDetailTab } from "./types"

const APPLICANT_DETAIL_TABS: Array<{
  value: ApplicantDetailTab
  label: string
  Icon: LucideIcon
}> = [
  { value: "basic", label: "基础资料", Icon: UserRound },
  { value: "cases", label: "签证业务", Icon: Plane },
  { value: "materials", label: "材料文档", Icon: FolderOpen },
  { value: "progress", label: "操作台与日志", Icon: BookOpen },
]

type ApplicantDetailFrameProps = {
  children: ReactNode
  activeTab: ApplicantDetailTab
  defaultTab: ApplicantDetailTab
  applicantId: string
  applicantTitle: string
  phone?: string | null
  email?: string | null
  wechat?: string | null
  passportNumber?: string | null
  passportLast4?: string | null
  viewerRole?: string | null
  isReadOnlyViewer: boolean
  caseCount: number
  materialCount: number
  selectedCaseSummary: string
  activeCaseTracker?: ApplicantDetailActiveCaseTracker
  message: string
  deletingApplicant: boolean
  savingProfile: boolean
  canEditApplicant: boolean
  onTabChange: (value: string) => void
  onRefresh: () => void | Promise<void>
  onSaveProfile: () => void | Promise<void>
  onDeleteApplicant: () => void | Promise<void>
  onCopyText: (label: string, value?: string | null) => void | Promise<void>
}

export function ApplicantDetailLoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-black text-white">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/60 shadow-2xl shadow-black">
        正在加载申请人档案...
      </div>
    </div>
  )
}

export function ApplicantDetailErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center bg-black px-4 text-white">
      <div className="w-full rounded-[28px] border border-white/10 bg-[#0f0f12] p-8 text-center shadow-2xl shadow-black">
        <div className="text-lg font-semibold text-white">申请人详情加载失败</div>
        <div className="mt-2 text-sm text-white/45">{message || "当前申请人不存在，或你没有访问权限。"}</div>
        <Button asChild className="mt-6 rounded-xl bg-white text-black hover:bg-white/90">
          <Link href="/applicants">返回申请人列表</Link>
        </Button>
      </div>
    </div>
  )
}

export function ApplicantDetailFrame({
  children,
  activeTab,
  defaultTab,
  applicantId,
  applicantTitle,
  phone,
  email,
  wechat,
  passportNumber,
  passportLast4,
  viewerRole,
  isReadOnlyViewer,
  caseCount,
  materialCount,
  selectedCaseSummary,
  activeCaseTracker,
  message,
  savingProfile,
  canEditApplicant,
  onTabChange,
  onRefresh,
  onSaveProfile,
  onCopyText,
}: ApplicantDetailFrameProps) {
  const archiveId = formatArchiveId(applicantId)
  const displayPhone = cleanDisplay(phone, "未填写电话")
  const displayEmail = cleanDisplay(email, "未填写邮箱")
  const tracker = activeCaseTracker ?? {
    title: selectedCaseSummary || "暂无处理中的业务",
    priorityLabel: "普通",
    stageLabel: "待建档",
    daysToSubmission: "未填写",
    createdAt: null,
    assignedLabel: isReadOnlyViewer || !canEditApplicant ? "只读" : "未指派",
    systemId: archiveId,
    cityLabel: "-",
  }
  const pendingMaterialLabel = materialCount >= 3 ? "同步完成" : "1 份待传"
  const workspaceGridClass =
    activeTab === "cases"
      ? "grid gap-9"
      : "grid gap-9 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start"

  return (
    <div className="min-h-screen bg-black px-4 pb-16 pt-28 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(59,130,246,0.13),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(16,185,129,0.10),transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl space-y-7">
        <header className="pt-3">
          <div className="mb-9 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href="/applicants"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.05] text-white/55 transition hover:bg-white/10 hover:text-white"
                aria-label="返回申请人档案"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">CUSTOMER PROFILE</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-white">
                  <Link href="/applicants" className="transition hover:text-white/80">
                    档案管理中心
                  </Link>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.75)]" />
                  <span className="font-mono text-sm text-white/45">档案 #{archiveId}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/applicants"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/8 bg-white/[0.05] px-4 text-sm font-bold text-white/75 transition hover:bg-white/[0.1] hover:text-white active:scale-95"
                aria-label="切换档案人"
              >
                <UsersRound className="h-4 w-4" />
                切换档案人
              </Link>
              <button
                type="button"
                onClick={() => void onSaveProfile()}
                disabled={savingProfile || !canEditApplicant}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black shadow-[0_18px_55px_rgba(255,255,255,0.16)] transition hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? "保存中..." : "保存所有修改"}
              </button>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-12">
            <BentoProfileCard
              applicantTitle={applicantTitle}
              archiveId={archiveId}
              phone={displayPhone}
              email={displayEmail}
              viewerRole={viewerRole}
            />

            <button
              type="button"
              onClick={() => onTabChange("cases")}
              className="group relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(135deg,_#1b1b1f,_#101014)] p-5 text-left shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-orange-300/25 xl:col-span-4"
            >
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_100%_50%,rgba(249,115,22,0.15),transparent_62%)]" />
              <div className="relative z-10 flex min-h-[160px] flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <BentoIcon className="bg-orange-500/14 text-orange-300 shadow-[0_0_38px_rgba(249,115,22,0.24)]">
                    <Plane className="h-5 w-5" />
                  </BentoIcon>
                  <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1 text-[10px] font-bold text-orange-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                    处理中
                  </span>
                </div>
                <div className="mt-9">
                  <div className="text-xs font-bold text-white/38">{tracker.title}</div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="text-2xl font-bold tracking-tight text-white">{tracker.stageLabel}</div>
                    <div className="pb-1 text-lg font-medium text-white/45">{tracker.daysToSubmission}</div>
                  </div>
                </div>
                <ArrowRight className="absolute bottom-1 right-0 h-5 w-5 text-white/35 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
            </button>

            <BentoMetricCard
              className="xl:col-span-3"
              icon={<CalendarClock className="h-5 w-5" />}
              iconClassName="bg-cyan-500/12 text-cyan-300 shadow-[0_0_36px_rgba(34,211,238,0.18)]"
              label="递签/面试时间"
              value={tracker.daysToSubmission}
              helper={tracker.cityLabel && tracker.cityLabel !== "-" ? tracker.cityLabel : tracker.stageLabel}
              mono
            />
            <button
              type="button"
              onClick={() => onTabChange("materials")}
              className="group relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(135deg,_#1b1b1f,_#101014)] p-5 text-left shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-emerald-300/25 xl:col-span-3"
            >
              <div className="relative z-10 flex min-h-[132px] flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <BentoIcon className="bg-emerald-500/12 text-emerald-300 shadow-[0_0_36px_rgba(16,185,129,0.20)]">
                    <FolderOpen className="h-5 w-5" />
                  </BentoIcon>
                  <span className="text-[11px] font-bold text-red-400">{pendingMaterialLabel}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white/38">云端档案库</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-3xl font-bold text-white">{materialCount}</span>
                    <span className="pb-1 text-sm font-medium text-white/45">已存档</span>
                  </div>
                </div>
                <ArrowUpRight className="absolute bottom-0 right-0 h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
              </div>
            </button>

            <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(135deg,_#1b1b1f,_#101014)] p-6 shadow-2xl shadow-black/30 xl:col-span-9">
              <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-violet-500/12 blur-[56px]" />
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-violet-300">
                  <Sparkles className="h-4 w-4" />
                  AI Agent Note
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange("basic")}
                  className="rounded-xl p-2 text-white/35 transition hover:bg-white/8 hover:text-white"
                  aria-label="编辑 AI 备注"
                >
                  <PencilLine className="h-4 w-4" />
                </button>
              </div>
              <p className="relative z-10 mt-8 max-w-2xl text-sm leading-7 text-white/78">
                客户档案已完成基础同步。团队需留意递签指令、材料补充和联系方式一致性；系统将持续追踪 Case、材料与预约状态。
              </p>
            </section>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm text-blue-100 shadow-sm">
            {message}
          </div>
        ) : null}

        <Tabs key={defaultTab} value={activeTab} onValueChange={onTabChange} className="space-y-9">
          <div className="sticky top-28 z-30">
          <TabsList className="grid h-auto w-full grid-cols-4 justify-center rounded-[28px] border border-white/[0.06] border-b border-white/10 bg-black/70 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl">
            {APPLICANT_DETAIL_TABS.map((tab) => {
              const Icon = tab.Icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative flex h-12 justify-center gap-2 rounded-2xl border-0 bg-transparent px-2 text-center text-sm font-semibold text-white/42 shadow-none transition hover:bg-white/[0.035] hover:text-white/75 data-[state=active]:!bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-1.5 data-[state=active]:after:left-1/2 data-[state=active]:after:h-0.5 data-[state=active]:after:w-10 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:rounded-full data-[state=active]:after:bg-cyan-300 data-[state=active]:after:shadow-[0_0_18px_rgba(103,232,249,0.65)]"
                >
                  <Icon className="h-4 w-4 opacity-65" />
                  {tab.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
          </div>

          <div className={workspaceGridClass}>
            <div className="min-w-0">{children}</div>
            {activeTab !== "cases" ? (
              <ApplicantDetailWorkRail
                activeTab={activeTab}
                applicantTitle={applicantTitle}
                archiveId={archiveId}
                phone={phone}
                email={email}
                wechat={wechat}
                passportNumber={passportNumber}
                passportLast4={passportLast4}
                selectedCaseSummary={selectedCaseSummary}
                activeCaseTracker={activeCaseTracker}
                caseCount={caseCount}
                materialCount={materialCount}
                canEditApplicant={canEditApplicant}
                isReadOnlyViewer={isReadOnlyViewer}
                onTabChange={(value) => onTabChange(value)}
                onRefresh={onRefresh}
                onCopyText={onCopyText}
              />
            ) : null}
          </div>
        </Tabs>
      </div>
    </div>
  )
}

function formatArchiveId(applicantId: string) {
  return `APP-${applicantId.slice(0, 8).toUpperCase()}`
}

function getApplicantInitial(value: string) {
  const normalized = value.trim()
  if (!normalized) return <UserRound className="h-7 w-7" />
  return normalized.slice(0, 1).toUpperCase()
}

function BentoProfileCard({
  applicantTitle,
  archiveId,
  phone,
  email,
  viewerRole,
}: {
  applicantTitle: string
  archiveId: string
  phone: string
  email: string
  viewerRole?: string | null
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(135deg,_#1b1b1f,_#101014)] p-5 shadow-2xl shadow-black/30 xl:col-span-5">
      <div className="pointer-events-none absolute -right-16 -top-14 h-40 w-40 rounded-full bg-blue-500/10 blur-[64px]" />
      <div className="relative z-10 flex min-h-[160px] flex-col justify-between">
        <div className="flex items-start justify-between gap-5">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.07] text-xl font-semibold text-white shadow-inner shadow-white/5">
              {getApplicantInitial(applicantTitle)}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#1b1b1f] bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.45)]">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>
          <div className="space-y-1 text-right">
            <span className="inline-flex rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/78">
              VIP LEVEL
            </span>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              {getAppRoleLabel(viewerRole)}
            </div>
          </div>
        </div>

        <div>
          <h1 className="max-w-full truncate text-3xl font-bold tracking-tight text-white lg:text-4xl">{applicantTitle}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs font-bold uppercase tracking-wider text-white/38">
            <span>ID: {archiveId}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ExtractedContactChip icon={<Phone className="h-3 w-3" />} label="联系电话" value={phone} />
            <ExtractedContactChip icon={<Mail className="h-3 w-3" />} label="电子邮箱" value={email} />
          </div>
        </div>
      </div>
    </section>
  )
}

function ExtractedContactChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.028] px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-mono text-white/22">Excel/JSON</span>
      </div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-white/70">{value}</div>
    </div>
  )
}

function BentoMetricCard({
  className = "",
  icon,
  iconClassName,
  label,
  value,
  helper,
  truncate = false,
  mono = false,
}: {
  className?: string
  icon: ReactNode
  iconClassName: string
  label: string
  value: string
  helper?: string
  truncate?: boolean
  mono?: boolean
}) {
  return (
    <section className={`relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,_#1b1b1f,_#101014)] p-5 shadow-2xl shadow-black/35 ${className}`}>
      <div className="flex min-h-[132px] flex-col justify-between">
        <BentoIcon className={iconClassName}>{icon}</BentoIcon>
        <div>
          <div className="text-xs font-bold text-white/38">{label}</div>
          <div
            className={`mt-2 text-lg font-bold tracking-tight text-white ${truncate ? "truncate" : ""} ${mono ? "font-mono" : ""}`}
          >
            {value}
          </div>
          {helper ? <div className="mt-2 truncate text-xs font-bold uppercase tracking-wider text-emerald-300">{helper}</div> : null}
        </div>
      </div>
    </section>
  )
}

function BentoIcon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${className}`}>
      {children}
    </div>
  )
}

function cleanDisplay(value?: string | null, fallback = "-") {
  return value?.trim() || fallback
}

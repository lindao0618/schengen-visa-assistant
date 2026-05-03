"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Bot,
  Camera,
  CheckCircle2,
  CircleDot,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Play,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Target,
  Terminal,
  Trash2,
  UserPlus,
} from "lucide-react"
import { AuthPromptProvider } from "./contexts/AuthPromptContext"
import {
  ACTIVE_APPLICANT_CASE_KEY,
  ACTIVE_APPLICANT_PROFILE_KEY,
  ApplicantProfileSelector,
} from "@/components/applicant-profile-selector"
import { useActiveApplicantProfile, type ActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { usePrefetchApplicantDetail } from "@/hooks/use-prefetch-applicant-detail"
import { UsVisaQuickStartCard } from "./components/us-visa-quick-start-card"

const PhotoChecker = dynamic(() => import("./components/photo-checker").then((mod) => mod.PhotoChecker), {
  ssr: false,
  loading: () => <TabModuleLoading label="正在加载照片检测工具..." />,
})

const DS160Form = dynamic(() => import("./components/ds160-form").then((mod) => mod.DS160Form), {
  ssr: false,
  loading: () => <TabModuleLoading label="正在加载 DS-160 填表工具..." />,
})

const SubmitDS160Form = dynamic(() => import("./components/submit-ds160-form").then((mod) => mod.SubmitDS160Form), {
  ssr: false,
  loading: () => <TabModuleLoading label="正在加载 DS-160 提交工具..." />,
})

const RegisterAISForm = dynamic(() => import("./components/register-ais-form").then((mod) => mod.RegisterAISForm), {
  ssr: false,
  loading: () => <TabModuleLoading label="正在加载 AIS 注册工具..." />,
})

const InterviewBriefForm = dynamic(() => import("./components/interview-brief-form").then((mod) => mod.InterviewBriefForm), {
  ssr: false,
  loading: () => <TabModuleLoading label="正在加载面试必看生成工具..." />,
})

const TaskList = dynamic(() => import("./components/task-list").then((mod) => mod.TaskList), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
      正在加载任务列表...
    </div>
  ),
})

const stopPresets = [
  "01.资料校验",
  "02.DS-160",
  "03.AIS预约",
  "04.面试简报",
] as const

const pipelineSteps = [
  { code: "01", title: "资料校验", detail: "Photo compliance" },
  { code: "02", title: "DS-160", detail: "Consular JSON" },
  { code: "03", title: "AIS预约", detail: "Payment rail" },
  { code: "04", title: "面签简报", detail: "Interview packet" },
]

function TabModuleLoading({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/42">
      {label}
    </div>
  )
}

function getPassportTail(activeApplicant: ActiveApplicantProfile | null) {
  const passport = activeApplicant?.passportLast4 || activeApplicant?.passportNumber || activeApplicant?.usVisa?.passportNumber || ""
  return passport ? passport.slice(-4) : "----"
}

function getApplicantName(activeApplicant: ActiveApplicantProfile | null) {
  return activeApplicant?.name || activeApplicant?.label || "未选择申请人"
}

function USVisaContextBanner({ activeApplicant }: { activeApplicant: ActiveApplicantProfile | null }) {
  const activeCase = activeApplicant?.activeCase
  const status = activeCase?.mainStatus || "DS160_READY"
  const city = activeCase?.applyRegion || "AIS-CN"

  return (
    <section className="pro-spotlight pro-spotlight-blue relative overflow-visible rounded-[32px] border border-white/5 bg-[#080808] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-white/10" />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-7 md:flex-row md:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] font-mono text-2xl font-bold text-white">
            US
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                Dashboard Hero Banner
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/45">
                当前办理
              </span>
            </div>
            <h1 className="truncate text-3xl font-bold tracking-tight text-white md:text-4xl">{getApplicantName(activeApplicant)}</h1>
            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                ["护照尾号", getPassportTail(activeApplicant)],
                ["当前状态", status],
                ["使馆节点", city],
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
      <div className="relative z-20 mt-7">
        <ApplicantProfileSelector scope="usa-visa" variant="embeddedDark" />
      </div>
    </section>
  )
}

function ExecutionPanel({
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
          <Play className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">美签自动流水线</h2>
        <p className="mt-3 text-sm leading-6 text-white/45">将照片、DS-160、AIS 与面签简报串成一次可控执行。</p>

        <div className="mt-8 rounded-2xl border border-white/5 bg-black/30 p-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/[0.38]">自动化卡点预设</span>
          <Select value={stopStep} onValueChange={onStopStepChange}>
            <SelectTrigger className="mt-3 min-h-12 border-white/10 bg-white/[0.035] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stopPresets.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pro-status-glow-success mt-5 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/38">当前状态</div>
          <div className="mt-3 flex items-center gap-2 text-base font-bold text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
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
            <h2 className="text-2xl font-bold tracking-tight text-white">美签案件进度</h2>
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
          {pipelineSteps.map((step, index) => {
            const active = index === 1
            return (
              <div key={step.code} className="relative">
                {index < pipelineSteps.length - 1 ? <div className="absolute left-14 right-0 top-7 hidden h-px bg-white/10 md:block" /> : null}
                <div className={active ? "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white font-mono text-lg font-bold text-black" : "relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] font-mono text-lg font-bold text-white/35"}>
                  {step.code}
                </div>
                <div className="mt-5 font-bold text-white">{step.title}</div>
                <div className="mt-2 text-xs text-white/38">{step.detail}</div>
              </div>
            )
          })}
        </div>

        <div className="mt-10 grid gap-4 rounded-3xl border border-white/5 bg-black/25 p-5 sm:grid-cols-3">
          {[
            ["PHOTO GATE", "照片校验"],
            ["DS-160 SYNC", "表单同步"],
            ["AIS PAYMENT", "预约付款"],
          ].map(([code, label]) => (
            <div key={code}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{code}</div>
              <div className="mt-1 text-xs font-bold text-white/45">{label}</div>
              <div className="mt-2 font-mono text-lg font-bold text-white">READY</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ResultOutputCard() {
  return (
    <div className="pro-status-glow-success rounded-3xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-sm font-bold text-white">TASK-US-618-AIS</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              success
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-xs text-white/44 sm:grid-cols-3">
            <span>案件号 <strong className="font-mono text-white/75">US-2026-0521</strong></span>
            <span>执行时间 <strong className="font-mono text-white/75">04m 18s</strong></span>
            <span>网关邮箱 <strong className="font-mono text-white/75">node-ais@vistoria.pro</strong></span>
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

function WorkspaceCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Camera
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="pro-spotlight pro-spotlight-blue overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] shadow-none backdrop-blur-md">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04]">
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </CardTitle>
        <CardDescription className="text-white/42">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  )
}

export default function USAVisaClientPage() {
  const searchParams = useSearchParams()
  const activeApplicant = useActiveApplicantProfile()
  const [stopStep, setStopStep] = useState<(typeof stopPresets)[number]>("03.AIS预约")

  const defaultTab = useMemo(() => {
    const requestedTab = searchParams.get("tab") || ""
    const allowedTabs = new Set(["photo", "ds160-fill", "ds160-submit", "ais-register", "interview-brief"])
    return allowedTabs.has(requestedTab) ? requestedTab : "photo"
  }, [searchParams])

  const applicantProfileId = searchParams.get("applicantProfileId")?.trim() || ""
  const caseId = searchParams.get("caseId")?.trim() || ""
  usePrefetchApplicantDetail(applicantProfileId, { view: "active", auto: true })

  useEffect(() => {
    if (typeof window === "undefined" || !applicantProfileId) return

    window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, applicantProfileId)
    window.dispatchEvent(
      new CustomEvent("active-applicant-profile-changed", {
        detail: { applicantProfileId },
      }),
    )

    if (!caseId) return

    window.localStorage.setItem(ACTIVE_APPLICANT_CASE_KEY, caseId)
    window.localStorage.setItem(`${ACTIVE_APPLICANT_CASE_KEY}:${applicantProfileId}`, caseId)
    window.dispatchEvent(
      new CustomEvent("active-applicant-case-changed", {
        detail: { applicantProfileId, caseId },
      }),
    )
  }, [applicantProfileId, caseId])

  return (
    <AuthPromptProvider>
      <div className="pro-task-surface min-h-screen overflow-hidden bg-black text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.06),transparent_28rem)]" />
        <main className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-40 sm:px-6 lg:px-8">
          <div className="space-y-7">
            <USVisaContextBanner activeApplicant={activeApplicant} />
            <ExecutionPanel stopStep={stopStep} onStopStepChange={(value) => setStopStep(value as (typeof stopPresets)[number])} />
            <UsVisaQuickStartCard />

            <section className="pro-spotlight pro-spotlight-blue rounded-[32px] border border-white/5 bg-[#080808] p-5 md:p-7">
              <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Data Modules & Logs</div>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">美签自动化业务看板</h2>
                  <p className="mt-2 text-sm text-white/42">细粒度控制 Consular Core 与 AIS Contact 的执行结果、任务列表和日志输出。</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black">Consular Core</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-bold text-white/45">AIS Contact</span>
                </div>
              </div>

              <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    className="pro-input pro-focus-glow h-12 w-full rounded-2xl border border-white/5 bg-white/[0.02] pl-11 pr-20 text-sm outline-none"
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

              <ResultOutputCard />

              <Tabs key={defaultTab} defaultValue={defaultTab} className="mt-6 w-full">
                <div className="sticky top-28 z-30 rounded-[28px] border border-white/5 bg-black/80 p-2 shadow-2xl shadow-black/30 backdrop-blur-2xl">
                  <div className="mb-2 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
                    <CircleDot className="h-4 w-4 text-white/50" />
                    Pipeline Modules
                  </div>
                  <TabsList className="grid h-12 w-full grid-cols-5 rounded-[24px] border border-white/5 bg-white/[0.02] p-1">
                    <TabsTrigger value="photo" className="flex items-center gap-2 rounded-2xl text-white/45 data-[state=active]:bg-white data-[state=active]:text-black">
                      <Camera className="h-4 w-4" />
                      照片检测
                    </TabsTrigger>
                    <TabsTrigger value="ds160-fill" className="flex items-center gap-2 rounded-2xl text-white/45 data-[state=active]:bg-white data-[state=active]:text-black">
                      <FileSpreadsheet className="h-4 w-4" />
                      DS160 填表
                    </TabsTrigger>
                    <TabsTrigger value="ds160-submit" className="flex items-center gap-2 rounded-2xl text-white/45 data-[state=active]:bg-white data-[state=active]:text-black">
                      <FileCheck className="h-4 w-4" />
                      提交 DS160
                    </TabsTrigger>
                    <TabsTrigger value="ais-register" className="flex items-center gap-2 rounded-2xl text-white/45 data-[state=active]:bg-white data-[state=active]:text-black">
                      <UserPlus className="h-4 w-4" />
                      AIS 注册
                    </TabsTrigger>
                    <TabsTrigger value="interview-brief" className="flex items-center gap-2 rounded-2xl text-white/45 data-[state=active]:bg-white data-[state=active]:text-black">
                      <FileText className="h-4 w-4" />
                      面试必看
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="photo" className="mt-6">
                  <WorkspaceCard icon={Camera} title="签证照片检测" description="处理照片 -> 检查是否符合要求 -> 提供下载">
                    <PhotoChecker />
                  </WorkspaceCard>
                  <div id="us-photo-tasks" className="mt-6">
                    <TaskList filterTaskTypes={["check-photo"]} title="照片检测任务" pollInterval={2000} autoRefresh={true} />
                  </div>
                </TabsContent>

                <TabsContent value="ds160-fill" className="mt-6">
                  <WorkspaceCard icon={FileSpreadsheet} title="DS-160 批量填表" description="上传 Excel 和照片，自动填写 DS-160 表单">
                    <DS160Form />
                  </WorkspaceCard>
                  <div id="us-ds160-fill-tasks" className="mt-6">
                    <TaskList filterTaskTypes={["fill-ds160"]} title="DS-160 填表任务" pollInterval={2000} autoRefresh={true} />
                  </div>
                </TabsContent>

                <TabsContent value="ds160-submit" className="mt-6">
                  <WorkspaceCard icon={FileCheck} title="提交 DS-160 申请表" description="使用 AA 码、姓、出生年、护照号提交并获取 PDF 确认页">
                    <SubmitDS160Form />
                  </WorkspaceCard>
                  <div id="us-ds160-submit-tasks" className="mt-6">
                    <TaskList filterTaskTypes={["submit-ds160"]} title="提交 DS160 任务" pollInterval={2000} autoRefresh={true} />
                  </div>
                </TabsContent>

                <TabsContent value="ais-register" className="mt-6">
                  <WorkspaceCard icon={UserPlus} title="AIS 账号注册" description="上传 Excel，在 ais.usvisa-info.com 上自动注册签证预约账号">
                    <RegisterAISForm />
                  </WorkspaceCard>
                  <div id="us-ais-register-tasks" className="mt-6">
                    <TaskList filterTaskTypes={["register-ais"]} title="AIS 注册任务" pollInterval={2000} autoRefresh={true} />
                  </div>
                </TabsContent>

                <TabsContent value="interview-brief" className="mt-6">
                  <WorkspaceCard icon={FileText} title="面试必看与 PDF" description="上传递签之前必看 Word 模板，自动替换中间问答区并导出新的 Word / PDF。">
                    <InterviewBriefForm />
                  </WorkspaceCard>
                </TabsContent>
              </Tabs>
            </section>
          </div>
        </main>
      </div>
    </AuthPromptProvider>
  )
}

"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, BriefcaseBusiness, FileText, RefreshCw, ShieldCheck, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAppRoleLabel } from "@/lib/access-control"

import type { ApplicantDetailTab } from "./types"

type ApplicantDetailFrameProps = {
  children: ReactNode
  activeTab: ApplicantDetailTab
  defaultTab: ApplicantDetailTab
  applicantTitle: string
  viewerRole?: string | null
  isReadOnlyViewer: boolean
  caseCount: number
  materialCount: number
  selectedCaseSummary: string
  message: string
  deletingApplicant: boolean
  canEditApplicant: boolean
  onTabChange: (value: string) => void
  onRefresh: () => void | Promise<void>
  onDeleteApplicant: () => void | Promise<void>
}

export function ApplicantDetailLoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        正在加载申请人档案…
      </div>
    </div>
  )
}

export function ApplicantDetailErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
      <Card className="w-full border-slate-200 bg-white/95 shadow-sm">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="text-lg font-semibold text-slate-950">申请人详情加载失败</div>
          <div className="text-sm text-slate-500">{message || "当前申请人不存在，或你没有访问权限。"}</div>
          <Button asChild>
            <Link href="/applicants">返回申请人列表</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function ApplicantDetailFrame({
  children,
  activeTab,
  defaultTab,
  applicantTitle,
  viewerRole,
  isReadOnlyViewer,
  caseCount,
  materialCount,
  selectedCaseSummary,
  message,
  deletingApplicant,
  canEditApplicant,
  onTabChange,
  onRefresh,
  onDeleteApplicant,
}: ApplicantDetailFrameProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34rem),radial-gradient(circle_at_top_right,_#dcfce7,_transparent_30rem),linear-gradient(180deg,_#f8fafc,_#ffffff)] px-4 py-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_24rem)]" />
          <div className="relative space-y-5">
            <Button variant="ghost" asChild className="h-auto px-0 text-slate-500 hover:bg-transparent hover:text-slate-900">
              <Link href="/applicants">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回申请人列表
              </Link>
            </Button>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{applicantTitle}</h1>
                  <Badge variant={isReadOnlyViewer ? "outline" : "secondary"}>
                    {getAppRoleLabel(viewerRole)}
                  </Badge>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-500">
                  内部工作台已按“档案、Case、材料、进度”拆开，专员先看当前状态，再进入需要处理的区域。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void onRefresh()} className="bg-white/80">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  刷新详情
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void onDeleteApplicant()}
                  disabled={deletingApplicant || !canEditApplicant}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deletingApplicant ? "删除中..." : "删除申请人"}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                icon={<BriefcaseBusiness className="h-4 w-4" />}
                label="关联 Case"
                value={`${caseCount}`}
                helper={selectedCaseSummary}
              />
              <SummaryCard
                icon={<FileText className="h-4 w-4" />}
                label="已归档材料"
                value={`${materialCount}`}
                helper="材料页打开时按需加载，减少首次进入压力"
              />
              <SummaryCard
                icon={<ShieldCheck className="h-4 w-4" />}
                label="当前权限"
                value={isReadOnlyViewer ? "只读" : "可操作"}
                helper={isReadOnlyViewer ? "可查看并下载资料，不能改写档案" : "可保存档案、Case 与材料"}
              />
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/95 px-4 py-3 text-sm text-sky-800 shadow-sm">
            {message}
          </div>
        ) : null}

        <Tabs key={defaultTab} value={activeTab} onValueChange={onTabChange} className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur">
            <ApplicantTabTrigger value="basic" label="档案" />
            <ApplicantTabTrigger value="cases" label="Case" />
            <ApplicantTabTrigger value="materials" label="材料" />
            <ApplicantTabTrigger value="progress" label="进度" />
          </TabsList>

          {children}
        </Tabs>
      </div>
    </div>
  )
}

function ApplicantTabTrigger({ value, label }: { value: ApplicantDetailTab; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="h-11 w-full rounded-xl border border-transparent bg-transparent text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 data-[state=active]:!border-slate-300 data-[state=active]:!bg-white data-[state=active]:!text-slate-950 data-[state=active]:shadow-sm"
    >
      {label}
    </TabsTrigger>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  )
}

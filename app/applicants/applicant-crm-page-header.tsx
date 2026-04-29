"use client"

import { memo } from "react"
import Link from "next/link"
import { CalendarClock, RefreshCw, Shield, UserPlus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type ApplicantCrmPageHeaderProps = {
  canOpenAdmin: boolean
  canReadAll: boolean
  canEditApplicants: boolean
  viewerRoleLabel: string
  refreshing: boolean
  summaryLoading: boolean
  onRefresh: () => void | Promise<void>
  onCreateApplicant: () => void
}

export const ApplicantCrmPageHeader = memo(function ApplicantCrmPageHeader({
  canOpenAdmin,
  canReadAll,
  canEditApplicants,
  viewerRoleLabel,
  refreshing,
  summaryLoading,
  onRefresh,
  onCreateApplicant,
}: ApplicantCrmPageHeaderProps) {
  const loading = refreshing || summaryLoading

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              员工工作台
            </Badge>
            {canReadAll ? (
              <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                {`${viewerRoleLabel}视角可查看团队数据`}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">申请人 CRM 工作台</h1>
            <p className="text-sm leading-6 text-slate-500">
              集中跟进申请人、案件、材料与自动化流程；建议先用视图和筛选缩小范围，再进入详情或批量处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">高频入口：新建 / 筛选 / 批量分组</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">主管视角：团队数据与异常跟进</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <Button variant="outline" asChild>
            <Link href="/applicants/schedule">
              <CalendarClock className="mr-2 h-4 w-4" />
              递签日程
            </Link>
          </Button>
          {canOpenAdmin ? (
            <Button variant="outline" asChild>
              <Link href="/admin">
                <Shield className="mr-2 h-4 w-4" />
                管理后台
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            刷新数据
          </Button>
          {canEditApplicants ? (
            <Button onClick={onCreateApplicant}>
              <UserPlus className="mr-2 h-4 w-4" />
              新建申请人
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
})

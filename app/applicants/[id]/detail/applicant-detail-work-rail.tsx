"use client"

import { ArrowRight, Check, Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ApplicantDetailTab } from "@/app/applicants/[id]/detail/types"

export type ApplicantDetailActiveCaseTracker = {
  title: string
  priorityLabel: string
  stageLabel: string
  daysToSubmission: string
  createdAt?: string | null
  assignedLabel: string
  systemId: string
  cityLabel?: string | null
}

export function ApplicantDetailWorkRail({
  placement = "global",
  activeTab,
  archiveId,
  selectedCaseSummary,
  activeCaseTracker,
  canEditApplicant,
  isReadOnlyViewer,
  onTabChange,
}: {
  placement?: "global" | "caseColumn"
  activeTab: ApplicantDetailTab
  applicantTitle: string
  archiveId: string
  phone?: string | null
  email?: string | null
  wechat?: string | null
  passportNumber?: string | null
  passportLast4?: string | null
  selectedCaseSummary: string
  activeCaseTracker?: ApplicantDetailActiveCaseTracker
  caseCount: number
  materialCount: number
  canEditApplicant: boolean
  isReadOnlyViewer: boolean
  onTabChange: (value: ApplicantDetailTab) => void
  onRefresh: () => void | Promise<void>
  onCopyText: (label: string, value?: string | null) => void | Promise<void>
}) {
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

  const railContent = (
    <div className={placement === "caseColumn" ? "space-y-6" : "sticky top-[132px] space-y-7"}>
        <section className="rounded-[28px] border border-white/8 bg-[#161619] p-6 shadow-2xl shadow-black/30">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white">处理中的业务</h2>
            <span className="rounded-md bg-orange-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-950">
              PROCESSING
            </span>
          </div>

          <button
            type="button"
            onClick={() => onTabChange("cases")}
            className="group w-full rounded-2xl border border-white/8 bg-white/[0.055] p-4 text-left transition hover:border-orange-300/30 hover:bg-white/[0.075]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-white">{tracker.title}</h3>
                  <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                    {tracker.priorityLabel}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">跟进阶段</p>
                    <p className="mt-1 text-sm font-semibold text-white">{tracker.stageLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">距离递签</p>
                    <p className="mt-1 text-lg font-bold text-orange-400">{tracker.daysToSubmission}</p>
                  </div>
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-white" />
            </div>
          </button>

          <VerticalStepper activeTab={activeTab} />
        </section>

        <SystemInfoCard
          createdAt={tracker.createdAt}
          assignedLabel={tracker.assignedLabel}
          systemId={tracker.systemId}
        />
      </div>
  )

  if (placement === "caseColumn") {
    return railContent
  }

  return (
    <aside className="order-first xl:order-none">
      {railContent}
    </aside>
  )
}

function VerticalStepper({ activeTab }: { activeTab: ApplicantDetailTab }) {
  const steps = [
    { label: "客户已付款建档", helper: "基础档案已经建立", state: "done" as const },
    {
      label: "材料审查",
      helper: activeTab === "materials" ? "当前正在核验材料完整性。" : "需要等待补充资产流水凭证。",
      state: "current" as const,
    },
    { label: "递交领馆预约", helper: "等待 slot 与递签时间确认", state: "todo" as const },
  ]

  return (
    <div className="relative mt-7 space-y-5 pl-9 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-px before:bg-white/12">
      {steps.map((step) => (
        <div key={step.label} className="relative">
          <span
            className={cn(
              "absolute -left-9 top-0 flex h-6 w-6 items-center justify-center rounded-full",
              step.state === "done" && "bg-white text-black",
              step.state === "current" && "border-2 border-white bg-[#161619] text-white shadow-[0_0_0_4px_rgba(245,158,11,0.12)]",
              step.state === "todo" && "border border-dashed border-white/25 bg-white/[0.03] text-white/25",
            )}
          >
            {step.state === "done" ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
          </span>
          <p className={cn("text-sm font-semibold", step.state === "todo" ? "text-white/35" : "text-white")}>{step.label}</p>
          <p className="mt-1 text-xs leading-5 text-white/40">{step.helper}</p>
        </div>
      ))}
    </div>
  )
}

function SystemInfoCard({
  createdAt,
  assignedLabel,
  systemId,
}: {
  createdAt?: string | null
  assignedLabel: string
  systemId: string
}) {
  return (
    <section className="rounded-[24px] border border-white/8 bg-[#151518] p-6 font-mono text-xs uppercase tracking-wider text-white/45">
      <InfoRow label="CREATED" value={formatDateTime(createdAt)} />
      <InfoRow label="ASSIGNED" value={assignedLabel || "-"} />
      <InfoRow label="ID" value={formatSystemId(systemId)} />
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <span>{label}</span>
      <span className="truncate text-right text-white/85">{value}</span>
    </div>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function formatSystemId(value: string) {
  if (value.length <= 10) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

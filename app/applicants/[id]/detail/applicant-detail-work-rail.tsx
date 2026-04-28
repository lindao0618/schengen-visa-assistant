"use client"

import type { ReactNode } from "react"
import { ClipboardCopy, Mail, MessageCircle, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ApplicantDetailTab } from "@/app/applicants/[id]/detail/types"

function clean(value?: string | null) {
  return value?.trim() || ""
}

function buildNextStep(activeTab: ApplicantDetailTab) {
  if (activeTab === "basic") return "先补齐联系方式和护照，再进入签证 Case。"
  if (activeTab === "cases") return "确认案件状态、预约窗口和负责人后，检查材料。"
  if (activeTab === "materials") return "处理缺失材料和预览结果后，查看进度与日志。"
  return "根据日志确认下一步动作，必要时回到 Case 调整状态。"
}

export function ApplicantDetailWorkRail({
  activeTab,
  applicantTitle,
  phone,
  email,
  wechat,
  passportNumber,
  passportLast4,
  selectedCaseSummary,
  caseCount,
  materialCount,
  canEditApplicant,
  isReadOnlyViewer,
  onTabChange,
  onRefresh,
  onCopyText,
}: {
  activeTab: ApplicantDetailTab
  applicantTitle: string
  phone?: string | null
  email?: string | null
  wechat?: string | null
  passportNumber?: string | null
  passportLast4?: string | null
  selectedCaseSummary: string
  caseCount: number
  materialCount: number
  canEditApplicant: boolean
  isReadOnlyViewer: boolean
  onTabChange: (value: ApplicantDetailTab) => void
  onRefresh: () => void | Promise<void>
  onCopyText: (label: string, value?: string | null) => void | Promise<void>
}) {
  const displayPassport = clean(passportNumber) || (clean(passportLast4) ? `尾号 ${passportLast4}` : "")

  return (
    <aside className="order-first xl:order-none">
      <div className="sticky top-[184px] space-y-4">
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70 backdrop-blur">
          <div className="bg-slate-950 px-4 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">专员操作台</div>
                <div className="mt-1 truncate text-lg font-semibold">{applicantTitle || "申请人"}</div>
              </div>
              <Badge variant={canEditApplicant ? "success" : "outline"} className={canEditApplicant ? "" : "border-white/20 bg-white/10 text-white"}>
                {isReadOnlyViewer || !canEditApplicant ? "只读" : "可编辑"}
              </Badge>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-950">
                <ShieldCheck className="h-4 w-4" />
                下一步建议
              </div>
              <p className="text-xs leading-5 text-amber-800">{buildNextStep(activeTab)}</p>
            </div>

            <div className="space-y-2">
              <RailAction label="打开基础信息" helper="客户资料与签证基础字段" count="CRM" active={activeTab === "basic"} onClick={() => onTabChange("basic")} />
              <RailAction label="打开签证 Case" helper={selectedCaseSummary} count={`${caseCount} 个`} active={activeTab === "cases"} onClick={() => onTabChange("cases")} />
              <RailAction label="打开材料文档" helper="上传、预览、归档和下载" count={`${materialCount} 份`} active={activeTab === "materials"} onClick={() => onTabChange("materials")} />
              <RailAction label="查看进度与日志" helper="状态流转和提醒记录" count="日志" active={activeTab === "progress"} onClick={() => onTabChange("progress")} />
            </div>

            <Button type="button" variant="outline" className="w-full rounded-2xl bg-white" onClick={() => void onRefresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新当前档案
            </Button>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white/95 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">客户联系</div>
              <div className="text-xs text-slate-500">电话、邮箱、微信、护照可快速复制。</div>
            </div>
            <UserRound className="h-5 w-5 text-slate-400" />
          </div>

          <div className="space-y-2">
            <ContactLine icon={<Phone className="h-4 w-4" />} label="电话" value={clean(phone)} onCopyText={onCopyText} />
            <ContactLine icon={<Mail className="h-4 w-4" />} label="邮箱" value={clean(email)} onCopyText={onCopyText} />
            <ContactLine icon={<MessageCircle className="h-4 w-4" />} label="微信" value={clean(wechat)} onCopyText={onCopyText} />
            <ContactLine icon={<ShieldCheck className="h-4 w-4" />} label="护照" value={displayPassport} onCopyText={onCopyText} />
          </div>
        </section>
      </div>
    </aside>
  )
}

function RailAction({
  label,
  helper,
  count,
  active,
  onClick,
}: {
  label: string
  helper: string
  count: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition",
        active ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-200" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
      ].join(" ")}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className={["mt-0.5 block truncate text-xs", active ? "text-white/65" : "text-slate-500"].join(" ")}>{helper}</span>
      </span>
      <span className={["shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"].join(" ")}>{count}</span>
    </button>
  )
}

function ContactLine({
  icon,
  label,
  value,
  onCopyText,
}: {
  icon: ReactNode
  label: string
  value: string
  onCopyText: (label: string, value?: string | null) => void | Promise<void>
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="shrink-0 text-slate-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
        <div className="truncate text-sm text-slate-800">{value || "未填写"}</div>
      </div>
      <button
        type="button"
        onClick={() => void onCopyText(label, value)}
        className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-800"
        aria-label={`复制${label}`}
      >
        <ClipboardCopy className="h-4 w-4" />
      </button>
    </div>
  )
}

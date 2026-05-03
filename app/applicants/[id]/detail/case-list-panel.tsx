"use client"

import { Circle, Plus } from "lucide-react"

import type { VisaCaseRecord } from "@/app/applicants/[id]/detail/types"
import { getApplicantCrmRegionLabel, getApplicantCrmVisaTypeLabel } from "@/lib/applicant-crm-labels"
import { formatDateTime } from "@/app/applicants/[id]/detail/detail-ui"

function getPriorityLabel(value?: string | null) {
  if (!value) return "-"
  if (value === "urgent") return "紧急"
  if (value === "high") return "高优先级"
  return "普通"
}

function getPriorityVariant(value?: string | null) {
  if (value === "urgent") return "border-red-400/30 bg-red-400/10 text-red-300"
  if (value === "high") return "border-amber-400/30 bg-amber-400/10 text-amber-300"
  return "border-blue-400/25 bg-blue-400/10 text-blue-200"
}

export function CaseSwitcherPanel({
  cases,
  selectedCaseId,
  onSelectCaseId,
}: {
  cases: VisaCaseRecord[]
  selectedCaseId: string
  onSelectCaseId: (caseId: string) => void
}) {
  if (cases.length <= 1) return null

  return (
    <section className="rounded-[32px] border border-white/8 bg-[#151518] p-4 shadow-2xl shadow-black/30">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">案件切换</p>
        <span className="font-mono text-[10px] text-white/30">{cases.length} CASES</span>
      </div>
      <div className="space-y-2">
        {cases.map((item) => {
          const active = selectedCaseId === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectCaseId(item.id)}
              className={[
                "w-full rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all",
                active
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/8 bg-white/[0.025] text-white/45 hover:border-white/16 hover:text-white/80",
              ].join(" ")}
            >
              {getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}
              {item.applyRegion ? ` / ${getApplicantCrmRegionLabel(item.applyRegion)}` : ""}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function CaseListPanel({
  cases,
  selectedCaseId,
  onSelectCaseId,
  canEditApplicant,
  onOpenCreateCase,
}: {
  cases: VisaCaseRecord[]
  selectedCaseId: string
  onSelectCaseId: (caseId: string) => void
  canEditApplicant: boolean
  onOpenCreateCase: () => void
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/8 bg-[#151518] p-5 shadow-2xl shadow-black/35">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Archive Cases</p>
            <h3 className="mt-2 text-base font-bold tracking-tight text-white">Case 列表</h3>
          </div>
          <button
            type="button"
            onClick={onOpenCreateCase}
            disabled={!canEditApplicant}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/8 text-white/65 transition hover:border-white/18 hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="新建 Case"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {cases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-4 text-sm text-white/45">当前还没有 Case，先创建一个再继续。</div>
        ) : (
          <div className="space-y-3">
            {cases.map((item) => {
              const active = selectedCaseId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectCaseId(item.id)}
                  className={[
                    "group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all",
                    active
                      ? "border-blue-400/45 bg-[linear-gradient(135deg,_rgba(59,130,246,0.15),_rgba(255,255,255,0.035))] shadow-[0_0_34px_rgba(59,130,246,0.08)]"
                      : "border-white/8 bg-white/[0.025] hover:border-white/16 hover:bg-white/[0.045]",
                  ].join(" ")}
                >
                  {active ? <div className="absolute inset-y-4 left-0 w-px bg-blue-400" /> : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}</div>
                      <div className="mt-2 text-[11px] text-white/55">{item.applyRegion ? getApplicantCrmRegionLabel(item.applyRegion) : "未设置地区"} · {getPriorityLabel(item.priority)}</div>
                    </div>
                    {item.isActive ? (
                      <span className="rounded-md border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[9px] font-bold text-blue-200">当前案件</span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={["rounded-full border px-2 py-0.5 text-[10px] font-bold", getPriorityVariant(item.priority)].join(" ")}>
                      {getPriorityLabel(item.priority)}
                    </span>
                    {item.exceptionCode ? <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">异常处理中</span> : null}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] text-white/30">
                    <Circle className="h-2.5 w-2.5" />
                    最近更新：{formatDateTime(item.updatedAt)}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

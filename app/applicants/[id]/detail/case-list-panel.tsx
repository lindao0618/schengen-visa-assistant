"use client"

import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { VisaCaseRecord } from "@/app/applicants/[id]/detail/types"
import { getApplicantCrmRegionLabel, getApplicantCrmVisaTypeLabel } from "@/lib/applicant-crm-labels"
import { formatDateTime, Section } from "@/app/applicants/[id]/detail/detail-ui"

function getPriorityLabel(value?: string | null) {
  if (!value) return "-"
  if (value === "urgent") return "紧急"
  if (value === "high") return "高优先级"
  return "普通"
}

function getPriorityVariant(value?: string | null) {
  if (value === "urgent") return "destructive" as const
  if (value === "high") return "warning" as const
  return "outline" as const
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
  if (cases.length === 0) return null

  return (
    <Section title="案件切换" description="同一个申请人可同时办理多个签证案件，点击标签即可切换当前工作案件。" tone="amber">
      <div className="flex flex-wrap gap-3">
        {cases.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectCaseId(item.id)}
            className={[
              "rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-all",
              selectedCaseId === item.id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-blue-200 bg-white text-blue-900 hover:border-blue-300 hover:bg-blue-50",
            ].join(" ")}
          >
            {getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}
            {item.applyRegion ? ` · ${getApplicantCrmRegionLabel(item.applyRegion)}` : ""}
          </button>
        ))}
      </div>
    </Section>
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
    <Section title="Case 列表" description="一个申请人可以挂多个 Case。当前激活中的 France Case 会驱动法签自动化和提醒。" tone="amber">
      <div className="space-y-3">
        <Button onClick={onOpenCreateCase} disabled={!canEditApplicant} className="w-full rounded-2xl bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          新建 Case
        </Button>

        {cases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-800">当前还没有 Case，先创建一个再继续。</div>
        ) : (
          cases.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectCaseId(item.id)}
              className={[
                "w-full rounded-2xl border p-4 text-left shadow-sm transition-all",
                selectedCaseId === item.id
                  ? "border-blue-300 bg-[linear-gradient(135deg,_#eff6ff,_#ffffff)] text-blue-950 shadow-blue-100"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}</div>
                  <div className="mt-1 text-xs opacity-80">{item.applyRegion ? getApplicantCrmRegionLabel(item.applyRegion) : "未设置地区"}</div>
                </div>
                {item.isActive ? <Badge variant={selectedCaseId === item.id ? "secondary" : "info"}>当前案件</Badge> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={getPriorityVariant(item.priority)}>{getPriorityLabel(item.priority)}</Badge>
                {item.exceptionCode ? <Badge variant="destructive">异常处理中</Badge> : null}
              </div>
              <div className="mt-3 text-xs opacity-80">最近更新：{formatDateTime(item.updatedAt)}</div>
            </button>
          ))
        )}
      </div>
    </Section>
  )
}

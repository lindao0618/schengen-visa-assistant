"use client"

import { memo, useMemo } from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import {
  getApplicantCrmPriorityLabel,
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ApplicantCrmRow } from "@/app/applicants/applicant-crm-types"

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("zh-CN")
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function getStatusBadgeClass(statusKey: string) {
  if (statusKey === "exception") return "border-red-400/30 bg-red-400/10 text-red-300 shadow-red-500/10"
  if (statusKey === "completed") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
  if (statusKey === "submitted" || statusKey === "slot_booked" || statusKey === "tls_processing") {
    return "border-blue-400/25 bg-blue-400/10 text-blue-300"
  }
  if (statusKey === "reviewing" || statusKey === "docs_ready" || statusKey === "preparing_docs") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-300"
  }
  return "border-white/10 bg-white/[0.02] text-white/58"
}

function getPriorityBadgeClass(priority?: string) {
  if (priority === "urgent") return "border-red-400/25 bg-red-400/10 text-red-300"
  if (priority === "high") return "border-amber-400/25 bg-amber-400/10 text-amber-300"
  return "border-white/10 bg-white/[0.02] text-white/58"
}

function getVisaTypeBadgeClass(value?: string) {
  if (!value) return "border-white/10 bg-white/[0.02] text-white/58"
  const normalized = value.toLowerCase()
  if (normalized.includes("france") || normalized.includes("schengen") || normalized.includes("法国") || normalized.includes("申根")) {
    return "border-blue-400/25 bg-blue-400/10 text-blue-300"
  }
  if (normalized.includes("usa") || normalized.includes("us") || normalized.includes("美国")) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
  }
  if (normalized.includes("uk") || normalized.includes("英国")) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-300"
  }
  return "border-white/10 bg-white/[0.02] text-white/58"
}

const groupBadgePalette = [
  "border-blue-400/25 bg-blue-400/10 text-blue-300",
  "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  "border-amber-400/25 bg-amber-400/10 text-amber-300",
  "border-red-400/25 bg-red-400/10 text-red-300",
]

function getGroupBadgeClass(groupName?: string) {
  const normalized = (groupName || "").trim()
  if (!normalized) return "border-white/10 bg-white/[0.02] text-white/58"
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0
  }
  return groupBadgePalette[hash % groupBadgePalette.length]
}

function getApplicantCrmStatusLabel(statusKey: string, fallbackLabel?: string) {
  const labels: Record<string, string> = {
    no_case: "未创建案件",
    pending_payment: "待付款",
    preparing_docs: "资料准备中",
    reviewing: "审核中",
    docs_ready: "材料已就绪",
    tls_processing: "TLS 处理中",
    slot_booked: "已获取 Slot",
    submitted: "已递签",
    completed: "已完成",
    exception: "异常处理中",
  }
  return labels[statusKey] || fallbackLabel || statusKey || "-"
}

function SelectionToggleButton({
  checked,
  onClick,
  label,
}: {
  checked: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 min-w-[78px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all",
        checked
          ? "border-white bg-white text-black"
          : "border-white/5 bg-white/[0.02] text-white/55 hover:border-blue-300/25 hover:text-white",
      )}
      aria-pressed={checked}
      aria-label={label}
    >
      <CheckCircle2 className={cn("h-4 w-4", checked ? "text-black" : "text-white/25")} />
      <span>{checked ? "已选" : "选择"}</span>
    </button>
  )
}

export const ApplicantCrmRowsTable = memo(function ApplicantCrmRowsTable({
  rows,
  selectedApplicantIds,
  allVisibleSelected,
  onToggleAllVisible,
  onToggleApplicant,
  onOpenApplicant,
  onPrefetchApplicant,
}: {
  rows: ApplicantCrmRow[]
  selectedApplicantIds: string[]
  allVisibleSelected: boolean
  onToggleAllVisible: (checked: boolean) => void
  onToggleApplicant: (applicantId: string, checked: boolean) => void
  onOpenApplicant: (applicantId: string) => void
  onPrefetchApplicant: (applicantId: string) => void
}) {
  const selectedApplicantIdSet = useMemo(() => new Set(selectedApplicantIds), [selectedApplicantIds])

  return (
    <Table className="text-white">
      <TableHeader>
        <TableRow className="border-white/5 hover:bg-transparent">
          <TableHead className="w-[96px]">
            <SelectionToggleButton
              checked={allVisibleSelected}
              onClick={() => onToggleAllVisible(!allVisibleSelected)}
              label={allVisibleSelected ? "取消全选当前显示" : "全选当前显示"}
            />
          </TableHead>
          <TableHead>{"申请人"}</TableHead>
          <TableHead>{"签证类型"}</TableHead>
          <TableHead>{"地区"}</TableHead>
          <TableHead>{"当前状态"}</TableHead>
          <TableHead>{"优先级"}</TableHead>
          <TableHead>{"出行时间"}</TableHead>
          <TableHead>{"最近更新"}</TableHead>
          <TableHead className="w-[120px]">{"操作"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const selected = selectedApplicantIdSet.has(row.id)
          const isException = row.currentStatusKey === "exception"

          return (
            <TableRow
              key={row.id}
              className={cn(
                "group cursor-pointer border-white/5 transition-colors hover:bg-white/[0.03]",
                selected && "bg-white/[0.04]",
                isException && "bg-red-400/[0.035] hover:bg-red-400/[0.06]",
              )}
              onMouseEnter={() => onPrefetchApplicant(row.id)}
              onFocus={() => onPrefetchApplicant(row.id)}
              onClick={() => onOpenApplicant(row.id)}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <SelectionToggleButton
                  checked={selected}
                  onClick={() => onToggleApplicant(row.id, !selected)}
                  label={`选择 ${row.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-white transition-colors group-hover:text-blue-300">{row.name}</div>
                    {row.groupName ? (
                      <Badge variant="outline" className={getGroupBadgeClass(row.groupName)}>
                        {row.groupName}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-white/42">
                    {row.phone || row.email || row.wechat || row.passportNumber || "暂无联系方式"}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={getVisaTypeBadgeClass(row.visaType || row.caseType)}
                >
                  {getApplicantCrmVisaTypeLabel(row.visaType || row.caseType)}
                </Badge>
              </TableCell>
              <TableCell>{getApplicantCrmRegionLabel(row.region)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("pro-semantic-badge", getStatusBadgeClass(row.currentStatusKey))}>
                  {isException ? (
                    <span className="pro-status-pulse-dot inline-flex h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                  ) : null}
                  {getApplicantCrmStatusLabel(row.currentStatusKey, row.currentStatusLabel)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getPriorityBadgeClass(row.priority)}>
                  {getApplicantCrmPriorityLabel(row.priority)}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-white/65">{formatDate(row.travelDate)}</TableCell>
              <TableCell className="font-mono text-white/65">{formatDateTime(row.updatedAt)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-white/65 hover:bg-white/[0.04] hover:text-white group-hover:bg-blue-400/10 group-hover:text-blue-300"
                  onMouseEnter={() => onPrefetchApplicant(row.id)}
                  onFocus={() => onPrefetchApplicant(row.id)}
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenApplicant(row.id)
                  }}
                >
                  查看详情
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className="py-10 text-center text-sm text-white/45">
              暂无符合当前筛选条件的申请人，建议调整筛选条件后重试。
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
})

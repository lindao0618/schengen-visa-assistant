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
import type { ApplicantCrmRow } from "@/app/applicants/ApplicantsCrmClientPage"

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

function getStatusVariant(statusKey: string) {
  if (statusKey === "exception") return "destructive" as const
  if (statusKey === "completed") return "success" as const
  if (statusKey === "submitted" || statusKey === "slot_booked") return "info" as const
  if (statusKey === "reviewing") return "warning" as const
  return "outline" as const
}

function getPriorityBadgeClass(priority?: string) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-700"
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-gray-200 bg-gray-50 text-gray-700"
}

function getVisaTypeBadgeClass(value?: string) {
  if (!value) return "border-gray-200 bg-gray-50 text-gray-700"
  const normalized = value.toLowerCase()
  if (normalized.includes("france") || normalized.includes("schengen") || normalized.includes("法国") || normalized.includes("申根")) {
    return "border-blue-200 bg-blue-50 text-blue-700"
  }
  if (normalized.includes("usa") || normalized.includes("us") || normalized.includes("美国")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }
  if (normalized.includes("uk") || normalized.includes("英国")) {
    return "border-violet-200 bg-violet-50 text-violet-700"
  }
  return "border-slate-200 bg-slate-50 text-slate-700"
}

const groupBadgePalette = [
  "border-blue-200 bg-blue-50 text-blue-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-rose-200 bg-rose-50 text-rose-700",
  "border-cyan-200 bg-cyan-50 text-cyan-700",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  "border-lime-200 bg-lime-50 text-lime-700",
]

function getGroupBadgeClass(groupName?: string) {
  const normalized = (groupName || "").trim()
  if (!normalized) return "border-slate-200 bg-slate-50 text-slate-700"
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
          ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200"
          : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700",
      )}
      aria-pressed={checked}
      aria-label={label}
    >
      <CheckCircle2 className={cn("h-4 w-4", checked ? "text-white" : "text-gray-300")} />
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
    <Table>
      <TableHeader>
        <TableRow>
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

          return (
            <TableRow
              key={row.id}
              className={cn("cursor-pointer transition-colors", selected && "bg-blue-50/60")}
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
                    <div className="font-medium text-gray-900">{row.name}</div>
                    {row.groupName ? (
                      <Badge variant="outline" className={getGroupBadgeClass(row.groupName)}>
                        {row.groupName}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">
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
                <Badge variant={getStatusVariant(row.currentStatusKey)}>
                  {getApplicantCrmStatusLabel(row.currentStatusKey, row.currentStatusLabel)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getPriorityBadgeClass(row.priority)}>
                  {getApplicantCrmPriorityLabel(row.priority)}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(row.travelDate)}</TableCell>
              <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
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
            <TableCell colSpan={9} className="py-10 text-center text-sm text-gray-500">
              暂无符合当前筛选条件的申请人，建议调整筛选条件后重试。
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
})

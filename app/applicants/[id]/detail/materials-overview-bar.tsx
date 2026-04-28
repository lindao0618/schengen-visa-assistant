"use client"

import { CheckCircle2, FileStack, LockKeyhole, Sparkles, UploadCloud } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  allMaterialSlots,
  schengenMaterialSlots,
  usVisaMaterialSlots,
  type FileMeta,
  type MaterialSlot,
} from "@/app/applicants/[id]/detail/material-upload-grid"

function countUploaded(files: Record<string, FileMeta>, slots: readonly MaterialSlot[]) {
  return slots.filter((slot) => Boolean(files[slot.key])).length
}

function ProgressPill({ label, uploaded, total }: { label: string; uploaded: number; total: number }) {
  const percent = total > 0 ? Math.round((uploaded / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-800">{label}</span>
        <span className="text-xs text-slate-500">
          {uploaded}/{total}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function MaterialsOverviewBar({
  files,
  filesLoading,
  filesError,
  canEditApplicant,
  canRunAutomation,
}: {
  files: Record<string, FileMeta>
  filesLoading?: boolean
  filesError?: string
  canEditApplicant: boolean
  canRunAutomation: boolean
}) {
  const totalUploaded = countUploaded(files, allMaterialSlots)
  const usVisaUploaded = countUploaded(files, usVisaMaterialSlots)
  const schengenUploaded = countUploaded(files, schengenMaterialSlots)

  return (
    <div className="sticky top-3 z-20 rounded-[1.75rem] border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/70 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-slate-900 text-white">
              <FileStack className="mr-1 h-3.5 w-3.5" />
              已归档 {totalUploaded}/{allMaterialSlots.length}
            </Badge>
            <Badge variant={canEditApplicant ? "info" : "outline"}>
              {canEditApplicant ? (
                <UploadCloud className="mr-1 h-3.5 w-3.5" />
              ) : (
                <LockKeyhole className="mr-1 h-3.5 w-3.5" />
              )}
              {canEditApplicant ? "可上传覆盖" : "只读查看"}
            </Badge>
            <Badge variant={canRunAutomation ? "success" : "outline"}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              自动化{canRunAutomation ? "可用" : "不可触发"}
            </Badge>
            {filesLoading ? <Badge variant="outline">正在同步材料</Badge> : null}
            {filesError ? <Badge variant="destructive">材料加载异常</Badge> : null}
          </div>
          <div className="text-sm leading-6 text-slate-500">
            先看总览判断缺哪些材料，再到对应分组上传、预览或下载，避免在长页面里来回找。
          </div>
        </div>

        <div className="grid min-w-[min(100%,28rem)] gap-2 sm:grid-cols-2">
          <ProgressPill label="美签" uploaded={usVisaUploaded} total={usVisaMaterialSlots.length} />
          <ProgressPill label="申根" uploaded={schengenUploaded} total={schengenMaterialSlots.length} />
        </div>
      </div>
      {totalUploaded === allMaterialSlots.length ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          当前材料 slot 已全部归档。
        </div>
      ) : null}
    </div>
  )
}

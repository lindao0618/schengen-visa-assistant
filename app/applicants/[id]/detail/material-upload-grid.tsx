"use client"

import type { ChangeEvent } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/app/applicants/[id]/detail/detail-ui"

export type FileMeta = {
  originalName: string
  uploadedAt: string
}

export type MaterialSlot = {
  key: string
  label: string
  accept: string
}

export const usVisaUploadedSlots: readonly MaterialSlot[] = [
  { key: "usVisaPhoto", label: "美签照片", accept: "image/*" },
  { key: "usVisaDs160Excel", label: "DS-160 / AIS Excel", accept: ".xlsx,.xls" },
]

export const usVisaSubmissionSlots: readonly MaterialSlot[] = [
  { key: "usVisaDs160ConfirmationPdf", label: "DS-160 确认页 PDF", accept: ".pdf,application/pdf" },
  { key: "usVisaDs160PrecheckJson", label: "DS-160 预检查 JSON", accept: ".json,application/json" },
]

export const usVisaInterviewBriefSlots: readonly MaterialSlot[] = [
  { key: "usVisaInterviewBriefPdf", label: "面试必看 PDF", accept: ".pdf,application/pdf" },
  {
    key: "usVisaInterviewBriefDocx",
    label: "面试必看 Word",
    accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
]

export const schengenUploadedSlots: readonly MaterialSlot[] = [
  { key: "schengenPhoto", label: "申根照片", accept: "image/*" },
  { key: "schengenExcel", label: "申根 Excel", accept: ".xlsx,.xls" },
  { key: "passportScan", label: "护照扫描件", accept: "image/*,.pdf,application/pdf" },
]

export const schengenSubmissionSlots: readonly MaterialSlot[] = [
  { key: "franceTlsAccountsJson", label: "TLS 注册 accounts JSON", accept: ".json,application/json" },
  { key: "franceApplicationJson", label: "法国新申请 JSON", accept: ".json,application/json" },
  { key: "franceReceiptPdf", label: "法国回执 PDF", accept: ".pdf,application/pdf" },
  { key: "franceFinalSubmissionPdf", label: "法国最终表 PDF", accept: ".pdf,application/pdf" },
]

export const schengenMaterialDocumentSlots: readonly MaterialSlot[] = [
  { key: "schengenItineraryPdf", label: "行程单 PDF", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterCnPdf", label: "解释信 PDF（中文）", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterEnPdf", label: "解释信 PDF（英文）", accept: ".pdf,application/pdf" },
  { key: "schengenHotelReservation", label: "酒店预订单材料", accept: ".pdf,.doc,.docx,image/*" },
  { key: "schengenFlightReservation", label: "机票/车票预订单材料", accept: ".pdf,.doc,.docx,image/*" },
]

export const usVisaMaterialSlots = [
  ...usVisaUploadedSlots,
  ...usVisaSubmissionSlots,
  ...usVisaInterviewBriefSlots,
] as const

export const schengenMaterialSlots = [
  ...schengenUploadedSlots,
  ...schengenSubmissionSlots,
  ...schengenMaterialDocumentSlots,
] as const

export const allMaterialSlots = [...usVisaMaterialSlots, ...schengenMaterialSlots] as const

export function UploadGrid({
  applicantId,
  files,
  slots,
  onUpload,
  onPreview,
  canUpload = true,
  emptyMessage = "当前还没有材料。",
  tone = "slate",
}: {
  applicantId: string
  files: Record<string, FileMeta>
  slots: readonly MaterialSlot[]
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: FileMeta) => Promise<void>
  canUpload?: boolean
  emptyMessage?: string
  tone?: "slate" | "sky" | "emerald" | "amber"
}) {
  const toneMap = {
    slate: {
      card: "border-slate-200 bg-white",
      title: "text-slate-900",
      meta: "text-slate-500",
      empty: "text-slate-400",
      preview: "text-sky-700",
      download: "text-slate-700",
    },
    sky: {
      card: "border-sky-200 bg-sky-50/50",
      title: "text-sky-950",
      meta: "text-sky-800/70",
      empty: "text-sky-700/50",
      preview: "text-sky-700",
      download: "text-sky-900",
    },
    emerald: {
      card: "border-emerald-200 bg-emerald-50/50",
      title: "text-emerald-950",
      meta: "text-emerald-800/70",
      empty: "text-emerald-700/50",
      preview: "text-emerald-700",
      download: "text-emerald-900",
    },
    amber: {
      card: "border-amber-200 bg-amber-50/50",
      title: "text-amber-950",
      meta: "text-amber-900/70",
      empty: "text-amber-700/50",
      preview: "text-amber-700",
      download: "text-amber-900",
    },
  } as const
  const styles = toneMap[tone]

  if (!slots.length) {
    return <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">{emptyMessage}</div>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((slot) => {
        const meta = files[slot.key]
        const canPreview = Boolean(meta && !/\.docx?$/i.test(meta.originalName))
        return (
          <div key={slot.key} className={cn("rounded-2xl border p-4 shadow-sm transition", styles.card)}>
            <div className={cn("mb-2 text-base font-semibold", styles.title)}>{slot.label}</div>
            {canUpload ? (
              <Input type="file" accept={slot.accept} onChange={(event) => void onUpload(event, slot.key)} className="bg-white/90" />
            ) : (
              <div className={cn("rounded-xl border border-dashed px-3 py-2 text-xs", styles.meta)}>只读查看，不能上传或覆盖</div>
            )}
            {meta ? (
              <div className={cn("mt-3 space-y-1 text-xs", styles.meta)}>
                <div className="truncate text-sm font-medium">{meta.originalName}</div>
                <div>{formatDateTime(meta.uploadedAt)}</div>
                <div className="flex items-center gap-3">
                  {canPreview ? (
                    <button type="button" className={cn("font-medium hover:underline", styles.preview)} onClick={() => void onPreview(slot.key, meta)}>
                      预览
                    </button>
                  ) : null}
                  <a
                    className={cn("font-medium hover:underline", styles.download)}
                    href={`/api/applicants/${applicantId}/files/${slot.key}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    下载
                  </a>
                </div>
              </div>
            ) : (
              <div className={cn("mt-3 text-xs", styles.empty)}>暂未上传</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

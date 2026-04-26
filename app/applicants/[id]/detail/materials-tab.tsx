"use client"

import Link from "next/link"
import type { ChangeEvent } from "react"
import { FileText } from "lucide-react"

import { WecomDriveBindingsCard } from "@/components/wecom-drive-bindings-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { formatDateTime, Section } from "@/app/applicants/[id]/detail/detail-ui"

type FileMeta = {
  originalName: string
  uploadedAt: string
}

type MaterialSlot = {
  key: string
  label: string
  accept: string
}

const usVisaUploadedSlots: readonly MaterialSlot[] = [
  { key: "usVisaPhoto", label: "美签照片", accept: "image/*" },
  { key: "usVisaDs160Excel", label: "DS-160 / AIS Excel", accept: ".xlsx,.xls" },
]

const usVisaSubmissionSlots: readonly MaterialSlot[] = [
  { key: "usVisaDs160ConfirmationPdf", label: "DS-160 确认页 PDF", accept: ".pdf,application/pdf" },
  { key: "usVisaDs160PrecheckJson", label: "DS-160 预检查 JSON", accept: ".json,application/json" },
]

const usVisaInterviewBriefSlots: readonly MaterialSlot[] = [
  { key: "usVisaInterviewBriefPdf", label: "面试必看 PDF", accept: ".pdf,application/pdf" },
  {
    key: "usVisaInterviewBriefDocx",
    label: "面试必看 Word",
    accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
]

const schengenUploadedSlots: readonly MaterialSlot[] = [
  { key: "schengenPhoto", label: "申根照片", accept: "image/*" },
  { key: "schengenExcel", label: "申根 Excel", accept: ".xlsx,.xls" },
  { key: "passportScan", label: "护照扫描件", accept: "image/*,.pdf,application/pdf" },
]

const schengenSubmissionSlots: readonly MaterialSlot[] = [
  { key: "franceTlsAccountsJson", label: "TLS 注册 accounts JSON", accept: ".json,application/json" },
  { key: "franceApplicationJson", label: "法国新申请 JSON", accept: ".json,application/json" },
  { key: "franceReceiptPdf", label: "法国回执 PDF", accept: ".pdf,application/pdf" },
  { key: "franceFinalSubmissionPdf", label: "法国最终表 PDF", accept: ".pdf,application/pdf" },
]

const schengenMaterialDocumentSlots: readonly MaterialSlot[] = [
  { key: "schengenItineraryPdf", label: "行程单 PDF", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterCnPdf", label: "解释信 PDF（中文）", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterEnPdf", label: "解释信 PDF（英文）", accept: ".pdf,application/pdf" },
  { key: "schengenHotelReservation", label: "酒店预订单材料", accept: ".pdf,.doc,.docx,image/*" },
  { key: "schengenFlightReservation", label: "机票/车票预订单材料", accept: ".pdf,.doc,.docx,image/*" },
]

function UploadGrid({
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

export function MaterialsTab({
  applicantId,
  applicantProfileId,
  selectedCaseId,
  files,
  filesLoading,
  filesError,
  canEditApplicant,
  canRunAutomation,
  onUpload,
  onPreview,
}: {
  applicantId: string
  applicantProfileId: string
  selectedCaseId?: string
  files: Record<string, FileMeta>
  filesLoading?: boolean
  filesError?: string
  canEditApplicant: boolean
  canRunAutomation: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: FileMeta) => Promise<void>
}) {
  const hasUsVisaInterviewSource = Boolean(files.usVisaDs160Excel || files.ds160Excel || files.usVisaAisExcel || files.aisExcel)
  const interviewBriefHref = `/usa-visa?tab=interview-brief&applicantProfileId=${encodeURIComponent(applicantProfileId)}${
    selectedCaseId ? `&caseId=${encodeURIComponent(selectedCaseId)}` : ""
  }`

  return (
    <TabsContent value="materials" className="space-y-6">
      {filesLoading ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          正在加载材料文件列表...
        </div>
      ) : null}
      {filesError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{filesError}</div>
      ) : null}
      <Section title="美签材料" description="继续兼容 DS-160、AIS、照片检测和提交 DS-160 的现有归档结构。" tone="sky">
        <div className="space-y-5">
          <div className="rounded-2xl border border-sky-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_40%),linear-gradient(135deg,_#ffffff,_#f0f9ff)] p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileText className="h-4 w-4 text-sky-700" />
                  面试必看生成
                </div>
                <div className="text-sm text-slate-600">
                  从当前申请人直接跳到美签工作台的“面试必看”页面，生成后的 Word 和 PDF 会自动归档到下面的材料区。
                </div>
                <div className="text-xs text-slate-500">
                  {hasUsVisaInterviewSource
                    ? "已检测到 DS-160 / AIS Excel，可直接生成。"
                    : "当前档案里还没有可用的 DS-160 / AIS Excel，先上传后再生成会更顺。"}
                </div>
              </div>
              {hasUsVisaInterviewSource ? (
                <Button asChild className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" disabled={!canRunAutomation}>
                  <Link href={interviewBriefHref}>
                    <FileText className="mr-2 h-4 w-4" />
                    去生成面试必看
                  </Link>
                </Button>
              ) : (
                <Button disabled className="rounded-2xl">
                  <FileText className="mr-2 h-4 w-4" />
                  先上传美签 Excel
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-base font-semibold text-sky-950">上传材料</div>
            <div className="text-sm text-sky-800/70">先放照片和 DS-160 / AIS 信息表，后续自动化与材料整理都会用到。</div>
            <UploadGrid applicantId={applicantId} files={files} slots={usVisaUploadedSlots} onUpload={onUpload} onPreview={onPreview} canUpload={canEditApplicant} tone="sky" />
          </div>
          <div className="space-y-3">
            <div className="text-base font-semibold text-sky-950">递签材料</div>
            <div className="text-sm text-sky-800/70">这里放 DS-160 确认页和预检查结果，方便后续复核与递签。</div>
            <UploadGrid applicantId={applicantId} files={files} slots={usVisaSubmissionSlots} onUpload={onUpload} onPreview={onPreview} canUpload={canEditApplicant} tone="sky" />
          </div>
          <div className="space-y-3">
            <div className="text-base font-semibold text-sky-950">面试必看材料</div>
            <div className="text-sm text-sky-800/70">生成后的 PDF 可直接预览，Word 和 PDF 都可以从这里下载。</div>
            <UploadGrid applicantId={applicantId} files={files} slots={usVisaInterviewBriefSlots} onUpload={onUpload} onPreview={onPreview} canUpload={canEditApplicant} tone="sky" />
          </div>
        </div>
      </Section>

      <Section title="申根材料" description="申根上传材料、递签材料和材料文档都统一归档在这里。" tone="emerald">
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="text-base font-semibold text-emerald-950">上传材料</div>
            <div className="text-sm text-emerald-800/70">基础照片、信息表和护照扫描件统一放这里，方便后续申根流程继续接力。</div>
            <UploadGrid applicantId={applicantId} files={files} slots={schengenUploadedSlots} onUpload={onUpload} onPreview={onPreview} canUpload={canEditApplicant} tone="emerald" />
          </div>
          <div className="space-y-3">
            <div className="text-base font-semibold text-emerald-950">递签材料</div>
            <div className="text-sm text-emerald-800/70">TLS、申请 JSON、回执 PDF 和最终表统一归档在这一组。</div>
            <UploadGrid applicantId={applicantId} files={files} slots={schengenSubmissionSlots} onUpload={onUpload} onPreview={onPreview} canUpload={canEditApplicant} tone="emerald" />
          </div>
          <div className="space-y-3">
            <div className="text-base font-semibold text-emerald-950">材料文档</div>
            <div className="text-sm text-emerald-800/70">行程单、解释信、预订单等辅助材料集中放这里，避免和递签件混在一起。</div>
            <UploadGrid applicantId={applicantId} files={files} slots={schengenMaterialDocumentSlots} onUpload={onUpload} onPreview={onPreview} canUpload={canEditApplicant} tone="emerald" />
          </div>
        </div>
      </Section>

      <WecomDriveBindingsCard applicantId={applicantId} />
    </TabsContent>
  )
}

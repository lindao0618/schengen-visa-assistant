"use client"

import Link from "next/link"
import type { ChangeEvent } from "react"
import { FileText } from "lucide-react"

import { WecomDriveBindingsCard } from "@/components/wecom-drive-bindings-card"
import { Button } from "@/components/ui/button"
import { TabsContent } from "@/components/ui/tabs"
import { Section } from "@/app/applicants/[id]/detail/detail-ui"
import { MaterialsOverviewBar } from "@/app/applicants/[id]/detail/materials-overview-bar"
import { shouldShowApplicantMaterialFilesLoading } from "@/lib/applicant-material-files"
import {
  schengenMaterialDocumentSlots,
  schengenSubmissionSlots,
  schengenUploadedSlots,
  UploadGrid,
  usVisaInterviewBriefSlots,
  usVisaSubmissionSlots,
  usVisaUploadedSlots,
  type FileMeta,
} from "@/app/applicants/[id]/detail/material-upload-grid"

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
  const visibleFileCount = Object.keys(files).length
  const showFilesLoading = shouldShowApplicantMaterialFilesLoading({
    loading: filesLoading,
    visibleFileCount,
  })
  const interviewBriefHref = `/usa-visa?tab=interview-brief&applicantProfileId=${encodeURIComponent(applicantProfileId)}${
    selectedCaseId ? `&caseId=${encodeURIComponent(selectedCaseId)}` : ""
  }`

  return (
    <TabsContent value="materials" className="space-y-6">
      <MaterialsOverviewBar
        files={files}
        filesLoading={filesLoading}
        filesError={filesError}
        canEditApplicant={canEditApplicant}
        canRunAutomation={canRunAutomation}
      />

      {showFilesLoading ? (
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

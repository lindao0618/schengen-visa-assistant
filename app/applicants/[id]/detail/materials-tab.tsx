"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { motion } from "framer-motion"
import {
  Archive,
  Bot,
  Download,
  FileCode2,
  FileText,
  History,
  ImageIcon,
  Info,
  Layers3,
  LockKeyhole,
  Sparkles,
  UploadCloud,
  WandSparkles,
  type LucideIcon,
} from "lucide-react"

import { TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { AisPaymentInfoCard } from "@/app/applicants/[id]/detail/ais-payment-info-card"
import { formatDateTime } from "@/app/applicants/[id]/detail/detail-ui"
import {
  schengenMaterialDocumentSlots,
  schengenSubmissionSlots,
  schengenUploadedSlots,
  usVisaInterviewBriefSlots,
  usVisaSubmissionSlots,
  usVisaUploadedSlots,
  type FileMeta,
  type MaterialSlot,
} from "@/app/applicants/[id]/detail/material-upload-grid"

type RepositoryTone = "emerald" | "sky" | "amber" | "rose" | "violet"
type MaterialRepositoryKind = "schengenFrance" | "usVisa"

const SCHENGEN_COVER_LETTER_KEYS = new Set(["schengenExplanationLetterCnPdf", "schengenExplanationLetterEnPdf"])

type SupplementaryQueueItem = {
  key: string
  label: string
  description: string
  slot: MaterialSlot
  meta?: FileMeta
}

const slotVisualMeta: Record<string, { description: string; icon: LucideIcon; tone: RepositoryTone }> = {
  schengenPhoto: { description: "Biometric Photo Record", icon: ImageIcon, tone: "emerald" },
  schengenExcel: { description: "Budget Sheet / Applicant Matrix", icon: FileText, tone: "emerald" },
  passportScan: { description: "Passport Copy", icon: FileText, tone: "rose" },
  franceTlsAccountsJson: { description: "MIA System Record", icon: FileCode2, tone: "emerald" },
  franceApplicationJson: { description: "Generated Application Payload", icon: FileCode2, tone: "emerald" },
  franceReceiptPdf: { description: "MIA System Receipt", icon: FileText, tone: "rose" },
  franceFinalSubmissionPdf: { description: "Final Submission Package", icon: FileText, tone: "amber" },
  schengenItineraryPdf: { description: "Itinerary", icon: FileText, tone: "amber" },
  schengenExplanationLetterCnPdf: { description: "Cover Letter CN", icon: FileText, tone: "sky" },
  schengenExplanationLetterEnPdf: { description: "Cover Letter EN", icon: FileText, tone: "sky" },
  schengenHotelReservation: { description: "Hotel Reservation", icon: FileText, tone: "violet" },
  schengenFlightReservation: { description: "Flight Reservation", icon: FileText, tone: "violet" },
  usVisaPhoto: { description: "US Visa Photo", icon: ImageIcon, tone: "sky" },
  usVisaDs160Excel: { description: "DS-160 / AIS Source Sheet", icon: FileText, tone: "sky" },
  usVisaDs160ConfirmationPdf: { description: "DS-160 Confirmation Page", icon: FileText, tone: "rose" },
  usVisaDs160PrecheckJson: { description: "Precheck Engine JSON", icon: FileCode2, tone: "emerald" },
  usVisaInterviewBriefPdf: { description: "Interview Brief PDF", icon: FileText, tone: "violet" },
  usVisaInterviewBriefDocx: { description: "Interview Brief Word", icon: FileText, tone: "violet" },
}

const toneStyles = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-300 shadow-emerald-500/10",
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    glow: "from-emerald-500/20",
    line: "bg-emerald-400",
  },
  sky: {
    icon: "bg-sky-500/10 text-sky-300 shadow-sky-500/10",
    badge: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    glow: "from-sky-500/20",
    line: "bg-sky-400",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-300 shadow-amber-500/10",
    badge: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    glow: "from-amber-500/20",
    line: "bg-amber-400",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-300 shadow-rose-500/10",
    badge: "border-rose-400/25 bg-rose-400/10 text-rose-300",
    glow: "from-rose-500/20",
    line: "bg-rose-400",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-300 shadow-violet-500/10",
    badge: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    glow: "from-violet-500/20",
    line: "bg-violet-400",
  },
} as const

function countUploaded(files: Record<string, FileMeta>, slots: readonly MaterialSlot[]) {
  return slots.filter((slot) => Boolean(files[slot.key])).length
}

function canPreviewFile(meta?: FileMeta) {
  return Boolean(meta && !/\.docx?$/i.test(meta.originalName))
}

function getSlotMeta(slot: MaterialSlot) {
  return slotVisualMeta[slot.key] || { description: "Document Asset", icon: FileText, tone: "emerald" as RepositoryTone }
}

function getAgentTargetAliases(slot: MaterialSlot) {
  const aliases = new Set([slot.key])
  if (slot.key === "passportScan") {
    aliases.add("passport_home")
    aliases.add("passport_scan")
  }
  if (/在职|工作|employment/i.test(slot.label)) {
    aliases.add("employment_certificate")
  }
  if (/递签|slot/i.test(slot.label)) {
    aliases.add("slot_time")
  }
  return [...aliases]
}

function buildSupplementaryQueueItems(slots: readonly MaterialSlot[], files: Record<string, FileMeta>) {
  const items: SupplementaryQueueItem[] = []
  let coverLetterAdded = false

  for (const slot of slots) {
    if (SCHENGEN_COVER_LETTER_KEYS.has(slot.key)) {
      if (coverLetterAdded) {
        continue
      }

      coverLetterAdded = true
      const coverLetterSlots = slots.filter((candidate) => SCHENGEN_COVER_LETTER_KEYS.has(candidate.key))
      const coverLetterFiles = coverLetterSlots
        .map((candidate) => files[candidate.key])
        .filter((meta): meta is FileMeta => Boolean(meta))
      const uploadSlot = coverLetterSlots.find((candidate) => !files[candidate.key]) || coverLetterSlots[0] || slot

      items.push({
        key: "schengen-cover-letter",
        label: "解释信 PDF（中 / 英）",
        description: coverLetterFiles.length
          ? coverLetterFiles.map((meta) => meta.originalName).join(" · ")
          : "Cover Letter CN / EN",
        slot: uploadSlot,
        meta: coverLetterFiles[0],
      })
      continue
    }

    const meta = files[slot.key]
    const slotMeta = getSlotMeta(slot)
    items.push({
      key: slot.key,
      label: slot.label,
      description: meta?.originalName || slotMeta.description,
      slot,
      meta,
    })
  }

  return items
}

function RepositoryCategorySwitch({
  activeRepositoryKind,
  onRepositoryKindChange,
  schengenUploadedCount,
  schengenTotalCount,
  usVisaUploadedCount,
  usVisaTotalCount,
}: {
  activeRepositoryKind: MaterialRepositoryKind
  onRepositoryKindChange: (value: MaterialRepositoryKind) => void
  schengenUploadedCount: number
  schengenTotalCount: number
  usVisaUploadedCount: number
  usVisaTotalCount: number
}) {
  const categories: Array<{
    value: MaterialRepositoryKind
    title: string
    subtitle: string
    helper: string
    count: string
    tone: "emerald" | "sky"
    Icon: LucideIcon
  }> = [
    {
      value: "schengenFrance",
      title: "申根法签文档",
      subtitle: "France Schengen Repository",
      helper: "照片、护照、FV / TLS 产物、行程机酒证明",
      count: `${schengenUploadedCount}/${schengenTotalCount}`,
      tone: "emerald",
      Icon: Archive,
    },
    {
      value: "usVisa",
      title: "美签材料文档",
      subtitle: "US Visa Repository",
      helper: "照片、DS-160 / AIS、确认页、面试必看材料",
      count: `${usVisaUploadedCount}/${usVisaTotalCount}`,
      tone: "sky",
      Icon: FileText,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {categories.map((category) => {
        const active = activeRepositoryKind === category.value
        const Icon = category.Icon
        const activeClass =
          category.tone === "emerald"
            ? "border-emerald-400/35 bg-emerald-400/10 shadow-emerald-500/10"
            : "border-sky-400/35 bg-sky-400/10 shadow-sky-500/10"
        const inactiveClass = "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]"
        const iconClass =
          category.tone === "emerald"
            ? "bg-emerald-400/10 text-emerald-300"
            : "bg-sky-400/10 text-sky-300"

        return (
          <button
            key={category.value}
            type="button"
            aria-pressed={active}
            onClick={() => onRepositoryKindChange(category.value)}
            className={cn(
              "group relative overflow-hidden rounded-[32px] border p-5 text-left shadow-2xl shadow-black/15 transition-all duration-300 active:scale-[0.99]",
              active ? activeClass : inactiveClass,
            )}
          >
            <div className="pointer-events-none absolute -right-12 -top-14 h-32 w-32 rounded-full bg-white/5 blur-[54px] opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", iconClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{category.subtitle}</div>
                  <div className="mt-2 text-xl font-black tracking-tight text-white">{category.title}</div>
                  <div className="mt-2 max-w-md text-xs font-bold leading-5 text-white/42">{category.helper}</div>
                </div>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[11px] font-black text-white/55">
                {category.count}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function RepositoryStatusHub({
  isSchengenRepository,
  uploadedCount,
  totalCount,
  repositoryCompletionPercent,
  filesLoading,
  filesError,
  canEditApplicant,
  canRunAutomation,
  interviewBriefHref,
}: {
  isSchengenRepository: boolean
  uploadedCount: number
  totalCount: number
  repositoryCompletionPercent: number
  filesLoading?: boolean
  filesError?: string
  canEditApplicant: boolean
  canRunAutomation: boolean
  interviewBriefHref: string
}) {
  const repositoryFileLabel = `${uploadedCount} / ${totalCount} Files`
  const repositoryTypeLabel = isSchengenRepository ? "SCHENGEN FRANCE REPOSITORY" : "US VISA REPOSITORY"

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#111214]/80 p-7 shadow-2xl shadow-black/30 backdrop-blur-3xl lg:col-span-8 xl:p-9">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-emerald-400/10 blur-[80px]" />
        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-lg">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.38em] text-white/30">
              <Archive className="h-3.5 w-3.5" />
              Repository Status
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">材料集成中心</h2>
            <p className="mt-3 max-w-md text-sm font-medium leading-6 text-white/40">
              系统已按当前 Case 自动匹配必要文档池，集中管理上传件、系统产出和补充证明。
            </p>
          </div>

          <div className="w-full max-w-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">
                完成进度 {repositoryCompletionPercent}%
              </span>
              <span className="font-mono text-[11px] font-bold text-white/40">{repositoryFileLabel}</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-white/[0.06] p-1">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${repositoryCompletionPercent}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/20"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                {repositoryTypeLabel}
              </span>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                  canEditApplicant ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-white/40",
                )}
              >
                {canEditApplicant ? "Writable" : "Read Only"}
              </span>
              {filesLoading ? <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200">Syncing</span> : null}
              {filesError ? <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">Error</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="group relative overflow-hidden rounded-[40px] border border-emerald-300/[0.12] bg-[#111714] p-7 text-white shadow-2xl shadow-black/25 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/[0.24] lg:col-span-4 xl:p-9">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/25 to-transparent" />
        <Sparkles className="absolute right-7 top-7 h-7 w-7 text-emerald-300/25" />
        <UploadCloud className="relative z-10 mb-6 h-10 w-10 text-emerald-300 transition-transform duration-300 group-hover:-translate-y-2" />
        <h3 className="relative z-10 text-xl font-black leading-tight text-white">全量智能归档与解析</h3>
        <p className="relative z-10 mt-3 max-w-xs text-[13px] font-bold leading-5 text-white/45">
          支持 PDF 自动分拣、OCR 提取和关键字段回写，降低人工翻找成本。
        </p>
        {isSchengenRepository ? (
          <button
            type="button"
            disabled={!canRunAutomation}
            className="relative z-10 mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-xs font-black text-black transition hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
          >
            立即启动引擎
            <WandSparkles className="h-4 w-4" />
          </button>
        ) : (
          <Link
            href={interviewBriefHref}
            className={cn(
              "relative z-10 mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-xs font-black text-black transition hover:bg-white/90 active:scale-95",
              !canRunAutomation && "pointer-events-none bg-white/10 text-white/30",
            )}
          >
            生成面试必看
            <WandSparkles className="h-4 w-4" />
          </Link>
        )}
      </section>
    </div>
  )
}

function DocumentSection({
  eyebrow,
  title,
  slots,
  applicantId,
  files,
  canEditApplicant,
  onUpload,
  onPreview,
}: {
  eyebrow: string
  title: string
  slots: readonly MaterialSlot[]
  applicantId: string
  files: Record<string, FileMeta>
  canEditApplicant: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: FileMeta) => Promise<void>
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-white/20" />
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.34em] text-white/30">{eyebrow}</div>
          <h3 className="mt-1 text-lg font-black tracking-tight text-white">{title}</h3>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {slots.map((slot) => (
          <DocumentAssetCard
            key={slot.key}
            applicantId={applicantId}
            slot={slot}
            meta={files[slot.key]}
            canUpload={canEditApplicant}
            onUpload={onUpload}
            onPreview={onPreview}
          />
        ))}
      </div>
    </section>
  )
}

function DocumentAssetCard({
  applicantId,
  slot,
  meta,
  canUpload,
  onUpload,
  onPreview,
}: {
  applicantId: string
  slot: MaterialSlot
  meta?: FileMeta
  canUpload: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: FileMeta) => Promise<void>
}) {
  const slotMeta = getSlotMeta(slot)
  const Icon = slotMeta.icon
  const styles = toneStyles[slotMeta.tone]
  const verified = Boolean(meta)
  const previewable = canPreviewFile(meta)
  const articleRef = useRef<HTMLElement>(null)
  const [agentHighlighted, setAgentHighlighted] = useState(false)
  const agentAliases = getAgentTargetAliases(slot)

  useEffect(() => {
    const matchesTarget = (target: unknown) => typeof target === "string" && agentAliases.includes(target)
    const handleHighlight = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; active?: boolean }>).detail
      if (!matchesTarget(detail?.target)) return
      setAgentHighlighted(Boolean(detail?.active))
    }
    const handleFocus = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail
      if (!matchesTarget(detail?.target)) return
      setAgentHighlighted(true)
      articleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      articleRef.current?.focus()
      window.setTimeout(() => setAgentHighlighted(false), 1800)
    }

    document.addEventListener("ops-agent:highlight", handleHighlight)
    document.addEventListener("ops-agent:focus", handleFocus)
    return () => {
      document.removeEventListener("ops-agent:highlight", handleHighlight)
      document.removeEventListener("ops-agent:focus", handleFocus)
    }
  }, [agentAliases])

  return (
    <article
      ref={articleRef}
      tabIndex={-1}
      data-material-slot={slot.key}
      data-agent-alias={agentAliases.join(" ")}
      className={cn(
        "group/asset relative flex min-h-[224px] flex-col justify-between overflow-hidden rounded-[32px] border p-6 shadow-2xl shadow-black/20 transition-all duration-300 active:scale-[0.99]",
        verified
          ? "border-white/10 bg-[#151618] hover:border-emerald-400/20"
          : "border-rose-400/20 bg-[#151114] hover:border-rose-300/30",
        agentHighlighted && "border-cyan-300/70 ring-2 ring-cyan-300/45 ring-offset-2 ring-offset-black",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover/asset:opacity-100", styles.glow)} />
      <div className="pointer-events-none absolute -right-16 -top-20 h-36 w-36 rounded-full bg-white/5 blur-[54px] opacity-0 transition-opacity duration-500 group-hover/asset:opacity-100" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl", styles.icon)}>
          <Icon className="h-6 w-6" />
        </div>
        <span
          className={cn(
            "rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em]",
            verified ? styles.badge : "border-rose-400/25 bg-rose-400/10 text-rose-300",
          )}
        >
          {verified ? "Verified" : "Missing"}
        </span>
      </div>

      <div className="relative z-10 mt-8">
        <h4 className="text-lg font-black tracking-tight text-white">{slot.label}</h4>
        <p className="mt-1 text-[12px] font-bold text-white/30">{slotMeta.description}</p>
        <div className="mt-4 border-t border-dashed border-white/10 pt-4">
          {meta ? (
            <div className="min-w-0 space-y-1">
              <div className="break-words text-xs font-bold leading-5 text-white/65" title={meta.originalName}>
                {meta.originalName}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">{formatDateTime(meta.uploadedAt)}</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-white/30">
              <Info className="h-3.5 w-3.5" />
              档案未匹配到此材料
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
          {meta ? "Stored" : "Required"}
        </span>
        <div className="flex items-center gap-2">
          {previewable && meta ? (
            <button
              type="button"
              onClick={() => void onPreview(slot.key, meta)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-white/60 transition hover:border-white/20 hover:text-white active:scale-95"
            >
              预览
            </button>
          ) : null}
          {meta ? (
            <a
              href={`/api/applicants/${applicantId}/files/${slot.key}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white/50 transition hover:text-white active:scale-95"
              aria-label={`下载 ${slot.label}`}
            >
              <Download className="h-4 w-4" />
            </a>
          ) : null}
          <UploadAction slot={slot} canUpload={canUpload} onUpload={onUpload} compact={Boolean(meta)} />
        </div>
      </div>
    </article>
  )
}

function UploadAction({
  slot,
  canUpload,
  onUpload,
  compact = false,
}: {
  slot: MaterialSlot
  canUpload: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  compact?: boolean
}) {
  if (!canUpload) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-white/30">
        <LockKeyhole className="h-3.5 w-3.5" />
        只读
      </span>
    )
  }

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-xl font-black transition active:scale-95",
        compact
          ? "border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/60 hover:text-white"
          : "bg-white px-4 py-2.5 text-[11px] text-black hover:bg-white/90",
      )}
    >
      <UploadCloud className="h-3.5 w-3.5" />
      {compact ? "替换" : "上传文件"}
      <input
        type="file"
        accept={slot.accept}
        onChange={(event) => void onUpload(event, slot.key)}
        className="sr-only"
      />
    </label>
  )
}

function SupplementaryQueue({
  slots,
  files,
  canEditApplicant,
  onUpload,
}: {
  slots: readonly MaterialSlot[]
  files: Record<string, FileMeta>
  canEditApplicant: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
}) {
  const queueItems = buildSupplementaryQueueItems(slots, files)

  return (
    <section className="rounded-[32px] border border-white/10 bg-[#151618] p-5 shadow-2xl shadow-black/25">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-white/30">Supplementary</div>
          <h3 className="mt-2 text-lg font-black text-white">目标补充材料</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/40">
          <Layers3 className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-3">
        {queueItems.map((item) => {
          const meta = item.meta
          const slotMeta = getSlotMeta(item.slot)
          const styles = toneStyles[slotMeta.tone]
          return (
            <div
              key={item.key}
              className="group/queue flex items-start justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20 hover:bg-white/[0.045]"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", meta ? styles.line : "bg-white/40")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black leading-5 text-white/85">{item.label}</div>
                  <div
                    className={cn(
                      "mt-1 break-words text-[10px] font-bold leading-4 text-white/35",
                      !meta && "uppercase tracking-[0.14em]",
                    )}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
              <UploadAction slot={item.slot} canUpload={canEditApplicant} onUpload={onUpload} compact />
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-3xl border border-dashed border-white/10 px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/30 transition hover:border-white/20 hover:text-white/50 active:scale-[0.99]"
      >
        + Add Supplementary
      </button>
    </section>
  )
}

function ArchiveTraceCard({
  applicantName,
  missingCount,
  isSchengenRepository,
}: {
  applicantName?: string
  missingCount: number
  isSchengenRepository: boolean
}) {
  const targetName = applicantName || "当前申请人"
  const traceMessage = isSchengenRepository
    ? `系统检测到 ${targetName} 的申根照片与行程辅助件需要复核，若照片采集时间超过 6 个月建议重新上传。`
    : `系统检测到 ${targetName} 的 DS-160 与面试必看材料需要保持版本一致，提交前请复核确认页编号。`

  return (
    <section className="group relative overflow-hidden rounded-[40px] border border-violet-300/[0.12] bg-[#15131a] p-6 text-white shadow-2xl shadow-black/25 transition-all duration-300 hover:-translate-y-1 hover:border-violet-300/[0.24]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/22 to-transparent" />
      <div className="relative z-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.28em] text-white/70">
        <History className="h-4 w-4" />
        AI Archive Trace
      </div>
      <p className="relative z-10 mt-8 text-[14px] font-bold leading-7 text-white/78">{traceMessage}</p>
      <div className="relative z-10 mt-7 flex items-center justify-between gap-4 border-t border-white/20 pt-5">
        <span className="text-[11px] font-bold text-white/60">当前缺口：{missingCount} 项</span>
        <button type="button" className="text-[11px] font-black underline decoration-white/30 underline-offset-4 transition hover:decoration-white">
          查看溯源详情
        </button>
      </div>
    </section>
  )
}

export function MaterialsTab({
  applicantId,
  applicantProfileId,
  applicantName,
  selectedCaseId,
  selectedCaseType,
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
  applicantName?: string
  selectedCaseId?: string
  selectedCaseType?: string
  files: Record<string, FileMeta>
  filesLoading?: boolean
  filesError?: string
  canEditApplicant: boolean
  canRunAutomation: boolean
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: FileMeta) => Promise<void>
}) {
  const defaultRepositoryKind = selectedCaseType === "usa-visa" ? "usVisa" : "schengenFrance"
  const [activeRepositoryKind, setActiveRepositoryKind] = useState<MaterialRepositoryKind>(defaultRepositoryKind)
  const schengenRepositorySlots = [...schengenUploadedSlots, ...schengenSubmissionSlots, ...schengenMaterialDocumentSlots]
  const usVisaRepositorySlots = [...usVisaUploadedSlots, ...usVisaSubmissionSlots, ...usVisaInterviewBriefSlots]
  const schengenUploadedCount = countUploaded(files, schengenRepositorySlots)
  const usVisaUploadedCount = countUploaded(files, usVisaRepositorySlots)
  const isSchengenRepository = activeRepositoryKind === "schengenFrance"
  const primaryAssetSlots = isSchengenRepository ? schengenUploadedSlots : usVisaUploadedSlots
  const generatedAssetSlots = isSchengenRepository ? schengenSubmissionSlots : usVisaSubmissionSlots
  const supplementarySlots = isSchengenRepository ? schengenMaterialDocumentSlots : usVisaInterviewBriefSlots
  const repositorySlots = isSchengenRepository ? schengenRepositorySlots : usVisaRepositorySlots
  const uploadedCount = countUploaded(files, repositorySlots)
  const missingCount = Math.max(repositorySlots.length - uploadedCount, 0)
  const repositoryCompletionPercent = repositorySlots.length > 0 ? Math.round((uploadedCount / repositorySlots.length) * 100) : 0
  const interviewBriefHref = `/usa-visa?tab=interview-brief&applicantProfileId=${encodeURIComponent(applicantProfileId)}${
    selectedCaseId ? `&caseId=${encodeURIComponent(selectedCaseId)}` : ""
  }`

  useEffect(() => {
    setActiveRepositoryKind(defaultRepositoryKind)
  }, [defaultRepositoryKind])

  return (
    <TabsContent value="materials" className="space-y-8">
      <RepositoryCategorySwitch
        activeRepositoryKind={activeRepositoryKind}
        onRepositoryKindChange={setActiveRepositoryKind}
        schengenUploadedCount={schengenUploadedCount}
        schengenTotalCount={schengenRepositorySlots.length}
        usVisaUploadedCount={usVisaUploadedCount}
        usVisaTotalCount={usVisaRepositorySlots.length}
      />

      <RepositoryStatusHub
        isSchengenRepository={isSchengenRepository}
        uploadedCount={uploadedCount}
        totalCount={repositorySlots.length}
        repositoryCompletionPercent={repositoryCompletionPercent}
        filesLoading={filesLoading}
        filesError={filesError}
        canEditApplicant={canEditApplicant}
        canRunAutomation={canRunAutomation}
        interviewBriefHref={interviewBriefHref}
      />

      {filesError ? (
        <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm font-bold text-rose-200">
          材料文件加载异常：{filesError}
        </div>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-9">
          <DocumentSection
            eyebrow="Applicant Raw Assets"
            title="申请人原始档案"
            slots={primaryAssetSlots}
            applicantId={applicantId}
            files={files}
            canEditApplicant={canEditApplicant}
            onUpload={onUpload}
            onPreview={onPreview}
          />

          <DocumentSection
            eyebrow="System Generated"
            title="系统链路自动产物"
            slots={generatedAssetSlots}
            applicantId={applicantId}
            files={files}
            canEditApplicant={canEditApplicant}
            onUpload={onUpload}
            onPreview={onPreview}
          />

          {!isSchengenRepository ? (
            <AisPaymentInfoCard
              applicantProfileId={applicantProfileId}
              selectedCaseId={selectedCaseId}
              applicantName={applicantName}
            />
          ) : null}

          {!isSchengenRepository ? (
            <section className="rounded-[40px] border border-sky-400/10 bg-[#10161d] p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-200">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-black text-white">面试材料自动生成</h3>
                  <p className="mt-2 text-sm leading-6 text-white/40">
                    DS-160 / AIS 源文件归档后，可跳转到美签工作台生成面试必看 PDF 与 Word。
                  </p>
                </div>
                <Link
                  href={interviewBriefHref}
                  className={cn(
                    "shrink-0 rounded-full bg-white px-5 py-3 text-xs font-black text-black transition hover:bg-white/90 active:scale-95",
                    !canRunAutomation && "pointer-events-none opacity-40",
                  )}
                >
                  去生成
                </Link>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5 xl:w-[300px] xl:justify-self-end">
          <SupplementaryQueue
            slots={supplementarySlots}
            files={files}
            canEditApplicant={canEditApplicant}
            onUpload={onUpload}
          />
          <ArchiveTraceCard
            applicantName={applicantName}
            missingCount={missingCount}
            isSchengenRepository={isSchengenRepository}
          />
          {filesLoading ? (
            <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 text-sm font-bold text-white/50">
              正在同步材料文件列表...
            </div>
          ) : null}
        </aside>
      </div>
    </TabsContent>
  )
}

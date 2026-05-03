"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  CircleDashed,
  Command,
  Edit3,
  FileText,
  Layers,
  Loader2,
  Plane,
  UploadCloud,
  User,
} from "lucide-react"

import { ProApplicantDropdown, type ProApplicantOption } from "@/components/pro-ui/pro-dropdown"
import { Progress } from "@/components/ui/progress"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { type ComprehensiveReviewResult } from "@/lib/comprehensive-material-review"
import { cn } from "@/lib/utils"

type MaterialSlotConfig = {
  key: keyof UploadState
  label: string
  compactLabel: string
  required: boolean
  accept: string
  archiveKeys: string[]
  hint: string
  icon: typeof FileText
}

type UploadState = {
  schengenExcel: File | null
  fvReceipt: File | null
  tlsAppointment: File | null
  itinerary: File | null
  hotel: File | null
  flight: File | null
  insurance: File | null
}

const REVIEW_PROGRESS_STEPS = ["正在整理材料", "正在提取 PDF 文本", "正在比对规则", "审核完成"]
const REVIEW_PROGRESS_VALUES = [20, 48, 78, 100]

const REVIEW_STANDARD_GROUPS = [
  {
    title: "时间链",
    items: ["入境日期、离境日期、入住/退房、机票首尾日期需要互相闭合。"],
  },
  {
    title: "身份链",
    items: ["姓名、出生日期、护照号、FV 申请号与 TLS 预约单需要一致。"],
  },
  {
    title: "住宿链",
    items: ["酒店名称、城市、地址与行程单和 Excel 主控信息需要匹配。"],
  },
]

const SLOT_CONFIG: MaterialSlotConfig[] = [
  {
    key: "schengenExcel",
    label: "申根基准表 (Excel)",
    compactLabel: "申根基准表",
    required: true,
    accept: ".xlsx,.xls",
    archiveKeys: ["schengenExcel", "franceExcel"],
    hint: "优先自动带入当前档案里的申根 Excel。",
    icon: FileText,
  },
  {
    key: "fvReceipt",
    label: "FV 申请回执单 (PDF)",
    compactLabel: "FV 申请回执单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: ["franceReceiptPdf"],
    hint: "优先自动带入当前档案里的 FV 申请回执单 PDF。",
    icon: FileText,
  },
  {
    key: "tlsAppointment",
    label: "TLS 预约确认单 (PDF)",
    compactLabel: "TLS 预约确认单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: [],
    hint: "当前系统还没有 TLS 预约单档案槽位，V1 先手动上传。",
    icon: Calendar,
  },
  {
    key: "itinerary",
    label: "行程单 (PDF / ZIP)",
    compactLabel: "行程单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: ["schengenItineraryPdf"],
    hint: "优先自动带入当前档案里的行程单 PDF。",
    icon: Plane,
  },
  {
    key: "hotel",
    label: "酒店订单 (PDF)",
    compactLabel: "酒店订单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: ["schengenHotelReservation"],
    hint: "优先自动带入当前档案里的酒店订单。",
    icon: Briefcase,
  },
  {
    key: "flight",
    label: "机票 / 车票 (PDF)",
    compactLabel: "机票 / 车票",
    required: false,
    accept: ".pdf,.docx",
    archiveKeys: ["schengenFlightReservation"],
    hint: "缺少机票不会直接拦截递签结论，但会在结果里明确提示。",
    icon: Plane,
  },
  {
    key: "insurance",
    label: "旅行保险 (PDF)",
    compactLabel: "旅行保险",
    required: false,
    accept: ".pdf,.docx",
    archiveKeys: [],
    hint: "缺少保险不会直接拦截递签结论，但会在结果里明确提示。",
    icon: FileText,
  },
]

function emptyUploads(): UploadState {
  return {
    schengenExcel: null,
    fvReceipt: null,
    tlsAppointment: null,
    itinerary: null,
    hotel: null,
    flight: null,
    insurance: null,
  }
}

function getArchiveFile(profile: ReturnType<typeof useActiveApplicantProfile>, archiveKeys: string[]) {
  if (!profile?.files) return null
  for (const key of archiveKeys) {
    const file = profile.files[key] as { originalName?: string } | undefined
    if (file?.originalName) return { slot: key, originalName: file.originalName }
  }
  return null
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values))
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const raw = await response.text()
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`接口返回内容无法解析，状态码 ${response.status}`)
  }
}

function initials(name: string) {
  const clean = name.trim()
  if (!clean) return "NA"
  if (/^[a-zA-Z]/.test(clean)) return clean.slice(0, 2).toUpperCase()
  return clean.slice(0, 1).toUpperCase()
}

export default function ComprehensiveReviewClientPage() {
  const activeApplicant = useActiveApplicantProfile()
  const [uploads, setUploads] = useState<UploadState>(emptyUploads)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ComprehensiveReviewResult | null>(null)
  const [progressStep, setProgressStep] = useState(0)

  useEffect(() => {
    if (!submitting) return

    setProgressStep(0)
    const timer = window.setInterval(() => {
      setProgressStep((current) => Math.min(current + 1, REVIEW_PROGRESS_STEPS.length - 2))
    }, 900)

    return () => window.clearInterval(timer)
  }, [submitting])

  const slotStatus = useMemo(
    () =>
      SLOT_CONFIG.map((slot) => {
        const upload = uploads[slot.key]
        const archiveFile = getArchiveFile(activeApplicant, slot.archiveKeys)
        return {
          ...slot,
          upload,
          archiveFile,
          hasAnySource: Boolean(upload || archiveFile),
        }
      }),
    [activeApplicant, uploads],
  )

  const readySlots = useMemo(() => slotStatus.filter((slot) => slot.hasAnySource), [slotStatus])
  const missingRequiredSlots = useMemo(
    () => slotStatus.filter((slot) => slot.required && !slot.hasAnySource),
    [slotStatus],
  )
  const canRun = Boolean(activeApplicant?.id) && missingRequiredSlots.length === 0 && !submitting

  const displayMaterialOutcomes = useMemo(
    () => result?.materialOutcomes.filter((material) => material.key !== "schengenExcel") || [],
    [result],
  )

  const blockingIssueGroups = useMemo(() => {
    if (!result) return []

    const groups = new Map<string, string[]>()
    for (const issue of result.blockingIssues) {
      const targetMaterials = issue.materials.filter((material) => material !== "申根 Excel") || []
      const materialLabels = targetMaterials.length > 0 ? targetMaterials : issue.materials

      for (const material of materialLabels) {
        const details = groups.get(material) || []
        details.push(issue.detail)
        groups.set(material, uniqueStrings(details))
      }
    }

    return Array.from(groups.entries()).map(([label, details]) => ({ label, details }))
  }, [result])

  const failingMaterialLabels = useMemo(
    () => displayMaterialOutcomes.filter((material) => material.status === "fail").map((material) => material.label),
    [displayMaterialOutcomes],
  )

  const missingRequiredMaterialLabels = useMemo(
    () =>
      displayMaterialOutcomes
        .filter((material) => material.status === "missing" && material.required)
        .map((material) => material.label),
    [displayMaterialOutcomes],
  )

  const handleFileChange = (key: keyof UploadState, file: File | null) => {
    setUploads((current) => ({ ...current, [key]: file }))
    setError("")
  }

  const handleResetUploads = () => {
    setUploads(emptyUploads())
    setResult(null)
    setError("")
  }

  const handleRun = async () => {
    if (!activeApplicant?.id) {
      setError("请先在申请人档案中选择当前申请人。")
      return
    }
    if (missingRequiredSlots.length > 0) {
      setError(`尚有 ${missingRequiredSlots.length} 份必传材料缺失，引擎拒绝工作。`)
      return
    }

    setSubmitting(true)
    setProgressStep(0)
    setError("")
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("applicantProfileId", activeApplicant.id)
      for (const slot of SLOT_CONFIG) {
        const upload = uploads[slot.key]
        if (upload) formData.append(slot.key, upload)
      }

      const response = await fetch("/api/material-review/comprehensive/run", {
        method: "POST",
        body: formData,
      })
      const data = await parseJsonResponse<{
        error?: string
        result?: ComprehensiveReviewResult
      }>(response)

      if (!response.ok || !data?.result) {
        throw new Error(data?.error || `综合材料审核失败（状态码 ${response.status}）`)
      }

      setProgressStep(REVIEW_PROGRESS_STEPS.length - 1)
      setResult(data.result)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "综合材料审核失败")
    } finally {
      setSubmitting(false)
    }
  }

  const applicantName = activeApplicant?.name || activeApplicant?.label || "未绑定申请人"
  const activeCase = activeApplicant?.activeCase
  const activeCaseLabel = activeCase?.caseType?.includes("france") || activeCase?.visaType === "france" ? "法国申根" : "法国申根"
  const activeCaseStatus = [activeCase?.mainStatus, activeCase?.subStatus].filter(Boolean).join(" / ") || "待付款 / 报价已发送"
  const activeCaseCity = activeCase?.tlsCity || activeApplicant?.schengen?.city || "LON (TLS)"
  const applicantUpdatedAt = activeApplicant?.updatedAt ? new Date(activeApplicant.updatedAt).toLocaleDateString("zh-CN") : "2026/4/18"
  const applicantDropdownOptions: ProApplicantOption[] = [
    {
      id: "current",
      name: applicantName,
      meta: `Updated ${applicantUpdatedAt}`,
      initials: initials(applicantName),
      tone: "blue",
      current: true,
      online: true,
    },
    {
      id: "liuying",
      name: "liuying",
      meta: "Updated 2026/4/10",
      initials: "LY",
      tone: "purple",
      online: false,
    },
    {
      id: "zhangwei",
      name: "zhangwei",
      meta: "Updated 2026/3/25",
      initials: "ZW",
      tone: "orange",
      online: false,
    },
  ]

  return (
    <div className="min-h-screen bg-black pt-28 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(16,185,129,0.12),transparent_28%)]" />
      <main className="relative mx-auto max-w-[1480px] space-y-7 px-4 pb-16 md:px-8">
        <section className="rounded-[24px] border border-white/5 bg-[#0f0f12] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
                  <Layers className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">综合材料审核引擎</h1>
              </div>
              <p className="max-w-4xl text-[13px] leading-6 text-white/50">
                交叉分析行程单、酒店订单、TLS预约单、FV申请回执单与申根 Excel 的互通性。缺失必传材料将中断审核。
              </p>
            </div>
            <Link
              href="/material-review/individual"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1c] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-white/5"
            >
              <Command className="h-3.5 w-3.5 opacity-50" />
              切换至单文件审核
            </Link>
          </div>
        </section>

        <section className="flex flex-col xl:flex-row gap-6">
          <aside className="w-full shrink-0 space-y-6 xl:w-[340px]">
            <div className="sticky top-28 rounded-[24px] border border-white/5 bg-[#0f0f12] p-6">
              <h2 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/80">
                <User className="h-4 w-4" />
                Context Binding
              </h2>

              <div className="space-y-5">
                <div>
                  <ProApplicantDropdown
                    label="Target Applicant"
                    addLabel="Add New Applicant"
                    value="current"
                    options={applicantDropdownOptions}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase text-white/40">Active Case</label>
                  <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#1a1a1c] p-4">
                    <div className="absolute bottom-0 left-0 top-0 w-1 bg-blue-500" />
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-bold text-blue-400">{activeCaseLabel}</span>
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                        办理中
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-[11px] text-white/50">
                      <div className="flex justify-between gap-4">
                        <span>类型:</span>
                        <span>{activeCase?.applyRegion || "英国"} · {activeCase?.priority || "普通"}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>状态:</span>
                        <span>{activeCaseStatus}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>递签:</span>
                        <span>{activeCaseCity}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/applicants"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1c] text-sm font-bold text-white transition-colors hover:bg-white/5"
                >
                  <Edit3 className="h-4 w-4" />
                  管理申请人档案
                </Link>
              </div>
            </div>
          </aside>

          <div className="flex-1 space-y-6">
            <section className="rounded-[24px] border border-white/5 bg-[#0f0f12] p-6 md:p-8">
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="mb-1 text-lg font-bold text-white">审计材料注入</h2>
                  <p className="flex items-center gap-2 text-[12px] text-white/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {readySlots.length}/{slotStatus.length} 已就绪就位
                    <span className="sr-only">1/4 已就绪就位</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetUploads}
                  className="rounded-lg border border-white/10 bg-[#1a1a1c] px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:text-white"
                >
                  全部重新匹配
                </button>
              </div>

              <div className="space-y-4">
                {slotStatus.map((slot) => {
                  const SlotIcon = slot.icon
                  const sourceName = slot.upload?.name || slot.archiveFile?.originalName || ""
                  const isReady = slot.hasAnySource
                  const isRequiredMissing = slot.required && !isReady

                  return (
                    <div
                      key={slot.key}
                      className={cn(
                        "rounded-2xl border p-5 transition-all",
                        isReady
                          ? "border-white/5 bg-[#151518] hover:border-emerald-500/30"
                          : "border-dashed border-white/15 bg-transparent opacity-80 hover:border-white/30",
                      )}
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex shrink-0 items-center justify-center",
                            isReady
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "border border-dashed border-white/20 text-white/30",
                          )}
                        >
                          <SlotIcon className={cn(isReady ? "h-6 w-6" : "h-5 w-5")} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                          <div className="mb-1.5 flex items-center gap-2">
                            <h3 className={cn("truncate text-sm font-bold", isReady ? "text-white" : "text-white/70")}>
                              {slot.label}
                            </h3>
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                isReady
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : slot.required
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-slate-500/30 text-slate-300",
                              )}
                            >
                              {isReady ? "Ready" : slot.required ? "Required" : "Optional"}
                            </span>
                          </div>
                          <div className={cn("flex items-center gap-2 text-[12px]", isReady ? "text-white/60" : "text-white/40")}>
                            {isReady ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            ) : (
                              <CircleDashed className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className={cn("truncate", isReady && "font-medium text-emerald-400")}>
                              {isReady ? sourceName : slot.hint}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 shrink-0 lg:mt-0">
                          <label
                            htmlFor={`comprehensive-${slot.key}`}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium shadow-sm transition-colors",
                              isReady
                                ? "border-white/20 bg-transparent text-white hover:bg-white/10"
                                : isRequiredMissing
                                  ? "border-white/10 bg-[#1a1a1c] text-white hover:bg-white/10"
                                  : "border-white/10 bg-[#1a1a1c] text-white/70 hover:text-white",
                            )}
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                            {isReady ? "替换" : "上传"}
                          </label>
                          <input
                            id={`comprehensive-${slot.key}`}
                            type="file"
                            accept={slot.accept}
                            className="sr-only"
                            onChange={(event) => handleFileChange(slot.key, event.target.files?.[0] || null)}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-10 flex flex-col justify-between gap-6 border-t border-dashed border-white/10 pt-8 xl:flex-row xl:items-center">
                <div className="text-[13px] text-white/50">
                  <span className="font-medium text-amber-400">系统拦截：</span>
                  {missingRequiredSlots.length > 0
                    ? `尚有 ${missingRequiredSlots.length} 份必传材料缺失，引擎拒绝工作。`
                    : activeApplicant?.id
                      ? "必传材料已就绪，可以执行综合材料比对。"
                      : "请先绑定当前申请人，引擎拒绝工作。"}
                </div>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!canRun}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold shadow-sm transition-all active:scale-95",
                    canRun
                      ? "bg-white text-black hover:bg-white/90"
                      : "cursor-not-allowed border border-white/5 bg-white/5 text-white/30 opacity-50",
                  )}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4 opacity-50" />}
                  {submitting ? "综合比对中..." : "执行综合材料比对"}
                </button>
              </div>
            </section>

            {submitting ? (
              <section className="rounded-[24px] border border-blue-500/20 bg-blue-500/10 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {REVIEW_PROGRESS_STEPS[progressStep]}
                  </div>
                  <span className="font-mono text-xs text-blue-200">{REVIEW_PROGRESS_VALUES[progressStep]}%</span>
                </div>
                <Progress value={REVIEW_PROGRESS_VALUES[progressStep]} className="h-2 bg-blue-950" />
              </section>
            ) : null}

            {error ? (
              <section className="flex items-center gap-3 rounded-[24px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-3">
              {REVIEW_STANDARD_GROUPS.map((group) => (
                <div key={group.title} className="rounded-[24px] border border-white/5 bg-white/[0.02] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{group.title}</p>
                  <p className="mt-3 text-sm leading-6 text-white/55">{group.items[0]}</p>
                </div>
              ))}
            </section>
          </div>
        </section>

        {result ? (
          <section className="space-y-6">
            <div
              className={cn(
                "rounded-[24px] border p-6",
                result.decision === "pass" ? "border-emerald-500/20 bg-emerald-500/10" : "border-red-500/20 bg-red-500/10",
              )}
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    {result.decision === "pass" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    )}
                    <h2 className="text-xl font-semibold text-white">综合结论：{result.decisionLabel}</h2>
                  </div>
                  <p className="mt-2 text-sm text-white/65">{result.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-red-200">
                    必须修改 {result.blockingIssues.length} 项
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/65">
                    不过关材料 {displayMaterialOutcomes.filter((material) => material.status === "fail").length} 份
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/65">
                    缺少可选材料 {result.missingOptionalMaterials.length} 项
                  </span>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "rounded-[24px] border p-5",
                failingMaterialLabels.length > 0 || missingRequiredMaterialLabels.length > 0
                  ? "border-red-500/20 bg-red-500/10"
                  : "border-emerald-500/20 bg-emerald-500/10",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    failingMaterialLabels.length > 0 || missingRequiredMaterialLabels.length > 0
                      ? "text-red-200"
                      : "text-emerald-200",
                  )}
                >
                  {failingMaterialLabels.length > 0 || missingRequiredMaterialLabels.length > 0 ? "不过关材料汇总" : "当前材料通过情况"}
                </p>
                {failingMaterialLabels.length > 0 ? (
                  failingMaterialLabels.map((label) => (
                    <span key={`fail-${label}`} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-200">
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    当前对照材料均已通过
                  </span>
                )}
              </div>

              {missingRequiredMaterialLabels.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-red-200">缺失核心材料</p>
                  {missingRequiredMaterialLabels.map((label) => (
                    <span key={`missing-${label}`} className="rounded-full border border-red-500/20 bg-black/20 px-3 py-1 text-xs text-red-200">
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-[24px] border border-white/5 bg-[#0f0f12] p-6">
                <h2 className="text-lg font-semibold text-white">必须修改</h2>
                <p className="mt-2 text-sm text-white/45">
                  按材料归类展示。申根 Excel 作为标准源，不单独列入不过关材料。
                </p>
                <div className="mt-5 space-y-3">
                  {result.blockingIssues.length === 0 ? (
                    <p className="text-sm text-emerald-300">当前没有拦截递签的硬性冲突。</p>
                  ) : (
                    blockingIssueGroups.map((group) => (
                      <div key={group.label} className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                        <p className="text-sm font-semibold text-red-200">{group.label}</p>
                        <div className="mt-2 space-y-2">
                          {group.details.map((detail) => (
                            <p key={`${group.label}-${detail}`} className="text-sm text-red-100/70">
                              {detail}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-white/5 bg-[#0f0f12] p-6">
                <h2 className="text-lg font-semibold text-white">建议检查</h2>
                <div className="mt-5 space-y-3">
                  {result.advisoryIssues.length === 0 ? (
                    <p className="text-sm text-white/50">当前没有额外建议检查项。</p>
                  ) : (
                    result.advisoryIssues.map((issue) => (
                      <div key={issue.code} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <p className="text-sm font-semibold text-amber-200">{issue.title}</p>
                        <p className="mt-2 text-sm text-amber-100/70">{issue.detail}</p>
                        <p className="mt-2 text-xs text-amber-200/70">涉及材料：{issue.materials.join("、")}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-[24px] border border-white/5 bg-[#0f0f12] p-6">
              <h2 className="text-lg font-semibold text-white">解析快照</h2>
              <p className="mt-2 text-sm text-white/45">
                展示系统本次从各份材料中实际抽取到的核心字段。
              </p>
              <div className="mt-5 space-y-4">
                {result.extracted.length === 0 ? (
                  <p className="text-sm text-white/45">本次没有抽取到可展示的结构化字段。</p>
                ) : (
                  result.extracted.map((snapshot) => (
                    <details key={snapshot.source} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-white">{snapshot.source}</summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {snapshot.values.map((value) => (
                          <div key={`${snapshot.source}-${value.label}`} className="rounded-lg bg-black/20 p-3">
                            <p className="text-xs text-white/35">{value.label}</p>
                            <p className="mt-1 text-sm text-white/80">{value.value}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))
                )}
              </div>
            </section>
          </section>
        ) : null}
      </main>
    </div>
  )
}

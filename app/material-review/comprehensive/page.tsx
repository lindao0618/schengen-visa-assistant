"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react"

import { ApplicantProfileSelector } from "@/components/applicant-profile-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { type ComprehensiveReviewResult } from "@/lib/comprehensive-material-review"
import { cn } from "@/lib/utils"

type MaterialSlotConfig = {
  key: keyof UploadState
  label: string
  required: boolean
  accept: string
  archiveKeys: string[]
  hint: string
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
    title: "主控原则",
    items: [
      "申根 Excel 作为主控源，其他材料的关键字段会优先对比申根 Excel。",
      "材料之间也会交叉审核，只要任一核心规则不满足，就会判定对应材料不过关。",
      "机票、保险缺失不会直接拦截，但只要上传后与时间链或路线链不一致，就会判定不过关。",
    ],
  },
  {
    title: "时间链一致性",
    items: [
      "申根 Excel、FV申请回执单、行程单、酒店订单、机票、保险的日期区间要互相闭合。",
      "入境日期、离境日期、出发日期、返回日期都会按主区间逐项对比。",
      "酒店入住/退房必须覆盖整个停留夜晚，酒店晚数会自动反推。",
      "行程单每日日期必须连续，机票首尾日期要和行程首尾匹配。",
      "保险如果已上传，必须完整覆盖整个主区间。",
    ],
  },
  {
    title: "身份信息一致性",
    items: [
      "申根 Excel 与 FV申请回执单会核对姓名、出生日期、护照号。",
      "TLS预约单会核对姓名和申请号是否与 FV申请回执单一致。",
      "联系电话、邮箱、英国地址也会纳入一致性审核。",
    ],
  },
  {
    title: "酒店与行程一致性",
    items: [
      "酒店名称、地址、城市会在申根 Excel、FV申请回执单、行程单、酒店订单之间交叉比对。",
      "酒店 Guest name 允许多人，只要包含申请人姓名即可，忽略大小写和姓/名顺序。",
      "行程单中的酒店名称/地址/城市、酒店订单中的名称/地址/城市、Excel 中的酒店信息必须对得上。",
    ],
  },
  {
    title: "机票与路线一致性",
    items: [
      "如果上传机票，会核对去程/返程日期是否与主区间一致。",
      "机票去程出发/到达城市、返程出发/到达城市会对比行程单首尾路线。",
      "缺少机票或保险不会直接拦截，但会在结论里明确提示缺少哪些材料。",
    ],
  },
]

const SLOT_CONFIG: MaterialSlotConfig[] = [
  {
    key: "schengenExcel",
    label: "申根 Excel",
    required: true,
    accept: ".xlsx,.xls",
    archiveKeys: ["schengenExcel", "franceExcel"],
    hint: "优先自动带入当前档案里的申根 Excel。",
  },
  {
    key: "fvReceipt",
    label: "FV申请回执单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: ["franceReceiptPdf"],
    hint: "优先自动带入当前档案里的 FV 申请回执单 PDF。",
  },
  {
    key: "tlsAppointment",
    label: "TLS预约单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: [],
    hint: "当前系统还没有 TLS 预约单档案槽位，V1 先手动上传。",
  },
  {
    key: "itinerary",
    label: "行程单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: ["schengenItineraryPdf"],
    hint: "优先自动带入当前档案里的行程单 PDF。",
  },
  {
    key: "hotel",
    label: "酒店订单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: ["schengenHotelReservation"],
    hint: "优先自动带入当前档案里的酒店订单。",
  },
  {
    key: "flight",
    label: "机票",
    required: false,
    accept: ".pdf,.docx",
    archiveKeys: ["schengenFlightReservation"],
    hint: "缺少机票不会直接拦截递签结论，但会在结果里明确提示。",
  },
  {
    key: "insurance",
    label: "保险",
    required: false,
    accept: ".pdf,.docx",
    archiveKeys: [],
    hint: "缺少保险不会直接拦截递签结论，但会在结果里明确提示。",
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

export default function ComprehensiveMaterialReviewPage() {
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

  const displayMaterialOutcomes = useMemo(
    () => result?.materialOutcomes.filter((material) => material.key !== "schengenExcel") || [],
    [result],
  )

  const blockingIssueGroups = useMemo(() => {
    if (!result) return []

    const groups = new Map<string, string[]>()
    for (const issue of result.blockingIssues) {
      const targetMaterials =
        issue.materials.filter((material) => material !== "申根 Excel") || []
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
    () => displayMaterialOutcomes.filter((material) => material.status === "missing" && material.required).map((material) => material.label),
    [displayMaterialOutcomes],
  )

  const handleFileChange = (key: keyof UploadState, file: File | null) => {
    setUploads((current) => ({ ...current, [key]: file }))
  }

  const handleRun = async () => {
    if (!activeApplicant?.id) {
      setError("请先在顶部选择当前申请人。")
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

  return (
    <div className="min-h-screen bg-white pt-20">
      <div className="container mx-auto space-y-6 px-4 pb-10">
        <ApplicantProfileSelector scope="france-schengen" />

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">综合材料审核</CardTitle>
                <CardDescription className="mt-2 text-sm text-gray-600">
                  先支持法国申根。系统会检查行程单、酒店订单、TLS预约单、FV申请回执单与申根
                  Excel 是否互相对应、互相闭合。
                </CardDescription>
              </div>
              <Button variant="outline" asChild>
                <Link href="/material-review">返回单独材料审核</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <Badge variant="secondary">结论只给 可以递签 / 不可递签</Badge>
              <Badge variant="outline">机票、保险缺失仅提示，不直接拦截</Badge>
              <Badge variant="outline">当前申请人档案材料优先自动带入</Badge>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">材料槽位</CardTitle>
            <CardDescription>
              必传材料缺失会直接判为不可递签；可选材料缺失会在结论里说明。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {slotStatus.map((slot) => (
              <div key={slot.key} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{slot.label}</h3>
                      <Badge variant={slot.required ? "default" : "secondary"}>
                        {slot.required ? "必传" : "可选"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{slot.hint}</p>
                  </div>
                  <div
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-medium",
                      slot.hasAnySource ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {slot.hasAnySource ? "已就绪" : "待补充"}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">档案自动带入</p>
                    <p className="mt-1 text-sm text-gray-800">
                      {slot.archiveFile ? slot.archiveFile.originalName : "当前档案未匹配到该材料"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-dashed border-gray-300 px-3 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
                      <FileUp className="h-4 w-4" />
                      手动上传覆盖当前槽位
                    </label>
                    <input
                      type="file"
                      accept={slot.accept}
                      className="mt-2 block w-full text-xs text-gray-600"
                      onChange={(event) => handleFileChange(slot.key, event.target.files?.[0] || null)}
                    />
                    {slot.upload ? (
                      <p className="mt-2 text-xs text-blue-600">本次将优先使用：{slot.upload.name}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">审核标准说明</CardTitle>
            <CardDescription>这里列的是当前综合材料审核会实际执行的主要对比规则。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {REVIEW_STANDARD_GROUPS.map((group) => (
              <div key={group.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
                <div className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <p key={item} className="text-sm leading-6 text-gray-600">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleRun}
            disabled={submitting || !activeApplicant?.id}
            className="min-w-[180px] gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "综合审核中..." : "开始综合审核"}
          </Button>
          {!activeApplicant?.id ? (
            <p className="text-sm text-amber-600">请先在顶部选择申请人档案。</p>
          ) : (
            <p className="text-sm text-gray-500">当前申请人：{activeApplicant.name || activeApplicant.label}</p>
          )}
        </div>

        {submitting ? (
          <Card className="border-blue-200 bg-blue-50 shadow-sm">
            <CardContent className="space-y-3 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {REVIEW_PROGRESS_STEPS[progressStep]}
                </div>
                <span className="text-xs text-blue-700">{REVIEW_PROGRESS_VALUES[progressStep]}%</span>
              </div>
              <Progress value={REVIEW_PROGRESS_VALUES[progressStep]} className="h-2 bg-blue-100" />
              <p className="text-xs text-blue-700">文本型 PDF 会优先走文本提取，再进入规则比对。</p>
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-red-200 bg-red-50 shadow-sm">
            <CardContent className="flex items-center gap-3 py-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </CardContent>
          </Card>
        ) : null}

        {result ? (
          <div className="space-y-6">
            <Card
              className={cn(
                "shadow-sm",
                result.decision === "pass" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50",
              )}
            >
              <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    {result.decision === "pass" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <h2 className="text-xl font-semibold text-gray-900">综合结论：{result.decisionLabel}</h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{result.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="destructive">必须修改 {result.blockingIssues.length} 项</Badge>
                  <Badge variant="secondary">
                    不过关材料 {displayMaterialOutcomes.filter((material) => material.status === "fail").length} 份
                  </Badge>
                  <Badge variant="outline">缺少可选材料 {result.missingOptionalMaterials.length} 项</Badge>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "shadow-sm",
                failingMaterialLabels.length > 0 || missingRequiredMaterialLabels.length > 0
                  ? "border-red-200 bg-red-50"
                  : "border-emerald-200 bg-emerald-50",
              )}
            >
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      failingMaterialLabels.length > 0 || missingRequiredMaterialLabels.length > 0
                        ? "text-red-700"
                        : "text-emerald-700",
                    )}
                  >
                    {failingMaterialLabels.length > 0 || missingRequiredMaterialLabels.length > 0 ? "不过关材料汇总" : "当前材料通过情况"}
                  </p>
                  {failingMaterialLabels.length > 0
                    ? failingMaterialLabels.map((label) => (
                        <Badge key={`fail-${label}`} variant="outline" className="border-red-200 bg-red-100 text-red-700 hover:bg-red-100">
                          {label}
                        </Badge>
                      ))
                    : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          当前对照材料均已通过
                        </Badge>
                      )}
                </div>

                {missingRequiredMaterialLabels.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-red-700">缺失核心材料</p>
                    {missingRequiredMaterialLabels.map((label) => (
                      <Badge key={`missing-${label}`} variant="outline" className="border-red-200 bg-white text-red-700 hover:bg-white">
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">对照材料判定</CardTitle>
                <CardDescription>申根 Excel 作为标准源，不参与不过关材料列表。下面只展示其他材料的通过/不过关情况。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {displayMaterialOutcomes.map((material) => {
              const snapshot = result.materials[material.key]
              const statusLabel =
                material.status === "fail" ? "不过关" : material.status === "pass" ? "已通过" : material.required ? "缺失" : "未提供"
              const statusClassName =
                material.status === "fail"
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-50"
                  : material.status === "pass"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                    : material.required
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-50"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-50"
              const cardClassName =
                material.status === "fail"
                  ? "border-red-200 bg-red-50/40"
                  : material.status === "pass"
                    ? "border-emerald-200 bg-emerald-50/40"
                    : material.required
                      ? "border-red-200 bg-red-50/30"
                      : "border-gray-200 bg-white"

                  return (
                    <div key={`${material.label}-${snapshot.fileName || "empty"}`} className={cn("rounded-xl border p-3", cardClassName)}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{material.label}</p>
                        <Badge variant="outline" className={statusClassName}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {snapshot.present
                          ? `${snapshot.sourceType === "upload" ? "手动上传" : "档案带入"}：${snapshot.fileName}`
                          : snapshot.required
                            ? "当前审核未找到该核心材料"
                            : "当前审核未提供该可选材料"}
                      </p>
                      {material.blockingTitles.length > 0 ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="text-xs font-medium text-red-700">不过关原因</p>
                          <div className="mt-2 space-y-1">
                            {material.blockingTitles.map((title) => (
                              <p key={`${material.label}-${title}`} className="text-xs leading-5 text-red-700">
                                {title}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : material.status === "pass" ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-xs font-medium text-emerald-700">通过说明</p>
                          <p className="mt-2 text-xs leading-5 text-emerald-700">当前这份材料已通过本次综合审核，没有发现拦截递签的硬性冲突。</p>
                        </div>
                      ) : material.required ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="text-xs font-medium text-red-700">缺失说明</p>
                          <p className="mt-2 text-xs leading-5 text-red-700">这是核心材料，当前缺失时系统会直接判定为不可递签。</p>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs font-medium text-gray-700">未提供说明</p>
                          <p className="mt-2 text-xs leading-5 text-gray-700">这份材料当前未提供，不会直接拦截，但系统会在综合结论里明确提示。</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900">必须修改</CardTitle>
                  <CardDescription>按材料归类展示。申根 Excel 作为标准源，不单独列入不过关材料，但会在下面的描述里作为对比基准出现。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.blockingIssues.length === 0 ? (
                    <p className="text-sm text-emerald-700">当前没有拦截递签的硬性冲突。</p>
                  ) : (
                    blockingIssueGroups.map((group) => (
                      <div key={group.label} className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">{group.label}</p>
                        <div className="mt-2 space-y-2">
                          {group.details.map((detail) => (
                            <p key={`${group.label}-${detail}`} className="text-sm text-red-700">
                              {detail}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900">建议检查</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.advisoryIssues.length === 0 ? (
                    <p className="text-sm text-gray-600">当前没有额外建议检查项。</p>
                  ) : (
                    result.advisoryIssues.map((issue) => (
                      <div key={issue.code} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-800">{issue.title}</p>
                        <p className="mt-2 text-sm text-amber-800">{issue.detail}</p>
                        <p className="mt-2 text-xs text-amber-700">涉及材料：{issue.materials.join("、")}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">解析快照</CardTitle>
                <CardDescription>
                  这里展示系统本次从各份材料中实际抽取到的核心字段，方便判断问题出在材料本身还是解析链路。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.extracted.length === 0 ? (
                  <p className="text-sm text-gray-500">本次没有抽取到可展示的结构化字段。</p>
                ) : (
                  result.extracted.map((snapshot) => (
                    <details key={snapshot.source} className="rounded-xl border border-gray-200 bg-white p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-900">{snapshot.source}</summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {snapshot.values.map((value) => (
                          <div key={`${snapshot.source}-${value.label}`} className="rounded-lg bg-gray-50 p-3">
                            <p className="text-xs text-gray-500">{value.label}</p>
                            <p className="mt-1 text-sm text-gray-900">{value.value}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react"

import { ApplicantProfileSelector } from "@/components/applicant-profile-selector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    label: "FV 回执单",
    required: true,
    accept: ".pdf,.docx",
    archiveKeys: ["franceReceiptPdf"],
    hint: "优先自动带入当前档案里的法国回执单 PDF。",
  },
  {
    key: "tlsAppointment",
    label: "TLS 预约单",
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
    hint: "优先自动带入当前档案里的酒店预订单材料。",
  },
  {
    key: "flight",
    label: "机票",
    required: false,
    accept: ".pdf,.docx",
    archiveKeys: ["schengenFlightReservation"],
    hint: "缺少机票不拦截递签结论，但会在结果里明确提示。",
  },
  {
    key: "insurance",
    label: "保险",
    required: false,
    accept: ".pdf,.docx",
    archiveKeys: [],
    hint: "缺少保险不拦截递签结论，但会在结果里明确提示。",
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

export default function ComprehensiveMaterialReviewPage() {
  const activeApplicant = useActiveApplicantProfile()
  const [uploads, setUploads] = useState<UploadState>(emptyUploads)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ComprehensiveReviewResult | null>(null)

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

  const handleFileChange = (key: keyof UploadState, file: File | null) => {
    setUploads((current) => ({ ...current, [key]: file }))
  }

  const handleRun = async () => {
    if (!activeApplicant?.id) {
      setError("请先在顶部选择当前申请人。")
      return
    }

    setSubmitting(true)
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
      const data = (await response.json()) as {
        error?: string
        result?: ComprehensiveReviewResult
      }

      if (!response.ok || !data.result) {
        throw new Error(data.error || "综合材料审核失败")
      }

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
                  V1 先支持法国申根。系统会检查行程单、酒店、TLS 预约单、FV 回执单与申根 Excel 是否互相对应、互相闭合。
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
              必传材料缺失会直接判为不可递签；可选材料缺失则会在结论旁说明。
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
            <p className="text-sm text-gray-500">
              当前申请人：{activeApplicant.name || activeApplicant.label}
            </p>
          )}
        </div>

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
                  <Badge variant="secondary">建议检查 {result.advisoryIssues.length} 项</Badge>
                  <Badge variant="outline">缺少可选材料 {result.missingOptionalMaterials.length} 项</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">材料状态</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(result.materials).map(([key, material]) => (
                  <div key={key} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{material.label}</p>
                      <Badge variant={material.present ? "secondary" : material.required ? "destructive" : "outline"}>
                        {material.present ? "已纳入" : material.required ? "缺失" : "未提供"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {material.present
                        ? `${material.sourceType === "upload" ? "手动上传" : "档案带入"}：${material.fileName}`
                        : material.required
                          ? "当前审核未找到该核心材料"
                          : "当前审核未提供该可选材料"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900">必须修改</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.blockingIssues.length === 0 ? (
                    <p className="text-sm text-emerald-700">当前没有拦截递签的硬性冲突。</p>
                  ) : (
                    result.blockingIssues.map((issue) => (
                      <div key={issue.code} className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">{issue.title}</p>
                        <p className="mt-2 text-sm text-red-700">{issue.detail}</p>
                        <p className="mt-2 text-xs text-red-600">涉及材料：{issue.materials.join("、")}</p>
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
                  这里展示系统本次从各份材料中实际抽取到的核心字段，方便你判断问题到底出在材料本身还是解析链路。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.extracted.length === 0 ? (
                  <p className="text-sm text-gray-500">本次没有抽取到可展示的结构化字段。</p>
                ) : (
                  result.extracted.map((snapshot) => (
                    <details key={snapshot.source} className="rounded-xl border border-gray-200 bg-white p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                        {snapshot.source}
                      </summary>
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

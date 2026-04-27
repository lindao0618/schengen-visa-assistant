"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, RefreshCw } from "lucide-react"

import { ApplicantProfileSelector } from "@/components/applicant-profile-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"

type ReviewSourceInfo = {
  key: "excel" | "ds160" | "interviewBrief"
  label: string
  status: "ready" | "fallback" | "missing"
  description: string
  fileName?: string
}

type ReviewComparison = {
  key: string
  category: "identity" | "contact" | "travel" | "workEducation" | "background"
  labelCn: string
  labelEn: string
  excelValue: string
  ds160Value: string
  interviewBriefValue: string
  ds160Status: "match" | "mismatch" | "missing" | "not_applicable"
  interviewBriefStatus: "match" | "mismatch" | "missing" | "not_applicable"
}

type ReviewIssue = {
  source: "DS-160 生成结果" | "面试必看"
  title: string
  message: string
}

type ReviewResult = {
  decision: "pass" | "needs_changes"
  summary: string
  sources: ReviewSourceInfo[]
  blockingIssues: ReviewIssue[]
  comparisons: ReviewComparison[]
}

type ReviewResponse = {
  success?: boolean
  error?: string
  result?: ReviewResult
}

const STAGES = [
  "正在读取 Excel",
  "正在定位 DS-160 结果",
  "正在对照面试必看",
  "正在生成审核结论",
]

const CATEGORY_LABELS: Record<ReviewComparison["category"], string> = {
  identity: "身份信息",
  contact: "联系方式",
  travel: "赴美行程",
  workEducation: "学校 / 工作",
  background: "背景问答",
}

const FIELD_LABELS: Record<string, { cn: string; en: string }> = {
  applicationId: { cn: "AA码", en: "Application ID" },
  surname: { cn: "姓", en: "Surname" },
  givenName: { cn: "名", en: "Given Name" },
  dateOfBirth: { cn: "出生日期", en: "Date of Birth" },
  passportNumber: { cn: "护照号", en: "Passport Number" },
  primaryPhone: { cn: "主要电话", en: "Primary Phone Number" },
  lastFiveYearsPhone: { cn: "近五年电话", en: "Last Five Years Phone" },
  personalEmail: { cn: "个人邮箱", en: "Personal Email Address" },
  lastFiveYearsEmail: { cn: "近五年邮箱", en: "Last Five Years Email" },
  homeAddress: { cn: "家庭地址", en: "Home Address" },
  homeCity: { cn: "家庭城市", en: "Home City" },
  homeState: { cn: "家庭州省", en: "Home State/Province" },
  homeZip: { cn: "家庭邮编", en: "Home ZIP Code" },
  arrivalDate: { cn: "计划到达日期", en: "Intended Date of Arrival" },
  stayDays: { cn: "计划停留天数", en: "Intended Length of Stay" },
  hotelAddress: { cn: "在美地址", en: "Address Where You Will Stay" },
  hotelCity: { cn: "在美城市", en: "U.S. Stay City" },
  hotelState: { cn: "在美州", en: "U.S. Stay State" },
  tripPayer: { cn: "旅行费用支付人", en: "Trip Payer" },
  hotelName: { cn: "第一晚酒店", en: "First Night Hotel" },
  currentOccupation: { cn: "当前职业", en: "Primary Occupation" },
  schoolName: { cn: "当前学校/单位", en: "Present Employer or School Name" },
  major: { cn: "专业/课程", en: "Course of Study / Major" },
  presentSchoolAddress: { cn: "当前学校/单位地址", en: "Present Employer or School Address" },
  presentSchoolCity: { cn: "当前学校/单位城市", en: "Present Employer or School City" },
  presentSchoolState: { cn: "当前学校/单位州省", en: "Present Employer or School State" },
  presentSchoolZip: { cn: "当前学校/单位邮编", en: "Present Employer or School ZIP" },
  presentSchoolPhone: { cn: "当前学校/单位电话", en: "Present Employer or School Phone" },
  hasUsVisa: { cn: "是否曾有美国签证", en: "Have You Ever Been Issued a U.S. Visa?" },
  previousUsTravel: { cn: "是否去过美国", en: "Have You Ever Been in the U.S.?" },
}

const SOURCE_LABELS: Record<ReviewSourceInfo["key"], string> = {
  excel: "美签 Excel",
  ds160: "DS-160 生成结果",
  interviewBrief: "面试必看",
}

function getSourceDescription(source: ReviewSourceInfo) {
  if (source.key === "excel") {
    return source.fileName ? `已读取信息源 Excel：${source.fileName}` : "已读取当前申请人的信息源 Excel。"
  }
  if (source.key === "ds160") {
    if (source.status === "ready") {
      return source.fileName ? `已读取 DS-160 Review 文件：${source.fileName}` : "已读取最近一次生成的 DS-160 Review 文件。"
    }
    if (source.status === "fallback") {
      return "已读取 DS-160 对照结果，但部分字段来自兜底解析。"
    }
    return "未找到可用的 DS-160 生成结果，请先完成 DS-160 填表。"
  }
  if (source.status === "ready") {
    return source.fileName ? `已读取面试必看结果：${source.fileName}` : "已读取归档的面试必看结构化结果。"
  }
  if (source.status === "fallback") {
    return "未找到面试必看快照，已按当前 Excel 重建对照数据。"
  }
  return "未找到面试必看结果，请先生成面试必看。"
}

async function readJsonSafely<T>(response: Response) {
  const text = await response.text()
  if (!text) return null as T | null
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`服务端返回内容无法解析（状态码 ${response.status}）`)
  }
}

function groupByCategory(items: ReviewComparison[]) {
  const grouped = new Map<ReviewComparison["category"], ReviewComparison[]>()
  for (const item of items) {
    if (!grouped.has(item.category)) grouped.set(item.category, [])
    grouped.get(item.category)?.push(item)
  }
  return Array.from(grouped.entries()).map(([category, rows]) => ({
    category,
    label: CATEGORY_LABELS[category],
    rows,
  }))
}

function getSourceBadgeClass(status: ReviewSourceInfo["status"]) {
  if (status === "ready") return "bg-emerald-100 text-emerald-700 ring-emerald-200"
  if (status === "fallback") return "bg-amber-100 text-amber-700 ring-amber-200"
  return "bg-rose-100 text-rose-700 ring-rose-200"
}

function getCellClass(status: ReviewComparison["ds160Status"]) {
  if (status === "match") return "bg-emerald-50 text-emerald-800"
  if (status === "mismatch") return "bg-rose-50 text-rose-700"
  if (status === "missing") return "bg-amber-50 text-amber-700"
  return "bg-slate-50 text-slate-400"
}

function getCellLabel(status: ReviewComparison["ds160Status"]) {
  if (status === "match") return "一致"
  if (status === "mismatch") return "需修改"
  if (status === "missing") return "未识别"
  return "未对照"
}

export default function UsaReviewClientPage() {
  const activeApplicant = useActiveApplicantProfile()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [stageIndex, setStageIndex] = useState(0)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  const groupedComparisons = useMemo(
    () =>
      groupByCategory(
        (result?.comparisons || []).map((item) => ({
          ...item,
          labelCn: FIELD_LABELS[item.key]?.cn || item.labelCn,
          labelEn: FIELD_LABELS[item.key]?.en || item.labelEn,
        })),
      ),
    [result],
  )

  const normalizedSources = useMemo(
    () =>
      (result?.sources || []).map((source) => ({
        ...source,
        label: SOURCE_LABELS[source.key] || source.label,
        description: getSourceDescription(source),
      })),
    [result],
  )

  const displayIssues = useMemo(() => {
    if (!result) return []

    const issues: ReviewIssue[] = []
    for (const source of normalizedSources) {
      if (source.status !== "missing") continue
      issues.push({
        source: source.label as ReviewIssue["source"],
        title: `缺少${source.label}`,
        message: source.description,
      })
    }

    for (const comparison of result.comparisons) {
      const labels = FIELD_LABELS[comparison.key] || { cn: comparison.labelCn, en: comparison.labelEn }
      if (comparison.ds160Status === "mismatch") {
        issues.push({
          source: "DS-160 生成结果",
          title: `${labels.cn} / ${labels.en} 不一致`,
          message: `Excel：${comparison.excelValue || "未填写"}；DS-160：${comparison.ds160Value || "未识别"}`,
        })
      }
      if (comparison.interviewBriefStatus === "mismatch") {
        issues.push({
          source: "面试必看",
          title: `${labels.cn} / ${labels.en} 不一致`,
          message: `Excel：${comparison.excelValue || "未填写"}；面试必看：${comparison.interviewBriefValue || "未识别"}`,
        })
      }
    }

    return issues
  }, [normalizedSources, result])

  const hasExcel =
    Boolean(activeApplicant?.files?.usVisaDs160Excel) ||
    Boolean(activeApplicant?.files?.ds160Excel) ||
    Boolean(activeApplicant?.files?.usVisaAisExcel) ||
    Boolean(activeApplicant?.files?.aisExcel)

  const hasInterviewBrief = Boolean(activeApplicant?.files?.usVisaInterviewBriefPdf)

  const handleRun = async () => {
    if (!activeApplicant?.id) {
      setError("请先选择当前申请人")
      return
    }

    setLoading(true)
    setError("")
    setResult(null)
    setStageIndex(0)

    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setStageIndex((current) => (current < STAGES.length - 1 ? current + 1 : current))
    }, 850)

    try {
      const response = await fetch("/api/material-review/usa-review/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantProfileId: activeApplicant.id }),
      })
      const data = await readJsonSafely<ReviewResponse>(response)
      if (!response.ok || !data?.result) {
        throw new Error(data?.error || `美签审核失败（状态码 ${response.status}）`)
      }
      setStageIndex(STAGES.length - 1)
      setResult(data.result)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "美签审核失败")
    } finally {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <ApplicantProfileSelector scope="usa-visa" />

          <Card className="overflow-hidden border-0 shadow-[0_22px_50px_rgba(15,23,42,0.08)]">
            <CardHeader className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(135deg,#ffffff,#f8fafc)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-3xl text-slate-950">
                    <FileSearch className="h-8 w-8 text-sky-600" />
                    美签审核
                  </CardTitle>
                  <CardDescription className="mt-2 text-base text-slate-600">
                    以美签 Excel 为标准，逐项核对 DS-160 生成结果与面试必看内容是否一致。
                  </CardDescription>
                </div>
                <Button
                  onClick={handleRun}
                  disabled={loading || !activeApplicant?.id || !hasExcel}
                  className="h-11 rounded-full bg-slate-950 px-6 text-base font-medium hover:bg-black"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在审核
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      开始审核
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">美签 Excel</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {hasExcel ? "已就绪" : "缺少信息源"}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {activeApplicant?.files?.usVisaDs160Excel?.originalName ||
                      activeApplicant?.files?.ds160Excel?.originalName ||
                      activeApplicant?.files?.usVisaAisExcel?.originalName ||
                      activeApplicant?.files?.aisExcel?.originalName ||
                      "请先上传 DS-160 / AIS Excel"}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">DS-160 生成结果</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">按最近一次填表任务读取</div>
                  <div className="mt-2 text-sm text-slate-500">
                    优先读取最近一次生成的 DS-160 Review PDF。
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-medium text-slate-500">面试必看</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {hasInterviewBrief ? "可读取" : "建议先生成"}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {activeApplicant?.files?.usVisaInterviewBriefPdf?.originalName || "未找到面试必看 PDF"}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="text-lg font-semibold text-slate-900">审核标准说明</div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">DS-160 会对比</div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">
                      身份信息、联系方式、赴美日期、在美地址、旅行支付人、美国旅行史、学校或工作信息。
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">面试必看会对比</div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">
                      城市、酒店、出发与离开日期、停留天数、学校、专业、旅行支付人、美国旅行史等关键信息。
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card className="border-0 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-slate-900">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                  <div className="text-lg font-semibold">美签审核进行中</div>
                </div>
                <div className="mt-5 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-slate-900 transition-all"
                    style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {STAGES.map((stage, index) => {
                    const active = index <= stageIndex
                    return (
                      <div
                        key={stage}
                        className={`rounded-2xl border px-4 py-3 text-sm ${
                          active ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {index + 1}. {stage}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <Card className="border-rose-200 bg-rose-50/60">
              <CardContent className="flex items-start gap-3 p-5 text-rose-700">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>{error}</div>
              </CardContent>
            </Card>
          ) : null}

          {result ? (
            <>
              <Card className="border-0 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-500">综合结论</div>
                      <div
                        className={`mt-2 text-3xl font-semibold ${
                          result.decision === "pass" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {result.decision === "pass" ? "审核通过" : "需要修改"}
                      </div>
                      <div className="mt-3 text-sm text-slate-500">
                        当前申请人：{activeApplicant?.name || activeApplicant?.label || "未选择"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                      {result.decision === "pass" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      )}
                      需要修改：{displayIssues.length} 项
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {normalizedSources.map((source) => (
                      <div key={source.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base font-semibold text-slate-900">{source.label}</div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${getSourceBadgeClass(source.status)}`}
                          >
                            {source.status === "ready" ? "已读取" : source.status === "fallback" ? "重建对照" : "缺失"}
                          </span>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-600">{source.description}</div>
                        {source.fileName ? (
                          <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            文件：{source.fileName}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {displayIssues.length ? (
                <Card className="border-rose-200 bg-rose-50/40">
                  <CardHeader>
                    <CardTitle className="text-rose-700">必须修改</CardTitle>
                    <CardDescription>以下字段与标准 Excel 不一致，请先修正再继续。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {displayIssues.map((issue, index) => (
                      <div key={`${issue.source}-${issue.title}-${index}`} className="rounded-2xl border border-rose-200 bg-white p-4">
                        <div className="text-sm font-semibold text-rose-700">{issue.source}</div>
                        <div className="mt-2 text-base font-semibold text-slate-900">{issue.title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{issue.message}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <div className="space-y-5">
                {groupedComparisons.map((group) => (
                  <Card key={group.category} className="border-0 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
                    <CardHeader>
                      <CardTitle>{group.label}</CardTitle>
                      <CardDescription>中英文字段对照，方便顾问和客户一起核对。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {group.rows.map((row) => (
                        <div key={row.key} className="rounded-3xl border border-slate-200 bg-white p-4">
                          <div className="mb-4">
                            <div className="text-base font-semibold text-slate-900">
                              {row.labelCn} / {row.labelEn}
                            </div>
                          </div>
                          <div className="grid gap-4 lg:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                Excel
                              </div>
                              <div className="mt-2 break-words text-sm leading-6 text-slate-900">
                                {row.excelValue || "未填写"}
                              </div>
                            </div>
                            <div className={`rounded-2xl border p-4 ${getCellClass(row.ds160Status)}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-medium uppercase tracking-[0.18em]">DS-160</div>
                                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium">
                                  {getCellLabel(row.ds160Status)}
                                </span>
                              </div>
                              <div className="mt-2 break-words text-sm leading-6">
                                {row.ds160Value || (row.ds160Status === "not_applicable" ? "不适用" : "未识别")}
                              </div>
                            </div>
                            <div className={`rounded-2xl border p-4 ${getCellClass(row.interviewBriefStatus)}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-medium uppercase tracking-[0.18em]">面试必看</div>
                                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium">
                                  {getCellLabel(row.interviewBriefStatus)}
                                </span>
                              </div>
                              <div className="mt-2 break-words text-sm leading-6">
                                {row.interviewBriefValue ||
                                  (row.interviewBriefStatus === "not_applicable" ? "不适用" : "未识别")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react"

import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type InterviewBriefIssue = {
  field: string
  message: string
}

type InterviewBriefFields = {
  schoolName?: string
  major?: string
  currentOccupation?: string
  hotelName?: string
  hotelCity?: string
  arrivalDate?: string
  departureDate?: string
  stayDays?: string
  tripPayer?: string
}

type InterviewBriefOption = {
  label: string
  text: string
}

type InterviewBriefBlock =
  | {
      type: "qa"
      id: string
      questionCn: string
      questionEn?: string
      answerCn: string
      answerEn?: string
      note?: string
    }
  | {
      type: "qa-options"
      id: string
      questionCn: string
      questionEn?: string
      answerCn: string
      answerEn?: string
      note?: string
      options: InterviewBriefOption[]
    }
  | {
      type: "section-title"
      id: string
      title: string
      description?: string
    }
  | {
      type: "pending-qa"
      id: string
      questionCn: string
      questionEn?: string
      placeholderCn: string
      placeholderEn?: string
    }
  | {
      type: "hotel"
      id: string
      title: string
      hotelName: string
    }

type GenerationResult = {
  success: boolean
  fields: InterviewBriefFields
  blocks: InterviewBriefBlock[]
  issues: InterviewBriefIssue[]
  docx_download_url: string
  pdf_download_url?: string | null
  pdf_warning?: string | null
  template_mode?: "default" | "custom"
  error?: string
}

function hasUsVisaExcel(profile: ReturnType<typeof useActiveApplicantProfile>) {
  return Boolean(
    profile?.files?.usVisaDs160Excel ||
      profile?.files?.ds160Excel ||
      profile?.files?.usVisaAisExcel ||
      profile?.files?.aisExcel,
  )
}

function EnglishLine({ children }: { children: React.ReactNode }) {
  return <div className="font-serif text-sm leading-7 text-slate-600">{children}</div>
}

function PreviewBlock({ block }: { block: InterviewBriefBlock }) {
  if (block.type === "section-title") {
    return (
      <div className="rounded-[28px] border border-orange-200 bg-[linear-gradient(135deg,_#fff7ed,_#fff)] p-5 shadow-sm">
        <div className="text-sm font-semibold tracking-[0.16em] text-orange-700">敏感专业问题区</div>
        <div className="mt-2 text-xl font-semibold text-slate-900">{block.title}</div>
        {block.description ? <div className="mt-2 text-sm leading-7 text-slate-600">{block.description}</div> : null}
      </div>
    )
  }

  if (block.type === "hotel") {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">{block.title}</div>
        <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm font-medium text-sky-900">
          {block.hotelName}
        </div>
      </div>
    )
  }

  if (block.type === "pending-qa") {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">{block.questionCn}</div>
        {block.questionEn ? (
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{block.questionEn}</div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-white/80 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">中文：{block.placeholderCn || ""}</div>
          <EnglishLine>英文：{block.placeholderEn || ""}</EnglishLine>
        </div>
      </div>
    )
  }

  if (block.type === "qa-options") {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">{block.questionCn}</div>
        {block.questionEn ? (
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{block.questionEn}</div>
        ) : null}

        <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="text-sm leading-7 text-slate-700">
            <span className="font-semibold text-slate-900">中文：</span>
            {block.answerCn}
          </div>
          <EnglishLine>
            <span className="font-semibold text-slate-900">英文：</span>
            {block.answerEn || ""}
          </EnglishLine>
        </div>

        {block.note ? <div className="mt-4 text-sm font-medium text-amber-800">{block.note}</div> : null}

        <div className="mt-4 grid gap-3">
          {block.options.map((option) => (
            <div key={option.label} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{option.label}</div>
              <EnglishLine>{option.text}</EnglishLine>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">{block.questionCn}</div>
      {block.questionEn ? (
        <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{block.questionEn}</div>
      ) : null}
      <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
        <div className="text-sm leading-7 text-slate-700">
          <span className="font-semibold text-slate-900">中文：</span>
          {block.answerCn}
        </div>
        <EnglishLine>
          <span className="font-semibold text-slate-900">英文：</span>
          {block.answerEn || ""}
        </EnglishLine>
      </div>
      {block.note ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {block.note}
        </div>
      ) : null}
    </div>
  )
}

export function InterviewBriefForm() {
  const profile = useActiveApplicantProfile()
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)

  const summaryCards = useMemo(() => {
    if (!result?.fields) return []
    return [
      { label: "学校", value: result.fields.schoolName || "未识别" },
      { label: "专业", value: result.fields.major || "未识别" },
      { label: "赴美城市", value: result.fields.hotelCity || "未识别" },
      { label: "第一晚酒店", value: result.fields.hotelName || "未识别" },
      { label: "出发日期", value: result.fields.arrivalDate || "未识别" },
      { label: "离开日期", value: result.fields.departureDate || "未识别" },
      { label: "停留天数", value: result.fields.stayDays || "未识别" },
      { label: "支付人", value: result.fields.tripPayer || "默认按本人 + 父母支持整理" },
    ]
  }, [result])

  const previewSummary = useMemo(() => {
    if (!result?.blocks?.length) return { generated: 0, pending: 0 }
    return {
      generated: result.blocks.filter((block) => block.type !== "pending-qa" && block.type !== "section-title").length,
      pending: result.blocks.filter((block) => block.type === "pending-qa").length,
    }
  }, [result])

  const pdfPreviewUrl = useMemo(() => {
    if (!result?.pdf_download_url) return ""
    return result.pdf_download_url.includes("?")
      ? `${result.pdf_download_url}&disposition=inline`
      : `${result.pdf_download_url}?disposition=inline`
  }, [result?.pdf_download_url])

  const handleGenerate = async () => {
    if (!profile?.id) {
      setError("请先选择申请人。")
      return
    }

    if (!hasUsVisaExcel(profile)) {
      setError("当前申请人档案里没有可用于定制面试必看的信息表。")
      return
    }

    setLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("applicantProfileId", profile.id)
      if (templateFile) {
        formData.append("template", templateFile)
      }

      const response = await fetch("/api/usa-visa/interview-brief/generate", {
        method: "POST",
        body: formData,
      })
      const data = (await response.json()) as GenerationResult
      if (!response.ok || !data.success) {
        throw new Error(data.error || "生成失败")
      }
      setResult(data)
      setPdfPreviewOpen(false)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : "生成失败")
      setPdfPreviewOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const usingDefaultTemplate = !templateFile

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border border-slate-200 bg-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_42%),linear-gradient(135deg,_#ffffff,_#f8fafc)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 p-2 text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-900">美签面试必看生成器</CardTitle>
                <CardDescription className="text-slate-600">
                  默认使用系统模板，按当前申请人的个人信息定制中间问答区，并导出新的 Word / PDF。
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">当前申请人</div>
                <div className="text-base font-semibold text-slate-900">{profile?.name || profile?.label || "未选择"}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {hasUsVisaExcel(profile) ? "已找到可用的个人信息资料" : "未找到可用的个人信息资料"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  <WandSparkles className="h-3.5 w-3.5" />
                  模板模式
                </div>
                <Badge className="rounded-full bg-slate-900 px-3 py-1 text-white hover:bg-slate-900">
                  {usingDefaultTemplate ? "系统默认模板" : "自定义模板"}
                </Badge>
                <div className="mt-2 text-sm text-slate-500">
                  正常流程不需要上传 Word。只有你临时想替换模板时，才在下面选择一个自定义 `.docx`。
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-2 text-sm font-medium text-slate-900">可选：临时覆盖模板</div>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/80 px-4 py-3 transition hover:border-sky-400">
                <FileText className="h-4 w-4 text-sky-700" />
                <span className="text-sm text-slate-700">
                  {templateFile ? templateFile.name : "不上传则直接使用系统内置模板"}
                </span>
                <Input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(event) => setTemplateFile(event.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="rounded-[26px] border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                生成规则
              </div>
              <div className="leading-7">
                保留前面的“递签流程”和后面的“伦敦自取点”之后内容，只替换中间“美签常见问题”区间。
              </div>
            </div>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

            <Button
              onClick={handleGenerate}
              disabled={loading || !profile?.id}
              className="h-11 rounded-2xl bg-slate-900 px-5 text-white shadow-lg hover:bg-slate-800"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
              一键生成预览与导出文件
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] shadow-[0_18px_45px_-24px_rgba(15,23,42,0.25)]">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">识别摘要</CardTitle>
            <CardDescription>先把资料里能稳定提取的关键信息列出来，生成前就能看出有没有串内容。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {summaryCards.length > 0 ? (
              summaryCards.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-sm font-medium text-slate-800">{item.value}</div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                生成后这里会显示从当前资料中整理出的学校、专业、行程、酒店和支付信息。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result ? (
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <Card className="border border-slate-200 bg-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.2)]">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-slate-900">导出结果</CardTitle>
                <CardDescription>先看预览，再下载 Word 或 PDF。</CardDescription>
              </div>
              <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                已生成
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">当前模板</div>
                  <div className="mt-2 text-sm font-medium text-slate-800">
                    {result.template_mode === "custom" ? "自定义模板" : "系统默认模板"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">预览概览</div>
                  <div className="mt-2 flex items-center gap-3 text-sm text-slate-700">
                    <span>{previewSummary.generated} 个已整理内容块</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                    <span>{previewSummary.pending} 个待人工补充问题</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
                  <a href={result.docx_download_url} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    下载 Word
                  </a>
                </Button>
                {result.pdf_download_url ? (
                  <>
                    <Button variant="secondary" className="rounded-2xl" onClick={() => setPdfPreviewOpen(true)}>
                      <FileText className="mr-2 h-4 w-4" />
                      预览 PDF
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl">
                      <a href={result.pdf_download_url} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        下载 PDF
                      </a>
                    </Button>
                  </>
                ) : null}
              </div>

              {result.pdf_warning ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {result.pdf_warning}
                </div>
              ) : null}

              {result.issues.length ? (
                <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm font-medium text-rose-700">生成前提醒</div>
                  {result.issues.map((issue) => (
                    <div key={`${issue.field}-${issue.message}`} className="text-sm text-rose-700">
                      {issue.field}：{issue.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  没发现明显缺失字段，这份材料可以直接进入人工复核。
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] shadow-[0_18px_45px_-24px_rgba(15,23,42,0.24)]">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900">定制内容预览</CardTitle>
              <CardDescription>这里展示会被写进 Word 中间区段的内容结构。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.blocks.map((block) => (
                <PreviewBlock key={block.id} block={block} />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>面试必看 PDF 预览</DialogTitle>
          </DialogHeader>
          {pdfPreviewUrl ? (
            <iframe src={pdfPreviewUrl} className="h-[75vh] w-full rounded-xl border border-slate-200" />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              暂无可预览的 PDF。
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Download, ExternalLink, Eye, Maximize2 } from "lucide-react"

export type MaterialResultSummaryProps = {
  result: Record<string, unknown>
  taskType: string
}

export function MaterialResultSummary({ result, taskType }: MaterialResultSummaryProps) {
  const downloadPdf = result.download_pdf as string | undefined
  const downloadWordChinese = result.download_word_chinese as string | undefined
  const downloadWordEnglish = result.download_word_english as string | undefined
  const downloadPdfChinese = result.download_pdf_chinese as string | undefined
  const downloadPdfEnglish = result.download_pdf_english as string | undefined
  const archivedProfileCnDocxUrl = result.archivedProfileCnDocxUrl as string | undefined
  const archivedProfileEnDocxUrl = result.archivedProfileEnDocxUrl as string | undefined
  const archivedProfileCnPdfUrl = result.archivedProfileCnPdfUrl as string | undefined
  const archivedProfileEnPdfUrl = result.archivedProfileEnPdfUrl as string | undefined
  const analysisResult = result.analysis_result as Record<string, unknown> | undefined
  const archivedToApplicantProfile = Boolean(result.archivedToApplicantProfile)
  const archiveNote = archivedToApplicantProfile ? (
    <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">已自动归档到当前申请人档案</p>
  ) : null

  if (taskType === "material-review") {
    const aiObject = analysisResult?.ai_analysis
    const aiAnalysis =
      typeof aiObject === "string"
        ? aiObject
        : ((aiObject as Record<string, unknown>)?.ai_analysis as string | undefined)
    const bookingVerification = analysisResult?.booking_verification as
      | { checked?: boolean; found?: boolean | null; error?: string }
      | undefined
    if (!aiAnalysis) return null
    return (
      <div className="space-y-2">
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="group relative max-h-20 w-full cursor-pointer overflow-y-auto rounded border bg-gray-50 p-2 text-left text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:bg-gray-800/50"
            >
              <div className="pr-6">{aiAnalysis}</div>
              <div className="absolute right-2 top-2 flex items-center gap-1 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="text-[10px]">查看完整</span>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
            <DialogHeader>
              <DialogTitle>审核详情</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded border bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
              {aiAnalysis}
            </div>
          </DialogContent>
        </Dialog>
        {bookingVerification && (
          <div className="rounded border bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-900/50 dark:text-gray-400">
            Booking.com 订单验证：
            {bookingVerification.found === true ? (
              <span className="ml-1 text-green-600 dark:text-green-400">已找到订单</span>
            ) : bookingVerification.found === false ? (
              <span className="ml-1 text-red-600 dark:text-red-400">未找到订单</span>
            ) : bookingVerification.error ? (
              <span className="ml-1 text-amber-600 dark:text-amber-400">{bookingVerification.error}</span>
            ) : (
              <span className="ml-1">未验证/结果不明确</span>
            )}
          </div>
        )}
      </div>
    )
  }

  if (taskType === "itinerary" && downloadPdf) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        <DownloadButton href={downloadPdf} label="下载 PDF" />
        <PreviewPdfButton href={downloadPdf} />
        <div className="basis-full">{archiveNote}</div>
      </div>
    )
  }

  if (taskType === "explanation-letter") {
    const links: { href: string; label: string }[] = []
    const explanationWordChineseHref = archivedProfileCnDocxUrl ? `${archivedProfileCnDocxUrl}?download=1` : downloadWordChinese
    const explanationWordEnglishHref = archivedProfileEnDocxUrl ? `${archivedProfileEnDocxUrl}?download=1` : downloadWordEnglish
    const explanationPdfChineseHref = archivedProfileCnPdfUrl ? `${archivedProfileCnPdfUrl}?download=1` : downloadPdfChinese
    const explanationPdfEnglishHref = archivedProfileEnPdfUrl ? `${archivedProfileEnPdfUrl}?download=1` : downloadPdfEnglish

    if (explanationWordChineseHref) links.push({ href: explanationWordChineseHref, label: "Word 中文" })
    if (explanationWordEnglishHref) links.push({ href: explanationWordEnglishHref, label: "Word 英文" })
    if (explanationPdfChineseHref) links.push({ href: explanationPdfChineseHref, label: "PDF 中文" })
    if (explanationPdfEnglishHref) links.push({ href: explanationPdfEnglishHref, label: "PDF 英文" })
    if (links.length === 0) return null

    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {links.map(({ href, label }) => (
          <div key={label} className="flex flex-wrap gap-2">
            <DownloadButton href={href} label={label} />
            {label.startsWith("PDF") && <PreviewPdfButton href={href} label={`预览 ${label}`} />}
          </div>
        ))}
        <div className="basis-full">{archiveNote}</div>
      </div>
    )
  }

  return null
}

function DownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs" asChild>
      <a href={href} download target="_blank" rel="noopener noreferrer">
        <Download className="h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  )
}

function PreviewPdfButton({ href, label = "预览 PDF" }: { href: string; label?: string }) {
  const previewUrl = new URL(href, "http://localhost")
  previewUrl.searchParams.delete("download")
  previewUrl.searchParams.set("inline", "1")
  const previewHref = `${previewUrl.pathname}${previewUrl.search}${previewUrl.hash}`
  const viewerHref = `${previewHref}#view=FitH&zoom=page-width&pagemode=none`

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            默认按页宽预览，如果想看得更舒服，可以直接在新窗口打开或下载后查看。
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 border-b bg-muted/30 px-6 py-3">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={previewHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              新窗口打开
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={href} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              下载 PDF
            </a>
          </Button>
        </div>
        <iframe
          src={viewerHref}
          title={label}
          className="min-h-0 flex-1 bg-white"
          allow="fullscreen"
        />
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clipboard, Download, ExternalLink, ImageIcon, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type AisTaskArtifact = {
  filename?: string
  downloadUrl?: string
}

type AisTaskResult = {
  success?: boolean
  email?: string
  message?: string
  chineseName?: string
  password?: string
  paymentUrl?: string
  paymentScreenshot?: AisTaskArtifact
}

type AisTask = {
  task_id: string
  type: "register-ais" | string
  status: string
  updated_at?: number
  created_at?: number
  result?: AisTaskResult
}

type AisPaymentPackage = {
  taskId: string
  applicantName: string
  email: string
  password: string
  paymentUrl: string
  message: string
  screenshotUrl: string
  screenshotFilename: string
  updatedAt: number
}

type ClipboardItemConstructor = new (items: Record<string, Blob>) => ClipboardItem

function isSuccessfulAisPaymentTask(task: AisTask): task is AisTask & { result: AisTaskResult } {
  return task.type === "register-ais" && task.status === "completed" && task.result?.success === true
}

function normalizeAisPaymentPackage(task: AisTask, fallbackApplicantName: string): AisPaymentPackage | null {
  if (!isSuccessfulAisPaymentTask(task)) return null
  const result = task.result
  if (!result.email && !result.paymentUrl) return null

  return {
    taskId: task.task_id,
    applicantName: result.chineseName || fallbackApplicantName || "-",
    email: result.email || "-",
    password: result.password || "Visa202520252025!",
    paymentUrl: result.paymentUrl || "",
    message:
      result.message ||
      "已登录 AIS 账号，并推进到 Payment 页面。复制链接到浏览器打开，输入账号密码后支付签证费。",
    screenshotUrl: result.paymentScreenshot?.downloadUrl || "",
    screenshotFilename: result.paymentScreenshot?.filename || "ais-payment-page.png",
    updatedAt: task.updated_at || task.created_at || Date.now(),
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatDateTime(value: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function buildAisPaymentPlainText(info: AisPaymentPackage) {
  return [
    "AIS 支付信息包",
    `姓名：${info.applicantName}`,
    `邮箱：${info.email}`,
    `密码：${info.password}`,
    `链接：${info.paymentUrl || "-"}`,
    "",
    "补充：复制链接到浏览器打开，输入账号密码，然后支付页面里的签证费，就可以在后面选择 slot 日期；如果还需要快递，把 request 的邮寄费用 32 镑也付了。",
    "",
    info.screenshotUrl ? `支付页截图：${info.screenshotUrl}` : "支付页截图：暂无",
  ].join("\n")
}

function buildAisPaymentHtml(info: AisPaymentPackage, screenshotDataUrl?: string) {
  const screenshotSrc = screenshotDataUrl || info.screenshotUrl
  return `
    <article style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.65;">
      <h2 style="margin: 0 0 12px;">AIS 支付信息包</h2>
      <p style="margin: 0 0 10px; color: #16a34a;">${escapeHtml(info.message)}</p>
      <p style="margin: 0;">姓名：${escapeHtml(info.applicantName)}</p>
      <p style="margin: 0;">邮箱：${escapeHtml(info.email)}</p>
      <p style="margin: 0;">密码：${escapeHtml(info.password)}</p>
      <p style="margin: 0;">链接：<a href="${escapeHtml(info.paymentUrl)}">${escapeHtml(info.paymentUrl || "-")}</a></p>
      <p style="margin: 12px 0;">补充：复制链接到浏览器打开，输入账号密码，然后支付页面里的签证费，就可以在后面选择 slot 日期；如果还需要快递，把 request 的邮寄费用 32 镑也付了。</p>
      ${
        screenshotSrc
          ? `<figure style="margin: 14px 0 0;"><img src="${screenshotSrc}" alt="AIS 支付页截图" style="max-width: 100%; border: 1px solid #cbd5e1; border-radius: 12px;" /><figcaption style="font-size: 12px; color: #64748b;">支付页截图</figcaption></figure>`
          : ""
      }
    </article>
  `.trim()
}

async function fetchImageDataUrl(url: string) {
  const response = await fetch(url, { credentials: "include" })
  if (!response.ok) throw new Error(`截图读取失败（${response.status}）`)
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("截图转换失败"))
    reader.readAsDataURL(blob)
  })
}

export function AisPaymentInfoCard({
  applicantProfileId,
  selectedCaseId,
  applicantName,
}: {
  applicantProfileId: string
  selectedCaseId?: string
  applicantName?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState<AisPaymentPackage | null>(null)
  const [actionMessage, setActionMessage] = useState("")
  const [copying, setCopying] = useState(false)
  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({
      applicantProfileId,
      status: "completed",
      limit: "20",
    })
    if (selectedCaseId) params.set("caseId", selectedCaseId)
    return `/api/usa-visa/tasks-list?${params.toString()}`
  }, [applicantProfileId, selectedCaseId])

  useEffect(() => {
    if (!applicantProfileId) return

    let cancelled = false
    setLoading(true)
    setError("")
    fetch(queryUrl, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { tasks?: AisTask[]; error?: string }
        if (!response.ok) throw new Error(data.error || "读取 AIS 支付信息失败")
        const tasks = Array.isArray(data.tasks) ? data.tasks : []
        const packageInfo =
          tasks.map((task) => normalizeAisPaymentPackage(task, applicantName || "")).find(Boolean) || null
        if (!cancelled) setInfo(packageInfo)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "读取 AIS 支付信息失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [applicantName, applicantProfileId, queryUrl])

  const copyPlainText = async () => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(buildAisPaymentPlainText(info))
      setActionMessage("AIS 支付文字已复制")
    } catch {
      setActionMessage("当前浏览器不支持自动复制，请手动复制卡片内容")
    }
  }

  const copyRichPackage = async () => {
    if (!info) return
    setCopying(true)
    setActionMessage("")
    try {
      const screenshotDataUrl = info.screenshotUrl ? await fetchImageDataUrl(info.screenshotUrl) : ""
      const ClipboardItemCtor = (window as Window & { ClipboardItem?: ClipboardItemConstructor }).ClipboardItem
      if (!navigator.clipboard?.write || !ClipboardItemCtor) {
        if (!navigator.clipboard?.writeText) throw new Error("当前浏览器不支持自动复制")
        await navigator.clipboard.writeText(buildAisPaymentPlainText(info))
        setActionMessage("浏览器不支持图文一起复制，已复制文字")
        return
      }
      const html = buildAisPaymentHtml(info, screenshotDataUrl)
      await navigator.clipboard.write([
        new ClipboardItemCtor({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([buildAisPaymentPlainText(info)], { type: "text/plain" }),
        }),
      ])
      setActionMessage("AIS 图文包已复制")
    } catch (err) {
      try {
        if (!navigator.clipboard?.writeText) throw err
        await navigator.clipboard.writeText(buildAisPaymentPlainText(info))
        setActionMessage("图文复制失败，已改为复制文字")
      } catch {
        setActionMessage(err instanceof Error ? err.message : "复制失败")
      }
    } finally {
      setCopying(false)
    }
  }

  const downloadAisPaymentPackage = async () => {
    if (!info) return
    setActionMessage("")
    try {
      const screenshotDataUrl = info.screenshotUrl ? await fetchImageDataUrl(info.screenshotUrl) : ""
      const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>AIS 支付信息包</title></head><body>${buildAisPaymentHtml(info, screenshotDataUrl)}</body></html>`
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `ais-payment-package-${info.email.replace(/[^a-zA-Z0-9._-]/g, "_") || info.taskId}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setActionMessage("AIS 图文包已下载")
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "下载图文包失败")
    }
  }

  return (
    <div className="rounded-[36px] border border-sky-400/10 bg-[#10161d] p-6 text-white shadow-2xl shadow-black/25">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-200/45">AIS Payment Package</div>
            {info ? (
              <Badge className="gap-1 border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                可复制带走
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 text-lg font-black tracking-tight text-white">AIS 支付信息包</div>
          <div className="max-w-xl text-sm leading-6 text-white/42">
            保存最近一次成功推进到 Payment 页的 AIS 账号、密码、链接和支付页截图。
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs font-bold text-sky-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在读取 AIS 成功记录...
            </div>
          ) : error ? (
            <div className="text-xs font-bold text-rose-300">{error}</div>
          ) : !info ? (
            <div className="text-xs font-bold text-white/35">当前申请人/案件还没有成功的 AIS 支付页记录。</div>
          ) : (
            <div className="mt-4 grid gap-2 text-sm text-white/72 sm:grid-cols-2">
              <div>姓名：{info.applicantName}</div>
              <div className="font-mono text-xs">邮箱：{info.email}</div>
              <div className="font-mono text-xs">密码：{info.password}</div>
              <div className="break-all sm:col-span-2">
                链接：
                {info.paymentUrl ? (
                  <a href={info.paymentUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-sky-200 underline decoration-sky-200/30 underline-offset-4">
                    {info.paymentUrl}
                  </a>
                ) : (
                  "-"
                )}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/32 sm:col-span-2">更新时间：{formatDateTime(info.updatedAt)}</div>
            </div>
          )}
          {actionMessage ? <div className="text-xs font-bold text-sky-200">{actionMessage}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button type="button" variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white" disabled={!info} onClick={copyPlainText}>
            <Clipboard className="mr-2 h-4 w-4" />
            复制文字
          </Button>
          <Button type="button" size="sm" className="rounded-xl bg-white text-black hover:bg-white/90" disabled={!info || copying} onClick={copyRichPackage}>
            {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clipboard className="mr-2 h-4 w-4" />}
            复制图文包
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white" disabled={!info} onClick={downloadAisPaymentPackage}>
            <Download className="mr-2 h-4 w-4" />
            下载图文包
          </Button>
          {info?.screenshotUrl ? (
            <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white" asChild>
              <a href={info.screenshotUrl} target="_blank" rel="noopener noreferrer">
                <ImageIcon className="mr-2 h-4 w-4" />
                查看截图
              </a>
            </Button>
          ) : null}
          {info?.paymentUrl ? (
            <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white" asChild>
              <a href={info.paymentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                打开链接
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

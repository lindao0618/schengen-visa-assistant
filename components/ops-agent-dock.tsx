"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  FileUp,
  Loader2,
  MessageSquareText,
  PanelRightOpen,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

type OpsAgentCard = Record<string, unknown>

type OpsAgentMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  cards?: OpsAgentCard[]
  suggestions?: string[]
}

type OpsAgentPageContext = {
  currentUrl: string
  pageType?: string
  currentApplicantId?: string
  currentCaseId?: string
}

const QUICK_ACTIONS = [
  { label: "查缺漏", prompt: "检查当前申请人的材料缺漏", icon: ClipboardList },
  { label: "催办话术", prompt: "生成催办话术", icon: MessageSquareText },
  { label: "今日简报", prompt: "看今日简报", icon: CalendarClock },
  { label: "启动自动化", prompt: "启动自动化", icon: Wand2 },
] as const

const MATERIAL_GAPS = [
  { label: "护照首页", state: "待上传", target: "passport_home", severity: "critical" },
  { label: "在职证明", state: "待上传", target: "employment_certificate", severity: "critical" },
  { label: "递签时间", state: "待确认", target: "slot_time", severity: "warning" },
] as const

const FOLLOW_UP_TEMPLATE = `您好，当前材料还差：
1. 护照首页
2. 在职证明

麻烦今天方便时补充一下，我们收到后会继续推进递签准备。`

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function resolvePageContext(): OpsAgentPageContext {
  if (typeof window === "undefined") return { currentUrl: "" }
  const pathname = window.location.pathname
  const searchParams = new URLSearchParams(window.location.search)
  const applicantMatch = pathname.match(/^\/applicants\/([^/?#]+)/)
  const currentApplicantId = applicantMatch && applicantMatch[1] !== "schedule"
    ? decodeURIComponent(applicantMatch[1])
    : undefined

  return {
    currentUrl: window.location.href,
    pageType: pathname.includes("/applicants/schedule")
      ? "schedule"
      : currentApplicantId
        ? "applicant"
        : pathname.includes("/admin")
          ? "admin"
          : "global",
    currentApplicantId,
    currentCaseId: searchParams.get("caseId") || undefined,
  }
}

function stringifyCardValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value, null, 2)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => readString(item)).filter(Boolean)
}

function readCardActionPayload(card: OpsAgentCard) {
  return isPlainRecord(card.actionPayload) ? card.actionPayload : {}
}

function getCardActionKey(card: OpsAgentCard, action: string) {
  const payload = readCardActionPayload(card)
  return [
    stringifyCardValue(card.type || card.title || "card"),
    action,
    readString(payload.sourceFilename) || readString(payload.applicantName) || stringifyCardValue(card.applicantProfileId),
  ].join(":")
}

function formatCardItems(items: unknown) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null
      const record = item as Record<string, unknown>
      return {
        title: stringifyCardValue(record.title || record.name || record.label || record.id || "待处理事项"),
        reason: stringifyCardValue(record.reason),
        nextAction: stringifyCardValue(record.nextAction),
        severity: stringifyCardValue(record.severity),
      }
    })
    .filter((item): item is { title: string; reason: string; nextAction: string; severity: string } => Boolean(item))
}

function renderInlineMarkdown(text: string) {
  const nodes: React.ReactNode[] = []
  const boldPattern = /\*\*([^*]+)\*\*/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index))
    }
    nodes.push(
      <strong key={`${match.index}-${match[1]}`} className="font-semibold text-slate-50">
        {match[1]}
      </strong>,
    )
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes.length ? nodes : text
}

function MarkdownText({ content }: { content: string }) {
  const blocks: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (!listItems.length) return
    const items = listItems
    listItems = []
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="pl-1">
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ul>,
    )
  }

  content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) {
        flushList()
        return
      }

      const bullet = trimmed.match(/^[-*]\s+(.+)$/)
      if (bullet) {
        listItems.push(bullet[1].trim())
        return
      }

      flushList()
      blocks.push(
        <p key={`paragraph-${index}`} className="whitespace-pre-wrap">
          {renderInlineMarkdown(trimmed)}
        </p>,
      )
    })

  flushList()

  return <div className="space-y-2 leading-6">{blocks}</div>
}

function contextLabel(context: OpsAgentPageContext) {
  if (context.currentApplicantId) return `申请人 ${context.currentApplicantId}`
  if (context.pageType === "schedule") return "递签月历"
  if (context.pageType === "admin") return "管理后台"
  return "当前页面"
}

function emitAgentTargetEvent(type: "highlight" | "focus", target: string, active = true) {
  if (typeof document === "undefined") return
  document.dispatchEvent(new CustomEvent(`ops-agent:${type}`, { detail: { target, active } }))
}

function focusLeftTarget(target: string) {
  emitAgentTargetEvent("focus", target)
  if (typeof document === "undefined") return

  const candidates = [
    `[data-ops-target="${target}"]`,
    `[data-agent-target="${target}"]`,
    `[data-agent-alias~="${target}"]`,
    `[data-material-slot="${target}"]`,
    `[data-field="${target}"]`,
    `[name="${target}"]`,
    `#${target}`,
  ]

  const element = candidates
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .find(Boolean)

  element?.scrollIntoView({ behavior: "smooth", block: "center" })
  element?.focus?.()
}

export function OpsAgentDock() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string>()
  const [isProcessing, setIsProcessing] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string>()
  const [dragActive, setDragActive] = useState(false)
  const [activeUploadTarget, setActiveUploadTarget] = useState<string>()
  const [runningCardActionKey, setRunningCardActionKey] = useState<string>()
  const [completedCardActionKeys, setCompletedCardActionKeys] = useState<string[]>([])
  const [messages, setMessages] = useState<OpsAgentMessage[]>([])
  const [pageContext, setPageContext] = useState<OpsAgentPageContext>(() => ({ currentUrl: "" }))
  const isApplicantPage = pageContext.pageType === "applicant"
  const hasBlockingGaps = MATERIAL_GAPS.some((item) => item.severity === "critical")
  const lastUserMessage = useMemo(() => [...messages].reverse().find((item) => item.role === "user"), [messages])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isProcessing])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    setPageContext(resolvePageContext())
    if (params.get("opsAgent") === "open" || window.location.hash === "#ops-agent") {
      setOpen(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const refreshPageContext = () => {
      const nextContext = resolvePageContext()
      setPageContext((current) => {
        if (
          current.currentUrl === nextContext.currentUrl &&
          current.pageType === nextContext.pageType &&
          current.currentApplicantId === nextContext.currentApplicantId &&
          current.currentCaseId === nextContext.currentCaseId
        ) {
          return current
        }
        return nextContext
      })
    }

    refreshPageContext()
    if (!open) return

    const interval = setInterval(refreshPageContext, 250)
    window.addEventListener("popstate", refreshPageContext)
    window.addEventListener("hashchange", refreshPageContext)

    return () => {
      clearInterval(interval)
      window.removeEventListener("popstate", refreshPageContext)
      window.removeEventListener("hashchange", refreshPageContext)
    }
  }, [open])

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const selection = window.getSelection()?.toString().trim()
      if (!selection || selection.length < 2) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest("[data-ops-agent-dock]")) return
      event.preventDefault()
      setOpen(true)
      setInput(selection)
    }

    document.addEventListener("contextmenu", handleContextMenu)
    return () => document.removeEventListener("contextmenu", handleContextMenu)
  }, [])

  const copyText = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedMessageId(id)
    window.setTimeout(() => setCopiedMessageId(undefined), 1200)
  }

  const appendAssistantMessage = (message: Omit<OpsAgentMessage, "id" | "role">) => {
    setMessages((current) => [
      ...current,
      {
        id: makeId("assistant"),
        role: "assistant",
        ...message,
      },
    ])
  }

  const createApplicantFromImportCard = async (card: OpsAgentCard, action: string) => {
    const payload = readCardActionPayload(card)
    const applicantName = readString(payload.applicantName)
    const visaTypes = readStringList(payload.visaTypes)
    const fallbackVisaType = readString(payload.visaType)
    const requestedVisaTypes = visaTypes.length ? visaTypes : fallbackVisaType ? [fallbackVisaType] : []
    const createFirstCase = /创建申请人并建档|创建申请人并建案/.test(action)
    const travelDate = readString(payload.travelDate)
    const sourceFilename = readString(payload.sourceFilename)

    if (!applicantName) {
      throw new Error("确认卡缺少申请人姓名，不能自动创建。请先选择申请人或手动填写姓名。")
    }
    if (createFirstCase && requestedVisaTypes.length === 0) {
      throw new Error("确认卡缺少签证类型，不能自动建档。请先让 Agent 重新解析文件名。")
    }

    const response = await fetch("/api/applicants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: applicantName,
        visaTypes: requestedVisaTypes,
        visaType: requestedVisaTypes[0],
        createFirstCase,
        priority: "normal",
        travelDate: travelDate || undefined,
        note: sourceFilename ? `Ops Agent 从文件名创建：${sourceFilename}` : undefined,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.profile?.id) {
      throw new Error(data?.error || "创建申请人失败")
    }

    const profileId = String(data.profile.id)
    const profileName = String(data.profile.name || data.profile.label || applicantName)
    const caseId = data?.cases?.[0]?.id || data?.case?.id

    if (typeof window !== "undefined") {
      window.localStorage.setItem("activeApplicantProfileId", profileId)
      if (caseId) window.localStorage.setItem("activeApplicantCaseId", String(caseId))
      window.dispatchEvent(new CustomEvent("ops-agent:applicant-created", {
        detail: { applicantProfileId: profileId, applicantName: profileName, caseId },
      }))
    }

    appendAssistantMessage({
      content: caseId
        ? `已创建申请人「${profileName}」并建立首个签证案件。`
        : `已创建申请人「${profileName}」。`,
      cards: [
        {
          type: "applicant-created",
          title: "创建完成",
          items: [
            { title: profileName, reason: `申请人 ID：${profileId}`, nextAction: caseId ? `案件 ID：${caseId}` : "未创建案件" },
          ],
        },
      ],
    })
  }

  const handleAgentCardAction = async (card: OpsAgentCard, action: string) => {
    const actionKey = getCardActionKey(card, action)
    if (runningCardActionKey || completedCardActionKeys.includes(actionKey)) return

    if (action === "取消") {
      setCompletedCardActionKeys((current) => [...current, actionKey])
      appendAssistantMessage({ content: "已取消，不会写入申请人或案件数据。" })
      return
    }

    if (/创建申请人并建档|创建申请人并建案|只建申请人|新建申请人/.test(action)) {
      setRunningCardActionKey(actionKey)
      try {
        await createApplicantFromImportCard(card, action)
        setCompletedCardActionKeys((current) => [...current, actionKey])
      } catch (error) {
        appendAssistantMessage({
          content: error instanceof Error ? error.message : "创建申请人失败",
        })
      } finally {
        setRunningCardActionKey(undefined)
      }
      return
    }

    appendAssistantMessage({
      content: `「${action}」还没有接入写入执行逻辑，我不会假装已经完成。`,
    })
  }

  const sendMessage = async (content = input, filename?: string) => {
    const trimmed = content.trim()
    if ((!trimmed && !filename) || isProcessing) return
    const currentContext = resolvePageContext()
    const userMessage: OpsAgentMessage = {
      id: makeId("user"),
      role: "user",
      content: filename ? `导入文件：${filename}` : trimmed,
    }
    setMessages((current) => [...current, userMessage])
    setInput("")
    setIsProcessing(true)

    try {
      const response = await fetch("/api/ops-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: trimmed || filename,
          filename,
          pageContext: currentContext,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Agent 请求失败")
      setConversationId(data.conversationId || conversationId)
      setMessages((current) => [
        ...current,
        {
          id: makeId("assistant"),
          role: "assistant",
          content: data.assistantMessage?.content || "已处理。",
          cards: data.assistantMessage?.cards || [],
          suggestions: data.assistantMessage?.suggestions || QUICK_ACTIONS.map((item) => item.label),
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: makeId("assistant"),
          role: "assistant",
          content: error instanceof Error ? error.message : "Agent 请求失败",
        },
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      void sendMessage(`请识别并预览导入 ${file.name}`, file.name)
    }
  }

  return (
    <div data-ops-agent-dock>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 z-40 h-36 -translate-y-1/2 rounded-l-2xl rounded-r-none border border-r-0 border-cyan-300/25 bg-[#050b12]/95 px-2 text-white shadow-[0_18px_60px_rgba(6,182,212,0.25)] backdrop-blur-xl hover:border-cyan-200/45 hover:bg-[#07111c]"
      >
        <span className="flex flex-col items-center gap-2 text-xs font-semibold tracking-[0.18em]">
          <PanelRightOpen className="h-4 w-4 text-cyan-200" />
          <span className="[writing-mode:vertical-rl]">智能工作台</span>
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-[min(94vw,560px)] border-l border-cyan-200/15 bg-[#03070d]/95 p-0 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl sm:max-w-[560px]"
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="relative flex min-h-0 w-full flex-col">
            {dragActive ? (
              <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-3xl border border-cyan-200/60 bg-cyan-300/15 text-cyan-50 backdrop-blur-md">
                <div className="text-center">
                  <FileUp className="mx-auto mb-3 h-8 w-8" />
                  <div className="text-lg font-semibold">松开后生成归档预览</div>
                </div>
              </div>
            ) : null}

            <SheetHeader className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-4 pr-8">
                <SheetTitle className="flex items-center gap-3 text-white">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold tracking-wide">智能工作台</span>
                    <span className="block text-xs font-medium uppercase tracking-[0.22em] text-cyan-200/70">
                      {contextLabel(pageContext)}
                    </span>
                  </span>
                </SheetTitle>
                <Badge className="border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-emerald-200 hover:bg-emerald-300/10">
                  READY
                </Badge>
              </div>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-5">
                <CaseSummaryCard pageContext={pageContext} />
                {isApplicantPage ? <>
                  <MaterialGapCard
                    activeUploadTarget={activeUploadTarget}
                    onUploadTargetChange={setActiveUploadTarget}
                    onAttach={sendMessage}
                  />
                  <NextActionCard onSend={sendMessage} hasBlockingGaps={hasBlockingGaps} />
                  <FollowUpCard copied={copiedMessageId === "follow-up"} onCopy={() => copyText("follow-up", FOLLOW_UP_TEMPLATE)} />
                </> : <>
                  <GlobalBriefCard pageContext={pageContext} onSend={sendMessage} />
                  <PendingQueueCard onSend={sendMessage} />
                </>}

                {messages.length ? (
                  <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">非标指令结果</div>
                        <div className="text-xs text-slate-500">只有自然语言和临时任务会进入这里。</div>
                      </div>
                      {lastUserMessage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void sendMessage(lastUserMessage.content)}
                          className="text-slate-300 hover:bg-white/10 hover:text-white"
                        >
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          重试
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <AgentMessage
                          key={message.id}
                          message={message}
                          copied={copiedMessageId === message.id}
                          onCopy={() => copyText(message.id, message.content)}
                          onRetry={() => lastUserMessage && void sendMessage(lastUserMessage.content)}
                          onEdit={() => lastUserMessage && setInput(lastUserMessage.content)}
                          onCardAction={handleAgentCardAction}
                          runningActionKey={runningCardActionKey}
                          completedActionKeys={completedCardActionKeys}
                        />
                      ))}
                      {isProcessing ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-cyan-200/15 bg-cyan-300/8 px-4 py-3 text-sm text-cyan-100">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在处理...
                        </div>
                      ) : null}
                      <div ref={scrollRef} />
                    </div>
                  </section>
                ) : null}
              </div>
            </ScrollArea>

            <div className="border-t border-white/10 p-4">
              <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-black/30 p-2 shadow-inner shadow-black/30">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-11 shrink-0 rounded-xl text-slate-300 hover:bg-cyan-300/10 hover:text-cyan-50"
                  onClick={() => setInput("请识别这个文件并生成归档确认")}
                >
                  <FileUp className="h-4 w-4" />
                </Button>
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder="非标指令，例如粘贴乱码信息、批量姓名或文件说明"
                  className="min-h-12 resize-none border-0 bg-transparent text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  type="button"
                  disabled={isProcessing || !input.trim()}
                  onClick={() => void sendMessage()}
                  className="h-11 w-11 shrink-0 rounded-xl bg-cyan-200 text-slate-950 hover:bg-cyan-100 disabled:bg-white/10 disabled:text-white/35"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CaseSummaryCard({ pageContext }: { pageContext: OpsAgentPageContext }) {
  const isApplicant = pageContext.pageType === "applicant"
  return (
    <section className="rounded-3xl border border-emerald-200/15 bg-emerald-300/[0.055] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            状态摘要
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {isApplicant
              ? "已绑定当前申请人页面，可直接读取案件上下文并生成下一步动作。"
              : "当前不在申请人详情页，工作台会先按全局运营任务处理。"}
          </p>
        </div>
        <Badge className="border border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
          {isApplicant ? "已绑定" : "全局"}
        </Badge>
      </div>
    </section>
  )
}

function GlobalBriefCard({
  pageContext,
  onSend,
}: {
  pageContext: OpsAgentPageContext
  onSend: (content: string) => Promise<void>
}) {
  const isSchedule = pageContext.pageType === "schedule"

  return (
    <section className="rounded-3xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
          <CalendarClock className="h-4 w-4" />
          {isSchedule ? "递签日程摘要" : "全局今日简报"}
        </div>
        <Badge className="border border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/10">
          列表态
        </Badge>
      </div>

      <div className="grid gap-2 text-sm text-slate-300">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          今日优先看临近递签、待确认导入、自动化失败和卡点案件。
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          当前没有绑定单个申请人，不展示个人缺漏清单，避免和左侧列表上下文打架。
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => void onSend(isSchedule ? "生成递签日程简报" : "看今日简报")}
        className="mt-3 h-auto w-full justify-between rounded-2xl border-white/10 bg-white/[0.04] px-4 py-3 text-left text-slate-100 hover:border-cyan-200/35 hover:bg-cyan-300/10"
      >
        <span>
          <span className="block font-semibold">{isSchedule ? "生成日程简报" : "生成今日简报"}</span>
          <span className="block text-xs font-normal text-slate-500">按紧急程度输出今日需要处理的事。</span>
        </span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </section>
  )
}

function PendingQueueCard({ onSend }: { onSend: (content: string) => Promise<void> }) {
  return (
    <section className="rounded-3xl border border-amber-200/15 bg-amber-300/[0.045] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          待确认队列摘要
        </div>
        <Badge className="border border-amber-200/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
          待巡检
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-slate-300">
        {["缺人文件名", "低置信度建档", "自动化失败复核"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => void onSend(`查看${item}队列`)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:border-amber-200/35 hover:bg-amber-300/10"
          >
            <span>{item}</span>
            <ArrowRight className="h-4 w-4 text-amber-100" />
          </button>
        ))}
      </div>
    </section>
  )
}

function MaterialGapCard({
  activeUploadTarget,
  onUploadTargetChange,
  onAttach,
}: {
  activeUploadTarget?: string
  onUploadTargetChange: (target?: string) => void
  onAttach: (content: string, filename?: string) => Promise<void>
}) {
  const handleFile = (item: (typeof MATERIAL_GAPS)[number], file?: File) => {
    if (!file) return
    void onAttach(`请把 ${file.name} 归档到 ${item.label}`, file.name)
    onUploadTargetChange(undefined)
  }

  return (
    <section className="rounded-3xl border border-amber-200/15 bg-amber-300/[0.045] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          缺漏清单
        </div>
        <Badge className="border border-amber-200/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">待处理 3</Badge>
      </div>

      <div className="space-y-2">
        {MATERIAL_GAPS.map((item) => {
          const expanded = activeUploadTarget === item.target

          return (
            <div
              key={item.target}
              onMouseEnter={() => emitAgentTargetEvent("highlight", item.target, true)}
              onMouseLeave={() => emitAgentTargetEvent("highlight", item.target, false)}
              className="rounded-2xl border border-white/10 bg-black/20 transition hover:border-cyan-200/35 hover:bg-cyan-300/10"
            >
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <button
                  type="button"
                  onClick={() => focusLeftTarget(item.target)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <XCircle className={item.severity === "critical" ? "h-4 w-4 shrink-0 text-red-300" : "h-4 w-4 shrink-0 text-amber-200"} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-100">{item.label}</span>
                    <span className="text-xs text-slate-500">点击定位左侧字段或归档区域</span>
                  </span>
                </button>

                {item.state === "待上传" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onUploadTargetChange(expanded ? undefined : item.target)}
                    className="shrink-0 border-amber-200/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15"
                  >
                    待上传
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => focusLeftTarget(item.target)}
                    className="shrink-0 border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10"
                  >
                    {item.state}
                  </Button>
                )}
              </div>

              {expanded ? (
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleFile(item, event.dataTransfer.files?.[0])
                  }}
                  className="mx-3 mb-3 rounded-2xl border border-dashed border-cyan-200/35 bg-cyan-300/[0.06] p-3 text-center text-xs text-cyan-50"
                >
                  <FileUp className="mx-auto mb-2 h-5 w-5 text-cyan-200" />
                  <div className="font-semibold">拖入文件后生成归档确认</div>
                  <label className="mt-2 inline-flex cursor-pointer rounded-xl border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 font-semibold text-cyan-50 hover:bg-cyan-200/15">
                    选择文件
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(event) => {
                        handleFile(item, event.target.files?.[0])
                        event.target.value = ""
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function NextActionCard({
  onSend,
  hasBlockingGaps,
}: {
  onSend: (content: string) => Promise<void>
  hasBlockingGaps: boolean
}) {
  return (
    <section className="rounded-3xl border border-cyan-200/15 bg-cyan-300/[0.045] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-100">
        <ClipboardList className="h-4 w-4" />
        下一步操作
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          disabled={hasBlockingGaps}
          onClick={() => void onSend("启动法签建表")}
          className="h-auto justify-between rounded-2xl border border-cyan-200/20 bg-cyan-200/12 px-4 py-3 text-left text-cyan-50 hover:bg-cyan-200/18 disabled:border-amber-200/15 disabled:bg-amber-300/[0.055] disabled:text-amber-100/75"
        >
          <span>
            <span className="block font-semibold">
              {hasBlockingGaps ? "核心材料未齐，暂不可建表" : "启动建表"}
            </span>
            <span className="block text-xs font-normal text-cyan-100/70">
              {hasBlockingGaps ? "先补齐护照等阻断性材料，再启动自动化。" : "先生成确认卡，不会直接执行。"}
            </span>
          </span>
          {hasBlockingGaps ? <AlertTriangle className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void onSend("生成催办话术")}
          className="h-auto justify-between rounded-2xl border-white/10 bg-white/[0.04] px-4 py-3 text-left text-slate-100 hover:border-cyan-200/35 hover:bg-cyan-300/10"
        >
          <span>
            <span className="block font-semibold">生成催办话术</span>
            <span className="block text-xs font-normal text-slate-500">按当前缺漏自动填变量。</span>
          </span>
          <MessageSquareText className="h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}

function FollowUpCard({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <MessageSquareText className="h-4 w-4 text-cyan-200" />
          催办模板
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="border-white/10 bg-black/20 text-slate-100 hover:border-cyan-200/35 hover:bg-cyan-300/10 hover:text-cyan-50"
        >
          {copied ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
          复制排版格式
        </Button>
      </div>
      <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/25 p-3 text-sm leading-6 text-slate-300">
        {FOLLOW_UP_TEMPLATE}
      </pre>
    </section>
  )
}

function AgentMessage({
  message,
  copied,
  onCopy,
  onRetry,
  onEdit,
  onCardAction,
  runningActionKey,
  completedActionKeys,
}: {
  message: OpsAgentMessage
  copied: boolean
  onCopy: () => void
  onRetry: () => void
  onEdit: () => void
  onCardAction: (card: OpsAgentCard, action: string) => Promise<void>
  runningActionKey?: string
  completedActionKeys: string[]
}) {
  return (
    <div className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          message.role === "user"
            ? "max-w-[84%] rounded-2xl border border-cyan-200/20 bg-cyan-300/12 px-4 py-3 text-sm text-cyan-50"
            : "max-w-[92%] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100"
        }
      >
        <MarkdownText content={message.content} />
        {message.cards?.length ? (
          <div className="mt-3 space-y-2">
            {message.cards.map((card, index) => (
              <AgentCard
                key={`${message.id}-card-${index}`}
                card={card}
                onCardAction={onCardAction}
                runningActionKey={runningActionKey}
                completedActionKeys={completedActionKeys}
              />
            ))}
          </div>
        ) : null}
        {message.role === "assistant" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCopy} className="border-white/10 bg-black/20 text-slate-100 hover:bg-cyan-300/10">
              {copied ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              复制
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRetry} className="text-slate-300 hover:bg-white/10 hover:text-white">
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              重新生成
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="text-slate-300 hover:bg-white/10 hover:text-white">
              修改指令
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function AgentCard({
  card,
  onCardAction,
  runningActionKey,
  completedActionKeys,
}: {
  card: OpsAgentCard
  onCardAction: (card: OpsAgentCard, action: string) => Promise<void>
  runningActionKey?: string
  completedActionKeys: string[]
}) {
  const title = stringifyCardValue(card.title || card.type || "结果")
  const riskLevel = stringifyCardValue(card.riskLevel)
  const content = stringifyCardValue(card.content || card.description)
  const items = formatCardItems(card.items)
  const fallbackContent = !content && !items.length ? stringifyCardValue(card) : ""
  const actions = Array.isArray(card.actions) ? card.actions.map(String) : []

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-slate-100">
          <FileText className="h-4 w-4 text-cyan-200" />
          {title}
        </div>
        {riskLevel ? <Badge className="border border-amber-200/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">{riskLevel}</Badge> : null}
      </div>
      {content || fallbackContent ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">
          {content || fallbackContent}
        </pre>
      ) : null}
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                {item.severity ? (
                  <Badge className="shrink-0 border border-amber-200/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
                    {item.severity}
                  </Badge>
                ) : null}
              </div>
              {item.reason ? <div className="mt-2 text-xs leading-5 text-slate-400">{item.reason}</div> : null}
              {item.nextAction ? <div className="mt-2 text-xs leading-5 text-cyan-100">{item.nextAction}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {actions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => {
            const actionKey = getCardActionKey(card, action)
            const disabled = runningActionKey === actionKey || completedActionKeys.includes(actionKey)

            return (
              <Button
                key={action}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => void onCardAction(card, action)}
                className="border-white/10 bg-white/[0.04] text-slate-100 hover:border-cyan-200/35 hover:bg-cyan-300/10 hover:text-cyan-50 active:text-cyan-50 focus-visible:text-cyan-50 disabled:text-slate-500"
              >
                {runningActionKey === actionKey ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                {completedActionKeys.includes(actionKey) ? "已处理" : action}
              </Button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

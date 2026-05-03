import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import {
  batchLookupApplicantsTool,
  checkMaterialsTool,
  extractBatchNames,
  generateFollowUpMessageTool,
  getDailyBriefTool,
  previewExcelImportTool,
  summarizeTaskFailureTool,
} from "@/lib/ops-agent-business-tools"
import { callOpsAgentModel } from "@/lib/ops-agent-llm"
import {
  DEFAULT_OPS_AGENT_USER_PREFS,
  OPS_AGENT_GLOBAL_SETTINGS_KEY,
  buildEffectiveOpsAgentSettings,
  getOpsAgentUserPrefsKey,
  normalizeOpsAgentGlobalSettings,
  normalizeOpsAgentUserPrefs,
} from "@/lib/ops-agent-settings"

export const dynamic = "force-dynamic"

type PageContext = {
  currentUrl?: string
  pageType?: string
  currentApplicantId?: string
  currentCaseId?: string
  currentScheduleDate?: string
  currentConfirmationItemId?: string
}

type ChatBody = {
  message?: string
  conversationId?: string
  filename?: string
  pageContext?: PageContext
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getPageContext(value: unknown): PageContext {
  const source = isRecord(value) ? value : {}
  return {
    currentUrl: typeof source.currentUrl === "string" ? source.currentUrl : undefined,
    pageType: typeof source.pageType === "string" ? source.pageType : undefined,
    currentApplicantId: typeof source.currentApplicantId === "string" ? source.currentApplicantId : undefined,
    currentCaseId: typeof source.currentCaseId === "string" ? source.currentCaseId : undefined,
    currentScheduleDate: typeof source.currentScheduleDate === "string" ? source.currentScheduleDate : undefined,
    currentConfirmationItemId: typeof source.currentConfirmationItemId === "string" ? source.currentConfirmationItemId : undefined,
  }
}

function readBody(value: unknown): ChatBody {
  const source = isRecord(value) ? value : {}
  return {
    message: typeof source.message === "string" ? source.message : "",
    conversationId: typeof source.conversationId === "string" ? source.conversationId : undefined,
    filename: typeof source.filename === "string" ? source.filename : undefined,
    pageContext: getPageContext(source.pageContext),
  }
}

async function loadSettings(userId: string) {
  const [globalSetting, userSetting] = await Promise.all([
    prisma.adminSetting.findUnique({ where: { key: OPS_AGENT_GLOBAL_SETTINGS_KEY } }),
    prisma.adminSetting.findUnique({ where: { key: getOpsAgentUserPrefsKey(userId) } }),
  ])
  const global = normalizeOpsAgentGlobalSettings(globalSetting?.valueJson)
  const prefs = normalizeOpsAgentUserPrefs(userSetting?.valueJson ?? DEFAULT_OPS_AGENT_USER_PREFS, global)
  const effective = buildEffectiveOpsAgentSettings(global, prefs)
  return { global, prefs, effective }
}

function buildConversationId(body: ChatBody, userId: string) {
  return body.conversationId || `ops-${userId.slice(0, 8)}-${Date.now().toString(36)}`
}

function looksLikeImportFilename(message: string, filename?: string) {
  const target = filename || message
  return /(?:^|[\s"'「])(?:法签|美签)[-－—–]/.test(target) || /\.(xlsx|xls|csv)$/i.test(target)
}

function extractFilename(message: string, filename?: string) {
  if (filename) return filename
  const match = message.match(/(?:法签|美签)[-－—–][^\s"'，。]+(?:\.(?:xlsx|xls|csv))?/i)
  return match?.[0] || message.trim()
}

function extractTaskId(message: string) {
  return message.match(/\b(?:fv-[a-z0-9-]+|task-[a-z0-9-]+)\b/i)?.[0]
}

function inferFollowUpScene(message: string) {
  if (/缴费|付款|支付/.test(message)) return "payment" as const
  if (/临近|递签前|面签前|到时间|快到了/.test(message)) return "deadline" as const
  if (/缺|材料|补|催办|话术/.test(message)) return "missing-materials" as const
  return "general" as const
}

function isDailyBriefIntent(message: string) {
  return /每日|今日简报|今天.*干|工作简报|待办|todo|递签日程简报/i.test(message)
}

function isPendingQueueIntent(message: string) {
  return /待确认队列|缺人文件名|低置信度建档|自动化失败复核/i.test(message)
}

function extractArchiveSlotLabel(message: string) {
  const direct = message.match(/归档到\s*([^，。,.；;\n]+)/)?.[1]?.trim()
  if (direct) return direct
  const known = ["护照首页", "护照扫描件", "在职证明", "递签材料", "DS-160", "AIS", "TLS", "照片"]
  return known.find((item) => message.includes(item)) || "当前案件材料"
}

function makeAssistantResponse(params: {
  conversationId: string
  content: string
  pageContext: PageContext
  toolCalls?: Array<Record<string, unknown>>
  cards?: Array<Record<string, unknown>>
  model?: Record<string, unknown>
  suggestions?: string[]
}) {
  return NextResponse.json({
    conversationId: params.conversationId,
    pageContext: params.pageContext,
    assistantMessage: {
      role: "assistant",
      content: params.content,
      cards: params.cards || [],
      suggestions: params.suggestions || ["查缺漏", "生成催办话术", "看今日简报"],
    },
    toolCalls: params.toolCalls || [],
    model: params.model || null,
  })
}

async function recordCallTrace(data: Record<string, unknown>) {
  const valueJson = {
    ...data,
    recordedAt: new Date().toISOString(),
  } as Prisma.InputJsonValue
  await prisma.adminSetting.upsert({
    where: { key: "ops-agent.last-call-trace" },
    create: { key: "ops-agent.last-call-trace", valueJson },
    update: { valueJson },
  }).catch(() => null)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const body = readBody(await request.json().catch(() => ({})))
  const message = String(body.message || "").trim()
  const pageContext = getPageContext(body.pageContext)
  const conversationId = buildConversationId(body, userId)
  if (!message && !body.filename) {
    return NextResponse.json({ error: "缺少指令内容" }, { status: 400 })
  }

  const settings = await loadSettings(userId)
  const role = session.user.role

  if (looksLikeImportFilename(message, body.filename)) {
    const result = await previewExcelImportTool({
      userId,
      role,
      filename: extractFilename(message, body.filename),
    })
    await recordCallTrace({ userId, conversationId, intent: "previewExcelImport", pageContext, toolResultType: result.type })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: `已解析文件名：${result.parsed.promptSafeSummary}`,
      toolCalls: [{ name: "previewExcelImportTool", result }],
      cards: [result.confirmationCard],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
    })
  }

  const names = extractBatchNames(message)
  if (names.length >= 2 && /(建档|名单|这些人|有没有|递签时间)/.test(message)) {
    const result = await batchLookupApplicantsTool({ userId, role, names })
    await recordCallTrace({ userId, conversationId, intent: "batchLookupApplicants", pageContext, count: names.length })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: result.markdown,
      toolCalls: [{ name: "batchLookupApplicantsTool", result }],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
    })
  }

  if (isDailyBriefIntent(message)) {
    const result = await getDailyBriefTool({ userId, role })
    await recordCallTrace({ userId, conversationId, intent: "getDailyBrief", pageContext, count: result.items.length })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: renderDailyBrief(result.items),
      toolCalls: [{ name: "getDailyBriefTool", result }],
      cards: [{ type: "daily-brief", title: "每日工作简报", items: result.items.slice(0, 8) }],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
    })
  }

  if (isPendingQueueIntent(message)) {
    const result = await getDailyBriefTool({ userId, role })
    await recordCallTrace({ userId, conversationId, intent: "pendingQueue", pageContext, count: result.items.length })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: renderPendingQueueBrief(result.items, message),
      toolCalls: [{ name: "getDailyBriefTool", result }],
      cards: [{ type: "pending-queue", title: "待确认队列摘要", items: result.items.slice(0, 8) }],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
    })
  }

  const currentApplicantId = pageContext.currentApplicantId
  if (currentApplicantId && body.filename && /(归档|上传|文件|材料)/.test(message)) {
    const slotLabel = extractArchiveSlotLabel(message)
    const card = {
      type: "file-archive-confirmation",
      riskLevel: "medium",
      title: `确认归档到${slotLabel}`,
      description: `文件 ${body.filename} 将关联到当前申请人 ${currentApplicantId} 的 ${slotLabel} 槽位。第一版先生成确认卡，不直接写入文件。`,
      actions: ["确认归档", "取消", "查看材料区"],
      applicantProfileId: currentApplicantId,
      filename: body.filename,
      slotLabel,
    }
    await recordCallTrace({ userId, conversationId, intent: "fileArchiveConfirmation", pageContext, filename: body.filename, slotLabel })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: `已识别文件 ${body.filename}，建议归档到「${slotLabel}」。请确认后再写入。`,
      toolCalls: [{ name: "fileArchiveConfirmation", result: card }],
      cards: [card],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
    })
  }

  if (currentApplicantId && /(催办|话术|发给客户|提醒客户)/.test(message)) {
    const result = await generateFollowUpMessageTool({
      userId,
      role,
      applicantProfileId: currentApplicantId,
      scene: inferFollowUpScene(message),
    })
    if (result) {
      await recordCallTrace({ userId, conversationId, intent: "generateFollowUpMessage", pageContext })
      return makeAssistantResponse({
        conversationId,
        pageContext,
        content: result.draft,
        toolCalls: [{ name: "generateFollowUpMessageTool", result }],
        cards: [{ type: "copyable-text", title: "催办话术草稿", content: result.draft }],
        model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
      })
    }
  }

  if (currentApplicantId && /(材料|缺什么|能不能递签|查缺漏)/.test(message)) {
    const result = await checkMaterialsTool({ userId, role, applicantProfileId: currentApplicantId })
    if (result) {
      await recordCallTrace({ userId, conversationId, intent: "checkMaterials", pageContext })
      return makeAssistantResponse({
        conversationId,
        pageContext,
        content: renderMaterialCheck(result),
        toolCalls: [{ name: "checkMaterialsTool", result }],
        cards: [{ ...result, type: "material-check", title: "材料检查" }],
        model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
      })
    }
  }

  const taskId = extractTaskId(message)
  if (taskId && /失败|原因|为什么|卡住/.test(message)) {
    const result = await summarizeTaskFailureTool({ userId, role, taskId })
    if (result) {
      await recordCallTrace({ userId, conversationId, intent: "summarizeTaskFailure", pageContext, taskId })
      return makeAssistantResponse({
        conversationId,
        pageContext,
        content: renderFailureSummary(result.summary),
        toolCalls: [{ name: "summarizeTaskFailureTool", result }],
        cards: [{ type: "task-failure", title: "失败原因摘要", ...result.summary }],
        model: { provider: settings.effective.provider, model: settings.effective.reasoningModel, usedModel: false },
      })
    }
  }

  if (currentApplicantId && /(启动|自动化|建表|回执|最终表|DS-160|AIS|照片检测)/i.test(message)) {
    const card = {
      type: "confirmation",
      riskLevel: "high",
      title: "确认启动自动化",
      description: "自动化可能消耗验证码、访问真实账号或生成正式文件。请确认申请人和动作后再执行。",
      actions: ["确认执行", "取消", "查看申请人"],
      applicantProfileId: currentApplicantId,
    }
    await recordCallTrace({ userId, conversationId, intent: "automationConfirmation", pageContext })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: "我已准备好自动化启动确认卡。第一版不会绕过确认直接启动真实任务。",
      cards: [card],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
    })
  }

  if (currentApplicantId && /(改|修改|更新|撤回|改回)/.test(message)) {
    const card = {
      type: "confirmation",
      riskLevel: "medium",
      title: "字段修改需要确认",
      description: "我可以根据当前申请人上下文生成修改预览。第一版会先确认再写入。",
      actions: ["确认修改", "取消", "打开申请人详情"],
      applicantProfileId: currentApplicantId,
    }
    await recordCallTrace({ userId, conversationId, intent: "updateConfirmation", pageContext })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: "这属于写入动作，我先生成确认卡，不会直接改数据。",
      cards: [card],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
    })
  }

  const modelResult = await callOpsAgentModel({
    ...settings,
    taskKind: "chat",
    messages: [
      {
        role: "system",
        content: "你是内部签证运营 Visa Ops Agent。只讨论申请人档案、法签、美签、材料、递签/面签、TLS/AIS、自动化任务和内部工作简报；不要回答信用卡、支付卡或泛金融 Visa 业务。涉及写入、覆盖、自动化启动时必须要求确认。",
      },
      {
        role: "user",
        content: JSON.stringify({ message, pageContext }),
      },
    ],
  })
  await recordCallTrace({ userId, conversationId, intent: "modelFallback", pageContext, usedModel: modelResult.usedModel })

  return makeAssistantResponse({
    conversationId,
    pageContext,
    content: modelResult.content || "我已经接入 Ops Agent 工具层。你可以让我查名单、解析法签/美签 Excel 文件名、看今日简报、查当前申请人缺什么材料，或生成催办话术。",
    model: {
      provider: modelResult.provider,
      model: modelResult.model,
      usedModel: modelResult.usedModel,
      error: modelResult.error,
    },
  })
}

function renderDailyBrief(items: Array<{ title: string; reason?: string; nextAction?: string }>) {
  if (!items.length) return "今天没有识别到紧急待办。"
  return items.slice(0, 10).map((item, index) => {
    const details = [item.reason, item.nextAction].filter(Boolean).join("；")
    return `${index + 1}. ${item.title}${details ? `\n   ${details}` : ""}`
  }).join("\n")
}

function renderPendingQueueBrief(items: Array<{ title: string; reason?: string; nextAction?: string }>, message: string) {
  if (!items.length) return "当前没有识别到需要优先处理的待确认项。"
  const intentLabel = /自动化失败/.test(message)
    ? "自动化失败复核"
    : /缺人/.test(message)
      ? "缺人文件名"
      : /低置信度/.test(message)
        ? "低置信度建档"
        : "待确认队列"
  return [
    `${intentLabel}摘要：`,
    ...items.slice(0, 8).map((item, index) => {
      const details = [item.reason, item.nextAction].filter(Boolean).join("；")
      return `${index + 1}. ${item.title}${details ? `\n   ${details}` : ""}`
    }),
  ].join("\n")
}

function renderMaterialCheck(result: any) {
  const missingFiles = result.missingFileGroups?.map((item: any) => item.label).filter(Boolean) || []
  const missingInfo = result.missingInformation?.map((item: any) => item.label).filter(Boolean) || []
  if (!missingFiles.length && !missingInfo.length) return "当前申请人的关键材料和信息未发现明显缺口。"
  return [
    missingFiles.length ? `缺材料：${missingFiles.join("、")}` : "",
    missingInfo.length ? `缺信息：${missingInfo.join("、")}` : "",
  ].filter(Boolean).join("\n")
}

function renderFailureSummary(summary: { step: string; rootCause: string; nextAction: string }) {
  return [
    `失败步骤：${summary.step}`,
    `可理解根因：${summary.rootCause}`,
    `建议下一步：${summary.nextAction}`,
  ].join("\n")
}

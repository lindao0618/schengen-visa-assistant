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
  listCurrentAccountApplicantsTool,
  previewExcelImportTool,
  summarizeTaskFailureTool,
} from "@/lib/ops-agent-business-tools"
import {
  callOpsAgentModel,
  type OpsAgentChatMessage,
  type OpsAgentToolCall,
  type OpsAgentToolDefinition,
} from "@/lib/ops-agent-llm"
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

const OPS_AGENT_MODEL_TOOLS: OpsAgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_current_account_applicants",
      description: "查询当前登录账号权限范围内可见的申请人列表。只能返回当前 session 可见数据。",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "可选，申请人姓名、邮箱、手机号或护照号关键词。" },
          limit: { type: "number", description: "可选，最多返回条数，默认 20，最大 50。" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_brief",
      description: "查询当前账号权限范围内的今日工作简报、临近递签、缺 slot 和自动化失败摘要。",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "batch_lookup_applicants",
      description: "批量查询一组姓名在当前账号权限范围内是否已有申请人档案。",
      parameters: {
        type: "object",
        properties: {
          names: {
            type: "array",
            items: { type: "string" },
            description: "需要查询的申请人姓名列表。",
          },
        },
        required: ["names"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_current_applicant_materials",
      description: "检查当前申请人详情页绑定的申请人材料缺漏。只有 pageContext.currentApplicantId 存在时可用。",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
]

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

function isCurrentAccountApplicantListIntent(message: string) {
  return /(当前账号|我的|我这个账号|本账号).*申请人|申请人(信息)?列表|列出.*申请人|罗列.*申请人|有哪些申请人|所有申请人/.test(message)
}

function isPermissionSummaryIntent(message: string) {
  return /(权限|限制|不能做|可以做|能做什么|可操作范围)/.test(message) && /(AI|Agent|助手|当前账号|申请人|账号|权限)/i.test(message)
}

function extractApplicantLookupKeyword(message: string) {
  const cleaned = message
    .replace(/(查一下|查询|搜索|找一下|帮我看看|看一下|看下|申请人|客户|用户|档案|资料|信息|状态|进度|有没有建档|有没有|建档|是谁|当前账号|本账号|我的|里面|系统|的|一下)/g, " ")
    .replace(/[?？,，。；;:：]/g, " ")
    .trim()
  return cleaned
    .split(/\s+/)
    .map((item) => item.trim())
    .find((item) => /^[\u3400-\u9fffA-Za-z·.\s]{2,30}$/.test(item))
}

function isApplicantFactLookupIntent(message: string) {
  return /(查|查询|搜索|找|有没有|状态|进度|资料|档案|建档|申请人)/.test(message) && Boolean(extractApplicantLookupKeyword(message))
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

function parseToolArguments(toolCall: OpsAgentToolCall) {
  try {
    const parsed = JSON.parse(toolCall.function.arguments || "{}")
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeToolLimit(value: unknown, fallback = 20) {
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.floor(number), 1), 50)
}

async function executeOpsAgentModelToolCall(params: {
  toolCall: OpsAgentToolCall
  userId: string
  role?: string
  pageContext: PageContext
}) {
  const args = parseToolArguments(params.toolCall)
  const toolName = params.toolCall.function.name
  let result: Record<string, unknown> | null = null

  if (toolName === "list_current_account_applicants") {
    result = await listCurrentAccountApplicantsTool({
      userId: params.userId,
      role: params.role,
      keyword: typeof args.keyword === "string" ? args.keyword : undefined,
      limit: normalizeToolLimit(args.limit),
    })
  } else if (toolName === "get_daily_brief") {
    result = await getDailyBriefTool({ userId: params.userId, role: params.role })
  } else if (toolName === "batch_lookup_applicants") {
    const names = Array.isArray(args.names) ? args.names.map(String).filter(Boolean).slice(0, 30) : []
    result = names.length
      ? await batchLookupApplicantsTool({ userId: params.userId, role: params.role, names })
      : { type: "tool-error", error: "缺少 names 参数。" }
  } else if (toolName === "check_current_applicant_materials") {
    result = params.pageContext.currentApplicantId
      ? await checkMaterialsTool({
          userId: params.userId,
          role: params.role,
          applicantProfileId: params.pageContext.currentApplicantId,
        })
      : { type: "tool-error", error: "当前页面未绑定申请人，无法检查材料。" }
  } else {
    result = { type: "tool-error", error: `不支持的工具：${toolName}` }
  }

  return {
    message: {
      role: "tool" as const,
      tool_call_id: params.toolCall.id,
      name: toolName,
      content: JSON.stringify(result ?? { type: "empty" }).slice(0, 16000),
    },
    trace: { name: toolName, result: result ?? { type: "empty" } },
  }
}

function renderToolFallbackSummary(toolMessages: OpsAgentChatMessage[]) {
  if (!toolMessages.length) return "我没有拿到可用的工具查询结果。"
  return [
    "我已调用内部工具查询系统数据，但模型没有生成最终摘要。以下是工具返回的原始摘要：",
    ...toolMessages.map((message, index) => `${index + 1}. ${message.name || "tool"}: ${String(message.content || "").slice(0, 1200)}`),
  ].join("\n")
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

  if (isCurrentAccountApplicantListIntent(message) || isPermissionSummaryIntent(message)) {
    const result = await listCurrentAccountApplicantsTool({ userId, role, limit: 20 })
    await recordCallTrace({ userId, conversationId, intent: "listCurrentAccountApplicants", pageContext, count: result.rows.length })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: renderApplicantList(result),
      toolCalls: [{ name: "listCurrentAccountApplicantsTool", result }],
      cards: [
        {
          type: "applicant-list",
          title: "当前账号可见申请人",
          content: result.permissions.visibleScope,
          items: result.rows.slice(0, 8).map((row) => ({
            title: row.name,
            reason: `${row.visaType} / ${row.status}`,
            nextAction: row.activeCaseId ? `可继续追问：检查 ${row.name} 的材料缺漏` : "当前没有活动案件。",
          })),
        },
      ],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
      suggestions: ["按姓名查申请人", "查缺漏", "看今日简报"],
    })
  }

  const applicantKeyword = extractApplicantLookupKeyword(message)
  if (applicantKeyword && isApplicantFactLookupIntent(message)) {
    const result = await listCurrentAccountApplicantsTool({ userId, role, keyword: applicantKeyword, limit: 10 })
    await recordCallTrace({ userId, conversationId, intent: "lookupApplicantFacts", pageContext, keyword: applicantKeyword, count: result.rows.length })
    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: renderApplicantList(result, applicantKeyword),
      toolCalls: [{ name: "listCurrentAccountApplicantsTool", result }],
      cards: [
        {
          type: "applicant-lookup",
          title: `申请人查询：${applicantKeyword}`,
          content: result.permissions.visibleScope,
          items: result.rows.slice(0, 8).map((row) => ({
            title: row.name,
            reason: `${row.visaType} / ${row.status}`,
            nextAction: row.activeCaseId ? `可继续追问：检查 ${row.name} 的材料缺漏` : "当前没有活动案件。",
          })),
        },
      ],
      model: { provider: settings.effective.provider, model: settings.effective.defaultModel, usedModel: false },
      suggestions: ["查缺漏", "生成催办话术", "看今日简报"],
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

  const modelMessages: OpsAgentChatMessage[] = [
    {
      role: "system",
      content: "你是内部签证运营 Visa Ops Agent。只讨论申请人档案、法签、美签、材料、递签/面签、TLS/AIS、自动化任务和内部工作简报；不要回答信用卡、支付卡或泛金融 Visa 业务。涉及写入、覆盖、自动化启动时必须要求确认。任何涉及真实申请人、案件、递签时间、账号、数量或状态的问题，必须基于工具层查到的数据回答；如果当前消息没有工具结果，严禁编造姓名、数量、日期或状态，应该调用可用工具查询当前账号数据，查不到就明确说查不到。",
    },
    {
      role: "user",
      content: JSON.stringify({ message, pageContext }),
    },
  ]

  const modelResult = await callOpsAgentModel({
    ...settings,
    taskKind: "chat",
    messages: modelMessages,
    tools: OPS_AGENT_MODEL_TOOLS,
    toolChoice: "auto",
  })

  if (modelResult.toolCalls.length) {
    const toolExecutions = await Promise.all(
      modelResult.toolCalls.slice(0, 4).map((toolCall) =>
        executeOpsAgentModelToolCall({ toolCall, userId, role, pageContext }),
      ),
    )
    const toolMessages = toolExecutions.map((item) => item.message)
    const toolTraces = toolExecutions.map((item) => item.trace)
    const finalModelResult = await callOpsAgentModel({
      ...settings,
      taskKind: "chat",
      messages: [
        ...modelMessages,
        { role: "assistant", content: modelResult.content || "", tool_calls: modelResult.toolCalls },
        ...toolMessages,
      ],
      tools: OPS_AGENT_MODEL_TOOLS,
      toolChoice: "none",
    })
    await recordCallTrace({
      userId,
      conversationId,
      intent: "modelFallbackWithTools",
      pageContext,
      usedModel: finalModelResult.usedModel,
      toolCalls: toolTraces.map((item) => item.name),
    })

    return makeAssistantResponse({
      conversationId,
      pageContext,
      content: finalModelResult.content || renderToolFallbackSummary(toolMessages),
      toolCalls: toolTraces,
      model: {
        provider: finalModelResult.provider,
        model: finalModelResult.model,
        usedModel: finalModelResult.usedModel,
        error: finalModelResult.error,
      },
    })
  }

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

function renderApplicantList(result: Awaited<ReturnType<typeof listCurrentAccountApplicantsTool>>, keyword?: string) {
  const lines = [
    "我会以当前登录账号的权限查询系统申请人，不会凭空编造。",
    `可见范围：${result.permissions.visibleScope}`,
    keyword
      ? `查询关键词：${keyword}；匹配到 ${result.totalRows} 个可见申请人${result.hasMore ? `，先显示前 ${result.rows.length} 个` : ""}。`
      : `当前可见申请人：${result.totalRows} 个${result.hasMore ? `，先显示前 ${result.rows.length} 个` : ""}。`,
    "",
  ]

  if (result.rows.length) {
    lines.push(
      ...result.rows.map((row, index) => {
        const owner = row.assigneeName || row.ownerName || "未标注"
        const updatedAt = row.updatedAt ? String(row.updatedAt).slice(0, 10) : "未知"
        return `${index + 1}. ${row.name} - ${row.visaType} - ${row.status} - 负责人：${owner} - 更新：${updatedAt}`
      }),
    )
  } else {
    lines.push(keyword ? `当前账号没有查到与「${keyword}」匹配的可见申请人。` : "当前账号没有查到可见申请人。")
  }

  lines.push(
    "",
    "权限限制：",
    ...result.permissions.restricted.map((item) => `- ${item}`),
  )

  return lines.join("\n")
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

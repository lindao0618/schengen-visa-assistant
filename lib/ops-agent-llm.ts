import {
  type OpsAgentEffectiveSettings,
  type OpsAgentGlobalSettings,
  type OpsAgentTaskKind,
  type OpsAgentUserPrefs,
  pickOpsAgentModel,
} from "@/lib/ops-agent-settings"

export interface OpsAgentChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content?: string | null
  name?: string
  tool_call_id?: string
  tool_calls?: OpsAgentToolCall[]
}

export interface OpsAgentToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface OpsAgentToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface OpsAgentModelCallInput {
  global: OpsAgentGlobalSettings
  prefs: OpsAgentUserPrefs
  effective: OpsAgentEffectiveSettings
  taskKind: OpsAgentTaskKind
  messages: OpsAgentChatMessage[]
  tools?: OpsAgentToolDefinition[]
  toolChoice?: "auto" | "none" | Record<string, unknown>
}

export interface OpsAgentModelCallResult {
  content: string
  model: string
  provider: string
  usedModel: boolean
  error?: string
  toolCalls: OpsAgentToolCall[]
}

const SECRET_PATTERNS = [
  /(password|passwd|secret|token|authorization|cookie)\s*[:=]\s*["']?[^"'\s,;]+/gi,
  /(key)\s*[:=]\s*["']?[^"'\s,;]+/gi,
  /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
  /\b(\d{3})\d{4}(\d{4})\b/g,
  /\b([A-Z]\d{3})\d{4,}([A-Z0-9]{2})\b/gi,
]

function maskSensitiveText(value: string) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "$1:[redacted]"), value)
}

function normalizeBaseUrl(value: string) {
  const base = value.trim().replace(/\/+$/, "")
  if (!base) return ""
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`
}

function resolveProviderCredential(provider: string) {
  const normalized = provider.trim().toLowerCase()
  if (normalized === "deepseek") return process.env.DEEPSEEK_API_KEY || process.env.OPS_AGENT_MODEL_KEY || ""
  if (normalized === "openai") return process.env.OPENAI_API_KEY || process.env.OPS_AGENT_MODEL_KEY || ""
  if (normalized === "qwen") return process.env.QWEN_API_KEY || process.env.OPS_AGENT_MODEL_KEY || ""
  return process.env.OPS_AGENT_MODEL_KEY || ""
}

function buildProviderRequestOptions(provider: string, model: string) {
  const normalizedProvider = provider.trim().toLowerCase()

  if (normalizedProvider === "deepseek" && model.startsWith("deepseek-v4")) {
    return {
      thinking: { type: "enabled" },
      reasoning_effort: "high",
    }
  }

  return {}
}

export function sanitizeOpsAgentMessages(messages: OpsAgentChatMessage[]) {
  return messages.map((message) => {
    const sanitized: OpsAgentChatMessage = {
      role: message.role,
      content: typeof message.content === "string" ? maskSensitiveText(message.content).slice(0, 12000) : message.content ?? "",
    }

    if (message.name) sanitized.name = message.name
    if (message.tool_call_id) sanitized.tool_call_id = message.tool_call_id
    if (message.tool_calls?.length) {
      sanitized.tool_calls = message.tool_calls.map((toolCall) => ({
        ...toolCall,
        function: {
          ...toolCall.function,
          arguments: maskSensitiveText(toolCall.function.arguments).slice(0, 12000),
        },
      }))
    }

    return sanitized
  })
}

function normalizeToolCalls(value: unknown): OpsAgentToolCall[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): OpsAgentToolCall | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null
      const record = item as Record<string, any>
      const fn = record.function
      if (!fn || typeof fn !== "object") return null
      const name = typeof fn.name === "string" ? fn.name : ""
      if (!name) return null
      return {
        id: typeof record.id === "string" ? record.id : `tool-${name}`,
        type: "function",
        function: {
          name,
          arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments || {}),
        },
      }
    })
    .filter((item): item is OpsAgentToolCall => Boolean(item))
}

export async function callOpsAgentModel(input: OpsAgentModelCallInput): Promise<OpsAgentModelCallResult> {
  const provider = input.effective.provider || input.global.provider
  const model = pickOpsAgentModel(input.taskKind, input.global, input.prefs)
  const credential = resolveProviderCredential(provider)
  const baseUrl = normalizeBaseUrl(process.env.OPS_AGENT_MODEL_BASE_URL || input.effective.baseUrl || input.global.baseUrl)
  const providerOptions = buildProviderRequestOptions(provider, model)

  if (!credential || !baseUrl) {
    return {
      content: "",
      model,
      provider,
      usedModel: false,
      error: "模型未配置",
      toolCalls: [],
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  try {
    const requestBody: Record<string, unknown> = {
      model,
      messages: sanitizeOpsAgentMessages(input.messages),
      temperature: input.taskKind === "failure-diagnosis" ? 0.2 : 0.4,
      ...providerOptions,
      stream: false,
    }

    if (input.tools?.length) {
      requestBody.tools = input.tools
      requestBody.tool_choice = input.toolChoice || "auto"
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        content: "",
        model,
        provider,
        usedModel: false,
        error: `模型请求失败：${response.status}`,
        toolCalls: [],
      }
    }

    const data = await response.json()
    const message = data?.choices?.[0]?.message || {}
    const content = String(message.content || "").trim()
    const toolCalls = normalizeToolCalls(message.tool_calls)
    return {
      content,
      model,
      provider,
      usedModel: Boolean(content || toolCalls.length),
      toolCalls,
    }
  } catch (error) {
    return {
      content: "",
      model,
      provider,
      usedModel: false,
      error: error instanceof Error ? error.message : "模型请求异常",
      toolCalls: [],
    }
  } finally {
    clearTimeout(timeout)
  }
}

import {
  type OpsAgentEffectiveSettings,
  type OpsAgentGlobalSettings,
  type OpsAgentTaskKind,
  type OpsAgentUserPrefs,
  pickOpsAgentModel,
} from "@/lib/ops-agent-settings"

export interface OpsAgentChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface OpsAgentModelCallInput {
  global: OpsAgentGlobalSettings
  prefs: OpsAgentUserPrefs
  effective: OpsAgentEffectiveSettings
  taskKind: OpsAgentTaskKind
  messages: OpsAgentChatMessage[]
}

export interface OpsAgentModelCallResult {
  content: string
  model: string
  provider: string
  usedModel: boolean
  error?: string
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
  return messages.map((message) => ({
    ...message,
    content: maskSensitiveText(message.content).slice(0, 12000),
  }))
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
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify({
        model,
        messages: sanitizeOpsAgentMessages(input.messages),
        temperature: input.taskKind === "failure-diagnosis" ? 0.2 : 0.4,
        ...providerOptions,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        content: "",
        model,
        provider,
        usedModel: false,
        error: `模型请求失败：${response.status}`,
      }
    }

    const data = await response.json()
    const content = String(data?.choices?.[0]?.message?.content || "").trim()
    return {
      content,
      model,
      provider,
      usedModel: Boolean(content),
    }
  } catch (error) {
    return {
      content: "",
      model,
      provider,
      usedModel: false,
      error: error instanceof Error ? error.message : "模型请求异常",
    }
  } finally {
    clearTimeout(timeout)
  }
}

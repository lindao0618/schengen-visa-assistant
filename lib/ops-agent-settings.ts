export type OpsAgentModelQuality = "fast" | "balanced" | "reasoning"
export type OpsAgentTaskKind = "chat" | "import" | "materials" | "failure-diagnosis" | "daily-brief"
export type OpsAgentAnswerStyle = "concise" | "detailed" | "table-first" | "action-card-first"
export type OpsAgentOutputFormat = "markdown" | "wechat-copy"

export interface OpsAgentModelOption {
  id: string
  label: string
  enabled: boolean
  quality: OpsAgentModelQuality
}

export interface OpsAgentGlobalSettings {
  provider: string
  baseUrl: string
  defaultModel: string
  reasoningModel: string
  models: OpsAgentModelOption[]
}

export interface OpsAgentUserPrefs {
  defaultModel: string
  deepAnalysisEnabled: boolean
  answerStyle: OpsAgentAnswerStyle
  outputFormat: OpsAgentOutputFormat
  pinnedShortcuts: string[]
}

export interface OpsAgentEffectiveSettings extends OpsAgentUserPrefs {
  provider: string
  baseUrl: string
  reasoningModel: string
  availableModels: OpsAgentModelOption[]
}

export const OPS_AGENT_GLOBAL_SETTINGS_KEY = "ops-agent.global-settings"

export const DEFAULT_OPS_AGENT_MODELS: OpsAgentModelOption[] = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", enabled: true, quality: "fast" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", enabled: true, quality: "reasoning" },
]

export const DEFAULT_OPS_AGENT_GLOBAL_SETTINGS: OpsAgentGlobalSettings = {
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com",
  defaultModel: "deepseek-v4-flash",
  reasoningModel: "deepseek-v4-pro",
  models: DEFAULT_OPS_AGENT_MODELS,
}

export const DEFAULT_OPS_AGENT_USER_PREFS: OpsAgentUserPrefs = {
  defaultModel: "deepseek-v4-flash",
  deepAnalysisEnabled: false,
  answerStyle: "action-card-first",
  outputFormat: "wechat-copy",
  pinnedShortcuts: ["查缺漏", "生成催办话术", "启动自动化"],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeModelOption(value: unknown): OpsAgentModelOption | null {
  if (!isRecord(value)) return null

  const id = readString(value.id, "")
  if (!id) return null

  const quality =
    value.quality === "balanced" || value.quality === "reasoning" ? value.quality : "fast"

  return {
    id,
    label: readString(value.label, id),
    enabled: readBoolean(value.enabled, true),
    quality,
  }
}

function getEnabledFallbackModel(models: OpsAgentModelOption[]) {
  return models.find((item) => item.enabled)?.id ?? models[0]?.id ?? DEFAULT_OPS_AGENT_GLOBAL_SETTINGS.defaultModel
}

export function getOpsAgentUserPrefsKey(userId: string) {
  return `ops-agent.user-prefs.${userId}`
}

export function normalizeOpsAgentGlobalSettings(value: unknown): OpsAgentGlobalSettings {
  const source = isRecord(value) ? value : {}
  const rawModels = Array.isArray(source.models) ? source.models : DEFAULT_OPS_AGENT_MODELS
  const models = rawModels
    .map(normalizeModelOption)
    .filter((item): item is OpsAgentModelOption => Boolean(item))
  const safeModels = models.length ? models : DEFAULT_OPS_AGENT_MODELS
  const requestedDefaultModel = readString(source.defaultModel, DEFAULT_OPS_AGENT_GLOBAL_SETTINGS.defaultModel)
  const requestedReasoningModel = readString(source.reasoningModel, DEFAULT_OPS_AGENT_GLOBAL_SETTINGS.reasoningModel)
  const fallbackModel = getEnabledFallbackModel(safeModels)
  const defaultModel = safeModels.some((item) => item.id === requestedDefaultModel && item.enabled)
    ? requestedDefaultModel
    : fallbackModel
  const reasoningModel = safeModels.some((item) => item.id === requestedReasoningModel && item.enabled)
    ? requestedReasoningModel
    : safeModels.find((item) => item.quality === "reasoning" && item.enabled)?.id ?? defaultModel

  return {
    provider: readString(source.provider, DEFAULT_OPS_AGENT_GLOBAL_SETTINGS.provider),
    baseUrl: readString(source.baseUrl, DEFAULT_OPS_AGENT_GLOBAL_SETTINGS.baseUrl),
    defaultModel,
    reasoningModel,
    models: safeModels,
  }
}

export function normalizeOpsAgentUserPrefs(
  value: unknown,
  global = DEFAULT_OPS_AGENT_GLOBAL_SETTINGS,
): OpsAgentUserPrefs {
  const source = isRecord(value) ? value : {}
  const enabledModels = global.models.filter((item) => item.enabled)
  const requestedModel = readString(source.defaultModel, global.defaultModel)
  const defaultModel = enabledModels.some((item) => item.id === requestedModel)
    ? requestedModel
    : global.defaultModel
  const answerStyle =
    source.answerStyle === "concise" ||
    source.answerStyle === "detailed" ||
    source.answerStyle === "table-first"
      ? source.answerStyle
      : "action-card-first"
  const outputFormat = source.outputFormat === "markdown" ? "markdown" : "wechat-copy"
  const pinnedShortcuts = Array.isArray(source.pinnedShortcuts)
    ? source.pinnedShortcuts
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 8)
    : DEFAULT_OPS_AGENT_USER_PREFS.pinnedShortcuts

  return {
    defaultModel,
    deepAnalysisEnabled: readBoolean(source.deepAnalysisEnabled, false),
    answerStyle,
    outputFormat,
    pinnedShortcuts,
  }
}

export function buildEffectiveOpsAgentSettings(
  global: OpsAgentGlobalSettings,
  prefs: OpsAgentUserPrefs,
): OpsAgentEffectiveSettings {
  const normalizedPrefs = normalizeOpsAgentUserPrefs(prefs, global)

  return {
    ...normalizedPrefs,
    provider: global.provider,
    baseUrl: global.baseUrl,
    reasoningModel: global.reasoningModel,
    availableModels: global.models.filter((item) => item.enabled),
  }
}

export function pickOpsAgentModel(
  taskKind: OpsAgentTaskKind,
  global: OpsAgentGlobalSettings,
  prefs: OpsAgentUserPrefs,
) {
  if (taskKind === "failure-diagnosis" || (taskKind === "materials" && prefs.deepAnalysisEnabled)) {
    return global.reasoningModel
  }

  return normalizeOpsAgentUserPrefs(prefs, global).defaultModel
}

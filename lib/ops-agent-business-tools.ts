import {
  parseOpsAgentImportFilename,
  type OpsAgentImportQueueType,
} from "./ops-agent-filename-parser"
import {
  canAssignCases,
  canReadAllApplicants,
  canTriggerAutomation,
  canWriteApplicants,
  getAppRoleLabel,
  isReadOnlyRole,
  normalizeAppRole,
} from "./access-control"

export type OpsAgentBriefSeverity = "critical" | "warning" | "info"
export type OpsAgentFollowUpScene = "missing-materials" | "deadline" | "payment" | "general"

export interface OpsAgentDailyBriefItem {
  id: string
  title: string
  severity: OpsAgentBriefSeverity
  dueAt?: string | null
  applicantName?: string
  applicantProfileId?: string
  caseId?: string
  reason?: string
  nextAction?: string
}

export interface RankedOpsAgentDailyBriefItem extends OpsAgentDailyBriefItem {
  score: number
}

export interface OpsAgentFailureInput {
  system: "usa-visa" | "france-visa" | string
  type: string
  message?: string
  error?: string
}

export interface OpsAgentFailureSummary {
  step: string
  rootCause: string
  operatorCanRetry: boolean
  nextAction: string
}

export interface FollowUpDraftInput {
  applicantName: string
  scene: OpsAgentFollowUpScene
  missingMaterials?: string[]
  slotTime?: string | null
  paymentNote?: string
}

export interface OpsAgentPermissionSummary {
  role: string
  roleLabel: string
  visibleScope: string
  allowed: string[]
  restricted: string[]
}

const SEVERITY_SCORE: Record<OpsAgentBriefSeverity, number> = {
  critical: 1000,
  warning: 500,
  info: 100,
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dateOnly(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function taskTimestampToIso(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const timestamp = value > 1_000_000_000_000 ? value : value * 1000
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dueScore(value: string | null | undefined, now: Date) {
  if (!value) return 0
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  const days = Math.floor((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000)
  if (days < 0) return 80
  if (days === 0) return 300
  if (days === 1) return 240
  if (days <= 3) return 180
  if (days <= 7) return 90
  return 10
}

function normalizeNameCandidate(value: string) {
  return value
    .replace(/^[-*•\d.\s]+/, "")
    .replace(/^(姓名|客户|申请人|名单)[:：]?/, "")
    .replace(/[，,。；;、]+$/, "")
    .trim()
}

export function extractBatchNames(text: string) {
  const raw = String(text || "")
  const commandTail = raw.includes("：") ? raw.split("：").pop() || raw : raw.includes(":") ? raw.split(":").pop() || raw : raw
  const candidates = commandTail
    .split(/[\n\r,，、;；\t]+/)
    .map(normalizeNameCandidate)
    .filter(Boolean)
    .filter((item) => item !== "姓名")
    .filter((item) => !/(查一下|有没有|建档|递签时间|这些人)/.test(item))
    .filter((item) => /^[\u3400-\u9fffA-Za-z·.\s]{2,30}$/.test(item))

  return Array.from(new Set(candidates))
}

export function rankDailyBriefItems(items: OpsAgentDailyBriefItem[], now = new Date()): RankedOpsAgentDailyBriefItem[] {
  return items
    .map((item) => ({
      ...item,
      score: SEVERITY_SCORE[item.severity] + dueScore(item.dueAt, now),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return String(left.dueAt || "").localeCompare(String(right.dueAt || ""))
    })
}

export function buildFollowUpDraft(input: FollowUpDraftInput) {
  const name = input.applicantName || "您好"
  const slotLine = input.slotTime ? `目前系统记录的递签/面签时间是 ${dateOnly(input.slotTime)}。` : ""

  if (input.scene === "missing-materials") {
    const missing = input.missingMaterials?.length ? input.missingMaterials.join("、") : "未补齐材料"
    return [
      `${name}您好，`,
      `我们核对材料时发现还缺：${missing}。`,
      slotLine,
      "麻烦您方便时尽快补充，我们收到后会继续帮您推进后续流程。",
    ].filter(Boolean).join("\n")
  }

  if (input.scene === "deadline") {
    return [
      `${name}您好，`,
      slotLine || "您的签证流程已经接近关键时间节点。",
      "为避免影响递签/面签安排，请您今天优先确认材料和信息是否都已补齐。",
    ].filter(Boolean).join("\n")
  }

  if (input.scene === "payment") {
    return [
      `${name}您好，`,
      input.paymentNote || "当前流程还需要确认缴费状态。",
      "麻烦您确认后回复我们，我们会继续推进预约和材料提交。",
    ].join("\n")
  }

  return [
    `${name}您好，`,
    "我们正在继续推进您的签证申请。",
    "如有需要您补充或确认的信息，我们会及时同步。",
  ].join("\n")
}

function inferFailureStep(input: OpsAgentFailureInput) {
  const type = input.type.toLowerCase()
  if (type.includes("ais") || type.includes("register-ais")) return "AIS 注册/预约"
  if (type.includes("ds160") || type.includes("submit")) return "DS-160 提交"
  if (type.includes("photo")) return "美签照片检测"
  if (type.includes("receipt")) return "法签回执生成"
  if (type.includes("create") || type.includes("application")) return "法签建表"
  if (type.includes("tls") || type.includes("register")) return "TLS 注册/同步"
  return input.system === "france-visa" ? "法签自动化" : "美签自动化"
}

export function summarizeTaskFailureFallback(input: OpsAgentFailureInput): OpsAgentFailureSummary {
  const text = `${input.message || ""}\n${input.error || ""}`.toLowerCase()
  const step = inferFailureStep(input)

  if (/selector|element|not found|locator|timeout/.test(text)) {
    return {
      step,
      rootCause: "页面元素缺失或网站结构变化，自动化在等待页面按钮/输入框时超时。",
      operatorCanRetry: false,
      nextAction: "先不要反复重试。请把任务 ID、失败截图或日志交给开发排查自动化脚本；如果页面只是加载慢，可由开发确认后再重跑。",
    }
  }

  if (/password|login|credential|unauthorized|401|403/.test(text)) {
    return {
      step,
      rootCause: "账号、密码、权限或登录状态异常，自动化无法进入目标网站。",
      operatorCanRetry: true,
      nextAction: "请专员先核对账号密码、验证码方式和付款/预约权限，修正资料后再重试。",
    }
  }

  if (/captcha|验证码|2captcha/.test(text)) {
    return {
      step,
      rootCause: "验证码识别或验证码服务异常，流程被验证码步骤阻塞。",
      operatorCanRetry: true,
      nextAction: "可稍后重试；如果连续失败，请检查验证码服务余额和目标网站验证码是否变化。",
    }
  }

  return {
    step,
    rootCause: "自动化任务失败，日志没有提供明确可归类原因。",
    operatorCanRetry: true,
    nextAction: "请先核对申请人资料和上传文件是否完整；如果重试仍失败，再交由开发查看原始日志。",
  }
}

export async function previewExcelImportTool(params: {
  userId: string
  role?: string
  filename: string
  now?: Date
}) {
  const parsed = parseOpsAgentImportFilename(params.filename, params.now)
  const matches = parsed.applicantName
    ? await searchApplicantsByName(params.userId, params.role, parsed.applicantName)
    : []

  let queueType = parsed.queueType
  if (matches.length > 1) queueType = "low-confidence"

  return {
    type: "import-preview",
    parsed: {
      ...parsed,
      queueType,
    },
    matches,
    confirmationCard: {
      title: parsed.applicantName ? `确认导入 ${parsed.applicantName}` : "缺人文件待确认",
      riskLevel: queueType === "ready" && matches.length <= 1 ? "medium" : "high",
      actions: buildImportConfirmationActions(queueType, matches.length),
    },
  }
}

export async function batchLookupApplicantsTool(params: {
  userId: string
  role?: string
  names: string[]
}) {
  const rows = []
  for (const name of params.names) {
    const matches = await searchApplicantsByName(params.userId, params.role, name)
    rows.push({
      name,
      matchCount: matches.length,
      status: matches.length === 0 ? "未建档" : matches.length === 1 ? "已匹配" : "同名多人",
      risk: matches.length > 1 ? "需要人工选择" : matches.length === 0 ? "可新建档" : "",
      matches,
    })
  }
  return {
    type: "batch-name-lookup",
    rows,
    markdown: [
      "| 姓名 | 匹配结果 | 当前状态 | 风险 |",
      "| --- | --- | --- | --- |",
      ...rows.map((row) => `| ${row.name} | ${row.matchCount} | ${row.status} | ${row.risk || "-"} |`),
    ].join("\n"),
  }
}

export async function listCurrentAccountApplicantsTool(params: {
  userId: string
  role?: string
  keyword?: string
  limit?: number
}) {
  const { listApplicantCrmData } = await import("@/lib/applicant-crm")
  const role = normalizeAppRole(params.role)
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)
  const data = await listApplicantCrmData(params.userId, params.role, {
    keyword: params.keyword,
    includeProfiles: false,
    includeProfileFiles: false,
    includeListMeta: false,
    includeStats: true,
    limit,
  })
  const rows = (Array.isArray(data.rows) ? data.rows : []).map((row: any) => ({
    id: row.id,
    name: row.name,
    visaType: row.visaType || row.caseType || "未标注",
    region: row.region || "",
    status: row.currentStatusLabel || "未建案",
    activeCaseId: row.activeCaseId || null,
    assigneeName: row.assignee?.name || row.assignee?.email || "",
    ownerName: row.owner?.name || row.owner?.email || "",
    updatedAt: row.updatedAt,
  }))

  return {
    type: "current-account-applicant-list",
    rows,
    stats: data.stats,
    pagination: data.pagination,
    totalRows: data.pagination?.totalRows ?? rows.length,
    hasMore: Boolean(data.pagination?.hasMore),
    permissions: buildOpsAgentPermissionSummary(role),
  }
}

export async function getDailyBriefTool(params: {
  userId: string
  role?: string
  now?: Date
}) {
  const now = params.now ?? new Date()
  const [{ listApplicantSchedule }, { listAgentTasks }] = await Promise.all([
    import("@/lib/applicant-schedule"),
    import("@/lib/agent-tasks"),
  ])
  const schedule = await listApplicantSchedule(params.userId, params.role, new URLSearchParams("days=7&includeMissingSlot=true"))
  const failedTasks = await listAgentTasks(params.userId, params.role, { status: "failed", limit: 20 })
  const items: OpsAgentDailyBriefItem[] = [
    ...schedule.items.map((item: any) => ({
      id: `slot:${item.id}`,
      title: `${item.applicantName} ${dateOnly(item.slotTime)} 递签/面签`,
      severity: isWithinDays(item.slotTime, now, 1) ? "critical" as const : "warning" as const,
      dueAt: item.slotTime,
      applicantName: item.applicantName,
      applicantProfileId: item.applicantId,
      caseId: item.id,
      reason: "已填写递签/面签时间",
      nextAction: "检查材料是否齐全，确认是否需要递签前内部提醒。",
    })),
    ...schedule.missingSlotItems.slice(0, 30).map((item: any) => ({
      id: `missing-slot:${item.id}`,
      title: `${item.applicantName} 未填写递签/面签时间`,
      severity: "warning" as const,
      dueAt: item.updatedAt,
      applicantName: item.applicantName,
      applicantProfileId: item.applicantId,
      caseId: item.id,
      reason: "缺少 slotTime，月历无法准确提醒。",
      nextAction: "补充 TLS/AIS 同步结果或人工确认时间。",
    })),
    ...failedTasks.map((task: any) => {
      const summary = summarizeTaskFailureFallback(task)
      return {
        id: `task:${task.task_id}`,
        title: `${task.applicantName || "未绑定申请人"} 自动化失败：${task.type}`,
        severity: "critical" as const,
        dueAt: taskTimestampToIso(task.updated_at ?? task.created_at),
        applicantName: task.applicantName,
        applicantProfileId: task.applicantProfileId,
        caseId: task.caseId,
        reason: `${summary.step}：${summary.rootCause}`,
        nextAction: summary.nextAction,
      }
    }),
  ]
  const ranked = rankDailyBriefItems(items, now)
  return {
    type: "daily-brief",
    generatedAt: now.toISOString(),
    summary: schedule.summary,
    items: ranked.slice(0, 40),
  }
}

export async function checkMaterialsTool(params: {
  userId: string
  role?: string
  applicantProfileId: string
}) {
  const { buildAgentWorkspace } = await import("@/lib/agent-tasks")
  const workspace = await buildAgentWorkspace(params.userId, params.role, params.applicantProfileId)
  if (!workspace) return null
  return {
    type: "material-check",
    applicant: workspace.profile,
    missingFileGroups: workspace.missingFileGroups,
    missingInformation: workspace.missingInformation,
    recommendedActions: workspace.recommendedActions,
    canSubmit: workspace.missingFileGroups.length === 0 && workspace.missingInformation.length === 0,
  }
}

export async function generateFollowUpMessageTool(params: {
  userId: string
  role?: string
  applicantProfileId: string
  scene: OpsAgentFollowUpScene
}) {
  const check = await checkMaterialsTool(params)
  if (!check) return null
  const missingMaterials = check.missingFileGroups.map((item: any) => item.label)
  const activeCase = await getActiveCaseFromWorkspace(params.userId, params.role, params.applicantProfileId)
  return {
    type: "follow-up-draft",
    draft: buildFollowUpDraft({
      applicantName: check.applicant.name || "申请人",
      scene: params.scene,
      missingMaterials,
      slotTime: activeCase?.slotTime,
    }),
    missingMaterials,
  }
}

export async function summarizeTaskFailureTool(params: {
  userId: string
  role?: string
  taskId: string
  system?: "usa-visa" | "france-visa"
}) {
  const { getAgentTask } = await import("@/lib/agent-tasks")
  const task = await getAgentTask(params.userId, params.role, params.taskId, params.system)
  if (!task) return null
  return {
    type: "task-failure-summary",
    task,
    summary: summarizeTaskFailureFallback(task),
  }
}

function buildOpsAgentPermissionSummary(role: string): OpsAgentPermissionSummary {
  const normalizedRole = normalizeAppRole(role)
  const visibleScope = canReadAllApplicants(normalizedRole)
    ? "当前角色可查看系统内全部申请人。"
    : "当前角色只可查看自己创建或分配给自己的申请人。"
  const allowed = [
    visibleScope,
    "可以生成材料缺漏、催办话术、每日简报等只读分析。",
  ]
  const restricted = [
    "不会输出 API Key、密码、完整护照号等敏感信息。",
    "不会绕过确认直接执行写入、覆盖、批量修改或自动化启动。",
  ]

  if (canWriteApplicants(normalizedRole)) {
    allowed.push("可以发起申请人和案件字段修改，但必须先生成确认卡。")
  } else {
    restricted.push("当前角色不能修改申请人或案件字段。")
  }

  if (canTriggerAutomation(normalizedRole)) {
    allowed.push("可以发起法签/美签自动化启动确认。")
  } else {
    restricted.push("当前角色不能启动法签/美签自动化。")
  }

  if (canAssignCases(normalizedRole)) {
    allowed.push("可以分配案件或调整负责人。")
  } else {
    restricted.push("当前角色不能分配案件或调整负责人。")
  }

  if (!canReadAllApplicants(normalizedRole)) {
    restricted.push("不能查看未归属、未分配给当前账号的申请人。")
  }

  if (isReadOnlyRole(normalizedRole)) {
    restricted.push("客服角色属于只读运营视角，只能查看和生成话术/简报。")
  }

  return {
    role: normalizedRole,
    roleLabel: getAppRoleLabel(normalizedRole),
    visibleScope,
    allowed,
    restricted,
  }
}

async function searchApplicantsByName(userId: string, role: string | undefined, name: string) {
  const { listApplicantCrmData } = await import("@/lib/applicant-crm")
  const data = await listApplicantCrmData(userId, role, {
    keyword: name,
    includeProfiles: true,
    includeProfileFiles: false,
    limit: 10,
  })
  const rows = Array.isArray(data?.rows) ? data.rows : []
  return rows
    .filter((row: any) => String(row.name || "").includes(name) || String(name).includes(String(row.name || "")))
    .map((row: any) => ({
      id: row.id,
      name: row.name,
      status: row.currentStatusLabel,
      activeCaseId: row.activeCaseId,
      visaType: row.visaType,
      updatedAt: row.updatedAt,
    }))
}

async function getActiveCaseFromWorkspace(userId: string, role: string | undefined, applicantProfileId: string) {
  const { buildAgentWorkspace } = await import("@/lib/agent-tasks")
  const workspace = await buildAgentWorkspace(userId, role, applicantProfileId)
  return workspace?.activeCase ?? null
}

function buildImportConfirmationActions(queueType: OpsAgentImportQueueType, matchCount: number) {
  if (queueType === "missing-person") return ["选择申请人", "手动填写姓名", "取消"]
  if (matchCount > 1) return ["选择同名申请人", "新建申请人", "取消"]
  if (matchCount === 1) return ["合并到已有档案", "新建案件", "只归档文件", "取消"]
  return ["创建申请人并建案", "只建申请人", "取消"]
}

function isWithinDays(value: string | null | undefined, now: Date, days: number) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const delta = startOfDay(date).getTime() - startOfDay(now).getTime()
  return delta >= 0 && delta <= days * 86400000
}

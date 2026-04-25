import prisma from "@/lib/db"
import {
  getTask as getFrenchTask,
  listTasks as listFrenchTasks,
  type FrenchVisaTaskResponse,
} from "@/lib/french-visa-tasks"
import { getApplicantCrmDetail } from "@/lib/applicant-crm"
import {
  ApplicantProfile,
  ApplicantProfileFileSlot,
} from "@/lib/applicant-profiles"
import { normalizeApplicantCrmVisaType } from "@/lib/applicant-crm-labels"
import {
  getTask as getUsVisaTask,
  listTasks as listUsVisaTasks,
  type UsVisaTaskResponse,
} from "@/lib/usa-visa-tasks"

export type AgentTaskSystem = "usa-visa" | "france-visa"
type ApplicantVisaType = Exclude<ReturnType<typeof normalizeApplicantCrmVisaType>, undefined>

export interface AgentTaskResponse {
  system: AgentTaskSystem
  task_id: string
  type: string
  status: string
  progress: number
  message: string
  created_at: number
  updated_at?: number
  result?: Record<string, unknown>
  error?: string
  applicantProfileId?: string
  applicantName?: string
  caseId?: string
  caseLabel?: string
}

interface AgentTaskListOptions {
  status?: string
  applicantProfileId?: string
  caseId?: string
  limit?: number
  system?: AgentTaskSystem
}

interface WorkspaceFileGroup {
  id: string
  label: string
  slots: ApplicantProfileFileSlot[]
  requiredFor: ApplicantVisaType[]
  recommended?: boolean
}

const WORKSPACE_FILE_GROUPS: WorkspaceFileGroup[] = [
  {
    id: "usa-photo",
    label: "美签照片",
    slots: ["usVisaPhoto", "photo"],
    requiredFor: ["usa-visa"],
  },
  {
    id: "usa-ds160-excel",
    label: "DS-160 Excel",
    slots: ["usVisaDs160Excel", "ds160Excel"],
    requiredFor: ["usa-visa"],
  },
  {
    id: "usa-ais-excel",
    label: "AIS Excel",
    slots: ["usVisaAisExcel", "aisExcel"],
    requiredFor: ["usa-visa"],
    recommended: true,
  },
  {
    id: "schengen-excel",
    label: "申根 Excel",
    slots: ["schengenExcel", "franceExcel"],
    requiredFor: ["france-schengen"],
  },
  {
    id: "schengen-photo",
    label: "申根照片",
    slots: ["schengenPhoto", "photo"],
    requiredFor: ["france-schengen"],
    recommended: true,
  },
  {
    id: "passport-scan",
    label: "护照扫描件",
    slots: ["passportScan"],
    requiredFor: ["france-schengen"],
    recommended: true,
  },
]

function toAgentTask(system: AgentTaskSystem, task: UsVisaTaskResponse | FrenchVisaTaskResponse): AgentTaskResponse {
  return {
    system,
    task_id: task.task_id,
    type: task.type,
    status: task.status,
    progress: task.progress,
    message: task.message,
    created_at: task.created_at,
    updated_at: task.updated_at,
    result: task.result,
    error: task.error,
    applicantProfileId: task.applicantProfileId,
    applicantName: task.applicantName,
    caseId: task.caseId,
    caseLabel: task.caseLabel,
  }
}

function getTaskUpdatedAt(task: AgentTaskResponse) {
  return task.updated_at ?? task.created_at
}

function hasAnyFile(profile: ApplicantProfile, slots: ApplicantProfileFileSlot[]) {
  return slots.some((slot) => Boolean(profile.files[slot]))
}

function getApplicantVisaTypes(cases: Array<{ caseType: string; visaType?: string | null }>) {
  return Array.from(
    new Set(
      cases
        .map((item) => normalizeApplicantCrmVisaType(item.visaType || item.caseType))
        .filter((item): item is ApplicantVisaType => Boolean(item)),
    ),
  )
}

function buildRecommendedActions(params: {
  profile: ApplicantProfile
  visaTypes: ApplicantVisaType[]
  recentTasks: AgentTaskResponse[]
}) {
  const { profile, visaTypes, recentTasks } = params
  const actions: Array<{
    code: string
    label: string
    reason: string
    endpoint: string
    method: string
  }> = []

  const hasUsPhotoCheck = recentTasks.some((task) => task.system === "usa-visa" && task.type === "check-photo")
  const hasUsSubmit = recentTasks.some((task) => task.system === "usa-visa" && task.type === "submit-ds160")
  const hasFranceCreate = recentTasks.some((task) => task.system === "france-visa" && task.type === "create-application")
  const hasFranceReceipt = recentTasks.some((task) => task.system === "france-visa" && task.type === "fill-receipt")
  const hasFranceSubmit = recentTasks.some((task) => task.system === "france-visa" && task.type === "submit-final")

  if (visaTypes.includes("usa-visa")) {
    if (!hasAnyFile(profile, ["usVisaPhoto", "photo"])) {
      actions.push({
        code: "upload_us_visa_photo",
        label: "上传美签照片",
        reason: "档案中还没有可用于照片检测的照片",
        endpoint: `/api/agent/applicants/${profile.id}/files`,
        method: "POST",
      })
    }
    if (!hasAnyFile(profile, ["usVisaDs160Excel", "ds160Excel"])) {
      actions.push({
        code: "upload_us_visa_ds160_excel",
        label: "上传 DS-160 Excel",
        reason: "美签执行链路缺少核心 Excel",
        endpoint: `/api/agent/applicants/${profile.id}/files`,
        method: "POST",
      })
    }
    if (hasAnyFile(profile, ["usVisaPhoto", "photo"]) && !hasUsPhotoCheck) {
      actions.push({
        code: "run_us_visa_photo_check",
        label: "执行照片检测",
        reason: "已有照片，但还没有照片检测任务记录",
        endpoint: "/api/usa-visa/photo-check",
        method: "POST",
      })
    }
    if (profile.usVisa?.aaCode && !profile.files.usVisaDs160ConfirmationPdf && !hasUsSubmit) {
      actions.push({
        code: "run_ds160_submit",
        label: "提交 DS-160",
        reason: "档案已有 AA 码，但确认页 PDF 还未归档",
        endpoint: "/api/usa-visa/ds160/submit",
        method: "POST",
      })
    }
  }

  if (visaTypes.includes("france-schengen")) {
    if (!hasAnyFile(profile, ["schengenExcel", "franceExcel"])) {
      actions.push({
        code: "upload_schengen_excel",
        label: "上传申根 Excel",
        reason: "法签执行链路缺少核心 Excel",
        endpoint: `/api/agent/applicants/${profile.id}/files`,
        method: "POST",
      })
    }
    if (hasAnyFile(profile, ["schengenExcel", "franceExcel"]) && !profile.files.franceApplicationJson && !hasFranceCreate) {
      actions.push({
        code: "run_france_create_application",
        label: "生成法国新申请",
        reason: "Excel 已就绪，但申请 JSON 尚未生成",
        endpoint: "/api/schengen/france/create-application",
        method: "POST",
      })
    }
    if (profile.files.franceApplicationJson && !profile.files.franceReceiptPdf && !hasFranceReceipt) {
      actions.push({
        code: "run_france_fill_receipt",
        label: "生成回执 PDF",
        reason: "申请 JSON 已归档，但回执 PDF 尚未生成",
        endpoint: "/api/schengen/france/fill-receipt",
        method: "POST",
      })
    }
    if (profile.files.franceReceiptPdf && !profile.files.franceFinalSubmissionPdf && !hasFranceSubmit) {
      actions.push({
        code: "run_france_submit_final",
        label: "提交最终表",
        reason: "回执 PDF 已归档，但最终表尚未生成",
        endpoint: "/api/schengen/france/submit-final",
        method: "POST",
      })
    }
  }

  return actions
}

function buildMissingInfo(profile: ApplicantProfile, visaTypes: ApplicantVisaType[]) {
  const missingFields: Array<{ field: string; label: string; reason: string }> = []

  if (visaTypes.includes("usa-visa")) {
    if (!profile.usVisa?.surname) {
      missingFields.push({
        field: "usVisa.surname",
        label: "美签姓氏",
        reason: "DS-160 提交依赖姓氏字段",
      })
    }
    if (!profile.usVisa?.birthYear) {
      missingFields.push({
        field: "usVisa.birthYear",
        label: "美签出生年份",
        reason: "DS-160 提交依赖出生年份字段",
      })
    }
    if (!profile.passportNumber && !profile.usVisa?.passportNumber) {
      missingFields.push({
        field: "passportNumber",
        label: "护照号",
        reason: "美签和申根流程都常依赖护照号",
      })
    }
    if (!profile.usVisa?.aaCode) {
      missingFields.push({
        field: "usVisa.aaCode",
        label: "AA 码",
        reason: "DS-160 提交完成后应回写 AA 码",
      })
    }
  }

  if (visaTypes.includes("france-schengen") && !profile.schengen?.city) {
    missingFields.push({
      field: "schengen.city",
      label: "TLS 城市",
      reason: "法国申根任务通常需要城市信息",
    })
  }

  return missingFields
}

export async function listAgentTasks(userId: string, _role: string | undefined, options: AgentTaskListOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
  const includeUsVisa = !options.system || options.system === "usa-visa"
  const includeFrenchVisa = !options.system || options.system === "france-visa"

  const [usVisaTasks, frenchVisaTasks] = await Promise.all([
    includeUsVisa
      ? listUsVisaTasks(userId, limit * 2, options.status, options.applicantProfileId, options.caseId)
      : Promise.resolve([] as UsVisaTaskResponse[]),
    includeFrenchVisa
      ? listFrenchTasks(userId, limit * 2, options.status, options.applicantProfileId, options.caseId)
      : Promise.resolve([] as FrenchVisaTaskResponse[]),
  ])

  return [
    ...usVisaTasks.map((task) => toAgentTask("usa-visa", task)),
    ...frenchVisaTasks.map((task) => toAgentTask("france-visa", task)),
  ]
    .sort((left, right) => getTaskUpdatedAt(right) - getTaskUpdatedAt(left))
    .slice(0, limit)
}

export async function getAgentTask(userId: string, _role: string | undefined, taskId: string, system?: AgentTaskSystem) {
  if (system === "france-visa" || (!system && taskId.startsWith("fv-"))) {
    const task = await getFrenchTask(userId, taskId)
    if (task) return toAgentTask("france-visa", task)
    if (system === "france-visa") return null
  }

  if (system === "usa-visa" || !system) {
    const task = await getUsVisaTask(userId, taskId)
    if (task) return toAgentTask("usa-visa", task)
  }

  if (!system && !taskId.startsWith("fv-")) {
    const task = await getFrenchTask(userId, taskId)
    if (task) return toAgentTask("france-visa", task)
  }

  return null
}

export async function buildAgentWorkspace(
  userId: string,
  role: string | undefined,
  applicantProfileId: string,
  taskLimit = 20,
) {
  const detail = await getApplicantCrmDetail(userId, role, applicantProfileId)
  if (!detail) return null

  const recentTasks = await listAgentTasks(userId, role, {
    applicantProfileId,
    limit: taskLimit,
  })
  const activeCase = detail.cases.find((item) => item.id === detail.activeCaseId) ?? detail.cases[0] ?? null
  const visaTypes = getApplicantVisaTypes(detail.cases)

  const fileGroups = WORKSPACE_FILE_GROUPS
    .filter((group) => group.requiredFor.some((visaType) => visaTypes.includes(visaType)))
    .map((group) => ({
      id: group.id,
      label: group.label,
      required: !group.recommended,
      slots: group.slots,
      present: hasAnyFile(detail.profile, group.slots),
      matchedSlot: group.slots.find((slot) => detail.profile.files[slot]) || null,
    }))

  const missingFileGroups = fileGroups.filter((group) => !group.present)
  const missingInformation = buildMissingInfo(detail.profile, visaTypes)
  const recommendedActions = buildRecommendedActions({
    profile: detail.profile,
    visaTypes,
    recentTasks,
  })

  const taskSummary = {
    total: recentTasks.length,
    pendingOrRunning: recentTasks.filter((task) => task.status === "pending" || task.status === "running").length,
    failed: recentTasks.filter((task) => task.status === "failed").length,
    completed: recentTasks.filter((task) => task.status === "completed").length,
  }

  return {
    profile: detail.profile,
    cases: detail.cases,
    activeCaseId: detail.activeCaseId,
    activeCase,
    availableAssignees: detail.availableAssignees,
    visaTypes,
    fileGroups,
    missingFileGroups,
    missingInformation,
    recommendedActions,
    recentTasks,
    taskSummary,
  }
}

export async function resolveApplicantProfileIdFromCase(caseId: string) {
  const visaCase = await prisma.visaCase.findUnique({
    where: { id: caseId },
    select: { applicantProfileId: true },
  })
  return visaCase?.applicantProfileId ?? null
}

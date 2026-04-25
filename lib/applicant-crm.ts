import { Prisma } from "@prisma/client"
import * as fs from "fs/promises"
import * as path from "path"

import prisma from "@/lib/db"
import { ApplicantProfile, getApplicantProfile, listApplicantProfiles } from "@/lib/applicant-profiles"
import { buildApplicantSchengenIntakeView, buildApplicantUsVisaIntakeView } from "@/lib/agent-file-parsing"
import {
  CRM_PRIORITY_FILTER_VALUES,
  CRM_REGION_FILTER_VALUES,
  CRM_VISA_TYPE_FILTER_VALUES,
  normalizeApplicantCrmRegion,
  normalizeApplicantCrmVisaType,
} from "@/lib/applicant-crm-labels"
import {
  DEFAULT_FRANCE_CASE_MAIN_STATUS,
  DEFAULT_FRANCE_CASE_SUB_STATUS,
  FRANCE_CASE_TYPE,
  FranceExceptionCode,
  FranceMainStatus,
  FranceSubStatus,
  isFranceMainStatus,
  isFranceSubStatus,
} from "@/lib/france-case-machine"
import {
  DEFAULT_USA_CASE_MAIN_STATUS,
  DEFAULT_USA_CASE_SUB_STATUS,
  USA_CASE_TYPE,
  UsaExceptionCode,
  UsaMainStatus,
  UsaSubStatus,
  isUsaMainStatus,
  isUsaSubStatus,
} from "@/lib/usa-case-machine"
import { advanceFranceCase } from "@/lib/france-cases"
import { advanceUsaCase } from "@/lib/usa-cases"

type ApplicantWithCasesRecord = Prisma.ApplicantProfileGetPayload<{
  include: {
    user: {
      select: {
        id: true
        name: true
        email: true
        role: true
      }
    }
    visaCases: {
      include: {
        assignedTo: {
          select: {
            id: true
            name: true
            email: true
            role: true
          }
        }
      }
    }
  }
}>

type VisaCaseRecord = Prisma.VisaCaseGetPayload<{
  include: {
    user: {
      select: {
        id: true
        name: true
        email: true
        role: true
      }
    }
    assignedTo: {
      select: {
        id: true
        name: true
        email: true
        role: true
      }
    }
    applicantProfile: {
      select: {
        id: true
        name: true
      }
    }
    statusHistory: {
      orderBy: { createdAt: "desc" }
      take: 50
    }
    reminderLogs: {
      orderBy: { triggeredAt: "desc" }
      take: 50
    }
  }
}>

export const CRM_STATUS_OPTIONS = [
  { value: "pending_payment", label: "待付款" },
  { value: "preparing_docs", label: "资料准备中" },
  { value: "reviewing", label: "审核中" },
  { value: "docs_ready", label: "材料已就绪" },
  { value: "tls_processing", label: "TLS 处理中" },
  { value: "slot_booked", label: "已获取 Slot" },
  { value: "submitted", label: "已递签" },
  { value: "completed", label: "已完成" },
  { value: "exception", label: "异常处理中" },
] as const

export type ApplicantCrmStatusValue = (typeof CRM_STATUS_OPTIONS)[number]["value"]

export interface ApplicantCrmFilters {
  keyword?: string
  visaTypes?: string[]
  statuses?: string[]
  regions?: string[]
  priorities?: string[]
  includeStats?: boolean
  includeSelectorCases?: boolean
  includeProfiles?: boolean
  includeProfileFiles?: boolean
  includeAvailableAssignees?: boolean
}

export interface ApplicantCrmRow {
  id: string
  name: string
  groupName?: string
  phone?: string
  email?: string
  wechat?: string
  passportNumber?: string
  visaType?: string
  caseType?: string
  region?: string
  currentStatusKey: ApplicantCrmStatusValue | "no_case"
  currentStatusLabel: string
  priority?: string
  travelDate?: string | null
  updatedAt: string
  owner: {
    id: string
    name?: string | null
    email: string
  }
  assignee?: {
    id: string
    name?: string | null
    email: string
  } | null
  activeCaseId?: string | null
}

export interface ApplicantCrmStats {
  applicantCount: number
  activeCaseCount: number
  exceptionCaseCount: number
  updatedLast7DaysCount: number
}

export interface ApplicantCaseSummary {
  id: string
  caseType: string
  visaType?: string | null
  applyRegion?: string | null
  tlsCity?: string | null
  bookingWindow?: string | null
  acceptVip?: string | null
  slotTime?: string | null
  mainStatus: string
  subStatus?: string | null
  exceptionCode?: string | null
  priority: string
  travelDate?: string | null
  submissionDate?: string | null
  assignedToUserId?: string | null
  assignedRole?: string | null
  isActive: boolean
  updatedAt: string
  createdAt: string
  ds160PrecheckFile?: {
    originalName: string
    uploadedAt: string
  } | null
  owner: {
    id: string
    name?: string | null
    email: string
  }
  assignedTo?: {
    id: string
    name?: string | null
    email: string
    role: string
  } | null
  latestHistory?: {
    id: string
    toMainStatus: string
    toSubStatus?: string | null
    exceptionCode?: string | null
    reason?: string | null
    createdAt: string
  } | null
  statusHistory: Array<{
    id: string
    fromMainStatus?: string | null
    fromSubStatus?: string | null
    toMainStatus: string
    toSubStatus?: string | null
    exceptionCode?: string | null
    reason?: string | null
    operatorType: string
    operatorId?: string | null
    createdAt: string
  }>
  reminderLogs: Array<{
    id: string
    ruleCode: string
    channel: string
    automationMode: string
    severity: string
    templateCode: string
    sendStatus: string
    renderedContent?: string | null
    errorMessage?: string | null
    triggeredAt: string
    sentAt?: string | null
  }>
}

export interface ApplicantCrmDetail {
  profile: ApplicantProfile
  cases: ApplicantCaseSummary[]
  activeCaseId?: string | null
  availableAssignees: Array<{
    id: string
    name?: string | null
    email: string
    role: string
  }>
}

export interface VisaCaseInput {
  applicantProfileId: string
  caseType?: string
  visaType?: string
  applyRegion?: string
  tlsCity?: string
  bookingWindow?: string
  acceptVip?: string
  slotTime?: string | null
  priority?: string
  travelDate?: string | null
  submissionDate?: string | null
  assignedToUserId?: string | null
  isActive?: boolean
}

export interface VisaCasePatch {
  visaType?: string | null
  applyRegion?: string | null
  tlsCity?: string | null
  bookingWindow?: string | null
  acceptVip?: string | null
  slotTime?: string | null
  priority?: string | null
  travelDate?: string | null
  submissionDate?: string | null
  assignedToUserId?: string | null
  assignedRole?: string | null
  isActive?: boolean
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value)
  return normalized || null
}

function normalizePriority(value: unknown) {
  const normalized = normalizeText(value).toLowerCase()
  if (!normalized) return "normal"
  if (["normal", "high", "urgent"].includes(normalized)) return normalized
  return "normal"
}

function parseDateValue(value: string | null | undefined) {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) return direct

  const normalized = raw
    .replace(/[.]/g, "/")
    .replace(/年/g, "/")
    .replace(/月/g, "/")
    .replace(/日/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const ymd = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (ymd) {
    const [, y, m, d, hh = "0", mm = "0", ss = "0"] = ymd
    const dt = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    )
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  const dmy = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (dmy) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = dmy
    const dt = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    )
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  return null
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function parseDateValueForUsaPatch(
  value: string | null | undefined,
  fallback: Date | null,
) {
  if (value == null) return fallback
  const raw = String(value).trim()
  if (!raw) return null
  const parsed = parseDateValue(raw)
  return parsed ?? fallback
}

async function resolveIsAdmin(userId: string, role?: string) {
  if (role === "admin") return true
  if (role) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === "admin"
}

function buildApplicantAccessWhere(userId: string, isAdmin: boolean): Prisma.ApplicantProfileWhereInput {
  if (isAdmin) return {}
  return {
    OR: [
      { userId },
      {
        visaCases: {
          some: {
            assignedToUserId: userId,
          },
        },
      },
    ],
  }
}

function buildCaseAccessWhere(userId: string, isAdmin: boolean): Prisma.VisaCaseWhereInput {
  if (isAdmin) return {}
  return {
    OR: [
      { userId },
      { assignedToUserId: userId },
      { applicantProfile: { userId } },
    ],
  }
}

function getPrimaryCase(cases: ApplicantWithCasesRecord["visaCases"]) {
  return cases.find((item) => item.isActive) ?? cases[0] ?? null
}

function mapCaseToCrmStatus(caseRecord?: {
  mainStatus: string
  exceptionCode?: string | null
}) {
  if (!caseRecord) {
    return { key: "no_case" as const, label: "未创建案件" }
  }

  if (caseRecord.exceptionCode) {
    return { key: "exception" as const, label: "异常处理中" }
  }

  switch (caseRecord.mainStatus) {
    case "PENDING_PAYMENT":
      return { key: "pending_payment" as const, label: "待付款" }
    case "ONBOARDED":
    case "PRE_PREP":
    case "FORM_IN_PROGRESS":
      return { key: "preparing_docs" as const, label: "资料准备中" }
    case "REVIEWING":
      return { key: "reviewing" as const, label: "审核中" }
    case "DOCS_READY":
      return { key: "docs_ready" as const, label: "材料已就绪" }
    case "TLS_PROCESSING":
      return { key: "tls_processing" as const, label: "TLS 处理中" }
    case "SLOT_BOOKED":
      return { key: "slot_booked" as const, label: "已获取 Slot" }
    case "SUBMITTED":
      return { key: "submitted" as const, label: "已递签" }
    case "COMPLETED":
      return { key: "completed" as const, label: "已完成" }
    default:
      return { key: "preparing_docs" as const, label: caseRecord.mainStatus }
  }
}

function matchesKeyword(row: ApplicantCrmRow, keyword: string) {
  if (!keyword) return true
  const target = keyword.toLowerCase()
  return [
    row.name,
    row.phone,
    row.email,
    row.wechat,
    row.passportNumber,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(target))
}

function matchesArrayFilter(value: string | null | undefined, selected: string[] | undefined) {
  if (!selected || selected.length === 0) return true
  if (!value) return false
  return selected.includes(value)
}

function mapSelectorCase(caseRecord: ApplicantWithCasesRecord["visaCases"][number]) {
  return {
    id: caseRecord.id,
    caseType: caseRecord.caseType,
    visaType: caseRecord.visaType,
    applyRegion: caseRecord.applyRegion,
    tlsCity: caseRecord.tlsCity,
    bookingWindow: caseRecord.bookingWindow,
    acceptVip: caseRecord.acceptVip,
    slotTime: toIsoString(caseRecord.slotTime),
    mainStatus: caseRecord.mainStatus,
    subStatus: caseRecord.subStatus,
    exceptionCode: caseRecord.exceptionCode,
    priority: caseRecord.priority,
    travelDate: toIsoString(caseRecord.travelDate),
    submissionDate: toIsoString(caseRecord.submissionDate),
    assignedToUserId: caseRecord.assignedToUserId,
    assignedRole: caseRecord.assignedRole,
    isActive: caseRecord.isActive,
    updatedAt: caseRecord.updatedAt.toISOString(),
    createdAt: caseRecord.createdAt.toISOString(),
  }
}

function mapApplicantRow(item: ApplicantWithCasesRecord): ApplicantCrmRow {
  const primaryCase = getPrimaryCase(item.visaCases)
  const crmStatus = mapCaseToCrmStatus(primaryCase ?? undefined)
  const normalizedVisaType = normalizeApplicantCrmVisaType(primaryCase?.visaType ?? primaryCase?.caseType)
  const normalizedRegion = normalizeApplicantCrmRegion(primaryCase?.applyRegion)

  return {
    id: item.id,
    name: item.name,
    groupName: normalizeText((item as ApplicantWithCasesRecord & { groupName?: string | null }).groupName) || undefined,
    phone: item.phone ?? undefined,
    email: item.email ?? undefined,
    wechat: item.wechat ?? undefined,
    passportNumber: item.passportNumber ?? item.usVisaPassportNumber ?? undefined,
    visaType: normalizedVisaType,
    caseType: primaryCase?.caseType ?? undefined,
    region: normalizedRegion,
    currentStatusKey: crmStatus.key,
    currentStatusLabel: crmStatus.label,
    priority: primaryCase?.priority ?? undefined,
    travelDate: toIsoString(primaryCase?.travelDate),
    updatedAt: (primaryCase?.updatedAt ?? item.updatedAt).toISOString(),
    owner: {
      id: item.user.id,
      name: item.user.name,
      email: item.user.email,
    },
    assignee: primaryCase?.assignedTo
      ? {
          id: primaryCase.assignedTo.id,
          name: primaryCase.assignedTo.name,
          email: primaryCase.assignedTo.email,
        }
      : null,
    activeCaseId: primaryCase?.id ?? null,
  }
}

function mapApplicantProfileSummary(item: ApplicantWithCasesRecord) {
  const passportNumber = normalizeText(item.passportNumber) || normalizeText(item.usVisaPassportNumber) || undefined
  const passportLast4 = normalizeText(item.passportLast4) || passportNumber?.slice(-4) || undefined
  const aaCode = normalizeText(item.usVisaAaCode).toUpperCase() || undefined
  const birthYear = normalizeText(item.usVisaBirthYear) || undefined
  const schengenCountry = normalizeText(item.schengenCountry) || undefined
  const schengenCity = normalizeText(item.schengenVisaCity) || undefined
  const schengenFraNumber = normalizeText(item.schengenFraNumber) || undefined

  return {
    id: item.id,
    label: item.name,
    name: item.name,
    groupName: normalizeText((item as ApplicantWithCasesRecord & { groupName?: string | null }).groupName) || undefined,
    phone: item.phone ?? undefined,
    email: item.email ?? undefined,
    wechat: item.wechat ?? undefined,
    passportNumber,
    passportLast4,
    updatedAt: item.updatedAt.toISOString(),
    usVisa: {
      aaCode,
      surname: item.usVisaSurname ?? undefined,
      birthYear,
      passportNumber: item.usVisaPassportNumber ?? undefined,
    },
    schengen: {
      country: schengenCountry,
      city: schengenCity,
      fraNumber: schengenFraNumber,
    },
    files: {},
  }
}

type ApplicantStatsRecord = Prisma.ApplicantProfileGetPayload<{
  select: {
    id: true
    updatedAt: true
    visaCases: {
      select: {
        isActive: true
        exceptionCode: true
        updatedAt: true
      }
    }
  }
}>

function getPrimaryStatsCase(cases: ApplicantStatsRecord["visaCases"]) {
  return cases.find((item) => item.isActive) ?? cases[0] ?? null
}

function mapCaseSummary(caseRecord: VisaCaseRecord): ApplicantCaseSummary {
  return {
    id: caseRecord.id,
    caseType: caseRecord.caseType,
    visaType: caseRecord.visaType,
    applyRegion: caseRecord.applyRegion,
    tlsCity: caseRecord.tlsCity,
    bookingWindow: caseRecord.bookingWindow,
    acceptVip: caseRecord.acceptVip,
    slotTime: toIsoString(caseRecord.slotTime),
    mainStatus: caseRecord.mainStatus,
    subStatus: caseRecord.subStatus,
    exceptionCode: caseRecord.exceptionCode,
    priority: caseRecord.priority,
    travelDate: toIsoString(caseRecord.travelDate),
    submissionDate: toIsoString(caseRecord.submissionDate),
    assignedToUserId: caseRecord.assignedToUserId,
    assignedRole: caseRecord.assignedRole,
    isActive: caseRecord.isActive,
    updatedAt: caseRecord.updatedAt.toISOString(),
    createdAt: caseRecord.createdAt.toISOString(),
    ds160PrecheckFile: null,
    owner: {
      id: caseRecord.user.id,
      name: caseRecord.user.name,
      email: caseRecord.user.email,
    },
    assignedTo: caseRecord.assignedTo
      ? {
          id: caseRecord.assignedTo.id,
          name: caseRecord.assignedTo.name,
          email: caseRecord.assignedTo.email,
          role: caseRecord.assignedTo.role,
        }
      : null,
    latestHistory: caseRecord.statusHistory[0]
      ? {
          id: caseRecord.statusHistory[0].id,
          toMainStatus: caseRecord.statusHistory[0].toMainStatus,
          toSubStatus: caseRecord.statusHistory[0].toSubStatus,
          exceptionCode: caseRecord.statusHistory[0].exceptionCode,
          reason: caseRecord.statusHistory[0].reason,
          createdAt: caseRecord.statusHistory[0].createdAt.toISOString(),
        }
      : null,
    statusHistory: caseRecord.statusHistory.map((item) => ({
      id: item.id,
      fromMainStatus: item.fromMainStatus,
      fromSubStatus: item.fromSubStatus,
      toMainStatus: item.toMainStatus,
      toSubStatus: item.toSubStatus,
      exceptionCode: item.exceptionCode,
      reason: item.reason,
      operatorType: item.operatorType,
      operatorId: item.operatorId,
      createdAt: item.createdAt.toISOString(),
    })),
    reminderLogs: caseRecord.reminderLogs.map((item) => ({
      id: item.id,
      ruleCode: item.ruleCode,
      channel: item.channel,
      automationMode: item.automationMode,
      severity: item.severity,
      templateCode: item.templateCode,
      sendStatus: item.sendStatus,
      renderedContent: item.renderedContent,
      errorMessage: item.errorMessage,
      triggeredAt: item.triggeredAt.toISOString(),
      sentAt: toIsoString(item.sentAt),
    })),
  }
}

export async function listApplicantCrmData(
  userId: string,
  role: string | undefined,
  filters: ApplicantCrmFilters = {},
) {
  const isAdmin = await resolveIsAdmin(userId, role)
  const keyword = normalizeText(filters.keyword).toLowerCase()
  const visaTypes = (filters.visaTypes ?? []).filter(Boolean)
  const statuses = (filters.statuses ?? []).filter(Boolean)
  const regions = (filters.regions ?? []).filter(Boolean)
  const priorities = (filters.priorities ?? []).filter(Boolean)
  const includeStats = Boolean(filters.includeStats)
  const includeSelectorCases = Boolean(filters.includeSelectorCases)
  const includeProfiles = filters.includeProfiles !== false
  const includeProfileFiles = filters.includeProfileFiles !== false
  const includeAvailableAssignees = Boolean(filters.includeAvailableAssignees)

  const applicants = await prisma.applicantProfile.findMany({
    where: buildApplicantAccessWhere(userId, isAdmin),
    orderBy: { updatedAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      visaCases: {
        where: isAdmin ? {} : buildCaseAccessWhere(userId, isAdmin),
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
  })

  const rows = applicants.map(mapApplicantRow)
  const now = Date.now()
  const lastSevenDays = 7 * 24 * 60 * 60 * 1000

  const stats = includeStats
    ? {
        applicantCount: applicants.length,
        activeCaseCount: applicants.reduce(
          (count, item) => count + item.visaCases.filter((caseItem) => caseItem.isActive).length,
          0,
        ),
        exceptionCaseCount: applicants.reduce(
          (count, item) => count + item.visaCases.filter((caseItem) => caseItem.isActive && caseItem.exceptionCode).length,
          0,
        ),
        updatedLast7DaysCount: rows.filter((item) => now - new Date(item.updatedAt).getTime() <= lastSevenDays).length,
      }
    : undefined

  const filteredRows = rows.filter((row) => {
    if (!matchesKeyword(row, keyword)) return false
    if (!matchesArrayFilter(row.visaType, visaTypes)) return false
    if (!matchesArrayFilter(row.currentStatusKey, statuses)) return false
    if (!matchesArrayFilter(row.region, regions)) return false
    if (!matchesArrayFilter(row.priority, priorities)) return false
    return true
  })

  const profiles = includeProfiles
    ? includeProfileFiles
      ? await listApplicantProfiles(userId, role)
      : applicants.map(mapApplicantProfileSummary)
    : []
  const availableAssignees = includeAvailableAssignees && isAdmin
    ? await prisma.user.findMany({
        where: { status: "active" },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, email: true, role: true },
      })
    : []

  const filterOptions = {
    visaTypes: [...CRM_VISA_TYPE_FILTER_VALUES],
    regions: [...CRM_REGION_FILTER_VALUES],
    priorities: [...CRM_PRIORITY_FILTER_VALUES],
    statuses: CRM_STATUS_OPTIONS,
  }

  const selectorCasesByApplicantId = includeSelectorCases
    ? Object.fromEntries(
        applicants.map((item) => [item.id, item.visaCases.map(mapSelectorCase)]),
      )
    : undefined

  return {
    profiles,
    rows: filteredRows,
    stats,
    filterOptions,
    availableAssignees,
    selectorCasesByApplicantId,
  }
}

export async function getApplicantCrmStats(userId: string, role: string | undefined) {
  const isAdmin = await resolveIsAdmin(userId, role)
  const now = Date.now()
  const lastSevenDays = 7 * 24 * 60 * 60 * 1000

  const applicants = await prisma.applicantProfile.findMany({
    where: buildApplicantAccessWhere(userId, isAdmin),
    select: {
      id: true,
      updatedAt: true,
      visaCases: {
        where: isAdmin ? {} : buildCaseAccessWhere(userId, isAdmin),
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        select: {
          isActive: true,
          exceptionCode: true,
          updatedAt: true,
        },
      },
    },
  })

  return {
    applicantCount: applicants.length,
    activeCaseCount: applicants.reduce(
      (count, item) => count + item.visaCases.filter((caseItem) => caseItem.isActive).length,
      0,
    ),
    exceptionCaseCount: applicants.reduce(
      (count, item) => count + item.visaCases.filter((caseItem) => caseItem.isActive && caseItem.exceptionCode).length,
      0,
    ),
    updatedLast7DaysCount: applicants.filter((item) => {
      const updatedAt = getPrimaryStatsCase(item.visaCases)?.updatedAt ?? item.updatedAt
      return now - updatedAt.getTime() <= lastSevenDays
    }).length,
  } satisfies ApplicantCrmStats
}

export async function listApplicantCrmAvailableAssignees(userId: string, role: string | undefined) {
  const isAdmin = await resolveIsAdmin(userId, role)
  if (!isAdmin) return []

  return prisma.user.findMany({
    where: { status: "active" },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  })
}

async function loadCaseRecord(
  userId: string,
  role: string | undefined,
  caseId: string,
) {
  const isAdmin = await resolveIsAdmin(userId, role)
  return prisma.visaCase.findFirst({
    where: {
      id: caseId,
      ...buildCaseAccessWhere(userId, isAdmin),
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true, role: true },
      },
      applicantProfile: {
        select: { id: true, name: true },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      reminderLogs: {
        orderBy: { triggeredAt: "desc" },
        take: 50,
      },
    },
  })
}

export async function getApplicantCrmDetail(userId: string, role: string | undefined, applicantProfileId: string) {
  const [profile, isAdmin] = await Promise.all([
    getApplicantProfile(userId, applicantProfileId, role, {
      includeUsVisaFullIntake: true,
      includeSchengenFullIntake: true,
    }),
    resolveIsAdmin(userId, role),
  ])

  if (!profile) return null

  let hydratedProfile = profile
  const needsUsVisaFallback = Boolean(profile.files.usVisaDs160Excel || profile.files.ds160Excel || profile.files.usVisaAisExcel || profile.files.aisExcel) && !profile.usVisa?.fullIntake
  const needsSchengenFallback = Boolean(profile.files.schengenExcel || profile.files.franceExcel) && !profile.schengen?.fullIntake

  if (needsUsVisaFallback || needsSchengenFallback) {
    const [usVisaIntakeView, schengenIntakeView] = await Promise.all([
      needsUsVisaFallback ? buildApplicantUsVisaIntakeView(userId, applicantProfileId, role) : Promise.resolve(null),
      needsSchengenFallback ? buildApplicantSchengenIntakeView(userId, applicantProfileId, role) : Promise.resolve(null),
    ])

    hydratedProfile = {
      ...profile,
      usVisa: {
        ...(profile.usVisa || {}),
        ...(usVisaIntakeView?.usVisa || {}),
        fullIntake: profile.usVisa?.fullIntake || usVisaIntakeView?.intake || undefined,
      },
      schengen: {
        ...(profile.schengen || {}),
        ...(schengenIntakeView?.schengen || {}),
        fullIntake: profile.schengen?.fullIntake || schengenIntakeView?.intake || undefined,
      },
    }
  }

  const cases = await prisma.visaCase.findMany({
    where: {
      applicantProfileId,
      ...buildCaseAccessWhere(userId, isAdmin),
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true, role: true },
      },
      applicantProfile: {
        select: { id: true, name: true },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      reminderLogs: {
        orderBy: { triggeredAt: "desc" },
        take: 50,
      },
    },
  })

  const availableAssignees = isAdmin
    ? await prisma.user.findMany({
        where: { status: "active" },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, email: true, role: true },
      })
    : []

  return {
    profile: hydratedProfile,
    cases: await Promise.all(cases.map(mapCaseSummaryWithArtifacts)),
    activeCaseId: cases.find((item) => item.isActive)?.id ?? cases[0]?.id ?? null,
    availableAssignees,
  } satisfies ApplicantCrmDetail
}

export async function listVisaCases(
  userId: string,
  role: string | undefined,
  options?: { applicantProfileId?: string },
) {
  const isAdmin = await resolveIsAdmin(userId, role)
  const cases = await prisma.visaCase.findMany({
    where: {
      ...(options?.applicantProfileId ? { applicantProfileId: options.applicantProfileId } : {}),
      ...buildCaseAccessWhere(userId, isAdmin),
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true, role: true },
      },
      applicantProfile: {
        select: { id: true, name: true },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      reminderLogs: {
        orderBy: { triggeredAt: "desc" },
        take: 50,
      },
    },
  })

  return cases.map(mapCaseSummary)
}

async function normalizeAssigneeForSave(
  userId: string,
  role: string | undefined,
  assignedToUserId: string | null | undefined,
) {
  const isAdmin = await resolveIsAdmin(userId, role)
  if (!assignedToUserId) {
    return isAdmin ? null : userId
  }
  if (!isAdmin && assignedToUserId !== userId) {
    return userId
  }

  const assignee = await prisma.user.findUnique({
    where: { id: assignedToUserId },
    select: { id: true, role: true },
  })
  if (!assignee) return isAdmin ? null : userId
  return assignee.id
}

export async function createVisaCaseForApplicant(
  userId: string,
  role: string | undefined,
  input: VisaCaseInput,
) {
  const isAdmin = await resolveIsAdmin(userId, role)
  const applicant = await prisma.applicantProfile.findFirst({
    where: {
      id: input.applicantProfileId,
      ...buildApplicantAccessWhere(userId, isAdmin),
    },
    select: { id: true, userId: true },
  })

  if (!applicant) return null

  const caseType = normalizeText(input.caseType) || FRANCE_CASE_TYPE
  const assignedToUserId = await normalizeAssigneeForSave(userId, role, normalizeOptionalText(input.assignedToUserId))
  const assignedRole = assignedToUserId
    ? (
        await prisma.user.findUnique({
          where: { id: assignedToUserId },
          select: { role: true },
        })
      )?.role ?? null
    : null
  const isActive = input.isActive ?? true
  const now = new Date()

  const created = await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.visaCase.updateMany({
        where: {
          applicantProfileId: applicant.id,
          caseType,
          isActive: true,
        },
        data: { isActive: false },
      })
    }

    let mainStatus: string
    let subStatus: string | null
    if (caseType === FRANCE_CASE_TYPE) {
      mainStatus = DEFAULT_FRANCE_CASE_MAIN_STATUS
      subStatus = DEFAULT_FRANCE_CASE_SUB_STATUS
    } else if (caseType === USA_CASE_TYPE) {
      mainStatus = DEFAULT_USA_CASE_MAIN_STATUS
      subStatus = DEFAULT_USA_CASE_SUB_STATUS
    } else {
      mainStatus = "PENDING_PAYMENT"
      subStatus = null
    }

    const visaCase = await tx.visaCase.create({
      data: {
        userId: applicant.userId,
        applicantProfileId: applicant.id,
        caseType,
        visaType: normalizeOptionalText(input.visaType),
        applyRegion: normalizeOptionalText(input.applyRegion),
        tlsCity: normalizeOptionalText(input.tlsCity),
        bookingWindow: normalizeOptionalText(input.bookingWindow),
        acceptVip: normalizeOptionalText(input.acceptVip),
        slotTime: parseDateValue(input.slotTime ?? null),
        mainStatus,
        subStatus,
        priority: normalizePriority(input.priority),
        travelDate: parseDateValue(input.travelDate ?? null),
        submissionDate: parseDateValue(input.submissionDate ?? null),
        assignedToUserId,
        assignedRole,
        isActive,
        nextActionAt: null,
      },
    })

    await tx.visaCaseStatusHistory.create({
      data: {
        caseId: visaCase.id,
        toMainStatus: visaCase.mainStatus,
        toSubStatus: visaCase.subStatus,
        operatorType: "user",
        operatorId: userId,
        reason: "Case created",
        createdAt: now,
      },
    })

    return visaCase.id
  })

  return getVisaCaseDetail(userId, role, created)
}

export async function getVisaCaseDetail(userId: string, role: string | undefined, caseId: string) {
  const visaCase = await loadCaseRecord(userId, role, caseId)
  return visaCase ? mapCaseSummaryWithArtifacts(visaCase) : null
}

function sanitizeArtifactFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function getVisaCaseArtifactDir(visaCase: Pick<VisaCaseRecord, "userId" | "applicantProfileId" | "id">) {
  return path.join(
    process.cwd(),
    "storage",
    "applicant-profiles",
    visaCase.userId,
    visaCase.applicantProfileId,
    "cases",
    visaCase.id,
  )
}

function getVisaCaseDs160PrecheckPaths(visaCase: Pick<VisaCaseRecord, "userId" | "applicantProfileId" | "id">) {
  const dir = getVisaCaseArtifactDir(visaCase)
  return {
    dir,
    dataPath: path.join(dir, "ds160-precheck.json"),
    metaPath: path.join(dir, "ds160-precheck.meta.json"),
  }
}

async function readVisaCaseDs160PrecheckMeta(visaCase: Pick<VisaCaseRecord, "userId" | "applicantProfileId" | "id">) {
  const { metaPath, dataPath } = getVisaCaseDs160PrecheckPaths(visaCase)
  try {
    const [metaRaw, stat] = await Promise.all([fs.readFile(metaPath, "utf-8"), fs.stat(dataPath)])
    const meta = JSON.parse(metaRaw) as { originalName?: string; mimeType?: string; uploadedAt?: string }
    return {
      originalName: meta.originalName || `ds160-precheck-${visaCase.id}.json`,
      mimeType: meta.mimeType || "application/json",
      uploadedAt: meta.uploadedAt || stat.mtime.toISOString(),
      absolutePath: dataPath,
    }
  } catch {
    return null
  }
}

async function mapCaseSummaryWithArtifacts(caseRecord: VisaCaseRecord): Promise<ApplicantCaseSummary> {
  const summary = mapCaseSummary(caseRecord)
  const precheckMeta = await readVisaCaseDs160PrecheckMeta(caseRecord)
  if (!precheckMeta) return summary

  return {
    ...summary,
    ds160PrecheckFile: {
      originalName: precheckMeta.originalName,
      uploadedAt: precheckMeta.uploadedAt,
    },
  }
}

export async function saveVisaCaseDs160PrecheckFile(params: {
  userId: string
  role?: string
  caseId: string
  buffer: Buffer
  originalName: string
  mimeType?: string
}) {
  const { userId, role, caseId, buffer, originalName, mimeType } = params
  const visaCase = await loadCaseRecord(userId, role, caseId)
  if (!visaCase) return null

  const caseDir = getVisaCaseArtifactDir(visaCase)
  await fs.mkdir(caseDir, { recursive: true })

  const { dataPath, metaPath } = getVisaCaseDs160PrecheckPaths(visaCase)
  await fs.writeFile(dataPath, buffer)
  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        originalName: sanitizeArtifactFilename(originalName || `ds160-precheck-${caseId}.json`),
        mimeType: mimeType || "application/json",
        uploadedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf-8",
  )

  return getVisaCaseDetail(userId, role, caseId)
}

export async function getVisaCaseDs160PrecheckFile(userId: string, role: string | undefined, caseId: string) {
  const visaCase = await loadCaseRecord(userId, role, caseId)
  if (!visaCase) return null

  const file = await readVisaCaseDs160PrecheckMeta(visaCase)
  if (!file) return null

  return {
    absolutePath: file.absolutePath,
    meta: {
      originalName: file.originalName,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt,
    },
  }
}

export async function updateVisaCaseBasics(
  userId: string,
  role: string | undefined,
  caseId: string,
  patch: VisaCasePatch,
) {
  const currentCase = await loadCaseRecord(userId, role, caseId)
  if (!currentCase) return null

  const assignedToUserId = await normalizeAssigneeForSave(
    userId,
    role,
    patch.assignedToUserId === undefined ? currentCase.assignedToUserId : patch.assignedToUserId,
  )
  const assignedRole = assignedToUserId
    ? (
        await prisma.user.findUnique({
          where: { id: assignedToUserId },
          select: { role: true },
        })
      )?.role ?? null
    : null

  await prisma.$transaction(async (tx) => {
    if (patch.isActive) {
      await tx.visaCase.updateMany({
        where: {
          applicantProfileId: currentCase.applicantProfileId,
          caseType: currentCase.caseType,
          isActive: true,
          id: { not: currentCase.id },
        },
        data: { isActive: false },
      })
    }

    await tx.visaCase.update({
      where: { id: currentCase.id },
      data: {
        visaType:
          patch.visaType === undefined ? currentCase.visaType : normalizeOptionalText(patch.visaType),
        applyRegion:
          patch.applyRegion === undefined ? currentCase.applyRegion : normalizeOptionalText(patch.applyRegion),
        tlsCity:
          patch.tlsCity === undefined ? currentCase.tlsCity : normalizeOptionalText(patch.tlsCity),
        bookingWindow:
          patch.bookingWindow === undefined ? currentCase.bookingWindow : normalizeOptionalText(patch.bookingWindow),
        acceptVip:
          patch.acceptVip === undefined ? currentCase.acceptVip : normalizeOptionalText(patch.acceptVip),
        slotTime:
          patch.slotTime === undefined
            ? currentCase.slotTime
            : currentCase.caseType === USA_CASE_TYPE
              ? parseDateValueForUsaPatch(patch.slotTime, currentCase.slotTime)
              : parseDateValue(patch.slotTime),
        priority:
          patch.priority === undefined ? currentCase.priority : normalizePriority(patch.priority),
        travelDate:
          patch.travelDate === undefined
            ? currentCase.travelDate
            : currentCase.caseType === USA_CASE_TYPE
              ? parseDateValueForUsaPatch(patch.travelDate, currentCase.travelDate)
              : parseDateValue(patch.travelDate),
        submissionDate:
          patch.submissionDate === undefined
            ? currentCase.submissionDate
            : currentCase.caseType === USA_CASE_TYPE
              ? parseDateValueForUsaPatch(patch.submissionDate, currentCase.submissionDate)
              : parseDateValue(patch.submissionDate),
        assignedToUserId,
        assignedRole,
        isActive: patch.isActive === undefined ? currentCase.isActive : patch.isActive,
      },
    })
  })

  return getVisaCaseDetail(userId, role, currentCase.id)
}

export async function updateVisaCaseStatusById(
  userId: string,
  role: string | undefined,
  caseId: string,
  input: {
    mainStatus: string
    subStatus?: string | null
    exceptionCode?: string | null
    clearException?: boolean
    reason?: string
    allowRegression?: boolean
  },
) {
  const currentCase = await loadCaseRecord(userId, role, caseId)
  if (!currentCase) return null

  if (currentCase.caseType === FRANCE_CASE_TYPE) {
    if (!currentCase.isActive) {
      await updateVisaCaseBasics(userId, role, caseId, { isActive: true })
    }

    if (!isFranceMainStatus(input.mainStatus)) {
      throw new Error("France case status is invalid")
    }

    const updated = await advanceFranceCase({
      userId: currentCase.userId,
      applicantProfileId: currentCase.applicantProfileId,
      mainStatus: input.mainStatus as FranceMainStatus,
      subStatus:
        input.subStatus === undefined || input.subStatus === null
          ? input.subStatus ?? null
          : isFranceSubStatus(input.subStatus)
            ? (input.subStatus as FranceSubStatus)
            : null,
      exceptionCode:
        input.exceptionCode === undefined || input.exceptionCode === null
          ? input.exceptionCode ?? null
          : (input.exceptionCode as FranceExceptionCode),
      clearException: input.clearException,
      reason: input.reason,
      operatorType: "user",
      operatorId: userId,
      allowRegression: input.allowRegression,
    })

    return updated ? getVisaCaseDetail(userId, role, updated.id) : null
  } else if (currentCase.caseType === USA_CASE_TYPE) {
    if (!currentCase.isActive) {
      await updateVisaCaseBasics(userId, role, caseId, { isActive: true })
    }

    if (!isUsaMainStatus(input.mainStatus)) {
      throw new Error("USA case status is invalid")
    }

    const updated = await advanceUsaCase({
      userId: currentCase.userId,
      applicantProfileId: currentCase.applicantProfileId,
      mainStatus: input.mainStatus as UsaMainStatus,
      subStatus:
        input.subStatus === undefined || input.subStatus === null
          ? input.subStatus ?? null
          : isUsaSubStatus(input.subStatus)
            ? (input.subStatus as UsaSubStatus)
            : null,
      exceptionCode:
        input.exceptionCode === undefined || input.exceptionCode === null
          ? input.exceptionCode ?? null
          : (input.exceptionCode as UsaExceptionCode),
      clearException: input.clearException,
      reason: input.reason,
      operatorType: "user",
      operatorId: userId,
      allowRegression: input.allowRegression,
    })

    return updated ? getVisaCaseDetail(userId, role, updated.id) : null
  }

  const nextMainStatus = normalizeText(input.mainStatus) || currentCase.mainStatus
  const nextSubStatus =
    input.subStatus === undefined ? currentCase.subStatus : normalizeOptionalText(input.subStatus)
  const nextExceptionCode =
    input.clearException ? null : input.exceptionCode === undefined ? currentCase.exceptionCode : normalizeOptionalText(input.exceptionCode)

  await prisma.$transaction(async (tx) => {
    await tx.visaCase.update({
      where: { id: currentCase.id },
      data: {
        mainStatus: nextMainStatus,
        subStatus: nextSubStatus,
        exceptionCode: nextExceptionCode,
      },
    })

    await tx.visaCaseStatusHistory.create({
      data: {
        caseId: currentCase.id,
        fromMainStatus: currentCase.mainStatus,
        fromSubStatus: currentCase.subStatus,
        toMainStatus: nextMainStatus,
        toSubStatus: nextSubStatus,
        exceptionCode: nextExceptionCode,
        reason: input.reason ?? "Case status updated",
        operatorType: "user",
        operatorId: userId,
      },
    })
  })

  return getVisaCaseDetail(userId, role, currentCase.id)
}

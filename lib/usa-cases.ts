import { Prisma } from "@prisma/client"

import prisma from "@/lib/db"
import {
  compareUsaMainStatus,
  DEFAULT_USA_CASE_MAIN_STATUS,
  DEFAULT_USA_CASE_SUB_STATUS,
  DEFAULT_USA_REMINDER_RULES,
  USA_CASE_TYPE,
  UsaExceptionCode,
  UsaMainStatus,
  UsaSubStatus,
  isUsaMainStatus,
  isUsaSubStatus,
} from "@/lib/usa-case-machine"

type PrismaTx = Prisma.TransactionClient

type VisaCaseWithRelations = Prisma.VisaCaseGetPayload<{
  include: {
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

export interface UsaCaseStatusInput {
  userId: string
  applicantProfileId: string
  mainStatus: UsaMainStatus
  subStatus?: UsaSubStatus | null
  exceptionCode?: UsaExceptionCode | null
  clearException?: boolean
  reason?: string
  operatorType?: string
  operatorId?: string | null
  allowRegression?: boolean
}

let reminderRulesSeeded = false

function jsonOrDbNull(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.DbNull
}

function createReminderTriggerAt(base: Date, delayMinutes: number) {
  return new Date(base.getTime() + Math.max(0, delayMinutes) * 60_000)
}

function buildTimestampPatch(
  currentCase: {
    paymentConfirmedAt: Date | null
    formSubmittedAt: Date | null
    docsReadyAt: Date | null
    slotBookedAt: Date | null
    submittedAt: Date | null
    completedAt: Date | null
    closedAt: Date | null
  },
  mainStatus: UsaMainStatus,
  subStatus: string | null | undefined,
  now: Date,
) {
  const patch: {
    paymentConfirmedAt?: Date
    formSubmittedAt?: Date
    docsReadyAt?: Date
    slotBookedAt?: Date
    submittedAt?: Date
    completedAt?: Date
    closedAt?: Date
  } = {}

  if (!currentCase.paymentConfirmedAt && compareUsaMainStatus(mainStatus, "ONBOARDED") >= 0) {
    patch.paymentConfirmedAt = now
  }
  if (
    !currentCase.formSubmittedAt &&
    (compareUsaMainStatus(mainStatus, "REVIEWING") >= 0 || subStatus === "FORM_RECEIVED")
  ) {
    patch.formSubmittedAt = now
  }
  if (!currentCase.docsReadyAt && compareUsaMainStatus(mainStatus, "DOCS_READY") >= 0) {
    patch.docsReadyAt = now
  }
  if (!currentCase.slotBookedAt && compareUsaMainStatus(mainStatus, "SLOT_BOOKED") >= 0) {
    patch.slotBookedAt = now
  }
  if (!currentCase.submittedAt && compareUsaMainStatus(mainStatus, "SUBMITTED") >= 0) {
    patch.submittedAt = now
  }
  if (!currentCase.completedAt && compareUsaMainStatus(mainStatus, "COMPLETED") >= 0) {
    patch.completedAt = now
  }
  if (!currentCase.closedAt && mainStatus === "COMPLETED" && subStatus === "SERVICE_CLOSED") {
    patch.closedAt = now
  }

  return patch
}

function shouldQueueRuleForState(
  rule: {
    mainStatus: string | null
    subStatus: string | null
    exceptionCode: string | null
  },
  state: {
    mainStatus: string
    subStatus: string | null
    exceptionCode: string | null
  },
) {
  if (rule.mainStatus && rule.mainStatus !== state.mainStatus) return false
  if (rule.subStatus && rule.subStatus !== state.subStatus) return false
  if (rule.exceptionCode && rule.exceptionCode !== state.exceptionCode) return false
  return true
}

async function queueReminderLogsForState(
  tx: PrismaTx,
  visaCase: {
    id: string
    userId: string
    caseType: string
    mainStatus: string
    subStatus: string | null
    exceptionCode: string | null
  },
  now: Date,
) {
  const rules = await tx.reminderRule.findMany({
    where: { enabled: true, caseType: visaCase.caseType },
  })

  const matchedRules = rules.filter(
    (rule) => shouldQueueRuleForState(rule, visaCase) && rule.triggerType !== "date_offset",
  )
  if (matchedRules.length === 0) return

  await Promise.all(
    matchedRules.map((rule) =>
      tx.reminderLog.create({
        data: {
          caseId: visaCase.id,
          ruleId: rule.id,
          userId: visaCase.userId,
          ruleCode: rule.ruleCode,
          channel: rule.channels.join(","),
          automationMode: rule.automationMode,
          severity: rule.severity,
          templateCode: rule.templateCode,
          sendStatus: "pending",
          triggeredAt: createReminderTriggerAt(now, rule.delayMinutes ?? 0),
        },
      }),
    ),
  )
}

async function createInitialCase(
  tx: PrismaTx,
  input: UsaCaseStatusInput,
  now: Date,
) {
  const createdCase = await tx.visaCase.create({
    data: {
      userId: input.userId,
      applicantProfileId: input.applicantProfileId,
      caseType: USA_CASE_TYPE,
      mainStatus: input.mainStatus,
      subStatus: input.subStatus ?? null,
      exceptionCode: input.clearException ? null : input.exceptionCode ?? null,
      priority: "normal",
      isActive: true,
      ...buildTimestampPatch(
        {
          paymentConfirmedAt: null,
          formSubmittedAt: null,
          docsReadyAt: null,
          slotBookedAt: null,
          submittedAt: null,
          completedAt: null,
          closedAt: null,
        },
        input.mainStatus,
        input.subStatus ?? null,
        now,
      ),
    },
  })

  await tx.visaCaseStatusHistory.create({
    data: {
      caseId: createdCase.id,
      toMainStatus: input.mainStatus,
      toSubStatus: input.subStatus ?? null,
      exceptionCode: input.clearException ? null : input.exceptionCode ?? null,
      reason: input.reason,
      operatorType: input.operatorType ?? "system",
      operatorId: input.operatorId ?? null,
    },
  })

  await queueReminderLogsForState(
    tx,
    {
      id: createdCase.id,
      userId: createdCase.userId,
      caseType: createdCase.caseType,
      mainStatus: createdCase.mainStatus,
      subStatus: createdCase.subStatus,
      exceptionCode: createdCase.exceptionCode,
    },
    now,
  )

  return createdCase
}

async function loadCaseWithRelations(tx: PrismaTx, caseId: string) {
  return tx.visaCase.findUnique({
    where: { id: caseId },
    include: {
      statusHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      reminderLogs: { orderBy: { triggeredAt: "desc" }, take: 50 },
    },
  })
}

export async function ensureDefaultUsaReminderRules() {
  if (reminderRulesSeeded) return

  await Promise.all(
    DEFAULT_USA_REMINDER_RULES.map((rule) =>
      prisma.reminderRule.upsert({
        where: { ruleCode: rule.ruleCode },
        update: {
          name: rule.name,
          enabled: rule.enabled ?? true,
          caseType: rule.caseType ?? USA_CASE_TYPE,
          mainStatus: rule.mainStatus ?? null,
          subStatus: rule.subStatus ?? null,
          exceptionCode: rule.exceptionCode ?? null,
          triggerType: rule.triggerType,
          triggerValue: jsonOrDbNull(rule.triggerValue),
          delayMinutes: rule.delayMinutes ?? 0,
          channels: rule.channels,
          automationMode: rule.automationMode,
          severity: rule.severity,
          templateCode: rule.templateCode,
          cooldownMinutes: rule.cooldownMinutes ?? 0,
          stopCondition: jsonOrDbNull(rule.stopCondition),
        },
        create: {
          ruleCode: rule.ruleCode,
          name: rule.name,
          enabled: rule.enabled ?? true,
          caseType: rule.caseType ?? USA_CASE_TYPE,
          mainStatus: rule.mainStatus ?? null,
          subStatus: rule.subStatus ?? null,
          exceptionCode: rule.exceptionCode ?? null,
          triggerType: rule.triggerType,
          triggerValue: jsonOrDbNull(rule.triggerValue),
          delayMinutes: rule.delayMinutes ?? 0,
          channels: rule.channels,
          automationMode: rule.automationMode,
          severity: rule.severity,
          templateCode: rule.templateCode,
          cooldownMinutes: rule.cooldownMinutes ?? 0,
          stopCondition: jsonOrDbNull(rule.stopCondition),
        },
      }),
    ),
  )

  reminderRulesSeeded = true
}

export async function getOrCreateActiveUsaCase(userId: string, applicantProfileId: string) {
  await ensureDefaultUsaReminderRules()

  return prisma.$transaction(async (tx) => {
    const existingCase = await tx.visaCase.findFirst({
      where: {
        userId,
        applicantProfileId,
        caseType: USA_CASE_TYPE,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    })

    if (!existingCase) {
      const now = new Date()
      const createdCase = await createInitialCase(
        tx,
        {
          userId,
          applicantProfileId,
          mainStatus: DEFAULT_USA_CASE_MAIN_STATUS,
          subStatus: DEFAULT_USA_CASE_SUB_STATUS,
          operatorType: "system",
          reason: "Initialized USA case",
        },
        now,
      )
      return loadCaseWithRelations(tx, createdCase.id)
    }

    return loadCaseWithRelations(tx, existingCase.id)
  })
}

export async function advanceUsaCase(input: UsaCaseStatusInput): Promise<VisaCaseWithRelations | null> {
  await ensureDefaultUsaReminderRules()

  return prisma.$transaction(async (tx) => {
    const currentCase = await tx.visaCase.findFirst({
      where: {
        userId: input.userId,
        applicantProfileId: input.applicantProfileId,
        caseType: USA_CASE_TYPE,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    })

    const now = new Date()
    if (!currentCase) {
      const createdCase = await createInitialCase(tx, input, now)
      return loadCaseWithRelations(tx, createdCase.id)
    }

    const currentMainStatus = isUsaMainStatus(currentCase.mainStatus)
      ? currentCase.mainStatus
      : DEFAULT_USA_CASE_MAIN_STATUS
    const targetMainStatus = input.mainStatus

    let nextMainStatus = currentMainStatus
    let nextSubStatus = currentCase.subStatus

    const statusComparison = compareUsaMainStatus(targetMainStatus, currentMainStatus)
    if (statusComparison > 0 || (statusComparison === 0 && input.subStatus !== undefined)) {
      nextMainStatus = targetMainStatus
      nextSubStatus = input.subStatus ?? null
    } else if (statusComparison < 0 && input.allowRegression) {
      nextMainStatus = targetMainStatus
      nextSubStatus = input.subStatus ?? null
    }

    const nextExceptionCode = input.clearException
      ? null
      : input.exceptionCode !== undefined
        ? input.exceptionCode
        : currentCase.exceptionCode

    const hasStatusChange =
      nextMainStatus !== currentCase.mainStatus ||
      nextSubStatus !== currentCase.subStatus ||
      nextExceptionCode !== currentCase.exceptionCode

    if (!hasStatusChange) {
      return loadCaseWithRelations(tx, currentCase.id)
    }

    await tx.visaCase.update({
      where: { id: currentCase.id },
      data: {
        mainStatus: nextMainStatus,
        subStatus: nextSubStatus,
        exceptionCode: nextExceptionCode,
        ...buildTimestampPatch(currentCase, nextMainStatus, nextSubStatus, now),
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
        reason: input.reason,
        operatorType: input.operatorType ?? "system",
        operatorId: input.operatorId ?? null,
      },
    })

    await queueReminderLogsForState(
      tx,
      {
        id: currentCase.id,
        userId: currentCase.userId,
        caseType: currentCase.caseType,
        mainStatus: nextMainStatus,
        subStatus: nextSubStatus,
        exceptionCode: nextExceptionCode,
      },
      now,
    )

    return loadCaseWithRelations(tx, currentCase.id)
  })
}

export async function setUsaCaseException(input: {
  userId: string
  applicantProfileId: string
  exceptionCode: UsaExceptionCode
  reason?: string
  mainStatus?: UsaMainStatus
  subStatus?: UsaSubStatus | null
}) {
  const activeCase = await getOrCreateActiveUsaCase(input.userId, input.applicantProfileId)
  const currentMainStatus =
    activeCase && isUsaMainStatus(activeCase.mainStatus)
      ? activeCase.mainStatus
      : input.mainStatus ?? DEFAULT_USA_CASE_MAIN_STATUS
  const currentSubStatus: UsaSubStatus | null =
    activeCase && isUsaSubStatus(activeCase.subStatus ?? undefined)
      ? (activeCase.subStatus as UsaSubStatus)
      : input.subStatus ?? null

  return advanceUsaCase({
    userId: input.userId,
    applicantProfileId: input.applicantProfileId,
    mainStatus: input.mainStatus ?? currentMainStatus,
    subStatus: input.subStatus !== undefined ? input.subStatus : currentSubStatus,
    exceptionCode: input.exceptionCode,
    reason: input.reason,
  })
}

export async function clearUsaCaseException(userId: string, applicantProfileId: string, reason?: string) {
  const activeCase = await getOrCreateActiveUsaCase(userId, applicantProfileId)
  if (!activeCase || !isUsaMainStatus(activeCase.mainStatus)) return activeCase

  return advanceUsaCase({
    userId,
    applicantProfileId,
    mainStatus: activeCase.mainStatus,
    subStatus: isUsaSubStatus(activeCase.subStatus ?? undefined)
      ? (activeCase.subStatus as UsaSubStatus)
      : null,
    clearException: true,
    reason,
  })
}

export async function getUsaCaseByApplicant(userId: string, applicantProfileId: string) {
  await ensureDefaultUsaReminderRules()
  return prisma.visaCase.findFirst({
    where: {
      userId,
      applicantProfileId,
      caseType: USA_CASE_TYPE,
      isActive: true,
    },
    include: {
      statusHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      reminderLogs: { orderBy: { triggeredAt: "desc" }, take: 50 },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function listUsaCaseHistory(caseId: string) {
  return prisma.visaCaseStatusHistory.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  })
}

export async function listUsaReminderRules() {
  await ensureDefaultUsaReminderRules()
  return prisma.reminderRule.findMany({
    where: { caseType: USA_CASE_TYPE },
    orderBy: [{ mainStatus: "asc" }, { delayMinutes: "asc" }, { ruleCode: "asc" }],
  })
}

export interface UsaAdminCaseFilters {
  search?: string
  mainStatus?: string
  exceptionCode?: string
  limit?: number
}

export interface UsaAdminReminderFilters {
  search?: string
  mainStatus?: string
  sendStatus?: string
  severity?: string
  automationMode?: string
  channel?: string
  limit?: number
}

export async function listUsaCasesForAdmin(filters: UsaAdminCaseFilters = {}) {
  await ensureDefaultUsaReminderRules()

  const where: Prisma.VisaCaseWhereInput = {
    caseType: USA_CASE_TYPE,
    isActive: true,
  }

  if (filters.mainStatus && filters.mainStatus !== "all") {
    where.mainStatus = filters.mainStatus
  }

  if (filters.exceptionCode === "with_exception") {
    where.exceptionCode = { not: null }
  } else if (filters.exceptionCode === "none") {
    where.exceptionCode = null
  } else if (filters.exceptionCode && filters.exceptionCode !== "all") {
    where.exceptionCode = filters.exceptionCode
  }

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { applicantProfile: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { mainStatus: { contains: search, mode: "insensitive" } },
      { subStatus: { contains: search, mode: "insensitive" } },
    ]
  }

  const now = new Date()
  const rows = await prisma.visaCase.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(filters.limit ?? 50, 200),
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      applicantProfile: {
        select: { id: true, name: true },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      reminderLogs: {
        where: { sendStatus: "pending" },
        orderBy: { triggeredAt: "asc" },
        take: 20,
      },
    },
  })

  return rows.map((item) => {
    const dueReminderCount = item.reminderLogs.filter((log) => log.triggeredAt <= now).length

    return {
      ...item,
      pendingReminderCount: item.reminderLogs.length,
      dueReminderCount,
      nextReminderAt: item.reminderLogs[0]?.triggeredAt ?? null,
      latestHistory: item.statusHistory[0] ?? null,
    }
  })
}

export async function listUsaReminderLogsForAdmin(filters: UsaAdminReminderFilters = {}) {
  await ensureDefaultUsaReminderRules()

  const visaCaseWhere: Prisma.VisaCaseWhereInput = {
    caseType: USA_CASE_TYPE,
    isActive: true,
  }

  if (filters.mainStatus && filters.mainStatus !== "all") {
    visaCaseWhere.mainStatus = filters.mainStatus
  }

  const where: Prisma.ReminderLogWhereInput = {
    visaCase: visaCaseWhere,
  }

  if (filters.sendStatus && filters.sendStatus !== "all") {
    where.sendStatus = filters.sendStatus
  }

  if (filters.severity && filters.severity !== "all") {
    where.severity = filters.severity
  }

  if (filters.automationMode && filters.automationMode !== "all") {
    where.automationMode = filters.automationMode
  }

  if (filters.channel && filters.channel !== "all") {
    where.channel = { contains: filters.channel }
  }

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { ruleCode: { contains: search, mode: "insensitive" } },
      { templateCode: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { visaCase: { applicantProfile: { name: { contains: search, mode: "insensitive" } } } },
    ]
  }

  const orderBy =
    !filters.sendStatus || filters.sendStatus === "all" || filters.sendStatus === "pending"
      ? [{ triggeredAt: "asc" as const }]
      : [{ triggeredAt: "desc" as const }]

  const now = new Date()
  const rows = await prisma.reminderLog.findMany({
    where,
    orderBy,
    take: Math.min(filters.limit ?? 100, 300),
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      visaCase: {
        select: {
          id: true,
          mainStatus: true,
          subStatus: true,
          exceptionCode: true,
          applicantProfile: {
            select: { id: true, name: true },
          },
        },
      },
      rule: {
        select: {
          id: true,
          name: true,
          delayMinutes: true,
          channels: true,
        },
      },
    },
  })

  return rows.map((item) => ({
    ...item,
    isDue: item.sendStatus === "pending" && item.triggeredAt <= now,
  }))
}

export async function getUsaReminderAdminSummary() {
  await ensureDefaultUsaReminderRules()

  const now = new Date()
  const caseWhere: Prisma.VisaCaseWhereInput = {
    caseType: USA_CASE_TYPE,
    isActive: true,
  }
  const reminderWhere: Prisma.ReminderLogWhereInput = {
    visaCase: caseWhere,
  }

  const [activeCaseCount, exceptionCaseCount, pendingReminderCount, dueReminderCount, urgentReminderCount] =
    await Promise.all([
      prisma.visaCase.count({ where: caseWhere }),
      prisma.visaCase.count({ where: { ...caseWhere, exceptionCode: { not: null } } }),
      prisma.reminderLog.count({ where: { ...reminderWhere, sendStatus: "pending" } }),
      prisma.reminderLog.count({
        where: {
          ...reminderWhere,
          sendStatus: "pending",
          triggeredAt: { lte: now },
        },
      }),
      prisma.reminderLog.count({
        where: {
          ...reminderWhere,
          sendStatus: "pending",
          severity: "URGENT",
        },
      }),
    ])

  return {
    activeCaseCount,
    exceptionCaseCount,
    pendingReminderCount,
    dueReminderCount,
    urgentReminderCount,
  }
}

export async function updateUsaReminderLogStatus(input: {
  logId: string
  sendStatus: string
  errorMessage?: string | null
  renderedContent?: string | null
}) {
  const sendStatus = input.sendStatus.trim().toLowerCase()
  const sentAt = sendStatus === "sent" ? new Date() : null

  return prisma.reminderLog.update({
    where: { id: input.logId },
    data: {
      sendStatus,
      errorMessage: input.errorMessage ?? null,
      renderedContent: input.renderedContent ?? undefined,
      sentAt,
    },
    include: {
      rule: {
        select: { id: true, ruleCode: true, name: true, channels: true },
      },
      visaCase: {
        select: {
          id: true,
          mainStatus: true,
          subStatus: true,
          applicantProfile: {
            select: { id: true, name: true },
          },
        },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  })
}

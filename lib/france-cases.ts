import { Prisma } from "@prisma/client"

import prisma from "@/lib/db"
import {
  compareFranceMainStatus,
  DEFAULT_FRANCE_CASE_MAIN_STATUS,
  DEFAULT_FRANCE_CASE_SUB_STATUS,
  DEFAULT_FRANCE_REMINDER_RULES,
  FRANCE_CASE_TYPE,
  FranceExceptionCode,
  FranceMainStatus,
  FranceSubStatus,
  isFranceMainStatus,
  isFranceSubStatus,
} from "@/lib/france-case-machine"

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

export interface FranceCaseStatusInput {
  userId: string
  applicantProfileId: string
  mainStatus: FranceMainStatus
  subStatus?: FranceSubStatus | null
  exceptionCode?: FranceExceptionCode | null
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
  mainStatus: FranceMainStatus,
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

  if (!currentCase.paymentConfirmedAt && compareFranceMainStatus(mainStatus, "ONBOARDED") >= 0) {
    patch.paymentConfirmedAt = now
  }
  if (
    !currentCase.formSubmittedAt &&
    (compareFranceMainStatus(mainStatus, "REVIEWING") >= 0 || subStatus === "FORM_RECEIVED")
  ) {
    patch.formSubmittedAt = now
  }
  if (!currentCase.docsReadyAt && compareFranceMainStatus(mainStatus, "DOCS_READY") >= 0) {
    patch.docsReadyAt = now
  }
  if (!currentCase.slotBookedAt && compareFranceMainStatus(mainStatus, "SLOT_BOOKED") >= 0) {
    patch.slotBookedAt = now
  }
  if (!currentCase.submittedAt && compareFranceMainStatus(mainStatus, "SUBMITTED") >= 0) {
    patch.submittedAt = now
  }
  if (!currentCase.completedAt && compareFranceMainStatus(mainStatus, "COMPLETED") >= 0) {
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
          triggeredAt: createReminderTriggerAt(now, rule.delayMinutes),
        },
      }),
    ),
  )
}

async function createInitialCase(
  tx: PrismaTx,
  input: FranceCaseStatusInput,
  now: Date,
) {
  const createdCase = await tx.visaCase.create({
    data: {
      userId: input.userId,
      applicantProfileId: input.applicantProfileId,
      caseType: FRANCE_CASE_TYPE,
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

export async function ensureDefaultFranceReminderRules() {
  if (reminderRulesSeeded) return

  await Promise.all(
    DEFAULT_FRANCE_REMINDER_RULES.map((rule) =>
      prisma.reminderRule.upsert({
        where: { ruleCode: rule.ruleCode },
        update: {
          name: rule.name,
          enabled: rule.enabled ?? true,
          caseType: rule.caseType ?? FRANCE_CASE_TYPE,
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
          caseType: rule.caseType ?? FRANCE_CASE_TYPE,
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

export async function getOrCreateActiveFranceCase(userId: string, applicantProfileId: string) {
  await ensureDefaultFranceReminderRules()

  return prisma.$transaction(async (tx) => {
    const existingCase = await tx.visaCase.findFirst({
      where: {
        userId,
        applicantProfileId,
        caseType: FRANCE_CASE_TYPE,
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
          mainStatus: DEFAULT_FRANCE_CASE_MAIN_STATUS,
          subStatus: DEFAULT_FRANCE_CASE_SUB_STATUS,
          operatorType: "system",
          reason: "Initialized France case",
        },
        now,
      )
      return loadCaseWithRelations(tx, createdCase.id)
    }

    return loadCaseWithRelations(tx, existingCase.id)
  })
}

export async function advanceFranceCase(input: FranceCaseStatusInput): Promise<VisaCaseWithRelations | null> {
  await ensureDefaultFranceReminderRules()

  return prisma.$transaction(async (tx) => {
    const currentCase = await tx.visaCase.findFirst({
      where: {
        userId: input.userId,
        applicantProfileId: input.applicantProfileId,
        caseType: FRANCE_CASE_TYPE,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    })

    const now = new Date()
    if (!currentCase) {
      const createdCase = await createInitialCase(tx, input, now)
      return loadCaseWithRelations(tx, createdCase.id)
    }

    const currentMainStatus = isFranceMainStatus(currentCase.mainStatus)
      ? currentCase.mainStatus
      : DEFAULT_FRANCE_CASE_MAIN_STATUS
    const targetMainStatus = input.mainStatus

    let nextMainStatus = currentMainStatus
    let nextSubStatus = currentCase.subStatus

    const statusComparison = compareFranceMainStatus(targetMainStatus, currentMainStatus)
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

export async function setFranceCaseException(input: {
  userId: string
  applicantProfileId: string
  exceptionCode: FranceExceptionCode
  reason?: string
  mainStatus?: FranceMainStatus
  subStatus?: FranceSubStatus | null
}) {
  const activeCase = await getOrCreateActiveFranceCase(input.userId, input.applicantProfileId)
  const currentMainStatus =
    activeCase && isFranceMainStatus(activeCase.mainStatus)
      ? activeCase.mainStatus
      : input.mainStatus ?? DEFAULT_FRANCE_CASE_MAIN_STATUS
  const currentSubStatus: FranceSubStatus | null =
    activeCase && isFranceSubStatus(activeCase.subStatus ?? undefined)
      ? (activeCase.subStatus as FranceSubStatus)
      : input.subStatus ?? null

  return advanceFranceCase({
    userId: input.userId,
    applicantProfileId: input.applicantProfileId,
    mainStatus: input.mainStatus ?? currentMainStatus,
    subStatus: input.subStatus !== undefined ? input.subStatus : currentSubStatus,
    exceptionCode: input.exceptionCode,
    reason: input.reason,
  })
}

export async function clearFranceCaseException(userId: string, applicantProfileId: string, reason?: string) {
  const activeCase = await getOrCreateActiveFranceCase(userId, applicantProfileId)
  if (!activeCase || !isFranceMainStatus(activeCase.mainStatus)) return activeCase

  return advanceFranceCase({
    userId,
    applicantProfileId,
    mainStatus: activeCase.mainStatus,
    subStatus: isFranceSubStatus(activeCase.subStatus ?? undefined)
      ? (activeCase.subStatus as FranceSubStatus)
      : null,
    clearException: true,
    reason,
  })
}

export async function getFranceCaseByApplicant(userId: string, applicantProfileId: string) {
  await ensureDefaultFranceReminderRules()
  return prisma.visaCase.findFirst({
    where: {
      userId,
      applicantProfileId,
      caseType: FRANCE_CASE_TYPE,
      isActive: true,
    },
    include: {
      statusHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      reminderLogs: { orderBy: { triggeredAt: "desc" }, take: 50 },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function listFranceCaseHistory(caseId: string) {
  return prisma.visaCaseStatusHistory.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  })
}

export async function listFranceReminderRules() {
  await ensureDefaultFranceReminderRules()
  return prisma.reminderRule.findMany({
    where: { caseType: FRANCE_CASE_TYPE },
    orderBy: [{ mainStatus: "asc" }, { delayMinutes: "asc" }, { ruleCode: "asc" }],
  })
}

export interface FranceAdminCaseFilters {
  search?: string
  mainStatus?: string
  exceptionCode?: string
  limit?: number
}

export interface FranceAdminReminderFilters {
  search?: string
  mainStatus?: string
  sendStatus?: string
  severity?: string
  automationMode?: string
  channel?: string
  limit?: number
}

export async function listFranceCasesForAdmin(filters: FranceAdminCaseFilters = {}) {
  await ensureDefaultFranceReminderRules()

  const where: Prisma.VisaCaseWhereInput = {
    caseType: FRANCE_CASE_TYPE,
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

export async function listFranceReminderLogsForAdmin(filters: FranceAdminReminderFilters = {}) {
  await ensureDefaultFranceReminderRules()

  const visaCaseWhere: Prisma.VisaCaseWhereInput = {
    caseType: FRANCE_CASE_TYPE,
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

export async function getFranceReminderAdminSummary() {
  await ensureDefaultFranceReminderRules()

  const now = new Date()
  const caseWhere: Prisma.VisaCaseWhereInput = {
    caseType: FRANCE_CASE_TYPE,
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

export async function updateFranceReminderLogStatus(input: {
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

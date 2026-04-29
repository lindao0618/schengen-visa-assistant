import { Prisma } from "@prisma/client"

import prisma from "@/lib/db"
import { buildCaseAccessWhere, resolveViewerRole } from "@/lib/access-control-server"
import {
  type ApplicantScheduleItem,
  buildApplicantScheduleSummary,
  buildScheduleDateWindow,
  isSubmittedScheduleStatus,
  normalizeScheduleRangeDays,
} from "@/lib/applicant-schedule-view"

type ApplicantScheduleFilters = {
  days: ReturnType<typeof normalizeScheduleRangeDays>
  includeMissingSlot: boolean
  includeSubmitted: boolean
  assigneeId?: string
  visaType?: string
  status?: string
}

const scheduleCaseSelect = Prisma.validator<Prisma.VisaCaseSelect>()({
  id: true,
  applicantProfileId: true,
  caseType: true,
  visaType: true,
  applyRegion: true,
  tlsCity: true,
  slotTime: true,
  mainStatus: true,
  subStatus: true,
  priority: true,
  travelDate: true,
  updatedAt: true,
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  applicantProfile: {
    select: {
      id: true,
      name: true,
    },
  },
})

type ScheduleCaseRecord = Prisma.VisaCaseGetPayload<{ select: typeof scheduleCaseSelect }>

export async function listApplicantSchedule(
  userId: string,
  role: string | undefined | null,
  searchParams: URLSearchParams,
) {
  const viewerRole = await resolveViewerRole(userId, role)
  const filters = buildApplicantScheduleFilters(searchParams)
  const { from, to } = buildScheduleDateWindow(filters.days)
  const sharedWhere = buildSharedScheduleWhere({
    userId,
    viewerRole,
    filters,
  })
  const activeWhere: Prisma.VisaCaseWhereInput = {
    AND: [
      sharedWhere,
      {
        slotTime: {
          gte: from,
          lte: to,
        },
      },
      {
        mainStatus: {
          notIn: ["SUBMITTED", "COMPLETED"],
        },
      },
      { submittedAt: null },
      { completedAt: null },
      { closedAt: null },
    ],
  }
  const missingSlotWhere: Prisma.VisaCaseWhereInput = {
    AND: [
      sharedWhere,
      { slotTime: null },
      {
        mainStatus: {
          notIn: ["SUBMITTED", "COMPLETED"],
        },
      },
      { submittedAt: null },
      { completedAt: null },
      { closedAt: null },
    ],
  }
  const submittedWhere: Prisma.VisaCaseWhereInput = {
    AND: [
      sharedWhere,
      {
        OR: [
          { mainStatus: { in: ["SUBMITTED", "COMPLETED"] } },
          { submittedAt: { not: null } },
          { completedAt: { not: null } },
        ],
      },
      {
        OR: [
          {
            slotTime: {
              gte: from,
              lte: to,
            },
          },
          { slotTime: null },
        ],
      },
    ],
  }

  const [activeCases, missingSlotCases, submittedCases] = await Promise.all([
    prisma.visaCase.findMany({
      where: activeWhere,
      orderBy: [{ slotTime: "asc" }, { updatedAt: "desc" }],
      select: scheduleCaseSelect,
      take: 500,
    }),
    filters.includeMissingSlot
      ? prisma.visaCase.findMany({
          where: missingSlotWhere,
          orderBy: [{ updatedAt: "desc" }],
          select: scheduleCaseSelect,
          take: 500,
        })
      : Promise.resolve([] as ScheduleCaseRecord[]),
    prisma.visaCase.findMany({
      where: submittedWhere,
      orderBy: [{ slotTime: "desc" }, { updatedAt: "desc" }],
      select: scheduleCaseSelect,
      take: 500,
    }),
  ])

  const items = activeCases.map(mapScheduleCase)
  const missingSlotItems = missingSlotCases.map(mapScheduleCase)
  const submittedItems = submittedCases.map(mapScheduleCase).filter((item) => isSubmittedScheduleStatus(item.mainStatus))

  return {
    items,
    missingSlotItems,
    submittedItems: filters.includeSubmitted ? submittedItems : [],
    summary: buildApplicantScheduleSummary({
      items,
      missingSlotItems,
      submittedItems,
    }),
  }
}

function buildApplicantScheduleFilters(searchParams: URLSearchParams): ApplicantScheduleFilters {
  const assigneeId = normalizeOptionalFilter(searchParams.get("assigneeId"))
  const visaType = normalizeOptionalFilter(searchParams.get("visaType"))
  const status = normalizeOptionalFilter(searchParams.get("status"))
  return {
    days: normalizeScheduleRangeDays(searchParams.get("days")),
    includeMissingSlot: searchParams.get("includeMissingSlot") !== "false",
    includeSubmitted: searchParams.get("includeSubmitted") === "true",
    assigneeId,
    visaType,
    status,
  }
}

function buildSharedScheduleWhere({
  userId,
  viewerRole,
  filters,
}: {
  userId: string
  viewerRole: Awaited<ReturnType<typeof resolveViewerRole>>
  filters: ApplicantScheduleFilters
}): Prisma.VisaCaseWhereInput {
  const and: Prisma.VisaCaseWhereInput[] = [buildCaseAccessWhere(userId, viewerRole)]

  if (filters.assigneeId) {
    and.push({
      assignedToUserId: filters.assigneeId === "me" ? userId : filters.assigneeId,
    })
  }

  if (filters.visaType) {
    and.push({
      OR: [
        { visaType: filters.visaType },
        { caseType: filters.visaType },
      ],
    })
  }

  if (filters.status) {
    and.push({ mainStatus: normalizeMainStatusFilter(filters.status) })
  }

  return { AND: and }
}

function normalizeOptionalFilter(value?: string | null) {
  const raw = String(value || "").trim()
  return raw && raw !== "all" ? raw : undefined
}

function normalizeMainStatusFilter(value: string) {
  return value.trim().replace(/-/g, "_").toUpperCase()
}

function mapScheduleCase(record: ScheduleCaseRecord): ApplicantScheduleItem {
  return {
    id: record.id,
    applicantId: record.applicantProfile.id,
    applicantName: record.applicantProfile.name,
    caseType: record.caseType,
    visaType: record.visaType,
    applyRegion: record.applyRegion,
    tlsCity: record.tlsCity,
    slotTime: record.slotTime?.toISOString() ?? null,
    mainStatus: record.mainStatus,
    subStatus: record.subStatus,
    priority: record.priority,
    travelDate: record.travelDate?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    assignee: record.assignedTo,
  }
}

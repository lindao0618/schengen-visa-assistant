import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

import {
  SCHEDULE_RANGE_OPTIONS,
  buildApplicantScheduleGroups,
  buildCalendarMonthDays,
  isSubmittedScheduleStatus,
  normalizeScheduleRangeDays,
} from "../lib/applicant-schedule-view"

test("normalizeScheduleRangeDays only allows 3/7/15/30 day windows", () => {
  assert.deepEqual(SCHEDULE_RANGE_OPTIONS.map((item) => item.days), [3, 7, 15, 30])
  assert.equal(normalizeScheduleRangeDays("3"), 3)
  assert.equal(normalizeScheduleRangeDays("7"), 7)
  assert.equal(normalizeScheduleRangeDays("15"), 15)
  assert.equal(normalizeScheduleRangeDays("30"), 30)
  assert.equal(normalizeScheduleRangeDays("365"), 30)
})

test("buildApplicantScheduleGroups returns only the agreed list groups", () => {
  const now = new Date("2026-04-29T00:00:00.000Z")
  const groups = buildApplicantScheduleGroups({
    now,
    items: [
      makeScheduleItem("case-1", "2026-04-30T09:00:00.000Z"),
      makeScheduleItem("case-2", "2026-05-06T09:00:00.000Z"),
      makeScheduleItem("case-3", "2026-05-12T09:00:00.000Z"),
      makeScheduleItem("case-4", "2026-05-25T09:00:00.000Z"),
    ],
    missingSlotItems: [makeScheduleItem("missing", null)],
    submittedItems: [makeScheduleItem("submitted", "2026-04-20T09:00:00.000Z", "SUBMITTED")],
  })

  assert.deepEqual(groups.map((item) => item.key), [
    "next-3",
    "next-7",
    "next-15",
    "next-30",
    "missing-slot",
    "submitted",
  ])
})

test("isSubmittedScheduleStatus treats SUBMITTED and COMPLETED as completed submission", () => {
  assert.equal(isSubmittedScheduleStatus("SUBMITTED"), true)
  assert.equal(isSubmittedScheduleStatus("COMPLETED"), true)
  assert.equal(isSubmittedScheduleStatus("SLOT_BOOKED"), false)
})

test("buildCalendarMonthDays marks the current month and attaches daily items", () => {
  const days = buildCalendarMonthDays({
    month: "2026-04",
    items: [makeScheduleItem("case-1", "2026-04-29T09:00:00.000Z")],
  })
  assert.equal(days.length, 42)
  assert.equal(days.some((day) => day.date === "2026-04-29" && day.items.length === 1), true)
})

test("schedule API is authenticated and uses lightweight schedule query", () => {
  const routeSource = readFileSync(
    path.join(process.cwd(), "app", "api", "applicants", "schedule", "route.ts"),
    "utf8",
  )
  const serverSource = readFileSync(path.join(process.cwd(), "lib", "applicant-schedule.ts"), "utf8")

  assert.match(routeSource, /getServerSession\(authOptions\)/)
  assert.match(routeSource, /listApplicantSchedule/)
  assert.match(serverSource, /buildCaseAccessWhere/)
  assert.match(serverSource, /slotTime/)
  assert.doesNotMatch(serverSource, /include:\s*\{\s*files/)
})

test("schedule page has a server auth shell and isolated client implementation", () => {
  const pageSource = readFileSync(path.join(process.cwd(), "app", "applicants", "schedule", "page.tsx"), "utf8")
  const clientSource = readFileSync(
    path.join(process.cwd(), "app", "applicants", "schedule", "ApplicantsScheduleClientPage.tsx"),
    "utf8",
  )

  assert.match(pageSource, /getServerSession\(authOptions\)/)
  assert.match(pageSource, /redirect\("\/login\?callbackUrl=\/applicants\/schedule"\)/)
  assert.match(clientSource, /SCHEDULE_RANGE_OPTIONS/)
  assert.match(clientSource, /buildApplicantScheduleGroups/)
  assert.match(clientSource, /buildCalendarMonthDays/)
  assert.match(clientSource, /\/api\/applicants\/schedule/)
})

test("applicant CRM header links to submission schedule", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "applicants", "applicant-crm-page-header.tsx"), "utf8")

  assert.match(source, /href="\/applicants\/schedule"/)
  assert.match(source, /递签日程/)
})

test("applicant detail honors caseId query parameter", () => {
  const source = readFileSync(
    path.join(process.cwd(), "app", "applicants", "[id]", "ApplicantDetailClientPage.tsx"),
    "utf8",
  )

  assert.match(source, /searchParams\.get\("caseId"\)/)
  assert.match(source, /setSelectedCaseId\(queryCaseId\)/)
})

function makeScheduleItem(id: string, slotTime: string | null, mainStatus = "SLOT_BOOKED") {
  return {
    id,
    applicantId: `applicant-${id}`,
    applicantName: `客户 ${id}`,
    caseType: "france-schengen",
    visaType: "france-schengen",
    applyRegion: "uk",
    tlsCity: "London",
    slotTime,
    mainStatus,
    subStatus: null,
    priority: "normal",
    travelDate: null,
    updatedAt: "2026-04-28T00:00:00.000Z",
    assignee: null,
  }
}

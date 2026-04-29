# Submission Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a submission schedule board that shows applicant cases by `VisaCase.slotTime` in 3/7/15/30 day groups, with missing-slot and submitted groups plus a month calendar view.

**Architecture:** Add a lightweight schedule API under `/api/applicants/schedule` backed by a focused server module that reuses existing applicant/case access-control helpers. Add pure date/grouping helpers for testable schedule behavior, then build a client-only schedule page with list and calendar views. Keep editing of `slotTime` inside the existing applicant detail Case tab and make schedule items deep-link to `?tab=cases&caseId=...`.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, NextAuth, existing shadcn/ui components, Node test runner.

---

### File Structure

- Create `lib/applicant-schedule-view.ts`: pure helper types and functions for range options, query parsing, grouping, summary counts, calendar month cells, and submitted-status detection.
- Create `lib/applicant-schedule.ts`: Prisma query for schedule rows, access-control enforcement, and API response assembly.
- Create `app/api/applicants/schedule/route.ts`: authenticated GET endpoint.
- Create `app/applicants/schedule/page.tsx`: server-authenticated schedule page shell.
- Create `app/applicants/schedule/ApplicantsScheduleClientPage.tsx`: client page state, fetching, filters, list view, calendar view, and navigation.
- Modify `app/applicants/applicant-crm-page-header.tsx`: add `递签日程` navigation button.
- Modify `app/applicants/[id]/ApplicantDetailClientPage.tsx`: honor `caseId` query param when opening Case tab.
- Modify `tsconfig.test.json`: include new pure helper module in test compilation.
- Create `tests/applicant-schedule-view.test.ts`: range/group/calendar behavior tests.
- Modify `tests/applicant-detail-split.test.ts` or add a source-structure assertion in the new test: schedule page stays isolated and detail page supports `caseId`.

---

### Task 1: Pure Schedule Helpers

**Files:**
- Create: `lib/applicant-schedule-view.ts`
- Create: `tests/applicant-schedule-view.test.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Write failing tests for range parsing and groups**

Add tests that assert:

```ts
import test from "node:test"
import assert from "node:assert/strict"

import {
  SCHEDULE_RANGE_OPTIONS,
  buildApplicantScheduleGroups,
  buildApplicantScheduleSummary,
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
```

Use this helper in the same test file:

```ts
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
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npx tsc -p tsconfig.test.json
```

Expected: FAIL because `lib/applicant-schedule-view.ts` does not exist.

- [ ] **Step 3: Implement helper module**

Create `lib/applicant-schedule-view.ts` with:

```ts
export const SCHEDULE_RANGE_OPTIONS = [
  { days: 3, label: "未来 3 天" },
  { days: 7, label: "未来 7 天" },
  { days: 15, label: "未来 15 天" },
  { days: 30, label: "未来 30 天" },
] as const

export type ScheduleRangeDays = (typeof SCHEDULE_RANGE_OPTIONS)[number]["days"]
export type ScheduleViewMode = "list" | "calendar"
export type ApplicantScheduleGroupKey = "next-3" | "next-7" | "next-15" | "next-30" | "missing-slot" | "submitted"

export type ApplicantScheduleItem = {
  id: string
  applicantId: string
  applicantName: string
  caseType: string
  visaType?: string | null
  applyRegion?: string | null
  tlsCity?: string | null
  slotTime?: string | null
  mainStatus: string
  subStatus?: string | null
  priority: string
  travelDate?: string | null
  updatedAt: string
  assignee?: { id: string; name?: string | null; email: string } | null
}

export type ApplicantScheduleGroup = {
  key: ApplicantScheduleGroupKey
  title: string
  helper: string
  tone: "urgent" | "soon" | "normal" | "later" | "missing" | "done"
  items: ApplicantScheduleItem[]
}
```

Implement `normalizeScheduleRangeDays`, `isSubmittedScheduleStatus`, `buildApplicantScheduleGroups`, `buildApplicantScheduleSummary`, and `buildCalendarMonthDays`. Date grouping uses inclusive day windows starting from local start-of-day.

- [ ] **Step 4: Include helper in test tsconfig**

Add `"lib/applicant-schedule-view.ts"` to `tsconfig.test.json` include list.

- [ ] **Step 5: Run green test**

Run:

```powershell
npx tsc -p tsconfig.test.json; if ($LASTEXITCODE -eq 0) { node --test .test-dist/tests/applicant-schedule-view.test.js }
```

Expected: PASS.

---

### Task 2: Schedule API

**Files:**
- Create: `lib/applicant-schedule.ts`
- Create: `app/api/applicants/schedule/route.ts`
- Test: `tests/applicant-schedule-view.test.ts`

- [ ] **Step 1: Add source-level API tests**

Add tests that read source files and assert:

```ts
test("schedule API is authenticated and uses lightweight schedule query", () => {
  const routeSource = readFileSync(path.join(process.cwd(), "app", "api", "applicants", "schedule", "route.ts"), "utf8")
  const serverSource = readFileSync(path.join(process.cwd(), "lib", "applicant-schedule.ts"), "utf8")

  assert.match(routeSource, /getServerSession\(authOptions\)/)
  assert.match(routeSource, /listApplicantSchedule/)
  assert.match(serverSource, /buildCaseAccessWhere/)
  assert.match(serverSource, /slotTime/)
  assert.doesNotMatch(serverSource, /include:\s*\{\s*files/)
})
```

- [ ] **Step 2: Run red test**

Run:

```powershell
npx tsc -p tsconfig.test.json; if ($LASTEXITCODE -eq 0) { node --test .test-dist/tests/applicant-schedule-view.test.js }
```

Expected: FAIL because API files do not exist.

- [ ] **Step 3: Implement `listApplicantSchedule`**

Create `lib/applicant-schedule.ts`:

- Resolve role with `resolveViewerRole`.
- Use `buildCaseAccessWhere(userId, viewerRole)`.
- Query `prisma.visaCase.findMany` with `where` combining access, date range, optional filters, missing-slot/submitted rules.
- Select only case fields, assigned user, and applicant name/id.
- Return `{ items, missingSlotItems, submittedItems, summary }`.

- [ ] **Step 4: Implement API route**

Create `app/api/applicants/schedule/route.ts`:

```ts
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  const data = await listApplicantSchedule(session.user.id, session.user.role, new URL(request.url).searchParams)
  return NextResponse.json(data)
}
```

Use `handleApplicantProfileApiError` for errors.

- [ ] **Step 5: Run API source tests**

Run:

```powershell
npx tsc -p tsconfig.test.json; if ($LASTEXITCODE -eq 0) { node --test .test-dist/tests/applicant-schedule-view.test.js }
```

Expected: PASS.

---

### Task 3: Schedule Page UI

**Files:**
- Create: `app/applicants/schedule/page.tsx`
- Create: `app/applicants/schedule/ApplicantsScheduleClientPage.tsx`
- Test: `tests/applicant-schedule-view.test.ts`

- [ ] **Step 1: Add source-level page tests**

Assert:

```ts
test("schedule page has a server auth shell and isolated client implementation", () => {
  const pageSource = readFileSync(path.join(process.cwd(), "app", "applicants", "schedule", "page.tsx"), "utf8")
  const clientSource = readFileSync(path.join(process.cwd(), "app", "applicants", "schedule", "ApplicantsScheduleClientPage.tsx"), "utf8")

  assert.match(pageSource, /getServerSession\(authOptions\)/)
  assert.match(pageSource, /redirect\("\/login\?callbackUrl=\/applicants\/schedule"\)/)
  assert.match(clientSource, /SCHEDULE_RANGE_OPTIONS/)
  assert.match(clientSource, /buildApplicantScheduleGroups/)
  assert.match(clientSource, /buildCalendarMonthDays/)
  assert.match(clientSource, /\/api\/applicants\/schedule/)
})
```

- [ ] **Step 2: Run red test**

Expected: FAIL because page files do not exist.

- [ ] **Step 3: Implement server page**

Create `app/applicants/schedule/page.tsx` with auth check matching `/applicants`.

- [ ] **Step 4: Implement client page**

Build one focused client component:

- State: `rangeDays`, `viewMode`, `includeMissingSlot`, `includeSubmitted`, `assigneeId`, `visaType`, `status`, `month`, `loading`, `error`, `data`.
- Fetch query: `/api/applicants/schedule?days=${rangeDays}&includeMissingSlot=${...}&includeSubmitted=${...}`.
- Header: title, refresh button, back to applicant CRM.
- Filter chips: 3/7/15/30 days, missing, submitted, list/calendar toggle.
- List view: render groups from `buildApplicantScheduleGroups`.
- Calendar view: render 6x7 grid from `buildCalendarMonthDays`.
- Item click: `router.push(`/applicants/${item.applicantId}?tab=cases&caseId=${item.id}`)`.

- [ ] **Step 5: Run page tests**

Expected: PASS.

---

### Task 4: Navigation and Detail Deep Link

**Files:**
- Modify: `app/applicants/applicant-crm-page-header.tsx`
- Modify: `app/applicants/[id]/ApplicantDetailClientPage.tsx`
- Test: `tests/applicant-schedule-view.test.ts`

- [ ] **Step 1: Add source-level navigation tests**

Assert:

```ts
test("applicant CRM header links to submission schedule", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "applicants", "applicant-crm-page-header.tsx"), "utf8")
  assert.match(source, /href="\/applicants\/schedule"/)
  assert.match(source, /递签日程/)
})

test("applicant detail honors caseId query parameter", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "applicants", "[id]", "ApplicantDetailClientPage.tsx"), "utf8")
  assert.match(source, /searchParams\.get\("caseId"\)/)
  assert.match(source, /setSelectedCaseId\(queryCaseId\)/)
})
```

- [ ] **Step 2: Run red test**

Expected: FAIL because nav and query handling are missing.

- [ ] **Step 3: Add header link**

Add a `递签日程` outline button with `CalendarClock` icon next to refresh/admin actions.

- [ ] **Step 4: Add detail deep-link effect**

In `ApplicantDetailClientPage`, compute:

```ts
const queryCaseId = searchParams.get("caseId")
```

Then add an effect:

```ts
useEffect(() => {
  if (!queryCaseId || !detail?.cases.some((item) => item.id === queryCaseId)) return
  setSelectedCaseId(queryCaseId)
}, [detail?.cases, queryCaseId, setSelectedCaseId])
```

- [ ] **Step 5: Run navigation tests**

Expected: PASS.

---

### Task 5: Full Verification, Commit, Deploy

**Files:** all changed files.

- [ ] **Step 1: Run full Node tests**

```powershell
npx tsc -p tsconfig.test.json; if ($LASTEXITCODE -eq 0) { node --test .test-dist/tests/*.test.js }
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

```powershell
npm run lint
```

Expected: no ESLint warnings or errors.

- [ ] **Step 3: Run production build**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit implementation**

```powershell
git add app api lib tests tsconfig.test.json
git commit -m "feat: add applicant submission schedule"
```

- [ ] **Step 5: Deploy**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-volcengine.ps1 -FullDeploy
```

Expected: deployment script exits 0, services active, HTTP 200.

- [ ] **Step 6: Verify production**

```powershell
curl.exe -I https://www.vistoria618.top/applicants/schedule
curl.exe -s https://www.vistoria618.top/api/health
ssh -i "d:\360Downloads\download_chrome\vistoria.pem" -o StrictHostKeyChecking=no root@101.96.202.43 "systemctl is-active visa-web.service visa-trip-generator.service visa-explanation-letter.service visa-material-review.service visa-tls-monitor.service"
```

Expected: page responds, health status ok, all services active.

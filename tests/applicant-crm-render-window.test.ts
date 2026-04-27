import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("applicant CRM list renders applicants in visible batches", () => {
  const source = readSource("app/applicants/ApplicantsCrmClientPage.tsx")

  assert.match(source, /APPLICANT_CRM_INITIAL_VISIBLE_ROWS/)
  assert.match(source, /const \[visibleRowLimit, setVisibleRowLimit\] = useState/)
  assert.match(source, /const visibleRows = useMemo/)
  assert.match(source, /displayRows\.slice\(0, visibleRowLimit\)/)
  assert.match(source, /visibleRows\.map\(\(row\) =>/)
  assert.match(source, /加载更多申请人/)
})

test("applicant CRM selection applies to currently rendered rows", () => {
  const source = readSource("app/applicants/ApplicantsCrmClientPage.tsx")

  assert.match(source, /displayRowIds = useMemo\(\(\) => visibleRows\.map\(\(row\) => row\.id\), \[visibleRows\]\)/)
  assert.match(source, /当前显示/)
  assert.doesNotMatch(source, /displayRows\.map\(\(row\) =>/)
})

test("applicant CRM table rendering lives in a memoized focused component", () => {
  const pageSource = readSource("app/applicants/ApplicantsCrmClientPage.tsx")
  const tableSource = readSource("app/applicants/applicant-crm-rows-table.tsx")

  assert.match(pageSource, /ApplicantCrmRowsTable/)
  assert.doesNotMatch(pageSource, /import \{ Table/)
  assert.doesNotMatch(pageSource, /visibleRows\.map\(\(row\) => \(/)
  assert.match(tableSource, /memo\(function ApplicantCrmRowsTable/)
  assert.match(tableSource, /rows\.map\(\(row\) =>/)
  assert.match(tableSource, /selectedApplicantIdSet/)
})

test("applicant CRM dashboard filters live in a focused component", () => {
  const pageSource = readSource("app/applicants/ApplicantsCrmClientPage.tsx")
  const dashboardSource = readSource("app/applicants/applicant-crm-dashboard-panel.tsx")
  const typesSource = readSource("app/applicants/applicant-crm-types.ts")

  assert.match(pageSource, /ApplicantCrmDashboardPanel/)
  assert.doesNotMatch(pageSource, /function FilterGroup/)
  assert.doesNotMatch(pageSource, /function QuickViewCard/)
  assert.doesNotMatch(pageSource, /function StatCard/)
  assert.match(dashboardSource, /memo\(function ApplicantCrmDashboardPanel/)
  assert.match(dashboardSource, /function FilterGroup/)
  assert.match(dashboardSource, /function QuickViewCard/)
  assert.match(dashboardSource, /function StatCard/)
  assert.match(typesSource, /export type ApplicantCrmRow/)
  assert.match(typesSource, /export type QuickView/)
})

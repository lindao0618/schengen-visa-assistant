import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("applicant detail route uses a lightweight lazy client entry", () => {
  const routeSource = readSource("app/applicants/[id]/page.tsx")
  const entrySource = readSource("app/applicants/[id]/ApplicantDetailClientEntry.tsx")

  assert.match(routeSource, /ApplicantDetailClientEntry/)
  assert.doesNotMatch(routeSource, /ApplicantDetailClientPage/)
  assert.match(entrySource, /dynamic\(/)
  assert.match(entrySource, /import\(["']\.\/ApplicantDetailClientPage["']\)/)
})

test("applicant detail client keeps heavy page concerns in focused modules", () => {
  const source = readSource("app/applicants/[id]/ApplicantDetailClientPage.tsx")

  assert.match(source, /ApplicantMaterialsSection/)
  assert.match(source, /ApplicantDetailFrame/)
  assert.doesNotMatch(source, /useApplicantMaterialFiles/)
  assert.doesNotMatch(source, /useMaterialPreviewController/)
  assert.doesNotMatch(source, /useApplicantFileActions/)
  assert.doesNotMatch(source, /fetch\(`\/api\/applicants\/\$\{applicantId\}\/files`/)
  assert.doesNotMatch(source, /URL\.createObjectURL/)
  assert.doesNotMatch(source, /excelColumnMinWidthClass/)
})

test("applicant material section owns material-only hooks and dialogs", () => {
  const source = readSource("app/applicants/[id]/detail/applicant-materials-section.tsx")

  assert.match(source, /useApplicantMaterialFiles/)
  assert.match(source, /useMaterialPreviewController/)
  assert.match(source, /useApplicantFileActions/)
  assert.match(source, /MaterialPreviewDialog/)
  assert.match(source, /AuditDialog/)
})

test("materials tab keeps upload grids and overview chrome in focused modules", () => {
  const tabSource = readSource("app/applicants/[id]/detail/materials-tab.tsx")
  const gridSource = readSource("app/applicants/[id]/detail/material-upload-grid.tsx")
  const overviewSource = readSource("app/applicants/[id]/detail/materials-overview-bar.tsx")

  assert.match(tabSource, /MaterialsOverviewBar/)
  assert.match(tabSource, /UploadGrid/)
  assert.doesNotMatch(tabSource, /function UploadGrid/)
  assert.match(gridSource, /export function UploadGrid/)
  assert.match(gridSource, /usVisaUploadedSlots/)
  assert.match(gridSource, /schengenSubmissionSlots/)
  assert.match(overviewSource, /sticky/)
  assert.match(overviewSource, /已归档/)
  assert.match(overviewSource, /美签/)
  assert.match(overviewSource, /申根/)
  assert.match(overviewSource, /自动化/)
})

test("basic detail tab defers full intake accordion logic", () => {
  const basicSource = readSource("app/applicants/[id]/detail/basic-tab-content.tsx")
  const intakeSource = readSource("app/applicants/[id]/detail/parsed-intake-accordion.tsx")

  assert.match(basicSource, /dynamic\(/)
  assert.match(basicSource, /parsed-intake-accordion/)
  assert.doesNotMatch(basicSource, /function ParsedIntakeAccordion/)
  assert.doesNotMatch(basicSource, /shouldFetchApplicantIntake/)
  assert.doesNotMatch(basicSource, /\/intake\?scope=/)
  assert.match(intakeSource, /function ParsedIntakeAccordion/)
  assert.match(intakeSource, /shouldFetchApplicantIntake/)
  assert.match(intakeSource, /\/intake\?scope=/)
})

test("basic detail tab exposes a sticky profile command bar for frequent saves", () => {
  const basicSource = readSource("app/applicants/[id]/detail/basic-tab-content.tsx")
  const commandBarSource = readSource("app/applicants/[id]/detail/basic-profile-command-bar.tsx")

  assert.match(basicSource, /BasicProfileCommandBar/)
  assert.match(commandBarSource, /sticky/)
  assert.match(commandBarSource, /保存基础资料/)
  assert.match(commandBarSource, /联系方式/)
  assert.match(commandBarSource, /护照/)
  assert.match(commandBarSource, /只读/)
  assert.match(commandBarSource, /savingProfile/)
})

test("applicant detail shared form chrome is scan-friendly", () => {
  const uiSource = readSource("app/applicants/[id]/detail/detail-ui.tsx")
  const basicSource = readSource("app/applicants/[id]/detail/basic-tab-content.tsx")

  assert.match(uiSource, /function FieldShell/)
  assert.match(uiSource, /rounded-\[1\.75rem\]/)
  assert.match(uiSource, /tracking-\[0\.12em\]/)
  assert.match(uiSource, /focus-visible:ring-slate-300/)
  assert.match(basicSource, /min-h-\[132px\]/)
})

test("applicant detail frame exposes a sticky stage navigation rail", () => {
  const frameSource = readSource("app/applicants/[id]/detail/applicant-detail-frame.tsx")

  assert.match(frameSource, /APPLICANT_DETAIL_TABS/)
  assert.match(frameSource, /sticky top-\[72px\]/)
  assert.match(frameSource, /签证 Case/)
  assert.match(frameSource, /材料文档/)
  assert.match(frameSource, /进度与日志/)
  assert.match(frameSource, /count/)
})

test("applicant detail frame includes a right-side specialist work rail", () => {
  const pageSource = readSource("app/applicants/[id]/ApplicantDetailClientPage.tsx")
  const frameSource = readSource("app/applicants/[id]/detail/applicant-detail-frame.tsx")
  const railSource = readSource("app/applicants/[id]/detail/applicant-detail-work-rail.tsx")

  assert.match(pageSource, /copyRailValue/)
  assert.match(frameSource, /ApplicantDetailWorkRail/)
  assert.match(frameSource, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/)
  assert.match(railSource, /专员操作台/)
  assert.match(railSource, /客户联系/)
  assert.match(railSource, /下一步建议/)
  assert.match(railSource, /打开材料文档/)
  assert.match(railSource, /查看进度与日志/)
  assert.match(railSource, /sticky top-\[184px\]/)
})

test("applicant detail workspace uses a calm blue-neutral palette", () => {
  const frameSource = readSource("app/applicants/[id]/detail/applicant-detail-frame.tsx")
  const railSource = readSource("app/applicants/[id]/detail/applicant-detail-work-rail.tsx")
  const caseListSource = readSource("app/applicants/[id]/detail/case-list-panel.tsx")
  const caseCommandSource = readSource("app/applicants/[id]/detail/case-command-bar.tsx")
  const detailUiSource = readSource("app/applicants/[id]/detail/detail-ui.tsx")

  assert.match(frameSource, /data-\[state=active\]:!bg-\[linear-gradient\(135deg,_#eff6ff,_#ffffff\)\]/)
  assert.doesNotMatch(frameSource, /data-\[state=active\]:!bg-slate-950/)
  assert.match(railSource, /bg-\[linear-gradient\(135deg,_#f8fbff,_#eef6ff\)\]/)
  assert.doesNotMatch(railSource, /bg-slate-950/)
  assert.doesNotMatch(railSource, /border-amber-200/)
  assert.match(caseListSource, /border-blue-200/)
  assert.doesNotMatch(caseListSource, /#f59e0b/)
  assert.doesNotMatch(caseCommandSource, /bg-amber-500/)
  assert.match(caseCommandSource, /bg-blue-600/)
  assert.match(detailUiSource, /rail: "from-blue-500 to-sky-300"/)
})

test("cases detail tab keeps list and form logic in focused modules", () => {
  const tabSource = readSource("app/applicants/[id]/detail/cases-tab-content.tsx")
  const listSource = readSource("app/applicants/[id]/detail/case-list-panel.tsx")
  const formSource = readSource("app/applicants/[id]/detail/case-detail-form.tsx")

  assert.match(tabSource, /CaseSwitcherPanel/)
  assert.match(tabSource, /CaseListPanel/)
  assert.match(tabSource, /CaseDetailForm/)
  assert.doesNotMatch(tabSource, /function BookingWindowRangeField/)
  assert.doesNotMatch(tabSource, /function SlotTimeField/)
  assert.doesNotMatch(tabSource, /SLOT_TIME_OPTIONS/)
  assert.doesNotMatch(tabSource, /CRM_VISA_TYPE_OPTIONS/)
  assert.doesNotMatch(tabSource, /FRANCE_TLS_CITY_OPTIONS/)

  assert.match(listSource, /function CaseSwitcherPanel/)
  assert.match(listSource, /function CaseListPanel/)
  assert.match(listSource, /getPriorityVariant/)
  assert.match(listSource, /getApplicantCrmVisaTypeLabel/)

  assert.match(formSource, /function CaseDetailForm/)
  assert.match(formSource, /case-date-fields/)
  assert.match(formSource, /deriveApplicantCaseTypeFromVisaType/)
  assert.match(formSource, /onSaveCase/)
})

test("case detail form exposes a sticky command bar for high-frequency actions", () => {
  const formSource = readSource("app/applicants/[id]/detail/case-detail-form.tsx")
  const commandBarSource = readSource("app/applicants/[id]/detail/case-command-bar.tsx")

  assert.match(formSource, /CaseCommandBar/)
  assert.match(commandBarSource, /sticky/)
  assert.match(commandBarSource, /保存当前 Case/)
  assert.match(commandBarSource, /当前状态/)
  assert.match(commandBarSource, /当前案件/)
  assert.match(commandBarSource, /onSaveCase/)
  assert.match(commandBarSource, /formatFranceStatusLabel/)
})

test("detail sticky action bars sit below the stage navigation", () => {
  const basicCommandBarSource = readSource("app/applicants/[id]/detail/basic-profile-command-bar.tsx")
  const caseCommandBarSource = readSource("app/applicants/[id]/detail/case-command-bar.tsx")

  assert.match(basicCommandBarSource, /top-\[260px\] lg:top-\[184px\]/)
  assert.match(caseCommandBarSource, /top-\[260px\] lg:top-\[184px\]/)
})

test("case date and slot fields are shared by create and edit forms", () => {
  const sharedSource = readSource("app/applicants/[id]/detail/case-date-fields.tsx")
  const createDialogSource = readSource("app/applicants/[id]/detail/create-case-dialog.tsx")
  const formSource = readSource("app/applicants/[id]/detail/case-detail-form.tsx")

  assert.match(sharedSource, /function BookingWindowRangeField/)
  assert.match(sharedSource, /function SlotTimeField/)
  assert.match(sharedSource, /SLOT_TIME_OPTIONS/)
  assert.match(sharedSource, /splitBookingWindow/)
  assert.match(sharedSource, /mergeDateTimeLocal/)

  assert.match(createDialogSource, /case-date-fields/)
  assert.doesNotMatch(createDialogSource, /function BookingWindowRangeField/)
  assert.doesNotMatch(createDialogSource, /function SlotTimeField/)
  assert.doesNotMatch(createDialogSource, /SLOT_TIME_OPTIONS/)

  assert.match(formSource, /case-date-fields/)
  assert.doesNotMatch(formSource, /function BookingWindowRangeField/)
  assert.doesNotMatch(formSource, /function SlotTimeField/)
  assert.doesNotMatch(formSource, /SLOT_TIME_OPTIONS/)
})

test("applicant detail page defers assignee loading until case editing", () => {
  const pageSource = readSource("app/applicants/[id]/ApplicantDetailClientPage.tsx")
  const routeSource = readSource("app/api/applicants/[id]/route.ts")
  const crmSource = readSource("lib/applicant-crm.ts")

  assert.match(pageSource, /\/api\/applicants\/assignees/)
  assert.match(pageSource, /activeTab === "cases" \|\| createCaseOpen/)
  assert.doesNotMatch(pageSource, /\/api\/applicants\/\$\{applicantId\}\?includeAssignees=1/)

  assert.match(routeSource, /shouldIncludeApplicantDetailAssignees/)
  assert.match(routeSource, /includeAvailableAssignees/)

  assert.match(crmSource, /includeAvailableAssignees/)
  assert.match(crmSource, /includeAvailableAssignees\s+&&\s+canAssignCases/)
})

test("applicant detail page defers case artifact metadata until a case is selected", () => {
  const pageSource = readSource("app/applicants/[id]/ApplicantDetailClientPage.tsx")
  const routeSource = readSource("app/api/applicants/[id]/route.ts")
  const crmSource = readSource("lib/applicant-crm.ts")

  assert.match(pageSource, /loadSelectedCaseArtifacts/)
  assert.match(pageSource, /\/api\/cases\/\$\{caseId\}/)
  assert.match(pageSource, /activeTab === "cases"/)

  assert.match(routeSource, /shouldIncludeApplicantDetailCaseArtifacts/)
  assert.match(routeSource, /includeCaseArtifacts/)

  assert.match(crmSource, /includeCaseArtifacts/)
  assert.match(crmSource, /mapCaseSummaryWithArtifacts/)
  assert.match(crmSource, /mapCaseSummary\(item, \{ includeActivity: false \}\)/)
})

test("applicant detail case list query skips activity history rows by default", () => {
  const crmSource = readSource("lib/applicant-crm.ts")
  const detailStart = crmSource.indexOf("export async function getApplicantCrmDetail")
  const activeDetailStart = crmSource.indexOf("export async function getApplicantActiveDetail")
  const detailSource = crmSource.slice(detailStart, activeDetailStart)

  assert.match(detailSource, /statusHistory:\s*{\s*orderBy:\s*{\s*createdAt:\s*"desc"\s*},\s*take:\s*0,\s*}/)
  assert.match(detailSource, /reminderLogs:\s*{\s*orderBy:\s*{\s*triggeredAt:\s*"desc"\s*},\s*take:\s*0,\s*}/)
})

test("applicant detail page can hydrate from active detail cache before full refresh", () => {
  const pageSource = readSource("app/applicants/[id]/ApplicantDetailClientPage.tsx")

  assert.match(pageSource, /getApplicantDetailCacheKey\(applicantId,\s*"active"\)/)
  assert.match(pageSource, /readClientCache<ApplicantDetailResponse>\(activeDetailCacheKey\)/)
  assert.match(pageSource, /readClientCache<ApplicantDetailResponse>\(detailCacheKey\)\s*\?\?/)
})

test("material preview controller uses direct URLs for browser-native previews", () => {
  const source = readSource("app/applicants/[id]/detail/use-material-preview-controller.ts")

  const modeIndex = source.indexOf("resolveApplicantPreviewMode")
  const fetchIndex = source.indexOf("fetch(fileHref")

  assert.notEqual(modeIndex, -1)
  assert.notEqual(fetchIndex, -1)
  assert.ok(modeIndex < fetchIndex)
  assert.match(source, /previewMode === "pdf"/)
  assert.match(source, /previewMode === "image"/)
})

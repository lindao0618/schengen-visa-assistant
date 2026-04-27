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

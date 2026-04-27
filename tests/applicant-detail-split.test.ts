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

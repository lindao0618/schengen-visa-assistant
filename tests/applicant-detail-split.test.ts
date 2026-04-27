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

  assert.match(source, /useApplicantMaterialFiles/)
  assert.match(source, /useMaterialPreviewController/)
  assert.match(source, /ApplicantDetailFrame/)
  assert.doesNotMatch(source, /fetch\(`\/api\/applicants\/\$\{applicantId\}\/files`/)
  assert.doesNotMatch(source, /URL\.createObjectURL/)
  assert.doesNotMatch(source, /excelColumnMinWidthClass/)
})

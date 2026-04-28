import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("usePrefetchApplicantDetail only auto-prefetches when explicitly enabled", () => {
  const source = readSource("hooks/use-prefetch-applicant-detail.ts")

  assert.match(source, /auto\?:\s*boolean/)
  assert.match(source, /const auto = options\?\.auto \?\? false/)
  assert.match(source, /if \(!auto\) return\s+prefetchApplicantDetail\(applicantId\)/)
})

test("active applicant workflow pages avoid redundant detail prefetch on mount", () => {
  const pages = [
    "app/material-customization/MaterialCustomizationClientPage.tsx",
    "app/schengen-visa/france/automation/FranceAutomationClientPage.tsx",
    "app/services/explanation-letter-writer/ExplanationLetterWriterClientPage.tsx",
  ]

  for (const page of pages) {
    const source = readSource(page)
    assert.match(source, /useActiveApplicantProfile/)
    assert.doesNotMatch(source, /usePrefetchApplicantDetail/)
  }
})

test("usa visa URL applicant handoff keeps explicit active detail prefetch", () => {
  const source = readSource("app/usa-visa/USAVisaClientPage.tsx")

  assert.match(source, /usePrefetchApplicantDetail\(applicantProfileId,\s*{\s*view:\s*"active",\s*auto:\s*true\s*}\)/)
})

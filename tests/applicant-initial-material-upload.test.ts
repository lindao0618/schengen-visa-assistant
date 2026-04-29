import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

import {
  getInitialMaterialUploadSlots,
  shouldShowInitialMaterialUploadPrompt,
} from "../lib/applicant-initial-material-upload"

test("getInitialMaterialUploadSlots prompts for France Schengen Excel after applicant creation", () => {
  assert.deepEqual(
    getInitialMaterialUploadSlots(["france-schengen"]).map((slot) => slot.key),
    ["schengenExcel"],
  )
  assert.equal(shouldShowInitialMaterialUploadPrompt(["france-schengen"]), true)
})

test("getInitialMaterialUploadSlots prompts for US photo and Excel after applicant creation", () => {
  assert.deepEqual(
    getInitialMaterialUploadSlots(["usa-visa"]).map((slot) => slot.key),
    ["usVisaPhoto", "usVisaDs160Excel"],
  )
})

test("getInitialMaterialUploadSlots deduplicates mixed normalized visa types", () => {
  assert.deepEqual(
    getInitialMaterialUploadSlots(["schengen", "france-schengen", "us-visa"]).map((slot) => slot.key),
    ["schengenExcel", "usVisaPhoto", "usVisaDs160Excel"],
  )
})

test("initial material upload refreshes applicant detail cache before opening materials tab", () => {
  const pageSource = readFileSync(
    path.join(process.cwd(), "app", "applicants", "ApplicantsCrmClientPage.tsx"),
    "utf8",
  )
  const dialogSource = readFileSync(
    path.join(process.cwd(), "app", "applicants", "initial-material-upload-dialog.tsx"),
    "utf8",
  )

  assert.match(pageSource, /prefetchJsonIntoClientCache\(\s*getApplicantDetailCacheKey\(applicantId\)/)
  assert.match(pageSource, /force:\s*true/)
  assert.match(dialogSource, /await\s+onFinish\("uploaded"\)/)
})

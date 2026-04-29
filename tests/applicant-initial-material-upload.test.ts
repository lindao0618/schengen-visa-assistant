import test from "node:test"
import assert from "node:assert/strict"

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

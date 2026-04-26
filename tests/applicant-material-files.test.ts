import test from "node:test"
import assert from "node:assert/strict"

import { shouldFetchApplicantMaterialFiles } from "../lib/applicant-material-files"

test("shouldFetchApplicantMaterialFiles only loads files when materials tab is active", () => {
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "basic",
      hasFilesLoaded: false,
      loading: false,
    }),
    false,
  )
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "materials",
      hasFilesLoaded: false,
      loading: false,
    }),
    true,
  )
})

test("shouldFetchApplicantMaterialFiles avoids duplicate material file requests", () => {
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "materials",
      hasFilesLoaded: true,
      loading: false,
    }),
    false,
  )
  assert.equal(
    shouldFetchApplicantMaterialFiles({
      activeTab: "materials",
      hasFilesLoaded: false,
      loading: true,
    }),
    false,
  )
})

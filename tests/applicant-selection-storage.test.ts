import test from "node:test"
import assert from "node:assert/strict"

import {
  ACTIVE_APPLICANT_CASE_KEY,
  ACTIVE_APPLICANT_PROFILE_KEY,
  getApplicantCaseStorageKey,
} from "../lib/applicant-selection-storage"

test("applicant selection storage keys stay compatible with existing localStorage data", () => {
  assert.equal(ACTIVE_APPLICANT_PROFILE_KEY, "activeApplicantProfileId")
  assert.equal(ACTIVE_APPLICANT_CASE_KEY, "activeApplicantCaseId")
  assert.equal(getApplicantCaseStorageKey("applicant-1"), "activeApplicantCaseId:applicant-1")
})

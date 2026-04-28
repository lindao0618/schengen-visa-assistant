import test from "node:test"
import assert from "node:assert/strict"

import { resolveApplicantDetailView, shouldIncludeApplicantDetailAssignees } from "../lib/applicant-detail-view"

test("defaults to full applicant detail view", () => {
  assert.equal(resolveApplicantDetailView(null), "full")
  assert.equal(resolveApplicantDetailView(new URLSearchParams()), "full")
})

test("uses active applicant detail view when requested", () => {
  assert.equal(resolveApplicantDetailView(new URLSearchParams("view=active")), "active")
  assert.equal(resolveApplicantDetailView("active"), "active")
})

test("falls back to full view for unknown values", () => {
  assert.equal(resolveApplicantDetailView(new URLSearchParams("view=anything-else")), "full")
  assert.equal(resolveApplicantDetailView("detail"), "full")
})

test("applicant detail assignees are opt-in for heavier case editing views", () => {
  assert.equal(shouldIncludeApplicantDetailAssignees(null), false)
  assert.equal(shouldIncludeApplicantDetailAssignees(new URLSearchParams()), false)
  assert.equal(shouldIncludeApplicantDetailAssignees(new URLSearchParams("includeAssignees=1")), true)
  assert.equal(shouldIncludeApplicantDetailAssignees(new URLSearchParams("includeAssignees=true")), true)
  assert.equal(shouldIncludeApplicantDetailAssignees(new URLSearchParams("includeAssignees=0")), false)
  assert.equal(shouldIncludeApplicantDetailAssignees("1"), true)
})

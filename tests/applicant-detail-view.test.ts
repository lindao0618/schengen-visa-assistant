import test from "node:test"
import assert from "node:assert/strict"

import { resolveApplicantDetailView } from "../lib/applicant-detail-view"

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

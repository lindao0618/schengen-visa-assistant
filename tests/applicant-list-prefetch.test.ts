import test from "node:test"
import assert from "node:assert/strict"

import {
  shouldPrefetchApplicantDetailJson,
  shouldPrefetchApplicantDetailRoute,
} from "../lib/applicant-list-prefetch"

test("shouldPrefetchApplicantDetailJson skips automatic list prefetches", () => {
  assert.equal(
    shouldPrefetchApplicantDetailJson({
      applicantId: "applicant-1",
      source: "automatic",
    }),
    false,
  )
})

test("shouldPrefetchApplicantDetailJson allows user-intent prefetches", () => {
  assert.equal(
    shouldPrefetchApplicantDetailJson({
      applicantId: "applicant-1",
      source: "intent",
    }),
    true,
  )
})

test("shouldPrefetchApplicantDetailJson requires an applicant id", () => {
  assert.equal(
    shouldPrefetchApplicantDetailJson({
      applicantId: "",
      source: "intent",
    }),
    false,
  )
})

test("shouldPrefetchApplicantDetailRoute skips automatic list prefetches", () => {
  assert.equal(
    shouldPrefetchApplicantDetailRoute({
      applicantId: "applicant-1",
      source: "automatic",
    }),
    false,
  )
})

test("shouldPrefetchApplicantDetailRoute allows user-intent and create prefetches", () => {
  assert.equal(
    shouldPrefetchApplicantDetailRoute({
      applicantId: "applicant-1",
      source: "intent",
    }),
    true,
  )
  assert.equal(
    shouldPrefetchApplicantDetailRoute({
      applicantId: "applicant-1",
      source: "create",
    }),
    true,
  )
})

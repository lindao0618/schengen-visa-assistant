import test from "node:test"
import assert from "node:assert/strict"

import { shouldFetchApplicantIntake } from "../lib/applicant-intake-loading"

test("shouldFetchApplicantIntake only loads when accordion is opened", () => {
  assert.equal(
    shouldFetchApplicantIntake({
      open: false,
      hasIntakeLoaded: false,
      loading: false,
    }),
    false,
  )
  assert.equal(
    shouldFetchApplicantIntake({
      open: true,
      hasIntakeLoaded: false,
      loading: false,
    }),
    true,
  )
})

test("shouldFetchApplicantIntake avoids duplicate intake requests", () => {
  assert.equal(
    shouldFetchApplicantIntake({
      open: true,
      hasIntakeLoaded: true,
      loading: false,
    }),
    false,
  )
  assert.equal(
    shouldFetchApplicantIntake({
      open: true,
      hasIntakeLoaded: false,
      loading: true,
    }),
    false,
  )
})

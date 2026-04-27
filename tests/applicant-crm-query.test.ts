import test from "node:test"
import assert from "node:assert/strict"

import { buildApplicantCrmFiltersFromSearchParams } from "../lib/applicant-crm-query"

test("applicant CRM list query omits profile payloads by default", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(new URLSearchParams())

  assert.equal(filters.includeProfiles, false)
  assert.equal(filters.includeProfileFiles, false)
  assert.equal(filters.includeStats, false)
  assert.equal(filters.includeSelectorCases, false)
  assert.equal(filters.includeAvailableAssignees, false)
})

test("applicant CRM list query only includes profile payloads when explicitly requested", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(
    new URLSearchParams("includeProfiles=1&includeProfileFiles=true&includeSelectorCases=yes"),
  )

  assert.equal(filters.includeProfiles, true)
  assert.equal(filters.includeProfileFiles, true)
  assert.equal(filters.includeSelectorCases, true)
})

test("applicant CRM list query preserves custom defaults for agent callers", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("includeProfileFiles=0"), {
    includeStats: true,
    includeProfiles: true,
    includeProfileFiles: true,
    includeAvailableAssignees: true,
  })

  assert.equal(filters.includeStats, true)
  assert.equal(filters.includeProfiles, true)
  assert.equal(filters.includeProfileFiles, false)
  assert.equal(filters.includeAvailableAssignees, true)
})

test("applicant CRM list query normalizes keyword and multi-select filters", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(
    new URLSearchParams("keyword=%20Alice%20&visaTypes=france-schengen,usa&regions=uk&regions=cn"),
  )

  assert.equal(filters.keyword, "Alice")
  assert.deepEqual(filters.visaTypes, ["france-schengen", "usa"])
  assert.deepEqual(filters.regions, ["uk", "cn"])
})

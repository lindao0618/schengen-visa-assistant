import test from "node:test"
import assert from "node:assert/strict"

import { buildApplicantCrmFiltersFromSearchParams } from "../lib/applicant-crm-query"
import { getApplicantCrmCaseListTakeLimit } from "../lib/applicant-crm-list-options"

test("applicant CRM list query omits profile payloads by default", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(new URLSearchParams())

  assert.equal(filters.includeProfiles, false)
  assert.equal(filters.includeProfileFiles, false)
  assert.equal(filters.includeStats, false)
  assert.equal(filters.includeSelectorCases, false)
  assert.equal(filters.includeAvailableAssignees, false)
  assert.equal(filters.includeListMeta, true)
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
    new URLSearchParams("keyword=%20Alice%20&visaTypes=france-schengen,usa&regions=uk&regions=cn&groups=VIP,2026&groups=TeamA"),
  )

  assert.equal(filters.keyword, "Alice")
  assert.deepEqual(filters.visaTypes, ["france-schengen", "usa"])
  assert.deepEqual(filters.regions, ["uk", "cn"])
  assert.deepEqual(filters.groups, ["VIP", "2026", "TeamA"])
})

test("applicant CRM list limits nested cases unless full case payload is needed", () => {
  assert.equal(getApplicantCrmCaseListTakeLimit({}), 1)
  assert.equal(getApplicantCrmCaseListTakeLimit({ includeStats: true }), undefined)
  assert.equal(getApplicantCrmCaseListTakeLimit({ includeSelectorCases: true }), undefined)
})

test("applicant CRM list query parses optional pagination", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("limit=25&offset=50"))

  assert.equal(filters.limit, 25)
  assert.equal(filters.offset, 50)
})

test("applicant CRM list query clamps unsafe pagination values", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("limit=999&offset=-10"))

  assert.equal(filters.limit, 200)
  assert.equal(filters.offset, 0)
})

test("applicant CRM list query ignores pagination without a valid limit", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("limit=0&offset=20"))

  assert.equal(filters.limit, undefined)
  assert.equal(filters.offset, undefined)
})

test("applicant CRM list query validates quick view filters", () => {
  assert.equal(buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("quickView=mine")).quickView, "mine")
  assert.equal(buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("quickView=today")).quickView, "today")
  assert.equal(buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("quickView=all")).quickView, undefined)
  assert.equal(buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("quickView=unknown")).quickView, undefined)
})

test("applicant CRM list query can skip list metadata for append-only pages", () => {
  const filters = buildApplicantCrmFiltersFromSearchParams(new URLSearchParams("includeListMeta=0"))

  assert.equal(filters.includeListMeta, false)
})

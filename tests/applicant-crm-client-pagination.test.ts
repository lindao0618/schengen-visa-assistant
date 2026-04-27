import test from "node:test"
import assert from "node:assert/strict"

import {
  APPLICANT_CRM_PAGE_SIZE,
  buildApplicantCrmListSearchParams,
  mergeApplicantCrmPageRows,
} from "../app/applicants/applicant-crm-client-pagination"
import type { ApplicantCrmRow } from "../app/applicants/applicant-crm-types"

function row(id: string): ApplicantCrmRow {
  return {
    id,
    name: `Applicant ${id}`,
    currentStatusKey: "reviewing",
    currentStatusLabel: "审核中",
    updatedAt: "2026-04-27T00:00:00.000Z",
    owner: {
      id: "owner-1",
      email: "owner@example.com",
    },
  }
}

test("applicant CRM client list query sends server pagination and filters", () => {
  const query = buildApplicantCrmListSearchParams({
    keyword: " Alice ",
    selectedVisaTypes: ["france-schengen"],
    selectedStatuses: ["reviewing"],
    selectedRegions: ["uk"],
    selectedPriorities: ["urgent"],
    selectedGroups: ["VIP", "2026"],
    quickView: "mine",
    limit: APPLICANT_CRM_PAGE_SIZE,
    offset: 50,
  })
  const params = new URLSearchParams(query)

  assert.equal(params.get("keyword"), "Alice")
  assert.equal(params.get("limit"), String(APPLICANT_CRM_PAGE_SIZE))
  assert.equal(params.get("offset"), "50")
  assert.equal(params.get("quickView"), "mine")
  assert.deepEqual(params.getAll("groups"), ["VIP", "2026"])
  assert.deepEqual(params.getAll("visaTypes"), ["france-schengen"])
  assert.equal(params.get("includeProfiles"), "0")
  assert.equal(params.get("includeProfileFiles"), "0")
})

test("applicant CRM client list query omits all quick view", () => {
  const query = buildApplicantCrmListSearchParams({
    keyword: "",
    selectedVisaTypes: [],
    selectedStatuses: [],
    selectedRegions: [],
    selectedPriorities: [],
    selectedGroups: [],
    quickView: "all",
    limit: APPLICANT_CRM_PAGE_SIZE,
    offset: 0,
  })
  const params = new URLSearchParams(query)

  assert.equal(params.get("quickView"), null)
  assert.equal(params.get("limit"), String(APPLICANT_CRM_PAGE_SIZE))
  assert.equal(params.get("offset"), "0")
})

test("applicant CRM page rows replace or append with id de-duplication", () => {
  assert.deepEqual(mergeApplicantCrmPageRows([row("a")], [row("b")], "replace").map((item) => item.id), ["b"])
  assert.deepEqual(mergeApplicantCrmPageRows([row("a"), row("b")], [row("b"), row("c")], "append").map((item) => item.id), [
    "a",
    "b",
    "c",
  ])
})

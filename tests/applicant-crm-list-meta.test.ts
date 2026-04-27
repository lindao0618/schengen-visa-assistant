import test from "node:test"
import assert from "node:assert/strict"

import { buildApplicantCrmGroupOptions, buildApplicantCrmQuickCounts } from "../lib/applicant-crm-list-meta"

const rows = [
  {
    id: "a1",
    groupName: "VIP",
    currentStatusKey: "reviewing",
    owner: { id: "owner-1" },
    assignee: null,
  },
  {
    id: "a2",
    groupName: "Team A",
    currentStatusKey: "docs_ready",
    owner: { id: "owner-2" },
    assignee: { id: "owner-1" },
  },
  {
    id: "a3",
    groupName: "VIP",
    currentStatusKey: "exception",
    owner: { id: "owner-3" },
    assignee: null,
  },
  {
    id: "a4",
    groupName: "",
    currentStatusKey: "completed",
    owner: { id: "owner-1" },
    assignee: null,
  },
]

test("buildApplicantCrmQuickCounts computes counts from the full filtered row set", () => {
  assert.deepEqual(buildApplicantCrmQuickCounts(rows, "owner-1"), {
    mine: 3,
    review: 2,
    exception: 1,
    today: 3,
  })
})

test("buildApplicantCrmGroupOptions returns sorted unique non-empty groups", () => {
  assert.deepEqual(buildApplicantCrmGroupOptions(rows), ["Team A", "VIP"])
})

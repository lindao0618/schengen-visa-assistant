import test from "node:test"
import assert from "node:assert/strict"

import {
  buildApplicantCrmListWhere,
  shouldUseApplicantCrmKeywordWhere,
} from "../lib/applicant-crm-db-filters"

test("applicant CRM keyword where merges access control with profile fields", () => {
  const where = buildApplicantCrmListWhere(
    {
      OR: [
        { userId: "user-1" },
        { visaCases: { some: { assignedToUserId: "user-1" } } },
      ],
    },
    " Alice ",
  )

  assert.deepEqual(where, {
    AND: [
      {
        OR: [
          { userId: "user-1" },
          { visaCases: { some: { assignedToUserId: "user-1" } } },
        ],
      },
      {
        OR: [
          { name: { contains: "Alice", mode: "insensitive" } },
          { phone: { contains: "Alice", mode: "insensitive" } },
          { email: { contains: "Alice", mode: "insensitive" } },
          { wechat: { contains: "Alice", mode: "insensitive" } },
          { passportNumber: { contains: "Alice", mode: "insensitive" } },
          { usVisaPassportNumber: { contains: "Alice", mode: "insensitive" } },
        ],
      },
    ],
  })
})

test("applicant CRM keyword where preserves access where without keyword", () => {
  const accessWhere = { userId: "user-1" }

  assert.deepEqual(buildApplicantCrmListWhere(accessWhere, " "), accessWhere)
})

test("applicant CRM keyword where is only safe for lightweight list requests", () => {
  assert.equal(shouldUseApplicantCrmKeywordWhere({}), true)
  assert.equal(shouldUseApplicantCrmKeywordWhere({ includeStats: true }), false)
  assert.equal(shouldUseApplicantCrmKeywordWhere({ includeProfiles: true }), false)
  assert.equal(shouldUseApplicantCrmKeywordWhere({ includeSelectorCases: true }), false)
})

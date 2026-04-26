import test from "node:test"
import assert from "node:assert/strict"

import {
  buildApplicantDetailCapabilities,
  resolveApplicantDetailTab,
} from "../app/applicants/[id]/detail/use-applicant-detail-controller"

test("resolveApplicantDetailTab 只接受四个合法 tab", () => {
  assert.equal(resolveApplicantDetailTab("basic"), "basic")
  assert.equal(resolveApplicantDetailTab("cases"), "cases")
  assert.equal(resolveApplicantDetailTab("materials"), "materials")
  assert.equal(resolveApplicantDetailTab("progress"), "progress")
  assert.equal(resolveApplicantDetailTab("unknown"), "basic")
  assert.equal(resolveApplicantDetailTab(""), "basic")
})

test("buildApplicantDetailCapabilities 正确推导只读与自动化权限", () => {
  assert.deepEqual(buildApplicantDetailCapabilities("service"), {
    isReadOnly: true,
    canEditApplicant: false,
    canAssignCase: false,
    canRunAutomation: false,
  })
  assert.deepEqual(buildApplicantDetailCapabilities("supervisor"), {
    isReadOnly: false,
    canEditApplicant: true,
    canAssignCase: true,
    canRunAutomation: true,
  })
})

import test from "node:test"
import assert from "node:assert/strict"

import { buildBasicForm, buildCaseForm, emptyApplicantCaseForm } from "../app/applicants/[id]/detail/form-state"
import { emptyBasicForm, emptyCaseForm, type VisaCaseRecord } from "../app/applicants/[id]/detail/types"

test("buildBasicForm maps profile fields and keeps sensible defaults", () => {
  assert.deepEqual(buildBasicForm(null), emptyBasicForm)
  assert.deepEqual(
    buildBasicForm({
      id: "profile-1",
      userId: "user-1",
      label: "默认标签",
      name: "",
      phone: "13800000000",
      email: "vistoria@qq.com",
      wechat: "wechat-id",
      passportNumber: "E12345678",
      note: "重点客户",
      usVisa: {
        surname: "ZHANG",
        birthYear: "1990",
        passportNumber: "E12345678",
      },
      schengen: {},
    }),
    {
      name: "默认标签",
      phone: "13800000000",
      email: "vistoria@qq.com",
      wechat: "wechat-id",
      passportNumber: "E12345678",
      note: "重点客户",
      usVisaSurname: "ZHANG",
      usVisaBirthYear: "1990",
      usVisaPassportNumber: "E12345678",
      schengenCountry: "france",
      schengenVisaCity: "",
    },
  )
})

test("buildCaseForm preserves caller-specific fallback defaults", () => {
  assert.deepEqual(buildCaseForm(null), emptyCaseForm)
  assert.deepEqual(buildCaseForm(null, emptyApplicantCaseForm), emptyApplicantCaseForm)
})

test("buildCaseForm maps nullable case fields to editable form values", () => {
  const visaCase: VisaCaseRecord = {
    id: "case-1",
    caseType: "france-schengen",
    visaType: null,
    applyRegion: "france",
    tlsCity: "LON",
    bookingWindow: null,
    acceptVip: "yes",
    slotTime: null,
    mainStatus: "draft",
    subStatus: null,
    exceptionCode: null,
    priority: "",
    travelDate: "2026-05-20T00:00:00.000Z",
    submissionDate: "2026-05-01T00:00:00.000Z",
    assignedToUserId: null,
    isActive: true,
    updatedAt: "2026-04-27T00:00:00.000Z",
    createdAt: "2026-04-26T00:00:00.000Z",
    owner: {
      id: "user-1",
      email: "owner@example.com",
    },
    statusHistory: [],
    reminderLogs: [],
  }

  assert.deepEqual(buildCaseForm(visaCase), {
    caseType: "france-schengen",
    visaType: "",
    applyRegion: "france",
    tlsCity: "LON",
    bookingWindow: "",
    acceptVip: "yes",
    slotTime: "",
    priority: "normal",
    travelDate: "2026-05-20",
    submissionDate: "2026-05-01",
    assignedToUserId: "",
    isActive: true,
  })
})

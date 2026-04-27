import test from "node:test"
import assert from "node:assert/strict"

import { buildApplicantProfileUpdatePayload } from "../app/applicants/[id]/detail/profile-save"

test("buildApplicantProfileUpdatePayload maps basic form fields to API payload", () => {
  assert.deepEqual(
    buildApplicantProfileUpdatePayload({
      name: "张三",
      phone: "13800000000",
      email: "vistoria@qq.com",
      wechat: "wechat-id",
      passportNumber: "E12345678",
      note: "重点客户",
      usVisaSurname: "ZHANG",
      usVisaBirthYear: "1990",
      usVisaPassportNumber: "E12345678",
      schengenCountry: "france",
      schengenVisaCity: "LON",
    }),
    {
      name: "张三",
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
      schengen: {
        country: "france",
        city: "LON",
      },
    },
  )
})

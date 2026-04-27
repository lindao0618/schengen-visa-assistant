import test from "node:test"
import assert from "node:assert/strict"

import {
  buildTlsAccountInfo,
  buildTlsAccountTemplateText,
} from "../app/applicants/[id]/detail/tls-account"

test("buildTlsAccountInfo 优先使用申根 Excel 字段生成 TLS 汇报信息", () => {
  const info = buildTlsAccountInfo(
    {
      id: "applicant-1",
      userId: "user-1",
      label: "默认姓名",
      name: "中文姓名",
      schengen: {
        city: "beijing",
        fullIntake: {
          version: 1,
          sourceSlot: "schengenExcel",
          extractedAt: "2026-04-27T00:00:00.000Z",
          fieldCount: 5,
          items: [],
          audit: { ok: true, errors: [] },
          fields: {
            familyName: "ZHANG",
            firstName: "SAN",
            phoneUk: "13800000000",
            emailAccount: "vistoria@qq.com",
            emailPassword: "12345678",
          },
        },
      },
    },
    {
      bookingWindow: "5月上旬",
      acceptVip: "yes",
      tlsCity: "LON",
    },
  )

  assert.equal(info.name, "ZHANG SAN")
  assert.equal(info.bookingWindow, "5月上旬")
  assert.equal(info.acceptVip, "yes")
  assert.equal(info.city, "LON - 伦敦")
  assert.equal(info.phone, "13800000000")
  assert.equal(info.paymentAccount, "vistoria@qq.com")
  assert.equal(info.paymentPassword, "12345678")
})

test("buildTlsAccountTemplateText 输出客服可直接发送的固定格式", () => {
  assert.equal(
    buildTlsAccountTemplateText({
      name: "ZHANG SAN",
      bookingWindow: "5月上旬",
      acceptVip: "yes",
      city: "LON - 伦敦",
      groupSize: "1",
      phone: "13800000000",
      paymentAccount: "vistoria@qq.com",
      paymentPassword: "12345678",
      paymentLink: "https://visas-fr.tlscontact.com/en-us/",
    }),
    [
      "1.姓名：ZHANG SAN",
      "2.抢号区间再次确认：5月上旬",
      "⚠注意这个区间内任意一天都有可能",
      "抢到后不可更改 有特殊要求现在和我说哦",
      "以此次汇报为准",
      "3.是否接受vip：yes",
      "4.递签城市：LON - 伦敦",
      "5.人数：1",
      "6.电话：13800000000",
      "7.付款账号：vistoria@qq.com",
      "8.付款密码：12345678",
      "9.付款链接：https://visas-fr.tlscontact.com/en-us/",
    ].join("\n"),
  )
})

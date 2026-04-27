import test from "node:test"
import assert from "node:assert/strict"

import { collectDetectedUsVisaFieldLabels, sortUsVisaLabels } from "../app/applicants/[id]/detail/us-visa-fields"

test("sortUsVisaLabels orders known DS-160 fields before unknown labels", () => {
  assert.deepEqual(sortUsVisaLabels(["酒店名称", "未知字段", "护照号", "姓名", "邮箱"]), [
    "姓名",
    "酒店名称",
    "护照号",
    "邮箱",
    "未知字段",
  ])
})

test("collectDetectedUsVisaFieldLabels deduplicates non-empty intake labels", () => {
  assert.deepEqual(
    collectDetectedUsVisaFieldLabels({
      items: [
        { label: "邮箱", value: "a@example.com" },
        { label: "护照号", value: "E12345678" },
        { label: "邮箱", value: "duplicate@example.com" },
        { label: "空值字段", value: "" },
      ],
    }),
    ["护照号", "邮箱"],
  )
})

test("collectDetectedUsVisaFieldLabels falls back to parsed detail fields", () => {
  assert.deepEqual(
    collectDetectedUsVisaFieldLabels(undefined, {
      surname: "ZHANG",
      birthYear: "1990",
      passportNumber: "E12345678",
      chineseName: "张三",
      telecodeSurname: "",
      telecodeGivenName: "1234",
    }),
    ["姓", "名字电报码", "中文名", "出生年份", "护照号"],
  )
})

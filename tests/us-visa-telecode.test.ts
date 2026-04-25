import test from "node:test"
import assert from "node:assert/strict"
import { utils, write } from "xlsx"

import { deriveTelecodesFromChineseName } from "../lib/us-visa-chinese-telecode"
import { extractDs160PrecheckFromExcelBuffer } from "../lib/us-visa-ds160-precheck"
import { auditUsVisaExcelBuffer, extractUsVisaExcelReviewFields } from "../lib/us-visa-excel-audit"
import { extractUsVisaApplicantDetailsFromExcelBuffer } from "../lib/us-visa-excel-parser"

function workbookBuffer(rows: string[][]) {
  const workbook = utils.book_new()
  const sheet = utils.aoa_to_sheet(rows)
  utils.book_append_sheet(workbook, sheet, "Sheet1")
  return Buffer.from(write(workbook, { bookType: "xlsx", type: "buffer" }))
}

test("deriveTelecodesFromChineseName handles single-character surname", () => {
  const result = deriveTelecodesFromChineseName("张三")

  assert.equal(result.fullName, "张三")
  assert.equal(result.surnameChinese, "张")
  assert.equal(result.givenNameChinese, "三")
  assert.equal(result.telecodeSurname, "1728")
  assert.equal(result.telecodeGivenName, "0005")
  assert.deepEqual(result.unresolvedChars, [])
})

test("deriveTelecodesFromChineseName handles compound surnames", () => {
  const result = deriveTelecodesFromChineseName("欧阳娜娜")

  assert.equal(result.surnameChinese, "欧阳")
  assert.equal(result.givenNameChinese, "娜娜")
  assert.equal(result.telecodeSurname, "2962 7122")
  assert.equal(result.telecodeGivenName, "1226 1226")
  assert.deepEqual(result.unresolvedChars, [])
})

test("extractUsVisaApplicantDetailsFromExcelBuffer derives telecodes from chinese name", () => {
  const buffer = workbookBuffer([
    ["基本信息", "Field", "填写内容"],
    ["姓", "surname", "ZHANG"],
    ["名", "given_name", "SAN"],
    ["中文名", "chinese_name", "张三"],
    ["姓氏电报码", "telecode_surname", "9999"],
    ["名字电报码", "telecode_given_name", "8888"],
    ["出生日期", "birth_date", "1995/05/06"],
    ["护照号", "passport_number", "E12345678"],
  ])

  const result = extractUsVisaApplicantDetailsFromExcelBuffer(buffer)

  assert.equal(result.surname, "ZHANG")
  assert.equal(result.givenName, "SAN")
  assert.equal(result.birthYear, "1995")
  assert.equal(result.passportNumber, "E12345678")
  assert.equal(result.chineseName, "张三")
  assert.equal(result.telecodeSurname, "1728")
  assert.equal(result.telecodeGivenName, "0005")
})

test("extractUsVisaExcelReviewFields includes derived telecodes", () => {
  const buffer = workbookBuffer([
    ["基本信息", "Field", "填写内容"],
    ["中文名", "chinese_name", "张三"],
    ["姓氏电报码", "telecode_surname", "9999"],
    ["名字电报码", "telecode_given_name", "8888"],
  ])

  const result = extractUsVisaExcelReviewFields(buffer)

  assert.equal(result.chineseName, "张三")
  assert.equal(result.telecodeSurname, "1728")
  assert.equal(result.telecodeGivenName, "0005")
})

test("non-Chinese native name does not override provided telecodes", () => {
  const buffer = workbookBuffer([
    ["基本信息", "Field", "填写内容"],
    ["中文名", "chinese_name", "JIN DIAN"],
    ["姓氏电报码", "telecode_surname", "1728"],
    ["名字电报码", "telecode_given_name", "0005"],
  ])

  const parsed = extractUsVisaApplicantDetailsFromExcelBuffer(buffer)
  const review = extractUsVisaExcelReviewFields(buffer)

  assert.equal(parsed.telecodeSurname, "1728")
  assert.equal(parsed.telecodeGivenName, "0005")
  assert.equal(review.telecodeSurname, "1728")
  assert.equal(review.telecodeGivenName, "0005")
})

test("auditUsVisaExcelBuffer ignores AA/travel/lost-visa reminders", () => {
  const buffer = workbookBuffer([
    ["基本信息", "Field", "填写内容"],
    ["姓", "surname", "ZHANG"],
    ["名", "given_name", "SAN"],
    ["中文名", "chinese_name", "张三"],
    ["护照号", "passport_number", "E12345678"],
    ["主要电话", "primary_phone", "13800138000"],
    ["个人邮箱", "personal_email", "test@example.com"],
    ["在美地址", "hotel_address", "123 Main St"],
    ["在美城市", "hotel_city", "New York"],
    ["在美州", "hotel_state", "NY"],
    ["计划到达日期", "intended_arrival_date", "2099-01-01"],
    ["计划停留天数", "intended_stay_days", "7"],
    ["是否去过美国", "previous_us_travel", "YES"],
    ["签证是否遗失或被盗", "visa_lost_or_stolen", "YES"],
  ])

  const result = auditUsVisaExcelBuffer(buffer)

  assert.equal(result.errors.some((issue) => issue.field.includes("Application ID")), false)
  assert.equal(result.errors.some((issue) => issue.field.includes("上次赴美日期")), false)
  assert.equal(result.errors.some((issue) => issue.field.includes("签证遗失或被盗")), false)
})

test("extractDs160PrecheckFromExcelBuffer adds chinese name and telecodes", () => {
  const buffer = workbookBuffer([
    ["中文名", "张三"],
    ["姓氏电报码", "9999"],
    ["名字电报码", "8888"],
    ["家庭地址", "Room 301, Building 8"],
  ])

  const result = extractDs160PrecheckFromExcelBuffer(buffer, "sample.xlsx")
  const chineseName = result.fields.find((field) => field.key === "chinese_name")
  const telecodeSurname = result.fields.find((field) => field.key === "telecode_surname")
  const telecodeGivenName = result.fields.find((field) => field.key === "telecode_given_name")

  assert.equal(chineseName?.cleaned, "张三")
  assert.equal(telecodeSurname?.cleaned, "1728")
  assert.equal(telecodeGivenName?.cleaned, "0005")
  assert.match((telecodeSurname?.warnings || []).join(" "), /重新生成|忽略/)
  assert.equal(result.summary.total >= 3, true)
})

import test from "node:test"
import assert from "node:assert/strict"
import { utils, write } from "xlsx"

import { auditSchengenExcelBuffer } from "../lib/schengen-excel-audit"
import { buildUsVisaInterviewBrief } from "../lib/us-visa-interview-brief"

function workbookBuffer(sheetName: string, rows: string[][]) {
  const workbook = utils.book_new()
  const sheet = utils.aoa_to_sheet(rows)
  utils.book_append_sheet(workbook, sheet, sheetName)
  return Buffer.from(write(workbook, { bookType: "xlsx", type: "buffer" }))
}

test("schengen audit treats ambiguous slash dates as day-first", () => {
  const rows = [
    ["emailaccount", "applicant@example.com"],
    ["emailpassword", "secret123"],
    ["schengencountrytoapplyfor", "France"],
    ["currentcountryofresidenceandcity", "UK / London"],
    ["visasubmissioncity", "London"],
    ["familyname", "Zhang"],
    ["firstname", "San"],
    ["dateofbirth", "01/02/2000"],
    ["placeofbirth", "Shanghai"],
    ["sex", "Male"],
    ["civilstatus", "Single"],
    ["nationalidnumber", "ID123456"],
    ["numberoftraveldocument", "P1234567"],
    ["dateofissue", "01/01/2020"],
    ["validuntil", "01/01/2030"],
    ["streetcurrentaddressintheuk", "1 High Street"],
    ["citycurrentaddressintheuk", "London"],
    ["postcodecurrentaddressintheuk", "SW1A 1AA"],
    ["yourphonenumberwith44", "+447700900123"],
    ["residenceinacountryotherthanthecountryofcurrentnationality", "No"],
    ["sharecodenumber", "SCODE123"],
    ["validuntil", "05/06/2024"],
    ["effectivedate", "06/05/2024"],
    ["universityaddress", "1 College Road"],
    ["universitypostcode", "WC1 1AA"],
    ["universityphonenumber", "+442071234567"],
    ["universityemail", "uni@example.edu"],
    ["universityname", "Example University"],
    ["universitycity", "London"],
  ]

  const result = auditSchengenExcelBuffer(workbookBuffer("FV个人信息基础表", rows))

  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test("us visa interview brief computes stay days from day-first slash dates", () => {
  const rows = [
    ["hotel city", "New York"],
    ["hotel name", "Marriott Midtown"],
    ["hotel checkin date", "05/06/2024"],
    ["hotel checkout date", "06/06/2024"],
    ["present employer or school name", "Example University"],
    ["course of study", "Computer Science"],
  ]

  const result = buildUsVisaInterviewBrief(workbookBuffer("Sheet1", rows))
  const tripBlock = result.blocks.find((block) => block.type === "qa" && block.id === "q3")

  assert.equal(result.fields.arrivalDate, "05/06/2024")
  assert.equal(result.fields.departureDate, "06/06/2024")
  assert.equal(result.fields.stayDays, "2")
  assert.ok(tripBlock && tripBlock.type === "qa")
  assert.match(tripBlock.answerEn || "", /Jun 5, 2024/)
  assert.match(tripBlock.answerEn || "", /Jun 6, 2024/)
})

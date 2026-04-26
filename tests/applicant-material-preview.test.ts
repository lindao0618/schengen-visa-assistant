import test from "node:test"
import assert from "node:assert/strict"

import {
  getInitialExcelSheetName,
  resolveApplicantPreviewMode,
} from "../app/applicants/[id]/detail/material-preview"

test("resolveApplicantPreviewMode 识别 Word、Excel 和图片", () => {
  assert.equal(
    resolveApplicantPreviewMode(
      "passport.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    "word",
  )
  assert.equal(
    resolveApplicantPreviewMode(
      "form.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    "excel",
  )
  assert.equal(resolveApplicantPreviewMode("face.png", "image/png"), "image")
  assert.equal(resolveApplicantPreviewMode("note.txt", "text/plain"), "text")
})

test("getInitialExcelSheetName 优先返回 Sheet1", () => {
  assert.equal(getInitialExcelSheetName(["Info", "Sheet1", "Sheet2"], true), "Sheet1")
  assert.equal(getInitialExcelSheetName(["Info", "Sheet2"], true), "Info")
  assert.equal(getInitialExcelSheetName(["Main", "Extra"], false), "Main")
})

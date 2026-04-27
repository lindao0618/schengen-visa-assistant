import test from "node:test"
import assert from "node:assert/strict"

import {
  cloneTableRows,
  getInitialExcelSheetName,
  parseUsVisaExcelPreviewSections,
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

test("parseUsVisaExcelPreviewSections 按分组整理美签 Excel 预览字段", () => {
  assert.deepEqual(
    parseUsVisaExcelPreviewSections([
      ["基本信息", "field", "填写内容"],
      ["姓", "surname", "ZHANG"],
      ["联系方式"],
      ["邮箱", "email", "guest@example.com", "必填"],
      ["", "", ""],
    ]),
    [
      {
        title: "基本信息",
        items: [{ rowIndex: 2, label: "姓", field: "surname", value: "ZHANG", note: "" }],
      },
      {
        title: "联系方式",
        items: [{ rowIndex: 4, label: "邮箱", field: "email", value: "guest@example.com", note: "必填" }],
      },
    ],
  )
})

test("cloneTableRows 返回可独立编辑的表格副本", () => {
  const rows = [["姓名", "ZHANG"]]
  const cloned = cloneTableRows(rows)

  cloned[0][1] = "LI"

  assert.equal(rows[0][1], "ZHANG")
  assert.equal(cloned[0][1], "LI")
})

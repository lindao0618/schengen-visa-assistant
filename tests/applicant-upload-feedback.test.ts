import test from "node:test"
import assert from "node:assert/strict"

import {
  buildApplicantUploadSuccessMessage,
  buildRunningUploadAuditDialog,
  buildUploadAuditResultDialog,
  buildUsVisaAutoFixAuditDialog,
  getUploadExcelScope,
} from "../app/applicants/[id]/detail/upload-feedback"

test("getUploadExcelScope 识别申根和美签 Excel 上传 slot", () => {
  assert.equal(getUploadExcelScope("schengenExcel"), "schengen")
  assert.equal(getUploadExcelScope("franceExcel"), "schengen")
  assert.equal(getUploadExcelScope("usVisaDs160Excel"), "usVisa")
  assert.equal(getUploadExcelScope("aisExcel"), "usVisa")
  assert.equal(getUploadExcelScope("passport"), null)
})

test("buildRunningUploadAuditDialog 创建上传审核中的弹窗状态", () => {
  assert.deepEqual(buildRunningUploadAuditDialog("usVisa", "aisExcel"), {
    open: true,
    title: "美签 Excel 审核中",
    status: "running",
    issues: [],
    scope: "usVisa",
    slot: "aisExcel",
    helperText: "",
    autoFixing: false,
    phaseIndex: 0,
  })
})

test("buildUploadAuditResultDialog 给失败审核补充兜底问题", () => {
  assert.deepEqual(buildUploadAuditResultDialog("schengen", "franceExcel", { ok: false, errors: [] }), {
    open: true,
    title: "申根 Excel 审核失败",
    status: "error",
    issues: [{ field: "审核流程", message: "未获得有效审核结果，请重试上传。" }],
    scope: "schengen",
    slot: "franceExcel",
    helperText: "",
    autoFixing: false,
  })
})

test("buildUsVisaAutoFixAuditDialog 生成自动修复后的说明", () => {
  const dialog = buildUsVisaAutoFixAuditDialog("aisExcel", 2, { ok: true, errors: [] })

  assert.equal(dialog.title, "美签 Excel 审核通过")
  assert.equal(dialog.status, "success")
  assert.equal(dialog.helperText, "已自动处理 2 处格式问题，当前这份美签 Excel 已通过审核。")
  assert.deepEqual(dialog.issues, [])
})

test("buildApplicantUploadSuccessMessage 汇总识别到的字段", () => {
  assert.equal(
    buildApplicantUploadSuccessMessage({
      parsedUsVisaDetails: {
        surname: "ZHANG",
        passportNumber: "E12345678",
      },
      parsedSchengenDetails: {
        city: "LON",
      },
    }),
    "资料已上传，并自动识别 姓、护照号、TLS 递签城市：伦敦",
  )
})

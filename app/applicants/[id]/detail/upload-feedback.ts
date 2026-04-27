import { getFranceTlsCityLabel } from "../../../../lib/france-tls-city"

import type { ApplicantProfileDetail, AuditDialogState } from "./types"
import { collectDetectedUsVisaFieldLabels, type UsVisaIntakeLike } from "./us-visa-fields"

type AuditIssue = { field: string; message: string; value?: string }
type AuditPayload = {
  ok: boolean
  errors: AuditIssue[]
}

export type ApplicantFileUploadResponse = {
  profile?: ApplicantProfileDetail
  parsedUsVisaDetails?: {
    surname?: string
    givenName?: string
    birthYear?: string
    passportNumber?: string
    chineseName?: string
    telecodeSurname?: string
    telecodeGivenName?: string
  }
  parsedUsVisaFullIntake?: UsVisaIntakeLike
  parsedSchengenDetails?: { city?: string }
  schengenAudit?: AuditPayload
  usVisaAudit?: AuditPayload
  error?: string
}

export type UsVisaAutoFixResponse = {
  profile?: ApplicantProfileDetail
  changed?: boolean
  fixedCount?: number
  changes?: Array<{ field: string; before: string; after: string }>
  usVisaAudit?: AuditPayload
  error?: string
}

export type UploadExcelScope = "schengen" | "usVisa"

const SCHENGEN_EXCEL_UPLOAD_SLOTS = new Set(["schengenExcel", "franceExcel"])
const US_VISA_EXCEL_UPLOAD_SLOTS = new Set(["usVisaDs160Excel", "usVisaAisExcel", "ds160Excel", "aisExcel"])

export function getUploadExcelScope(slot: string): UploadExcelScope | null {
  if (SCHENGEN_EXCEL_UPLOAD_SLOTS.has(slot)) return "schengen"
  if (US_VISA_EXCEL_UPLOAD_SLOTS.has(slot)) return "usVisa"
  return null
}

export function buildRunningUploadAuditDialog(scope: UploadExcelScope, slot: string): AuditDialogState {
  return {
    open: true,
    title: scope === "schengen" ? "申根 Excel 审核中" : "美签 Excel 审核中",
    status: "running",
    issues: [],
    scope,
    slot,
    helperText: "",
    autoFixing: false,
    phaseIndex: 0,
  }
}

function auditIssuesForResult(audit?: AuditPayload): AuditIssue[] {
  if (audit?.ok) return []
  return audit?.errors.length
    ? audit.errors
    : [{ field: "审核流程", message: "未获得有效审核结果，请重试上传。" }]
}

export function buildUploadAuditResultDialog(
  scope: UploadExcelScope,
  slot: string,
  audit?: AuditPayload,
): AuditDialogState {
  const passed = Boolean(audit?.ok)
  return {
    open: true,
    title: scope === "schengen"
      ? passed
        ? "申根 Excel 审核通过"
        : "申根 Excel 审核失败"
      : passed
        ? "美签 Excel 审核通过"
        : "美签 Excel 审核失败",
    status: passed ? "success" : "error",
    issues: auditIssuesForResult(audit),
    scope,
    slot,
    helperText: scope === "usVisa" && !passed ? "格式类问题可以先让系统帮你处理，剩下的再手动修改。" : "",
    autoFixing: false,
  }
}

export function buildUsVisaAutoFixAuditDialog(
  slot: string,
  fixedCount: number,
  audit?: AuditPayload,
): AuditDialogState {
  const passed = Boolean(audit?.ok)
  const helperText =
    fixedCount > 0
      ? passed
        ? `已自动处理 ${fixedCount} 处格式问题，当前这份美签 Excel 已通过审核。`
        : `已自动处理 ${fixedCount} 处格式问题，剩余问题请你手动修改。`
      : "这份 Excel 里没有检测到可自动处理的格式问题，请手动修改剩余内容。"

  return {
    open: true,
    title: passed ? "美签 Excel 审核通过" : "美签 Excel 审核失败",
    status: passed ? "success" : "error",
    issues: auditIssuesForResult(audit),
    scope: "usVisa",
    slot,
    helperText,
    autoFixing: false,
  }
}

export function buildApplicantUploadSuccessMessage(data: ApplicantFileUploadResponse) {
  const parsedFields = [
    ...collectDetectedUsVisaFieldLabels(data.parsedUsVisaFullIntake, data.parsedUsVisaDetails),
    data.parsedSchengenDetails?.city
      ? `TLS 递签城市：${getFranceTlsCityLabel(data.parsedSchengenDetails.city) || data.parsedSchengenDetails.city}`
      : "",
  ].filter(Boolean)

  return parsedFields.length > 0 ? `资料已上传，并自动识别 ${parsedFields.join("、")}` : "资料已上传"
}

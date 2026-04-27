import { getFranceTlsCityLabel } from "../../../../lib/france-tls-city"

import type { ApplicantProfileDetail, CaseFormState } from "./types"

const TLS_PAYMENT_LINK = "https://visas-fr.tlscontact.com/en-us/"

export type TlsAccountInfo = {
  name: string
  bookingWindow: string
  acceptVip: string
  city: string
  groupSize: string
  phone: string
  paymentAccount: string
  paymentPassword: string
  paymentLink: string
}

function toDisplayValue(value?: string | null) {
  const normalized = String(value || "").trim()
  return normalized || "-"
}

function formatTlsCityDisplay(value?: string | null) {
  const normalized = String(value || "").trim()
  if (!normalized) return "-"
  const label = getFranceTlsCityLabel(normalized)
  return label ? `${normalized} - ${label}` : normalized
}

export function buildTlsAccountInfo(
  profile?: ApplicantProfileDetail | null,
  caseSource?: Pick<CaseFormState, "bookingWindow" | "acceptVip" | "tlsCity"> | null,
  fallbackTlsCity?: string,
): TlsAccountInfo {
  const schengenFields = profile?.schengen?.fullIntake?.fields || {}
  const familyName = String(schengenFields.familyName || "").trim()
  const firstName = String(schengenFields.firstName || "").trim()
  const excelEnglishName = [familyName, firstName].filter(Boolean).join(" ")
  const tlsCity = caseSource?.tlsCity?.trim() || fallbackTlsCity?.trim() || profile?.schengen?.city || ""

  return {
    name: toDisplayValue(excelEnglishName || profile?.name || profile?.label),
    bookingWindow: toDisplayValue(caseSource?.bookingWindow),
    acceptVip: toDisplayValue(caseSource?.acceptVip),
    city: formatTlsCityDisplay(tlsCity),
    groupSize: "1",
    phone: toDisplayValue(String(schengenFields.phoneUk || "").trim()),
    paymentAccount: toDisplayValue(String(schengenFields.emailAccount || "").trim()),
    paymentPassword: toDisplayValue(String(schengenFields.emailPassword || "").trim()),
    paymentLink: TLS_PAYMENT_LINK,
  }
}

export function buildTlsAccountTemplateText(info: TlsAccountInfo) {
  return [
    `1.姓名：${info.name}`,
    `2.抢号区间再次确认：${info.bookingWindow}`,
    "⚠注意这个区间内任意一天都有可能",
    "抢到后不可更改 有特殊要求现在和我说哦",
    "以此次汇报为准",
    `3.是否接受vip：${info.acceptVip}`,
    `4.递签城市：${info.city}`,
    `5.人数：${info.groupSize}`,
    `6.电话：${info.phone}`,
    `7.付款账号：${info.paymentAccount}`,
    `8.付款密码：${info.paymentPassword}`,
    `9.付款链接：${info.paymentLink}`,
  ].join("\n")
}

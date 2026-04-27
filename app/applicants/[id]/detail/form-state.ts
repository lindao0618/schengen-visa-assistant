import type { ApplicantProfileDetail, BasicFormState, CaseFormState, VisaCaseRecord } from "./types"
import { emptyBasicForm, emptyCaseForm } from "./types"

export const emptyApplicantCaseForm: CaseFormState = {
  caseType: "france-schengen",
  visaType: "",
  applyRegion: "",
  tlsCity: "",
  bookingWindow: "",
  acceptVip: "",
  slotTime: "",
  priority: "normal",
  travelDate: "",
  submissionDate: "",
  assignedToUserId: "",
  isActive: true,
}

export function buildBasicForm(profile?: ApplicantProfileDetail | null): BasicFormState {
  if (!profile) return emptyBasicForm
  return {
    name: profile.name || profile.label || "",
    phone: profile.phone || "",
    email: profile.email || "",
    wechat: profile.wechat || "",
    passportNumber: profile.passportNumber || "",
    note: profile.note || "",
    usVisaSurname: profile.usVisa?.surname || "",
    usVisaBirthYear: profile.usVisa?.birthYear || "",
    usVisaPassportNumber: profile.usVisa?.passportNumber || "",
    schengenCountry: profile.schengen?.country || "france",
    schengenVisaCity: profile.schengen?.city || "",
  }
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function buildCaseForm(
  visaCase?: VisaCaseRecord | null,
  fallback: CaseFormState = emptyCaseForm,
): CaseFormState {
  if (!visaCase) return fallback
  return {
    caseType: visaCase.caseType || "france-schengen",
    visaType: visaCase.visaType || "",
    applyRegion: visaCase.applyRegion || "",
    tlsCity: visaCase.tlsCity || "",
    bookingWindow: visaCase.bookingWindow || "",
    acceptVip: visaCase.acceptVip || "",
    slotTime: toDateTimeLocalValue(visaCase.slotTime),
    priority: visaCase.priority || "normal",
    travelDate: visaCase.travelDate ? visaCase.travelDate.slice(0, 10) : "",
    submissionDate: visaCase.submissionDate ? visaCase.submissionDate.slice(0, 10) : "",
    assignedToUserId: visaCase.assignedToUserId || "",
    isActive: visaCase.isActive,
  }
}

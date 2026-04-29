import { normalizeApplicantCrmVisaType } from "./applicant-crm-labels"
import type { ApplicantProfileFileSlot } from "./applicant-profiles"

export type InitialMaterialUploadSlot = {
  key: ApplicantProfileFileSlot
  label: string
  accept: string
  helperText: string
}

const FRANCE_UPLOAD_SLOTS: InitialMaterialUploadSlot[] = [
  {
    key: "schengenExcel",
    label: "法签 / 申根 Excel",
    accept: ".xlsx,.xls",
    helperText: "用于 France-visas / TLS 注册、建新申请和后续材料审核。",
  },
]

const US_UPLOAD_SLOTS: InitialMaterialUploadSlot[] = [
  {
    key: "usVisaPhoto",
    label: "美签照片",
    accept: "image/*",
    helperText: "用于照片检测、DS-160 和面试材料归档。",
  },
  {
    key: "usVisaDs160Excel",
    label: "美签 DS-160 / AIS Excel",
    accept: ".xlsx,.xls",
    helperText: "用于 DS-160 自动填写、AIS 注册和面试必看生成。",
  },
]

function appendUniqueSlots(target: InitialMaterialUploadSlot[], slots: readonly InitialMaterialUploadSlot[]) {
  const existing = new Set(target.map((slot) => slot.key))
  slots.forEach((slot) => {
    if (existing.has(slot.key)) return
    existing.add(slot.key)
    target.push(slot)
  })
}

export function getInitialMaterialUploadSlots(visaTypes: readonly string[]) {
  const normalizedTypes = new Set(visaTypes.map((type) => normalizeApplicantCrmVisaType(type)).filter(Boolean))
  const slots: InitialMaterialUploadSlot[] = []

  if (normalizedTypes.has("france-schengen")) {
    appendUniqueSlots(slots, FRANCE_UPLOAD_SLOTS)
  }
  if (normalizedTypes.has("usa-visa")) {
    appendUniqueSlots(slots, US_UPLOAD_SLOTS)
  }

  return slots
}

export function shouldShowInitialMaterialUploadPrompt(visaTypes: readonly string[]) {
  return getInitialMaterialUploadSlots(visaTypes).length > 0
}

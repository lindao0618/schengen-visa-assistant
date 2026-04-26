import type { CaseFormState, VisaCaseRecord } from "./types"

function isFranceSchengenCase(caseLike?: { caseType?: string | null; visaType?: string | null } | null) {
  if (!caseLike) return false
  return caseLike.caseType === "france-schengen" || caseLike.visaType === "france-schengen"
}

export function resolveSelectedFranceCase(cases: VisaCaseRecord[], selectedCase: VisaCaseRecord | null) {
  if (selectedCase && isFranceSchengenCase(selectedCase)) return selectedCase
  return cases.find((item) => item.isActive && isFranceSchengenCase(item)) ?? cases.find((item) => isFranceSchengenCase(item)) ?? null
}

export function resolveTlsAccountCaseSource(
  selectedCase: VisaCaseRecord | null,
  selectedFranceCase: VisaCaseRecord | null,
  caseForm: CaseFormState,
) {
  if (selectedCase && isFranceSchengenCase(selectedCase)) {
    return {
      bookingWindow: caseForm.bookingWindow,
      acceptVip: caseForm.acceptVip,
      tlsCity: caseForm.tlsCity,
    }
  }

  if (!selectedFranceCase) return null

  return {
    bookingWindow: selectedFranceCase.bookingWindow || "",
    acceptVip: selectedFranceCase.acceptVip || "",
    tlsCity: selectedFranceCase.tlsCity || "",
  }
}

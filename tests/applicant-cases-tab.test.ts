import assert from "node:assert/strict"
import test from "node:test"

import { resolveSelectedFranceCase, resolveTlsAccountCaseSource } from "../app/applicants/[id]/detail/cases-tab"

test("resolveSelectedFranceCase returns selected france case first", () => {
  const cases = [
    { id: "a", caseType: "us-niv", visaType: "us-niv", isActive: false },
    { id: "b", caseType: "france-schengen", visaType: "france-schengen", isActive: true },
  ] as any

  assert.equal(resolveSelectedFranceCase(cases, cases[1])?.id, "b")
})

test("resolveSelectedFranceCase falls back to active france case", () => {
  const cases = [
    { id: "a", caseType: "us-niv", visaType: "us-niv", isActive: false },
    { id: "b", caseType: "france-schengen", visaType: "france-schengen", isActive: true },
  ] as any

  assert.equal(resolveSelectedFranceCase(cases, cases[0])?.id, "b")
})

test("resolveTlsAccountCaseSource prefers case form when selected case is france", () => {
  const selectedCase = { caseType: "france-schengen", visaType: "france-schengen" } as any
  const selectedFranceCase = { bookingWindow: "2026-05-01~2026-05-10", acceptVip: "yes", tlsCity: "paris" } as any
  const caseForm = { bookingWindow: "2026-06-01~2026-06-10", acceptVip: "no", tlsCity: "lyon" } as any

  assert.deepEqual(resolveTlsAccountCaseSource(selectedCase, selectedFranceCase, caseForm), {
    bookingWindow: "2026-06-01~2026-06-10",
    acceptVip: "no",
    tlsCity: "lyon",
  })
})

test("resolveTlsAccountCaseSource falls back to france case data", () => {
  const selectedCase = { caseType: "us-niv", visaType: "us-niv" } as any
  const selectedFranceCase = { bookingWindow: "2026-05-01~2026-05-10", acceptVip: "yes", tlsCity: "paris" } as any
  const caseForm = { bookingWindow: "", acceptVip: "", tlsCity: "" } as any

  assert.deepEqual(resolveTlsAccountCaseSource(selectedCase, selectedFranceCase, caseForm), {
    bookingWindow: "2026-05-01~2026-05-10",
    acceptVip: "yes",
    tlsCity: "paris",
  })
})

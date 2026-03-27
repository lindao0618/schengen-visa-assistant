export const FRANCE_TLS_CITY_OPTIONS = [
  { value: "LON", label: "伦敦" },
  { value: "MNC", label: "曼彻斯特" },
  { value: "EDI", label: "爱丁堡" },
] as const

export type FranceTlsCityCode = (typeof FRANCE_TLS_CITY_OPTIONS)[number]["value"]

const CITY_ALIASES: Array<{ code: FranceTlsCityCode; patterns: RegExp[] }> = [
  {
    code: "LON",
    patterns: [/\bLON\b/i, /\bLONDON\b/i, /伦敦/, /GBLON2FR/i],
  },
  {
    code: "MNC",
    patterns: [/\bMNC\b/i, /\bMANCHESTER\b/i, /曼彻斯特/, /GBMNC2FR/i],
  },
  {
    code: "EDI",
    patterns: [/\bEDI\b/i, /\bEDINBURGH\b/i, /爱丁堡/, /GBEDI2FR/i],
  },
]

export function normalizeFranceTlsCity(value: unknown): FranceTlsCityCode | undefined {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim()
  if (!normalized) return undefined

  for (const candidate of CITY_ALIASES) {
    if (candidate.patterns.some((pattern) => pattern.test(normalized))) {
      return candidate.code
    }
  }

  return undefined
}

export function getFranceTlsCityLabel(value: unknown) {
  const normalized = normalizeFranceTlsCity(value)
  return FRANCE_TLS_CITY_OPTIONS.find((item) => item.value === normalized)?.label || ""
}

import { read, utils } from "xlsx"

import { normalizeFranceTlsCity, type FranceTlsCityCode } from "@/lib/france-tls-city"

const STRONG_CITY_KEY_PATTERNS = [
  /递签城市/i,
  /visa submission city/i,
  /\bapplication_city\b/i,
  /\bapplication city\b/i,
  /tls city/i,
  /tls location/i,
  /submission city/i,
] as const

const WEAK_CITY_KEY_PATTERNS = [
  /申请城市/i,
  /签证中心城市/i,
  /签证申请城市/i,
  /visa center city/i,
  /visa centre city/i,
] as const

const NEGATIVE_CITY_KEY_PATTERNS = [
  /居住城市/i,
  /current country of residence and city/i,
  /country of residence/i,
  /出生城市/i,
  /city of birth/i,
  /birth city/i,
  /destination city/i,
  /departure city/i,
] as const

function normalizeCell(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  return String(value).trim()
}

function matchesAny(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

function normalizeKey(value: unknown) {
  return normalizeCell(value).replace(/\s+/g, " ").toLowerCase()
}

function isCityKey(value: unknown, mode: "strong" | "weak" = "strong") {
  const normalized = normalizeKey(value)
  if (!normalized) return false
  if (matchesAny(normalized, NEGATIVE_CITY_KEY_PATTERNS)) return false
  if (matchesAny(normalized, STRONG_CITY_KEY_PATTERNS)) return true
  if (mode === "weak" && matchesAny(normalized, WEAK_CITY_KEY_PATTERNS)) return true
  return false
}

function findCityInValues(values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeFranceTlsCity(value)
    if (normalized) return normalized
  }
  return undefined
}

function extractCandidateNearCell(matrix: unknown[][], rowIndex: number, colIndex: number) {
  const row = matrix[rowIndex] || []
  const nextRow = matrix[rowIndex + 1] || []

  return findCityInValues([
    row[colIndex + 1],
    row[colIndex + 2],
    nextRow[colIndex],
    nextRow[colIndex + 1],
  ])
}

function extractCityFromMatrix(matrix: unknown[][]): FranceTlsCityCode | undefined {
  for (const mode of ["strong", "weak"] as const) {
    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || []
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        if (!isCityKey(row[colIndex], mode)) continue

        const candidate = extractCandidateNearCell(matrix, rowIndex, colIndex)
        if (candidate) return candidate
      }
    }
  }

  const headerRowLimit = Math.min(matrix.length - 1, 4)
  for (const mode of ["strong", "weak"] as const) {
    for (let rowIndex = 0; rowIndex <= headerRowLimit; rowIndex += 1) {
      const headers = matrix[rowIndex] || []
      const values = matrix[rowIndex + 1] || []
      for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
        if (!isCityKey(headers[colIndex], mode)) continue
        const candidate = normalizeFranceTlsCity(values[colIndex])
        if (candidate) return candidate
      }
    }
  }

  return undefined
}

function extractCityFromObjects(rows: Array<Record<string, unknown>>): FranceTlsCityCode | undefined {
  for (const mode of ["strong", "weak"] as const) {
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (!isCityKey(key, mode)) continue
        const candidate = normalizeFranceTlsCity(value)
        if (candidate) return candidate
      }
    }
  }

  return undefined
}

export function extractFranceTlsCityFromExcelBuffer(buffer: Buffer): FranceTlsCityCode | undefined {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false })

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const matrix = utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][]
    const fromMatrix = extractCityFromMatrix(matrix)
    if (fromMatrix) return fromMatrix

    const objects = utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
      blankrows: false,
    })
    const fromObjects = extractCityFromObjects(objects)
    if (fromObjects) return fromObjects
  }

  return undefined
}

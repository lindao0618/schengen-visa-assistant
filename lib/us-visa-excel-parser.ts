import { read, utils } from "xlsx"

export interface ParsedUsVisaExcelDetails {
  surname?: string
  birthYear?: string
  passportNumber?: string
}

const SURNAME_ALIASES = new Set(["姓", "姓氏", "surname", "lastname", "familyname"].map(normalizeKey))

const BIRTH_DATE_ALIASES = new Set(
  ["出生年月日", "出生日期", "birthdate", "birth_date", "dateofbirth", "dob"].map(normalizeKey)
)

const PASSPORT_NUMBER_ALIASES = new Set(
  ["护照号", "护照号码", "passportnumber", "passport_number", "passportno", "passportno."].map(normalizeKey)
)

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[\s_\-()（）:：.]/g, "")
}

function extractBirthYear(value: string) {
  const match = value.trim().match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : undefined
}

function pickRowValue(row: unknown[], aliases: Set<string>) {
  const cells = row.map((cell) => normalizeText(cell)).filter(Boolean)
  if (cells.length === 0) return undefined

  let sawAlias = false
  for (const cell of cells) {
    if (aliases.has(normalizeKey(cell))) {
      sawAlias = true
      continue
    }
    if (sawAlias) {
      return cell
    }
  }

  return undefined
}

export function extractUsVisaApplicantDetailsFromExcelBuffer(buffer: Buffer): ParsedUsVisaExcelDetails {
  const workbook = read(buffer, { type: "buffer", cellDates: false })
  const details: ParsedUsVisaExcelDetails = {}

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as unknown[][]

    for (const row of rows) {
      if (!details.surname) {
        const surname = pickRowValue(row, SURNAME_ALIASES)
        if (surname) details.surname = surname
      }

      if (!details.birthYear) {
        const birthDate = pickRowValue(row, BIRTH_DATE_ALIASES)
        if (birthDate) {
          const birthYear = extractBirthYear(birthDate)
          if (birthYear) details.birthYear = birthYear
        }
      }

      if (!details.passportNumber) {
        const passportNumber = pickRowValue(row, PASSPORT_NUMBER_ALIASES)
        if (passportNumber) details.passportNumber = passportNumber
      }

      if (details.surname && details.birthYear && details.passportNumber) {
        return details
      }
    }
  }

  return details
}

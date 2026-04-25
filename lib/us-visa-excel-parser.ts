import { read, utils } from "xlsx"

import {
  deriveTelecodesFromChineseName,
  hasHanCharacters,
  normalizeChineseName,
  normalizeTelecodeValue,
} from "./us-visa-chinese-telecode"

export interface ParsedUsVisaExcelDetails {
  surname?: string
  givenName?: string
  birthYear?: string
  passportNumber?: string
  chineseName?: string
  telecodeSurname?: string
  telecodeGivenName?: string
}

type FieldConfig = {
  key: keyof ParsedUsVisaExcelDetails
  aliases: string[]
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "surname",
    aliases: ["姓", "姓氏", "surname", "lastname", "last name", "familyname", "family name"],
  },
  {
    key: "givenName",
    aliases: ["名", "名字", "givenname", "given name", "firstname", "first name"],
  },
  {
    key: "birthYear",
    aliases: ["出生日期", "出生年月日", "出生年份", "birthdate", "birth date", "dateofbirth", "dob", "birth year"],
  },
  {
    key: "passportNumber",
    aliases: ["护照号", "护照号码", "passportnumber", "passport number", "passportno", "passport no", "passportno."],
  },
  {
    key: "chineseName",
    aliases: [
      "中文名",
      "中文姓名",
      "姓名中文",
      "chinesename",
      "chinese name",
      "fullnameinnativealphabet",
      "full name in native alphabet",
      "native name",
    ],
  },
  {
    key: "telecodeSurname",
    aliases: [
      "姓氏电报码",
      "姓电报码",
      "surname telecode",
      "telecode surname",
      "telecode of surname",
      "telecodesurname",
    ],
  },
  {
    key: "telecodeGivenName",
    aliases: [
      "名字电报码",
      "名电报码",
      "given name telecode",
      "telecode given name",
      "telecode of given name",
      "telecodegivenname",
    ],
  },
]

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[\s_\-()（）:：.。,，/\\]+/g, "")
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
      for (const config of FIELD_CONFIGS) {
        if (details[config.key]) continue
        const value = pickRowValue(row, new Set(config.aliases.map(normalizeKey)))
        if (!value) continue

        if (config.key === "birthYear") {
          const birthYear = extractBirthYear(value)
          if (birthYear) details.birthYear = birthYear
          continue
        }

        details[config.key] = value
      }
    }
  }

  if (details.chineseName) {
    details.chineseName = normalizeChineseName(details.chineseName) || undefined
  }

  if (details.telecodeSurname) {
    details.telecodeSurname = normalizeTelecodeValue(details.telecodeSurname) || undefined
  }

  if (details.telecodeGivenName) {
    details.telecodeGivenName = normalizeTelecodeValue(details.telecodeGivenName) || undefined
  }

  if (details.chineseName && hasHanCharacters(details.chineseName)) {
    const derived = deriveTelecodesFromChineseName(details.chineseName)
    details.chineseName = derived.fullName || details.chineseName
    details.telecodeSurname = derived.telecodeSurname || undefined
    details.telecodeGivenName = derived.telecodeGivenName || undefined
  }

  return details
}

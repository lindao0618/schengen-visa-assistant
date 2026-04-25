import { read, utils } from "xlsx"

import {
  deriveTelecodesFromChineseName,
  hasHanCharacters,
  normalizeChineseName,
  normalizeTelecodeValue,
} from "./us-visa-chinese-telecode"

type AuditIssue = {
  field: string
  message: string
  value?: string
}

export type UsVisaExcelAuditResult = {
  ok: boolean
  errors: AuditIssue[]
}

type FieldRule = {
  key: string
  label: string
  aliases: string[]
}

type SheetRows = {
  sheetName: string
  rows: string[][]
}

export type UsVisaExcelReviewFieldMap = Record<string, string>

const FIELD_RULES: FieldRule[] = [
  {
    key: "applicationId",
    label: "AA码 / Application ID",
    aliases: ["AA码", "AA code", "Application ID", "Application Number", "DS-160 Number", "DS160 Number"],
  },
  {
    key: "surname",
    label: "姓 / Surname",
    aliases: ["姓", "姓氏", "Surname", "Last Name", "Family Name"],
  },
  {
    key: "givenName",
    label: "名 / Given Name",
    aliases: ["名", "Given Name", "First Name"],
  },
  {
    key: "chineseName",
    label: "中文名 / Chinese Name",
    aliases: ["中文名", "中文姓名", "Chinese Name", "Full Name in Native Alphabet", "Native Name"],
  },
  {
    key: "telecodeSurname",
    label: "姓氏电报码 / Telecode Surname",
    aliases: ["姓氏电报码", "姓电报码", "Telecode Surname", "Surname Telecode"],
  },
  {
    key: "telecodeGivenName",
    label: "名字电报码 / Telecode Given Name",
    aliases: ["名字电报码", "名电报码", "Telecode Given Name", "Given Name Telecode"],
  },
  {
    key: "dateOfBirth",
    label: "出生日期 / Date of Birth",
    aliases: ["出生年月日", "出生日期", "Birth Date", "Date of Birth", "DOB"],
  },
  {
    key: "birthYear",
    label: "出生年份 / Birth Year",
    aliases: ["出生年份", "Birth Year", "Year of Birth"],
  },
  {
    key: "passportNumber",
    label: "护照号 / Passport Number",
    aliases: ["护照号", "护照号码", "Passport Number", "Passport No", "Number of Travel Document"],
  },
  {
    key: "primaryPhone",
    label: "主要电话 / Primary Phone",
    aliases: ["主要电话", "Primary Phone Number", "Primary Phone", "Phone Number"],
  },
  {
    key: "lastFiveYearsPhone",
    label: "近五年电话 / Last Five Years Phone",
    aliases: ["近五年电话", "last five years phone number", "Last Five Years Phone Number"],
  },
  {
    key: "personalEmail",
    label: "个人邮箱 / Personal Email",
    aliases: ["个人邮箱", "Personal Email Address", "Personal Email", "Email Address"],
  },
  {
    key: "lastFiveYearsEmail",
    label: "近五年邮箱 / Last Five Years Email",
    aliases: ["近五年邮箱", "last five years email address", "Last Five Years Email Address"],
  },
  {
    key: "homeAddress",
    label: "家庭地址 / Home Address",
    aliases: ["（目前）家庭地址", "家庭地址", "Home Address", "Present Home Address"],
  },
  {
    key: "homeCity",
    label: "家庭城市 / Home City",
    aliases: ["家庭城市", "Home City"],
  },
  {
    key: "homeState",
    label: "家庭省/州 / Home State",
    aliases: ["家庭省/州", "家庭省州", "Home State", "Home State/Province", "State/Province"],
  },
  {
    key: "homeZip",
    label: "家庭邮编 / Home Zip",
    aliases: ["家庭邮编", "家庭邮政编码", "Home Zip", "Home Postal Code", "Zip Code", "Postal Code"],
  },
  {
    key: "presentSchoolAddress",
    label: "当前学校/单位地址",
    aliases: ["当前学校/单位地址", "当前学校地址", "当前单位地址", "Present Employer Or School Address"],
  },
  {
    key: "presentSchoolCity",
    label: "当前学校/单位城市",
    aliases: ["当前城市", "Present Employer Or School City", "Current City"],
  },
  {
    key: "presentSchoolState",
    label: "当前学校/单位省州",
    aliases: ["当前州/省", "当前州省", "Present Employer Or School State", "Current State", "Current Province"],
  },
  {
    key: "presentSchoolZip",
    label: "当前学校/单位邮编",
    aliases: ["当前邮编", "当前邮政编码", "Present Employer Or School Zip", "Current Zip", "Current Postal Code"],
  },
  {
    key: "previousSchoolAddress",
    label: "前学校/单位地址",
    aliases: ["前学校/单位地址", "前学校地址", "前单位地址", "Previous Employer Or School Address"],
  },
  {
    key: "educationAddress",
    label: "教育机构地址",
    aliases: ["学校地址", "教育机构地址", "Educational Institution Address"],
  },
  {
    key: "intendedArrivalDate",
    label: "计划到达日期 / Intended Arrival Date",
    aliases: ["计划到达日期", "Intended Date of Arrival", "Arrival Date"],
  },
  {
    key: "intendedArrivalYear",
    label: "计划到达年份",
    aliases: ["计划到达年份", "Arrival Year", "Intended Arrival Year"],
  },
  {
    key: "intendedArrivalMonth",
    label: "计划到达月份",
    aliases: ["计划到达月份", "Arrival Month", "Intended Arrival Month"],
  },
  {
    key: "intendedArrivalDay",
    label: "计划到达日",
    aliases: ["计划到达日", "计划到达日期(日)", "Arrival Day", "Intended Arrival Day"],
  },
  {
    key: "intendedStayDays",
    label: "计划停留天数 / Intended Stay Days",
    aliases: ["计划停留天数", "停留天数", "Intended Length Of Stay In U.S.", "Intended Stay Days"],
  },
  {
    key: "hotelAddress",
    label: "在美地址 / Street Address (Line 1)",
    aliases: ["酒店地址", "在美地址", "Hotel Address", "Street Address Line 1", "Address Where You Will Stay In The U.S."],
  },
  {
    key: "hotelCity",
    label: "在美城市 / City",
    aliases: ["酒店城市", "赴美城市", "目的地城市", "Hotel City", "U.S. Stay City"],
  },
  {
    key: "hotelState",
    label: "在美州 / State",
    aliases: ["酒店州", "Hotel State", "U.S. Stay State", "State Where You Will Stay"],
  },
  {
    key: "firstTimeUsVisa",
    label: "\u662f\u5426\u7b2c\u4e00\u6b21\u529e\u7406\u7f8e\u7b7e",
    aliases: [
      "\u662f\u5426\u7b2c\u4e00\u6b21\u529e\u7406\u7f8e\u7b7e",
      "\u662f\u5426\u7b2c\u4e00\u6b21\u7533\u8bf7\u7f8e\u7b7e",
      "First Time U.S. Visa",
      "First Time US Visa",
      "First U.S. Visa Application",
      "Is This Your First Time Applying For A U.S. Visa",
    ],
  },
  {
    key: "hasFormerName",
    label: "是否有曾用名",
    aliases: ["是否有曾用名", "Has Former Name"],
  },
  {
    key: "formerNameSurname",
    label: "曾用名姓",
    aliases: ["曾用名姓", "姓(拼音)", "Former Name Surname"],
  },
  {
    key: "formerNameGivenName",
    label: "曾用名名",
    aliases: ["曾用名名", "名(拼音)", "Former Name Given Name"],
  },
  {
    key: "previousUsTravel",
    label: "是否去过美国",
    aliases: ["是否去过美国", "Previous U.S. Travel"],
  },
  {
    key: "previousUsTravelArrivalDate",
    label: "上次赴美日期",
    aliases: ["到达美国的日期", "Previous U.S. Travel Arrival Date"],
  },
  {
    key: "previousUsTravelYear",
    label: "赴美年份",
    aliases: ["去美年份", "Previous U.S. Travel Year"],
  },
  {
    key: "previousUsTravelMonth",
    label: "赴美月份",
    aliases: ["去美月份", "Previous U.S. Travel Month"],
  },
  {
    key: "previousUsTravelDay",
    label: "赴美日期",
    aliases: ["去美日期", "Previous U.S. Travel Day"],
  },
  {
    key: "hasUsDriversLicense",
    label: "是否有美国驾照",
    aliases: ["是否有美国驾照", "Has U.S. Drivers License"],
  },
  {
    key: "usDriversLicenseNumber",
    label: "美国驾照号",
    aliases: ["美国驾照号码", "U.S. Drivers License Number"],
  },
  {
    key: "usDriversLicenseState",
    label: "驾照颁发州",
    aliases: ["驾照颁发州", "U.S. Drivers License State"],
  },
  {
    key: "hasUsVisa",
    label: "是否曾有美国签证",
    aliases: ["是否曾有美国签证", "Has U.S. Visa"],
  },
  {
    key: "usVisaNumber",
    label: "美国签证号",
    aliases: ["美国签证号", "U.S. Visa Number"],
  },
  {
    key: "visaLostOrStolen",
    label: "签证是否遗失或被盗",
    aliases: ["签证是否遗失或被盗", "Visa Lost Or Stolen"],
  },
  {
    key: "visaLostOrStolenYear",
    label: "签证遗失或被盗年份",
    aliases: ["签证遗失或被盗年份", "Visa Lost Or Stolen Year"],
  },
  {
    key: "visaLostOrStolenExplanation",
    label: "签证遗失或被盗说明",
    aliases: ["签证遗失或被盗说明", "Visa Lost Or Stolen Explanation"],
  },
  {
    key: "visaCancelledOrRevoked",
    label: "签证是否被取消或吊销",
    aliases: ["签证是否被取消或吊销", "Visa Cancelled Or Revoked"],
  },
  {
    key: "visaCancelledOrRevokedExplanation",
    label: "签证被取消或吊销说明",
    aliases: ["签证被取消或吊销说明", "Visa Cancelled Or Revoked Explanation"],
  },
  {
    key: "hasBeenRefusedVisa",
    label: "是否被拒签",
    aliases: ["是否被拒签", "Has Been Refused Visa"],
  },
  {
    key: "hasBeenRefusedReason",
    label: "拒签原因",
    aliases: ["被拒签原因", "Has Been Refused Reason"],
  },
  {
    key: "hasImmigrantPetition",
    label: "是否有人为您提交移民签证申请",
    aliases: ["是否有人为您提交移民签证申请", "Has Immigrant Petition"],
  },
  {
    key: "immigrantPetitionExplanation",
    label: "移民签证申请说明",
    aliases: ["移民签证申请说明", "Immigrant Petition Explanation"],
  },
]

const ALL_ALIASES = FIELD_RULES.flatMap((field) => field.aliases)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const AA_CODE_PATTERN = /^AA[0-9A-Z]{8,}$/i
const US_STATE_CODE_PATTERN = /^[A-Z]{2}$/
const US_STATE_NAME_PATTERN = /^[A-Z][A-Z\s.'-]{1,40}$/
const DS160_SAFE_TEXT_PATTERN = /^[A-Z0-9&' -]+$/i
const ADDRESS_FIELD_KEYS = [
  "homeAddress",
  "homeCity",
  "homeState",
  "homeZip",
  "presentSchoolAddress",
  "presentSchoolCity",
  "presentSchoolState",
  "presentSchoolZip",
  "previousSchoolAddress",
  "educationAddress",
  "hotelAddress",
  "hotelCity",
  "hotelState",
] as const

function normalizeText(value: unknown): string {
  if (value == null) return ""
  const text = typeof value === "string" ? value : String(value)
  return text
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .trim()
}

function normalizeAscii(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeKey(value: unknown): string {
  return normalizeAscii(normalizeText(value)).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

function normalizeEmail(value: string): string {
  return normalizeText(value).toLowerCase()
}

function normalizePhoneDigits(value: string): string {
  return normalizeText(value).replace(/\D/g, "")
}

function isEmptyValue(value: string): boolean {
  const normalized = normalizeText(value).toLowerCase()
  return !normalized || normalized === "-" || normalized === "n/a" || normalized === "na" || normalized === "none"
}

function isTruthyYes(value: string): boolean {
  const normalized = normalizeText(value).toLowerCase()
  return ["yes", "y", "true", "1", "是", "有"].includes(normalized)
}

function isAliasLikeCell(value: string): boolean {
  const normalized = normalizeKey(value)
  if (!normalized) return false
  return ALL_ALIASES.some((alias) => normalized.includes(normalizeKey(alias)))
}

function isMetaCellValue(value: string): boolean {
  const normalized = normalizeKey(value)
  return !normalized || normalized === "field" || normalized === normalizeKey("填写内容")
}

type XlsxLooseCell = { v?: unknown; w?: string }

function formatIsoLocalDate(cell: Date): string {
  if (Number.isNaN(cell.getTime())) return ""
  const y = cell.getFullYear()
  const m = String(cell.getMonth() + 1).padStart(2, "0")
  const d = String(cell.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * 不做自定义「日期换算」：优先 cell.w（表格里看见的），否则用 SheetJS format_cell 按单元格数字格式渲染，
 * 与 Excel 显示一致；避免把日期处理成序列号数字或我们自造的 ISO。
 */
function auditCellDisplay(cell: XlsxLooseCell | undefined): string {
  if (!cell) return ""
  if (typeof cell.w === "string" && cell.w.trim() !== "") {
    return normalizeText(cell.w)
  }
  try {
    const formatted = utils.format_cell(cell as Parameters<typeof utils.format_cell>[0])
    if (formatted != null && String(formatted).trim() !== "") {
      return normalizeText(String(formatted))
    }
  } catch {
    /* ignore */
  }
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    return formatIsoLocalDate(cell.v)
  }
  return normalizeText(cell.v ?? "")
}

function sheetToFilteredAuditMatrix(sheet: ReturnType<typeof read>["Sheets"][string]): string[][] {
  const ref = sheet["!ref"]
  if (!ref) return []
  const range = utils.decode_range(ref)
  const rows: string[][] = []
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: string[] = []
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = utils.encode_cell({ r: r, c: c })
      row.push(auditCellDisplay(sheet[addr] as XlsxLooseCell | undefined))
    }
    if (row.some((cell) => normalizeText(cell))) {
      rows.push(row)
    }
  }
  return rows
}

function extractWorkbookRows(buffer: Buffer): SheetRows[] {
  const workbook = read(buffer, { type: "buffer", cellDates: true })
  const targetSheetName = workbook.SheetNames.find((name) => normalizeKey(name) === "sheet1") || workbook.SheetNames[0]
  const sheet = targetSheetName ? workbook.Sheets[targetSheetName] : undefined
  if (!sheet || !targetSheetName) return []

  return [
    {
      sheetName: targetSheetName,
      rows: sheetToFilteredAuditMatrix(sheet),
    },
  ]
}

function findAdjacentValue(row: string[], aliases: string[]): string {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias))
  for (let index = 0; index < row.length; index += 1) {
    const cell = normalizeKey(row[index])
    if (!cell) continue
    const matched = normalizedAliases.some((alias) => cell.includes(alias))
    if (!matched) continue

    for (let candidateIndex = index + 1; candidateIndex < row.length; candidateIndex += 1) {
      const candidate = normalizeText(row[candidateIndex] || "")
      if (isEmptyValue(candidate) || isMetaCellValue(candidate) || isAliasLikeCell(candidate)) continue
      return candidate
    }
    return ""
  }
  return ""
}

function findHeaderColumnValue(rows: string[][], aliases: string[]): string {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias))
  const maxHeaderRows = Math.min(rows.length - 1, 8)

  for (let rowIndex = 0; rowIndex < maxHeaderRows; rowIndex += 1) {
    const headerRow = rows[rowIndex] || []
    const dataRow = rows[rowIndex + 1] || []
    for (let columnIndex = 0; columnIndex < headerRow.length; columnIndex += 1) {
      const headerCell = normalizeKey(headerRow[columnIndex])
      if (!headerCell) continue
      const matched = normalizedAliases.some((alias) => headerCell.includes(alias))
      if (!matched) continue
      const value = normalizeText(dataRow[columnIndex] || "")
      if (isAliasLikeCell(value)) return ""
      return value
    }
  }

  return ""
}

function matchesAnyAlias(value: unknown, aliases: string[]): boolean {
  const normalized = normalizeKey(value)
  if (!normalized) return false
  return aliases.some((alias) => {
    const normalizedAlias = normalizeKey(alias)
    return Boolean(normalizedAlias) && (normalized === normalizedAlias || normalized.includes(normalizedAlias))
  })
}

function findStructuredSheet1Value(rows: string[][], aliases: string[]): string {
  for (const row of rows) {
    const leftLabel = row[0] || ""
    const fieldLabel = row[1] || ""
    if (!matchesAnyAlias(leftLabel, aliases) && !matchesAnyAlias(fieldLabel, aliases)) {
      continue
    }

    const candidate = normalizeText(row[2] || "")
    if (isEmptyValue(candidate) || isMetaCellValue(candidate) || isAliasLikeCell(candidate)) {
      return ""
    }
    return candidate
  }

  return ""
}

function collectWorkbookValues(sheets: SheetRows[]): Map<string, string> {
  const values = new Map<string, string>()

  for (const rule of FIELD_RULES) {
    for (const sheet of sheets) {
      let matched = findStructuredSheet1Value(sheet.rows, rule.aliases)
      if (!isEmptyValue(matched)) {
        values.set(rule.key, matched)
        break
      }

      matched = ""
      for (const row of sheet.rows) {
        matched = findAdjacentValue(row, rule.aliases)
        if (!isEmptyValue(matched)) break
      }

      if (isEmptyValue(matched)) {
        matched = findHeaderColumnValue(sheet.rows, rule.aliases)
      }

      if (!isEmptyValue(matched)) {
        values.set(rule.key, matched)
        break
      }
    }
  }

  return values
}

function parseYear(value: string): number | null {
  const match = normalizeText(value).match(/\b(19|20)\d{2}\b/)
  if (!match) return null
  const year = Number(match[0])
  return Number.isFinite(year) ? year : null
}

function parseMonth(value: string): number | null {
  const normalized = normalizeText(value).toUpperCase().replace(/月$/, "")
  if (!normalized) return null

  const monthMap: Record<string, number> = {
    JAN: 1,
    FEB: 2,
    MAR: 3,
    APR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AUG: 8,
    SEP: 9,
    SEPT: 9,
    OCT: 10,
    NOV: 11,
    DEC: 12,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    十一: 11,
    十二: 12,
  }

  if (normalized in monthMap) return monthMap[normalized]
  if (/^\d{1,2}$/.test(normalized)) {
    const month = Number(normalized)
    if (month >= 1 && month <= 12) return month
  }
  return null
}

function parseDay(value: string): number | null {
  const normalized = normalizeText(value).replace(/日$/, "").replace(/号$/, "")
  if (!/^\d{1,2}$/.test(normalized)) return null
  const day = Number(normalized)
  if (day < 1 || day > 31) return null
  return day
}

function createValidDate(year: number, month: number, day: number): Date | null {
  const parsed = new Date(year, month - 1, day)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

function parseExcelSerialDate(value: string): Date | null {
  const normalized = normalizeText(value)
  if (!/^\d{4,5}(?:\.\d+)?$/.test(normalized)) return null

  const serial = Math.floor(Number(normalized))
  if (!Number.isFinite(serial) || serial <= 0) return null

  const utcDays = serial - 25569
  const utcMillis = utcDays * 24 * 60 * 60 * 1000
  const parsed = new Date(utcMillis)
  if (Number.isNaN(parsed.getTime())) return null

  return createValidDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate())
}

function parseFlexibleDate(value: string): Date | null {
  const raw = normalizeText(value)
  if (!raw) return null

  const serialDate = parseExcelSerialDate(raw)
  if (serialDate) return serialDate

  const normalized = raw
    .replace(/[.]/g, "/")
    .replace(/年/g, "/")
    .replace(/月/g, "/")
    .replace(/日/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const compactYearFirst = normalized.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compactYearFirst) {
    return createValidDate(Number(compactYearFirst[1]), Number(compactYearFirst[2]), Number(compactYearFirst[3]))
  }

  const yearFirst = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (yearFirst) {
    return createValidDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]))
  }

  const dayFirst = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dayFirst) {
    return createValidDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]))
  }

  const dayMonthName = normalized.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})$/)
  if (dayMonthName) {
    const month = parseMonth(dayMonthName[2])
    if (month) {
      return createValidDate(Number(dayMonthName[3]), month, Number(dayMonthName[1]))
    }
  }

  const monthNameDay = normalized.match(/^([A-Za-z]{3,9})[ -](\d{1,2})(?:,)?[ -](\d{4})$/)
  if (monthNameDay) {
    const month = parseMonth(monthNameDay[1])
    if (month) {
      return createValidDate(Number(monthNameDay[3]), month, Number(monthNameDay[2]))
    }
  }

  return null
}

function resolveBirthYear(values: Map<string, string>): number | null {
  const birthDate = parseFlexibleDate(values.get("dateOfBirth") || "")
  if (birthDate) return birthDate.getFullYear()
  return parseYear(values.get("birthYear") || "")
}

function resolveIntendedArrivalDate(values: Map<string, string>): Date | null {
  const directDate = parseFlexibleDate(values.get("intendedArrivalDate") || "")
  if (directDate) return directDate

  const year = parseYear(values.get("intendedArrivalYear") || "")
  const month = parseMonth(values.get("intendedArrivalMonth") || "")
  const day = parseDay(values.get("intendedArrivalDay") || "")
  if (!year || !month || !day) return null
  return createValidDate(year, month, day)
}

function resolvePreviousUsTravelDate(values: Map<string, string>): Date | null {
  const directDate = parseFlexibleDate(values.get("previousUsTravelArrivalDate") || "")
  if (directDate) return directDate

  const year = parseYear(values.get("previousUsTravelYear") || "")
  const month = parseMonth(values.get("previousUsTravelMonth") || "")
  const day = parseDay(values.get("previousUsTravelDay") || "")
  if (!year || !month || !day) return null
  return createValidDate(year, month, day)
}

function containsNonAsciiCharacters(value: string): boolean {
  return /[^\x20-\x7E]/.test(value)
}

function isDigitsOnlyPhone(value: string): boolean {
  const normalized = normalizeText(value)
  return Boolean(normalized) && /^\d+$/.test(normalized)
}

function isDs160SafeText(value: string): boolean {
  const normalized = normalizeAscii(normalizeText(value))
  if (!normalized) return true
  if (/[^\x20-\x7E]/.test(normalized)) return false
  return DS160_SAFE_TEXT_PATTERN.test(normalized)
}

function getValue(values: Map<string, string>, key: string): string {
  return normalizeText(values.get(key) || "")
}

function getFieldLabel(key: string): string {
  return FIELD_RULES.find((field) => field.key === key)?.label || key
}

export function getUsVisaExcelFieldLabel(key: string): string {
  return getFieldLabel(key)
}

export function extractUsVisaExcelReviewFields(buffer: Buffer): UsVisaExcelReviewFieldMap {
  const sheets = extractWorkbookRows(buffer)
  const values = collectWorkbookValues(sheets)
  const result: UsVisaExcelReviewFieldMap = {}

  for (const rule of FIELD_RULES) {
    result[rule.key] = getValue(values, rule.key)
  }

  if (result.chineseName && hasHanCharacters(result.chineseName)) {
    result.chineseName = normalizeChineseName(result.chineseName)
    const derivedTelecodes = deriveTelecodesFromChineseName(result.chineseName)
    result.telecodeSurname = derivedTelecodes.telecodeSurname
    result.telecodeGivenName = derivedTelecodes.telecodeGivenName
  } else {
    result.chineseName = normalizeChineseName(result.chineseName)
    result.telecodeSurname = normalizeTelecodeValue(result.telecodeSurname)
    result.telecodeGivenName = normalizeTelecodeValue(result.telecodeGivenName)
  }

  const birthDate = getValue(values, "dateOfBirth")
  const birthYear = resolveBirthYear(values)

  // 保留原始日期格式，不进行格式化转换
  if (birthDate) {
    result.dateOfBirth = birthDate
  } else if (birthYear) {
    result.dateOfBirth = String(birthYear)
  }

  if (birthYear) {
    result.birthYear = String(birthYear)
  }

  // 检查日期字段是否有效，但保留原始格式
  const intendedArrivalDate = resolveIntendedArrivalDate(values)
  if (!intendedArrivalDate && getValue(values, "intendedArrivalDate")) {
    // 如果原始值存在但无法解析，保留原始值但会在审核中报错
  }

  const previousUsTravelDate = resolvePreviousUsTravelDate(values)
  if (!previousUsTravelDate && getValue(values, "previousUsTravelArrivalDate")) {
    // 如果原始值存在但无法解析，保留原始值但会在审核中报错
  }

  return result
}

function pushError(errors: AuditIssue[], field: string, message: string, value?: string) {
  errors.push({ field, message, value })
}

export function auditUsVisaExcelBuffer(buffer: Buffer): UsVisaExcelAuditResult {
  const sheets = extractWorkbookRows(buffer)
  const values = collectWorkbookValues(sheets)
  const errors: AuditIssue[] = []

  const applicationId = getValue(values, "applicationId")
  const surname = getValue(values, "surname")
  const givenName = getValue(values, "givenName")
  const passportNumber = getValue(values, "passportNumber")
  const primaryPhone = getValue(values, "primaryPhone")
  const lastFiveYearsPhone = getValue(values, "lastFiveYearsPhone")
  const personalEmail = getValue(values, "personalEmail")
  const lastFiveYearsEmail = getValue(values, "lastFiveYearsEmail")
  const hotelAddress = getValue(values, "hotelAddress")
  const hotelCity = getValue(values, "hotelCity")
  const hotelState = getValue(values, "hotelState")
  const intendedStayDays = getValue(values, "intendedStayDays")
  const birthYear = resolveBirthYear(values)
  const intendedArrivalDate = resolveIntendedArrivalDate(values)
  const isFirstTimeUsVisaApplicant = isTruthyYes(getValue(values, "firstTimeUsVisa"))
  const ignoreApplicationIdAudit = true
  const ignorePreviousUsTravelDateAudit = true
  const ignoreVisaLostOrStolenAudit = true

  if (!ignoreApplicationIdAudit && isEmptyValue(applicationId)) {
    pushError(errors, "AA码 / Application ID", "DS-160 提交/恢复会用到该字段，不能为空")
  } else if (!ignoreApplicationIdAudit && !AA_CODE_PATTERN.test(applicationId)) {
    pushError(errors, "AA码 / Application ID", "格式看起来不对，通常应以 AA 开头", applicationId)
  }

  if (isEmptyValue(surname)) {
    pushError(errors, "姓 / Surname", "美签恢复和 AIS 注册都会用到，不能为空")
  }

  if (isEmptyValue(givenName)) {
    pushError(errors, "名 / Given Name", "AIS 注册会用到，不能为空")
  }

  if (!birthYear) {
    pushError(errors, "出生日期 / Birth Date", "无法识别出生日期或出生年份")
  } else {
    const currentYear = new Date().getFullYear()
    if (birthYear < 1900 || birthYear > currentYear) {
      pushError(errors, "出生日期 / Birth Date", "出生年份不合理", String(birthYear))
    }
  }

  if (isEmptyValue(passportNumber)) {
    pushError(errors, "护照号 / Passport Number", "DS-160 提交/恢复会用到，不能为空")
  }

  if (isEmptyValue(primaryPhone)) {
    pushError(errors, "主要电话 / Primary Phone", "AIS 注册会用到，不能为空")
  } else {
    if (!isDigitsOnlyPhone(primaryPhone)) {
      pushError(errors, "主要电话 / Primary Phone", "必须只填数字，不要带空格、+、横杠或其他字符", primaryPhone)
    } else if (normalizePhoneDigits(primaryPhone).length < 7) {
      pushError(errors, "主要电话 / Primary Phone", "号码长度看起来不够，请检查", primaryPhone)
    }
  }

  if (!isEmptyValue(lastFiveYearsPhone)) {
    if (!isDigitsOnlyPhone(lastFiveYearsPhone)) {
      pushError(
        errors,
        "近五年电话 / Last Five Years Phone",
        "必须只填数字，不要带空格、+、横杠或其他字符",
        lastFiveYearsPhone,
      )
    } else if (normalizePhoneDigits(lastFiveYearsPhone).length < 7) {
      pushError(errors, "近五年电话 / Last Five Years Phone", "号码长度看起来不够，请检查", lastFiveYearsPhone)
    }
  }

  if (
    !isEmptyValue(primaryPhone) &&
    !isEmptyValue(lastFiveYearsPhone) &&
    normalizePhoneDigits(primaryPhone) &&
    normalizePhoneDigits(primaryPhone) === normalizePhoneDigits(lastFiveYearsPhone)
  ) {
    pushError(errors, "近五年电话 / Last Five Years Phone", "近五年电话不能和主要电话填写成一样", lastFiveYearsPhone)
  }

  if (isEmptyValue(personalEmail)) {
    pushError(errors, "个人邮箱 / Personal Email", "AIS 注册会用到，不能为空")
  } else if (!EMAIL_PATTERN.test(normalizeEmail(personalEmail))) {
    pushError(errors, "个人邮箱 / Personal Email", "邮箱格式不正确", personalEmail)
  }

  if (!isEmptyValue(lastFiveYearsEmail) && !EMAIL_PATTERN.test(normalizeEmail(lastFiveYearsEmail))) {
    pushError(errors, "近五年邮箱 / Last Five Years Email", "邮箱格式不正确", lastFiveYearsEmail)
  }

  if (
    !isEmptyValue(personalEmail) &&
    !isEmptyValue(lastFiveYearsEmail) &&
    normalizeEmail(personalEmail) === normalizeEmail(lastFiveYearsEmail)
  ) {
    pushError(errors, "近五年邮箱 / Last Five Years Email", "近五年邮箱不能和个人邮箱填写成一样", lastFiveYearsEmail)
  }

  if (!intendedArrivalDate) {
    pushError(errors, "计划到达日期 / Intended Arrival Date", "赴美行程页会用到，日期缺失或无法识别")
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (intendedArrivalDate.getTime() <= today.getTime()) {
      pushError(
        errors,
        "计划到达日期 / Intended Arrival Date",
        "必须晚于今天，否则 DS-160 Travel 页会直接报错",
        intendedArrivalDate.toISOString().slice(0, 10),
      )
    }
  }

  if (isEmptyValue(intendedStayDays)) {
    pushError(errors, "计划停留天数 / Intended Stay Days", "赴美行程页会用到，不能为空")
  } else if (!/^\d+$/.test(intendedStayDays) || Number(intendedStayDays) <= 0) {
    pushError(errors, "计划停留天数 / Intended Stay Days", "必须是大于 0 的整数", intendedStayDays)
  }

  if (isEmptyValue(hotelAddress)) {
    pushError(errors, "在美地址 / Street Address (Line 1)", "赴美行程页会用到，不能为空")
  }

  if (isEmptyValue(hotelCity)) {
    pushError(errors, "在美城市 / City", "赴美行程页会用到，不能为空")
  }

  if (isEmptyValue(hotelState)) {
    pushError(errors, "在美州 / State", "赴美行程页会用到，不能为空")
  } else {
    const normalizedState = normalizeAscii(hotelState).toUpperCase()
    if (!US_STATE_CODE_PATTERN.test(normalizedState) && !US_STATE_NAME_PATTERN.test(normalizedState)) {
      pushError(errors, "在美州 / State", "建议填写美国州英文名称或两位代码，例如 NEW YORK / NY", hotelState)
    }
  }

  for (const key of ADDRESS_FIELD_KEYS) {
    const value = getValue(values, key)
    if (isEmptyValue(value)) continue
    if (!isDs160SafeText(value)) {
      pushError(
        errors,
        getFieldLabel(key),
        "请按 DS-160 标准填写，不能带特殊字符；只保留字母、数字、空格、'、-、&",
        value,
      )
    }
  }

  if (!isFirstTimeUsVisaApplicant) {
  if (isTruthyYes(getValue(values, "hasFormerName"))) {
    if (isEmptyValue(getValue(values, "formerNameSurname"))) {
      pushError(errors, "曾用名姓", "已选择“有曾用名”，这里不能为空")
    }
    if (isEmptyValue(getValue(values, "formerNameGivenName"))) {
      pushError(errors, "曾用名名", "已选择“有曾用名”，这里不能为空")
    }
  }

  if (!ignorePreviousUsTravelDateAudit && isTruthyYes(getValue(values, "previousUsTravel")) && !resolvePreviousUsTravelDate(values)) {
    pushError(errors, "上次赴美日期", "已选择“去过美国”，需要补齐上次赴美日期")
  }

  if (isTruthyYes(getValue(values, "hasUsDriversLicense"))) {
    if (isEmptyValue(getValue(values, "usDriversLicenseNumber"))) {
      pushError(errors, "美国驾照号", "已选择“有美国驾照”，这里不能为空")
    }
    if (isEmptyValue(getValue(values, "usDriversLicenseState"))) {
      pushError(errors, "驾照颁发州", "已选择“有美国驾照”，这里不能为空")
    }
  }

  if (isTruthyYes(getValue(values, "hasUsVisa")) && isEmptyValue(getValue(values, "usVisaNumber"))) {
    pushError(errors, "美国签证号", "已选择“曾有美国签证”，这里不能为空")
  }

  if (!ignoreVisaLostOrStolenAudit && isTruthyYes(getValue(values, "visaLostOrStolen"))) {
    const lostYear = getValue(values, "visaLostOrStolenYear")
    const lostExplanation = getValue(values, "visaLostOrStolenExplanation")
    if (!parseYear(lostYear)) {
      pushError(errors, "签证遗失或被盗年份", "已选择“签证遗失或被盗”，需填写 4 位年份", lostYear)
    }
    if (isEmptyValue(lostExplanation)) {
      pushError(errors, "签证遗失或被盗说明", "已选择“签证遗失或被盗”，这里不能为空")
    } else if (containsNonAsciiCharacters(lostExplanation)) {
      pushError(errors, "签证遗失或被盗说明", "请只填英文 ASCII，避免 CEAC 校验报错", lostExplanation)
    }
  }

  if (isTruthyYes(getValue(values, "visaCancelledOrRevoked"))) {
    const explanation = getValue(values, "visaCancelledOrRevokedExplanation")
    if (isEmptyValue(explanation)) {
      pushError(errors, "签证被取消或吊销说明", "已选择“被取消或吊销”，这里不能为空")
    } else if (containsNonAsciiCharacters(explanation)) {
      pushError(errors, "签证被取消或吊销说明", "请只填英文 ASCII，避免 CEAC 校验报错", explanation)
    }
  }

  if (isTruthyYes(getValue(values, "hasBeenRefusedVisa"))) {
    const reason = getValue(values, "hasBeenRefusedReason")
    if (isEmptyValue(reason)) {
      pushError(errors, "拒签原因", "已选择“被拒签”，这里不能为空")
    } else if (containsNonAsciiCharacters(reason)) {
      pushError(errors, "拒签原因", "请只填英文 ASCII，避免 CEAC 校验报错", reason)
    }
  }

  if (isTruthyYes(getValue(values, "hasImmigrantPetition"))) {
    const explanation = getValue(values, "immigrantPetitionExplanation")
    if (isEmptyValue(explanation)) {
      pushError(errors, "移民签证申请说明", "已选择“有人提交移民签证申请”，这里不能为空")
    } else if (containsNonAsciiCharacters(explanation)) {
      pushError(errors, "移民签证申请说明", "请只填英文 ASCII，避免 CEAC 校验报错", explanation)
    }
  }

  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

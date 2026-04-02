import { read, utils, write } from "xlsx"

type FixKind = "phone" | "text"

type FixRule = {
  key: string
  label: string
  kind: FixKind
  aliases: string[]
}

export type UsVisaExcelAutoFixChange = {
  field: string
  before: string
  after: string
}

export type UsVisaExcelAutoFixResult = {
  changed: boolean
  fixedCount: number
  changes: UsVisaExcelAutoFixChange[]
  buffer: Buffer
}

const FIX_RULES: FixRule[] = [
  {
    key: "primaryPhone",
    label: "主要电话 / Primary Phone",
    kind: "phone",
    aliases: ["主要电话", "Primary Phone Number", "Primary Phone", "Phone Number"],
  },
  {
    key: "lastFiveYearsPhone",
    label: "近五年电话 / Last Five Years Phone",
    kind: "phone",
    aliases: ["近五年电话", "last five years phone number", "Last Five Years Phone Number"],
  },
  {
    key: "homeAddress",
    label: "家庭地址 / Home Address",
    kind: "text",
    aliases: ["（目前）家庭地址", "家庭地址", "Home Address", "Present Home Address"],
  },
  {
    key: "homeCity",
    label: "家庭城市 / Home City",
    kind: "text",
    aliases: ["家庭城市", "Home City"],
  },
  {
    key: "homeState",
    label: "家庭省/州 / Home State",
    kind: "text",
    aliases: ["家庭省/州", "家庭省州", "Home State", "Home State/Province", "State/Province"],
  },
  {
    key: "homeZip",
    label: "家庭邮编 / Home Zip",
    kind: "text",
    aliases: ["家庭邮编", "家庭邮政编码", "Home Zip", "Home Postal Code", "Zip Code", "Postal Code"],
  },
  {
    key: "presentSchoolAddress",
    label: "当前学校/单位地址",
    kind: "text",
    aliases: ["当前学校/单位地址", "当前学校地址", "当前单位地址", "Present Employer Or School Address"],
  },
  {
    key: "presentSchoolCity",
    label: "当前学校/单位城市",
    kind: "text",
    aliases: ["当前城市", "Present Employer Or School City", "Current City"],
  },
  {
    key: "presentSchoolState",
    label: "当前学校/单位省州",
    kind: "text",
    aliases: ["当前州/省", "当前州省", "Present Employer Or School State", "Current State", "Current Province"],
  },
  {
    key: "presentSchoolZip",
    label: "当前学校/单位邮编",
    kind: "text",
    aliases: ["当前邮编", "当前邮政编码", "Present Employer Or School Zip", "Current Zip", "Current Postal Code"],
  },
  {
    key: "previousSchoolAddress",
    label: "前学校/单位地址",
    kind: "text",
    aliases: ["前学校/单位地址", "前学校地址", "前单位地址", "Previous Employer Or School Address"],
  },
  {
    key: "educationAddress",
    label: "教育机构地址",
    kind: "text",
    aliases: ["学校地址", "教育机构地址", "Educational Institution Address"],
  },
  {
    key: "hotelAddress",
    label: "在美地址 / Street Address (Line 1)",
    kind: "text",
    aliases: ["酒店地址", "在美地址", "Hotel Address", "Street Address Line 1", "Address Where You Will Stay In The U.S."],
  },
  {
    key: "hotelCity",
    label: "在美城市 / City",
    kind: "text",
    aliases: ["酒店城市", "赴美城市", "目的地城市", "Hotel City", "U.S. Stay City"],
  },
  {
    key: "hotelState",
    label: "在美州 / State",
    kind: "text",
    aliases: ["酒店州", "Hotel State", "U.S. Stay State", "State Where You Will Stay"],
  },
]

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

function sanitizeDigitsOnlyPhone(value: string): string {
  return normalizeText(value).replace(/\D/g, "")
}

function sanitizeDs160SafeText(value: string): string {
  let text = normalizeAscii(normalizeText(value)).toUpperCase()
  if (!text) return ""

  const replacements: Array<[RegExp, string]> = [
    [/[,，、;；:/\\\.。·]+/g, " "],
    [/[()[\]{}"]/g, " "],
    [/[“”]/g, " "],
    [/[‘’`]/g, "'"],
    [/[—–－_]+/g, "-"],
    [/[\r\n\t]+/g, " "],
    [/[#@!?*%$+=|<>^~]+/g, " "],
  ]

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement)
  }

  text = text.replace(/[^A-Z0-9&' -]/g, " ")
  text = text.replace(/\s*-\s*/g, "-")
  text = text.replace(/\s*&\s*/g, " & ")
  text = text.replace(/\s*'\s*/g, "'")
  return text.replace(/\s+/g, " ").trim()
}

function getTargetSheet(workbook: ReturnType<typeof read>) {
  const targetSheetName = workbook.SheetNames.find((name) => normalizeKey(name) === "sheet1") || workbook.SheetNames[0]
  return targetSheetName ? { name: targetSheetName, sheet: workbook.Sheets[targetSheetName] } : null
}

function isEmptyValue(value: string): boolean {
  const normalized = normalizeText(value).toLowerCase()
  return !normalized || normalized === "-" || normalized === "n/a" || normalized === "na" || normalized === "none"
}

function isAliasLikeCell(value: string): boolean {
  const normalized = normalizeKey(value)
  if (!normalized) return false
  return FIX_RULES.some((rule) => rule.aliases.some((alias) => normalized.includes(normalizeKey(alias))))
}

function isMetaCellValue(value: string): boolean {
  const normalized = normalizeKey(value)
  return !normalized || normalized === "field" || normalized === normalizeKey("填写内容")
}

function locateAdjacentValueCell(rows: string[][], aliases: string[]): { rowIndex: number; colIndex: number; value: string } | null {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias))
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || []
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cell = normalizeKey(row[colIndex])
      if (!cell) continue
      const matched = normalizedAliases.some((alias) => cell.includes(alias))
      if (!matched) continue

      for (let candidateIndex = colIndex + 1; candidateIndex < row.length; candidateIndex += 1) {
        const candidate = normalizeText(row[candidateIndex] || "")
        if (isEmptyValue(candidate) || isMetaCellValue(candidate) || isAliasLikeCell(candidate)) continue
        return { rowIndex, colIndex: candidateIndex, value: candidate }
      }
      return null
    }
  }

  return null
}

function locateHeaderColumnValueCell(rows: string[][], aliases: string[]): { rowIndex: number; colIndex: number; value: string } | null {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias))
  const maxHeaderRows = Math.min(rows.length - 1, 8)

  for (let rowIndex = 0; rowIndex < maxHeaderRows; rowIndex += 1) {
    const headerRow = rows[rowIndex] || []
    const dataRow = rows[rowIndex + 1] || []
    for (let colIndex = 0; colIndex < headerRow.length; colIndex += 1) {
      const headerCell = normalizeKey(headerRow[colIndex])
      if (!headerCell) continue
      const matched = normalizedAliases.some((alias) => headerCell.includes(alias))
      if (!matched) continue
      const value = normalizeText(dataRow[colIndex] || "")
      if (!value || isAliasLikeCell(value)) return null
      return { rowIndex: rowIndex + 1, colIndex, value }
    }
  }

  return null
}

function matchesAnyAlias(value: unknown, aliases: string[]): boolean {
  const normalized = normalizeKey(value)
  if (!normalized) return false
  return aliases.some((alias) => {
    const normalizedAlias = normalizeKey(alias)
    return Boolean(normalizedAlias) && (normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized))
  })
}

function locateStructuredSheet1ValueCell(rows: string[][], aliases: string[]): { rowIndex: number; colIndex: number; value: string } | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || []
    if (!matchesAnyAlias(row[0] || "", aliases) && !matchesAnyAlias(row[1] || "", aliases)) {
      continue
    }

    const value = normalizeText(row[2] || "")
    if (!value || isEmptyValue(value) || isMetaCellValue(value) || isAliasLikeCell(value)) {
      return null
    }
    return { rowIndex, colIndex: 2, value }
  }

  return null
}

function setSheetCellString(sheet: Record<string, unknown>, rowIndex: number, colIndex: number, value: string) {
  const address = utils.encode_cell({ r: rowIndex, c: colIndex })
  sheet[address] = {
    t: "s",
    v: value,
    w: value,
  }
}

export function autoFixUsVisaExcelBuffer(buffer: Buffer): UsVisaExcelAutoFixResult {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false })
  const target = getTargetSheet(workbook)
  if (!target?.sheet) {
    return { changed: false, fixedCount: 0, changes: [], buffer }
  }

  const rows = utils.sheet_to_json(target.sheet, {
    header: 1,
    defval: "",
    raw: false,
    // Keep blank rows so matrix row indexes still match worksheet row numbers when writing back.
    blankrows: true,
  }) as unknown[][]

  const matrix = rows.map((row) => row.map((cell) => normalizeText(cell)))
  const changes: UsVisaExcelAutoFixChange[] = []

  for (const rule of FIX_RULES) {
    const located =
      locateStructuredSheet1ValueCell(matrix, rule.aliases) ||
      locateAdjacentValueCell(matrix, rule.aliases) ||
      locateHeaderColumnValueCell(matrix, rule.aliases)
    if (!located) continue

    const before = normalizeText(located.value)
    if (!before) continue

    const after = rule.kind === "phone" ? sanitizeDigitsOnlyPhone(before) : sanitizeDs160SafeText(before)
    if (!after || after === before) continue

    matrix[located.rowIndex][located.colIndex] = after
    setSheetCellString(target.sheet as Record<string, unknown>, located.rowIndex, located.colIndex, after)
    changes.push({ field: rule.label, before, after })
  }

  if (changes.length === 0) {
    return { changed: false, fixedCount: 0, changes: [], buffer }
  }

  const output = write(workbook, { bookType: "xlsx", type: "buffer" })
  return {
    changed: true,
    fixedCount: changes.length,
    changes,
    buffer: Buffer.isBuffer(output) ? output : Buffer.from(output),
  }
}

import { read, utils } from "xlsx"

/** 与模板 / 材料审核中一致的入境日期字段别名（归一化后做子串匹配） */
const ENTRY_LABEL_ALIASES = [
  "入境申根国的日期",
  "入境申根国日期",
  "入境申根日期",
  "dateofarrivalinschengen",
  "arrivaldate",
  "intendeddateofarrival",
]

function normalizeText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  return String(value).trim()
}

function normalizeKey(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u3000"'`“”‘’()（）[\]【】{}<>:：,，.。;；!！?？/\\|@#$%^&*_+=~-]/g, "")
}

function toIsoLocal(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function parseExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 90000) return null
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  if (Number.isNaN(date.getTime())) return null
  return toIsoLocal(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/**
 * 将 Excel 单元格中的日期解析为 YYYY-MM-DD（本地日历日）。
 */
export function parseSchengenEntryDateCellToIso(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoLocal(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }
  if (typeof value === "number") {
    return parseExcelSerial(value)
  }
  const raw = normalizeText(value)
  if (!raw) return null
  if (/^\d{5}$/.test(raw)) {
    const n = Number(raw)
    const fromSerial = parseExcelSerial(n)
    if (fromSerial) return fromSerial
  }

  let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) {
    return toIsoLocal(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) {
    return toIsoLocal(Number(m[3]), Number(m[2]), Number(m[1]))
  }
  const fallback = new Date(raw)
  if (!Number.isNaN(fallback.getTime())) {
    return toIsoLocal(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate())
  }
  return null
}

function aliasNormalizedSet(): string[] {
  return ENTRY_LABEL_ALIASES.map((a) => normalizeKey(a)).filter(Boolean)
}

function cellMatchesEntryLabel(cell: string, aliasParts: string[]): boolean {
  const nk = normalizeKey(cell)
  if (!nk) return false
  return aliasParts.some((part) => part && nk.includes(part))
}

function findAdjacentEntryRaw(matrix: string[][], aliasParts: string[]): string {
  for (const row of matrix) {
    for (let i = 0; i < row.length; i += 1) {
      if (!cellMatchesEntryLabel(row[i], aliasParts)) continue
      const adj = normalizeText(row[i + 1])
      if (!adj) continue
      const adjKey = normalizeKey(adj)
      if (aliasParts.some((p) => p && adjKey.includes(p))) continue
      return adj
    }
  }
  return ""
}

/**
 * 从申根 Excel 工作簿中读取「入境申根国/入境申根」日期，返回 YYYY-MM-DD；无法解析则返回 null。
 */
export function extractSchengenEntryDateIsoFromExcelBuffer(buffer: Buffer): string | null {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: true })
  const aliasParts = aliasNormalizedSet()

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const matrix = utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][]
    const stringMatrix = matrix.map((row) => row.map((cell) => normalizeText(cell)))
    const adjacentRaw = findAdjacentEntryRaw(stringMatrix, aliasParts)
    const fromAdjacent = parseSchengenEntryDateCellToIso(adjacentRaw)
    if (fromAdjacent) return fromAdjacent

    const objects = utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
      blankrows: false,
    })
    for (const row of objects) {
      for (const [key, val] of Object.entries(row)) {
        if (!cellMatchesEntryLabel(key, aliasParts)) continue
        const fromObject = parseSchengenEntryDateCellToIso(val)
        if (fromObject) return fromObject
      }
    }
  }

  return null
}

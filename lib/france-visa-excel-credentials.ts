import { read, utils, type WorkSheet } from "xlsx"

/** 与 `receipt_filler` / `extract_fv_registration_info` 对齐的默认密码 */
export const FRANCE_VISA_EXCEL_DEFAULT_PASSWORD = "Visa20252025!"

function normalizeCell(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  return String(value).trim()
}

function cleanPassword(raw: unknown): string {
  let s = normalizeCell(raw)
  if (!s || ["nan", "none", "null"].includes(s.toLowerCase())) return FRANCE_VISA_EXCEL_DEFAULT_PASSWORD
  if (/^\d+\.\d+$/.test(s)) {
    const n = Number.parseFloat(s)
    if (!Number.isNaN(n)) return String(Math.trunc(n))
  }
  return s
}

function transpose(matrix: unknown[][]): unknown[][] {
  if (!matrix.length) return []
  const colCount = Math.max(...matrix.map((r) => r.length), 0)
  const out: unknown[][] = []
  for (let c = 0; c < colCount; c++) {
    const row: unknown[] = []
    for (let r = 0; r < matrix.length; r++) {
      row.push(matrix[r]?.[c])
    }
    out.push(row)
  }
  return out
}

function tryKeyValueRows(matrix: unknown[][]): { email: string; password: string } | null {
  let email = ""
  let password = ""
  for (const row of matrix) {
    if (!row || row.length < 2) continue
    const key = normalizeCell(row[0]).toLowerCase()
    const val = row[1]
    if (!key) continue
    if (key.includes("邮箱") || key.includes("email")) {
      const e = normalizeCell(val)
      if (e.includes("@")) email = e
    }
    if (key.includes("密码") || key.includes("password")) {
      password = cleanPassword(val)
    }
  }
  if (email.includes("@")) {
    return { email, password: password || FRANCE_VISA_EXCEL_DEFAULT_PASSWORD }
  }
  return null
}

function tryHeaderRowDataRow(matrix: unknown[][]): { email: string; password: string } | null {
  if (matrix.length < 2) return null
  const headers = matrix[0].map((c) => normalizeCell(c))
  const dataRow = matrix[1]
  const emailIdx = headers.findIndex((h) => h.includes("邮箱") || h.toLowerCase().includes("email"))
  let passwordIdx = headers.findIndex((h) => h.includes("密码") || h.toLowerCase().includes("password"))
  if (passwordIdx < 0 && headers.length > 5) passwordIdx = 5
  if (emailIdx < 0 || passwordIdx < 0) return null
  const email = normalizeCell(dataRow[emailIdx])
  const password = cleanPassword(dataRow[passwordIdx])
  if (email.includes("@")) return { email, password }
  return null
}

function tryJsonObjectsFirstRow(sheet: WorkSheet): { email: string; password: string } | null {
  const objects = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    blankrows: false,
  })
  if (!objects.length) return null
  const row = objects[0]
  const keys = Object.keys(row)
  const emailKey = keys.find((k) => k.includes("邮箱") || k.toLowerCase().includes("email"))
  let passwordKey = keys.find((k) => k.includes("密码") || k.toLowerCase().includes("password"))
  if (!passwordKey && keys.length > 5) passwordKey = keys[5]
  if (!emailKey || !passwordKey) return null
  const email = normalizeCell(row[emailKey])
  const password = cleanPassword(row[passwordKey])
  if (email.includes("@")) return { email, password }
  return null
}

/**
 * 从法签/申根 Excel（档案中的 schengenExcel / franceExcel）解析 France-visas / TLS 常用登录邮箱与密码。
 * 兼容「FV注册表」横向表头、竖向「字段 / 值」两列、以及填写回执单前的转置读法。
 */
export function extractFranceVisaCredentialsFromExcelBuffer(buffer: Buffer): { email: string; password: string } {
  const workbook = read(buffer, { type: "buffer", cellDates: true })
  const sheetNames = workbook.SheetNames.filter(Boolean)
  const orderedNames = [
    ...sheetNames.filter((n) => n === "FV注册表"),
    ...sheetNames.filter((n) => n !== "FV注册表"),
  ]

  for (const name of orderedNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue

    const matrix = utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as unknown[][]

    if (matrix.length) {
      const kv = tryKeyValueRows(matrix)
      if (kv) return kv

      const transposed = transpose(matrix)
      const fromTransposed = tryHeaderRowDataRow(transposed)
      if (fromTransposed) return fromTransposed

      const fromWide = tryHeaderRowDataRow(matrix)
      if (fromWide) return fromWide
    }

    const fromObjects = tryJsonObjectsFirstRow(sheet)
    if (fromObjects) return fromObjects
  }

  throw new Error(
    "无法从申根 Excel 解析邮箱/密码。请确认表内含「邮箱」或 email、「密码」或 password 列/行（与填写回执单所用表一致）。"
  )
}

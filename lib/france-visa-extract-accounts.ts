import { read, utils } from "xlsx"

const DEFAULT_PASSWORD = "Visa20252025!"

function normalizeText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  return String(value).trim()
}

function cleanPassword(raw: unknown): string {
  const s = normalizeText(raw)
  if (!s || ["nan", "none", "null"].includes(s.toLowerCase())) return DEFAULT_PASSWORD
  if (/^[+-]?\d+(\.\d+)?$/.test(s) && s.includes(".")) {
    const n = Number.parseFloat(s)
    if (!Number.isNaN(n)) return String(Math.trunc(n))
  }
  return s
}

type AccountItem = { id: number; email: string; password: string; name: string }

export function extractTlsAccountsFromExcelBuffer(buffer: Buffer): AccountItem[] {
  const wb = read(buffer, { type: "buffer", cellDates: false })
  const preferred = wb.SheetNames.find((n) => n === "FV注册表")
  const sheet = wb.Sheets[preferred || wb.SheetNames[0]]
  if (!sheet) throw new Error("Excel 内容为空，无法提取 TLS 账号。")

  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    blankrows: false,
  })
  if (!rows.length) throw new Error("Excel 表格没有有效数据行，无法提取 TLS 账号。")

  const first = rows[0]
  const keys = Object.keys(first)
  const emailKey = keys.find((k) => k.includes("邮箱") || k.toLowerCase().includes("email"))
  let passwordKey = keys.find((k) => k.includes("密码") || k.toLowerCase().includes("password"))
  if (!passwordKey && keys.length > 5) passwordKey = keys[5]

  if (!emailKey || !passwordKey) {
    throw new Error("Excel 中缺少邮箱或密码列，请确认列名包含「邮箱/email」和「密码/password」。")
  }

  const out: AccountItem[] = []
  for (const row of rows) {
    const email = normalizeText(row[emailKey])
    if (!email || !email.includes("@")) continue
    const password = cleanPassword(row[passwordKey])
    out.push({
      id: out.length + 1,
      email,
      password,
      name: `账号 ${out.length + 1}`,
    })
  }
  if (!out.length) throw new Error("Excel 中未识别到有效邮箱，无法生成 TLS accounts JSON。")
  return out
}


import { read, utils } from "xlsx"

export interface SchengenExcelApplicantSummary {
  familyName?: string
  givenName?: string
  englishName?: string
  passportNumber?: string
  organization?: string
  schengenCountry?: string
  submissionCity?: string
  email?: string
  birthDate?: string
}

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

const FIELD_ALIASES: Record<keyof Omit<SchengenExcelApplicantSummary, "englishName">, string[]> = {
  familyName: ["姓氏", "familyname", "surname", "lastname"],
  givenName: ["名字", "firstname", "givenname", "first_name"],
  passportNumber: [
    "护照号码",
    "护照号",
    "护照编号",
    "numberoftraveldocument",
    "passportnumber",
    "passportno",
  ],
  organization: [
    "大学名称",
    "universityname",
    "学校名称",
    "schoolname",
    "学校工作单位",
    "工作单位",
    "单位名称",
    "companyname",
    "employer",
    "organization",
  ],
  schengenCountry: ["所要办理的申根国家", "schengencountrytoapplyfor", "申请国家", "签证国家", "visacountry"],
  submissionCity: ["递签城市", "visasubmissioncity", "applicationcity", "tlscity"],
  email: ["邮箱账号", "邮箱地址", "emailaccount", "emailaddress", "email"],
  birthDate: ["出生日期", "dateofbirth", "birthdate", "dob"],
}

function matchField(rawKey: unknown) {
  const normalized = normalizeKey(rawKey)
  if (!normalized) return null

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<
    [keyof Omit<SchengenExcelApplicantSummary, "englishName">, string[]]
  >) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return field
    }
  }

  return null
}

function assignValue(
  summary: SchengenExcelApplicantSummary,
  field: keyof Omit<SchengenExcelApplicantSummary, "englishName">,
  value: unknown
) {
  const normalized = normalizeText(value)
  if (!normalized || summary[field]) return
  summary[field] = normalized
}

function firstNonEmptyRow(rows: unknown[][], startIndex: number) {
  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index]
    if (row.some((cell) => normalizeText(cell))) {
      return row
    }
  }
  return null
}

function parseKeyValueRows(rows: unknown[][], summary: SchengenExcelApplicantSummary) {
  for (const row of rows) {
    if (!row || row.length < 2) continue
    const field = matchField(row[0])
    if (!field) continue
    assignValue(summary, field, row[1])
  }
}

function parseHeaderRows(rows: unknown[][], summary: SchengenExcelApplicantSummary) {
  for (let headerIndex = 0; headerIndex < rows.length; headerIndex += 1) {
    const headers = rows[headerIndex]
    if (!headers || headers.filter((cell) => normalizeText(cell)).length < 2) continue

    const dataRow = firstNonEmptyRow(rows, headerIndex + 1)
    if (!dataRow) continue

    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      const field = matchField(headers[columnIndex])
      if (!field) continue
      assignValue(summary, field, dataRow[columnIndex])
    }
  }
}

function finalizeSummary(summary: SchengenExcelApplicantSummary) {
  if (!summary.englishName) {
    const parts = [summary.familyName, summary.givenName].map((value) => normalizeText(value)).filter(Boolean)
    if (parts.length) {
      summary.englishName = parts.join(" ")
    }
  }

  return summary
}

export function extractSchengenApplicantSummaryFromExcelBuffer(buffer: Buffer): SchengenExcelApplicantSummary {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false })
  const summary: SchengenExcelApplicantSummary = {}

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const rows = utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][]

    parseKeyValueRows(rows, summary)
    parseHeaderRows(rows, summary)
  }

  return finalizeSummary(summary)
}

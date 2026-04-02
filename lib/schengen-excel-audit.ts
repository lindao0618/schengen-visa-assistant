import { read, utils } from "xlsx"

type AuditIssue = {
  field: string
  message: string
  value?: string
}

export type SchengenExcelAuditResult = {
  ok: boolean
  errors: AuditIssue[]
}

type FieldRule = {
  key: string
  label: string
  aliases: string[]
}

const REQUIRED_FIELDS: FieldRule[] = [
  { key: "emailAccount", label: "邮箱账号", aliases: ["邮箱账号", "emailaccount"] },
  { key: "emailPassword", label: "邮箱密码", aliases: ["邮箱密码", "emailpassword"] },
  { key: "schengenCountry", label: "所要办理的申根国家", aliases: ["所要办理的申根国家", "schengencountrytoapplyfor"] },
  { key: "residenceCountryCity", label: "居住国与居住城市", aliases: ["居住国与居住城市", "currentcountryofresidenceandcity"] },
  { key: "visaSubmissionCity", label: "递签城市", aliases: ["递签城市", "visasubmissioncity"] },
  { key: "familyName", label: "姓氏", aliases: ["姓氏", "familyname"] },
  { key: "firstName", label: "名字", aliases: ["名字", "firstname"] },
  { key: "dateOfBirth", label: "出生日期", aliases: ["出生日期", "dateofbirth"] },
  { key: "placeOfBirth", label: "出生省份", aliases: ["出生省份", "placeofbirth"] },
  { key: "sex", label: "性别", aliases: ["性别", "sex"] },
  { key: "civilStatus", label: "婚姻状况", aliases: ["婚姻状况", "civilstatus"] },
  { key: "nationalId", label: "身份证号", aliases: ["身份证号", "nationalidnumber"] },
  { key: "travelDocNumber", label: "护照号码", aliases: ["护照号码", "numberoftraveldocument"] },
  { key: "passportIssueDate", label: "证件签发日期", aliases: ["证件签发日期", "dateofissue"] },
  { key: "passportValidUntil", label: "证件有效期", aliases: ["证件有效期", "validuntil"] },
  { key: "streetUk", label: "街道（英国）", aliases: ["街道", "streetcurrentaddressintheuk"] },
  { key: "cityUk", label: "城市（英国）", aliases: ["城市", "citycurrentaddressintheuk"] },
  { key: "postcodeUk", label: "邮政编码（英国）", aliases: ["邮政编码", "postcodecurrentaddressintheuk"] },
  { key: "phoneUk", label: "你的电话（+44）", aliases: ["你的电话", "yourphonenumberwith44"] },
  { key: "residenceOtherCountry", label: "是否居住在其他国家", aliases: ["是否居住在其他国家", "residenceinacountryotherthanthecountryofcurrentnationality"] },
  { key: "sharecodeNumber", label: "Sharecode number", aliases: ["sharecodenumber"] },
  { key: "sharecodeValidUntil", label: "截止时间（Sharecode Valid until）", aliases: ["截止时间", "validuntil"] },
  { key: "sharecodeEffectiveDate", label: "生效时间（Effective date）", aliases: ["生效时间", "effectivedate"] },
  { key: "universityAddress", label: "大学地址", aliases: ["大学地址", "universityaddress"] },
  { key: "universityPostcode", label: "大学邮编", aliases: ["大学邮编", "universitypostcode"] },
  { key: "universityPhone", label: "大学电话", aliases: ["大学电话", "universityphonenumber"] },
  { key: "universityEmail", label: "大学邮箱", aliases: ["大学邮箱", "universityemail"] },
  { key: "universityName", label: "大学名称", aliases: ["大学名称", "universityname"] },
  { key: "universityCity", label: "大学所在城市", aliases: ["大学所在城市", "universitycity"] },
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

function isEmptyValue(value: string): boolean {
  const v = normalizeText(value).toLowerCase()
  return !v || v === "-" || v === "n/a" || v === "na"
}

function isAliasLikeCell(value: string): boolean {
  const normalized = normalizeKey(value)
  if (!normalized) return false
  return REQUIRED_FIELDS.some((rule) =>
    rule.aliases.some((alias) => normalized.includes(normalizeKey(alias))),
  )
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
  return parsed
}

function parseDate(value?: string): Date | null {
  if (!value) return null
  const raw = normalizeText(value)
  if (!raw) return null

  // Strict mode: only accept YYYY/MM/DD or YYYY-MM-DD.
  const yearFirst = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (yearFirst) {
    const year = Number(yearFirst[1])
    const month = Number(yearFirst[2])
    const day = Number(yearFirst[3])
    const parsed = createValidDate(year, month, day)
    if (parsed) return parsed
  }

  // Strict mode: only accept DD/MM/YYYY or DD-MM-YYYY.
  const dayFirst = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dayFirst) {
    const day = Number(dayFirst[1])
    const month = Number(dayFirst[2])
    const year = Number(dayFirst[3])
    const parsed = createValidDate(year, month, day)
    if (parsed) return parsed
  }

  return null
}

type SheetRows = {
  sheetName: string
  rows: string[][]
}

function extractWorkbookRows(buffer: Buffer): SheetRows[] {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false })
  const result: SheetRows[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const rows = utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][]
    result.push({
      sheetName,
      rows: rows.map((r) => r.map((cell) => normalizeText(cell))),
    })
  }
  return result
}

function findLabelValueInRowByAdjacentCell(row: string[], aliases: string[]): string {
  if (!row || row.length === 0) return ""
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias))

  for (let i = 0; i < row.length; i += 1) {
    const cell = row[i]
    const normalizedCell = normalizeKey(cell)
    if (!normalizedCell) continue
    const matched = normalizedAliases.some((alias) => normalizedCell.includes(alias))
    if (!matched) continue

    // IMPORTANT: only use the adjacent value cell, do not scan farther right.
    // Template rows often have remarks in later columns; scanning right causes false passes.
    const adjacent = normalizeText(row[i + 1] || "")
    // Ignore header-style adjacent cells such as "邮箱密码（Email password）".
    if (isAliasLikeCell(adjacent)) return ""
    return adjacent
  }

  return ""
}

function countAliasHitsInRow(row: string[]): number {
  let hits = 0
  for (const rule of REQUIRED_FIELDS) {
    if (findLabelValueInRowByAdjacentCell(row, rule.aliases) !== "") {
      hits += 1
      continue
    }
    const rowHasAlias = row.some((cell) =>
      rule.aliases.some((alias) => normalizeKey(cell).includes(normalizeKey(alias))),
    )
    if (rowHasAlias) hits += 1
  }
  return hits
}

function parseFromKeyValueSheets(sheets: SheetRows[], values: Map<string, string>, validUntilCandidates: string[]) {
  for (const sheet of sheets) {
    // Prefer your template sheet names to avoid noisy matches.
    const isTargetSheet =
      normalizeKey(sheet.sheetName).includes(normalizeKey("FV个人信息基础表")) ||
      normalizeKey(sheet.sheetName).includes(normalizeKey("自动生成的横排信息表")) ||
      normalizeKey(sheet.sheetName).includes(normalizeKey("fv个人信息基础表"))

    if (!isTargetSheet) continue

    for (const row of sheet.rows) {
      // Skip header-like rows with many labels and almost no data.
      const aliasHits = countAliasHitsInRow(row)
      if (aliasHits >= 5 && row.filter((cell) => !isEmptyValue(cell)).length <= aliasHits + 1) {
        continue
      }

      for (const rule of REQUIRED_FIELDS) {
        const hasLabel = row.some((cell) =>
          rule.aliases.some((alias) => normalizeKey(cell).includes(normalizeKey(alias))),
        )
        if (!hasLabel) continue

        const value = findLabelValueInRowByAdjacentCell(row, rule.aliases)
        if (!values.has(rule.key) || isEmptyValue(values.get(rule.key) || "")) {
          values.set(rule.key, value)
        }
        if ((rule.key === "passportValidUntil" || rule.key === "sharecodeValidUntil") && hasLabel) {
          validUntilCandidates.push(value)
        }
      }
    }
  }
}

export function auditSchengenExcelBuffer(buffer: Buffer): SchengenExcelAuditResult {
  const sheets = extractWorkbookRows(buffer)
  const values = new Map<string, string>()
  const validUntilCandidates: string[] = []

  parseFromKeyValueSheets(sheets, values, validUntilCandidates)

  // Disambiguate duplicate "Valid until": first one is passport, second one is sharecode in template.
  if (validUntilCandidates.length > 0) {
    values.set("passportValidUntil", values.get("passportValidUntil") || validUntilCandidates[0] || "")
  }
  if (validUntilCandidates.length > 1) {
    values.set("sharecodeValidUntil", values.get("sharecodeValidUntil") || validUntilCandidates[1] || "")
  }

  const errors: AuditIssue[] = []

  for (const rule of REQUIRED_FIELDS) {
    const value = values.get(rule.key) || ""
    if (isEmptyValue(value)) {
      errors.push({
        field: rule.label,
        message: `${rule.label} 不能为空`,
      })
    }
  }

  const sharecodeValidUntil = values.get("sharecodeValidUntil") || ""
  const sharecodeEffectiveDate = values.get("sharecodeEffectiveDate") || ""
  if (!isEmptyValue(sharecodeValidUntil) && !isEmptyValue(sharecodeEffectiveDate)) {
    const endDate = parseDate(sharecodeValidUntil)
    const startDate = parseDate(sharecodeEffectiveDate)
    if (!endDate || !startDate) {
      errors.push({
        field: "Sharecode 日期",
        message: "截止时间 / 生效时间 日期格式无法识别",
        value: `${sharecodeEffectiveDate} -> ${sharecodeValidUntil}`,
      })
    } else if (endDate.getTime() < startDate.getTime()) {
      errors.push({
        field: "截止时间（Valid until）",
        message: "截止时间不能早于生效时间（Effective date）",
        value: `${sharecodeEffectiveDate} -> ${sharecodeValidUntil}`,
      })
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}


import { read, utils } from "xlsx"

type PrecheckFieldKind = "text" | "phone"

type FieldConfig = {
  key: string
  label: string
  kind: PrecheckFieldKind
  aliases: string[]
}

export type Ds160PrecheckField = {
  key: string
  label: string
  original: string
  cleaned: string
  changed: boolean
  missing: boolean
  warnings: string[]
}

export type Ds160PrecheckResult = {
  sourceName?: string
  fields: Ds160PrecheckField[]
  summary: {
    total: number
    changed: number
    missing: number
  }
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "home_address",
    label: "（目前）家庭地址",
    kind: "text",
    aliases: ["（目前）家庭地址", "家庭地址", "home address", "homeaddress", "present home address"],
  },
  {
    key: "present_school_name",
    label: "当前学校/单位",
    kind: "text",
    aliases: [
      "当前学校/单位",
      "当前学校",
      "当前单位",
      "present employer or school name",
      "current school",
      "current employer",
      "current school/company",
    ],
  },
  {
    key: "present_school_address",
    label: "当前学校/单位地址",
    kind: "text",
    aliases: [
      "当前学校/单位地址",
      "当前学校地址",
      "当前单位地址",
      "present employer or school address",
      "current school address",
      "current employer address",
    ],
  },
  {
    key: "present_school_city",
    label: "当前城市",
    kind: "text",
    aliases: ["当前城市", "present employer or school city", "current city"],
  },
  {
    key: "present_school_state",
    label: "当前州/省",
    kind: "text",
    aliases: ["当前州/省", "当前州省", "present employer or school state", "current state", "current province"],
  },
  {
    key: "present_school_zip",
    label: "当前邮编",
    kind: "text",
    aliases: ["当前邮编", "当前邮政编码", "present employer or school zip", "current zip", "postal code"],
  },
  {
    key: "present_school_phone",
    label: "当前学校电话",
    kind: "phone",
    aliases: ["当前学校电话", "当前单位电话", "present employer or school phone", "current school phone", "current employer phone"],
  },
  {
    key: "present_school_country",
    label: "当前学校所在国家",
    kind: "text",
    aliases: ["当前学校所在国家", "当前单位所在国家", "present employer or school country", "current country"],
  },
  {
    key: "previous_school_name",
    label: "前学校/单位",
    kind: "text",
    aliases: ["前学校/单位", "前学校", "前单位", "previous employer or school name"],
  },
  {
    key: "previous_school_address",
    label: "前学校/单位地址",
    kind: "text",
    aliases: ["前学校/单位地址", "前学校地址", "前单位地址", "previous employer or school address"],
  },
  {
    key: "previous_school_phone",
    label: "前学校/单位电话",
    kind: "phone",
    aliases: ["前学校/单位电话", "前学校电话", "前单位电话", "previous employer or school phone"],
  },
  {
    key: "education_name",
    label: "学校名称",
    kind: "text",
    aliases: ["学校名称", "教育机构名称", "name of the educational institution", "educational institution name"],
  },
  {
    key: "education_address",
    label: "学校地址",
    kind: "text",
    aliases: ["学校地址", "教育机构地址", "educational institution address"],
  },
  {
    key: "education_phone",
    label: "学校电话",
    kind: "phone",
    aliases: ["学校电话", "教育机构电话", "educational institution phone"],
  },
]

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s_\-()（）:：,.，、/\\]/g, "")
}

function normalizeAscii(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
}

function sanitizeText(value: string) {
  let text = normalizeAscii(value).toUpperCase().trim()
  if (!text) return ""

  const replacements: Array<[RegExp, string]> = [
    [/[,，、;；:：/\\\.。·•]+/g, " "],
    [/[()[\]{}"]/g, " "],
    [/[“”]/g, " "],
    [/[‘’`´]/g, "'"],
    [/[—–－_]+/g, "-"],
    [/[#@!?*%$+=|<>^~]+/g, " "],
    [/\r?\n|\t/g, " "],
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

function sanitizePhone(value: string) {
  let text = normalizeAscii(value).toUpperCase()
  text = text.replace(/[^0-9 -]/g, " ")
  text = text.replace(/\s*-\s*/g, "-")
  return text.replace(/\s+/g, " ").trim()
}

function pickRowValue(row: unknown[], aliases: Set<string>) {
  const cells = row.map((cell) => normalizeText(cell))
  if (cells.every((cell) => !cell)) return undefined

  let sawAlias = false
  for (const cell of cells) {
    if (!cell) continue
    if (aliases.has(normalizeKey(cell))) {
      sawAlias = true
      continue
    }
    if (sawAlias) return cell
  }
  return undefined
}

export function extractDs160PrecheckFromExcelBuffer(buffer: Buffer, sourceName?: string): Ds160PrecheckResult {
  const workbook = read(buffer, { type: "buffer", cellDates: false })
  const rawValues = new Map<string, string>()

  for (const config of FIELD_CONFIGS) {
    const aliasSet = new Set(config.aliases.map(normalizeKey))
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      }) as unknown[][]

      for (const row of rows) {
        const value = pickRowValue(row, aliasSet)
        if (value) {
          rawValues.set(config.key, value)
          break
        }
      }

      if (rawValues.has(config.key)) break
    }
  }

  const fields = FIELD_CONFIGS.map<Ds160PrecheckField>((config) => {
    const original = rawValues.get(config.key) || ""
    const cleaned = config.kind === "phone" ? sanitizePhone(original) : sanitizeText(original)
    const warnings: string[] = []

    if (!original) {
      warnings.push("Excel 中未识别到该字段")
    } else if (!cleaned) {
      warnings.push("清洗后为空，请人工检查原始内容是否含过多不支持字符")
    } else if (cleaned !== original.trim()) {
      warnings.push("已按 DS-160 字符规则做清洗")
    }

    return {
      key: config.key,
      label: config.label,
      original,
      cleaned,
      changed: Boolean(original) && cleaned !== original.trim(),
      missing: !original,
      warnings,
    }
  })

  return {
    sourceName,
    fields,
    summary: {
      total: fields.length,
      changed: fields.filter((field) => field.changed).length,
      missing: fields.filter((field) => field.missing).length,
    },
  }
}

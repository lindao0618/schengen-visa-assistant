import { read, utils } from "xlsx"

import {
  deriveTelecodesFromChineseName,
  hasHanCharacters,
  isValidTelecodeValue,
  normalizeChineseName,
  normalizeTelecodeValue,
} from "./us-visa-chinese-telecode"

type PrecheckFieldKind = "text" | "phone" | "nativeName" | "telecode"

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
    key: "chinese_name",
    label: "中文名 / Chinese Name",
    kind: "nativeName",
    aliases: ["中文名", "中文姓名", "Chinese Name", "Full Name in Native Alphabet", "Native Name"],
  },
  {
    key: "telecode_surname",
    label: "姓氏电报码 / Telecode Surname",
    kind: "telecode",
    aliases: ["姓氏电报码", "姓电报码", "Telecode Surname", "Surname Telecode"],
  },
  {
    key: "telecode_given_name",
    label: "名字电报码 / Telecode Given Name",
    kind: "telecode",
    aliases: ["名字电报码", "名电报码", "Telecode Given Name", "Given Name Telecode"],
  },
  {
    key: "home_address",
    label: "当前家庭地址 / Home Address",
    kind: "text",
    aliases: ["（目前）家庭地址", "家庭地址", "Home Address", "Present Home Address"],
  },
  {
    key: "present_school_name",
    label: "当前学校/单位 / Present Employer or School Name",
    kind: "text",
    aliases: [
      "当前学校/单位",
      "当前学校",
      "当前单位",
      "Present Employer or School Name",
      "Current School",
      "Current Employer",
      "Current School/Company",
    ],
  },
  {
    key: "present_school_address",
    label: "当前学校/单位地址 / Present Employer or School Address",
    kind: "text",
    aliases: [
      "当前学校/单位地址",
      "当前学校地址",
      "当前单位地址",
      "Present Employer Or School Address",
      "Current School Address",
      "Current Employer Address",
    ],
  },
  {
    key: "present_school_city",
    label: "当前城市 / Present Employer or School City",
    kind: "text",
    aliases: ["当前城市", "Present Employer Or School City", "Current City"],
  },
  {
    key: "present_school_state",
    label: "当前州/省 / Present Employer or School State",
    kind: "text",
    aliases: ["当前州/省", "当前州省", "Present Employer Or School State", "Current State", "Current Province"],
  },
  {
    key: "present_school_zip",
    label: "当前邮编 / Present Employer or School ZIP",
    kind: "text",
    aliases: ["当前邮编", "当前邮政编码", "Present Employer Or School Zip", "Current Zip", "Postal Code"],
  },
  {
    key: "present_school_phone",
    label: "当前学校电话 / Present Employer or School Phone",
    kind: "phone",
    aliases: ["当前学校电话", "当前单位电话", "Present Employer Or School Phone", "Current School Phone", "Current Employer Phone"],
  },
  {
    key: "present_school_country",
    label: "当前学校所在国家 / Present Employer or School Country",
    kind: "text",
    aliases: ["当前学校所在国家", "当前单位所在国家", "Present Employer Or School Country", "Current Country"],
  },
  {
    key: "previous_school_name",
    label: "前学校/单位 / Previous Employer or School Name",
    kind: "text",
    aliases: ["前学校/单位", "前学校", "前单位", "Previous Employer Or School Name"],
  },
  {
    key: "previous_school_address",
    label: "前学校/单位地址 / Previous Employer or School Address",
    kind: "text",
    aliases: ["前学校/单位地址", "前学校地址", "前单位地址", "Previous Employer Or School Address"],
  },
  {
    key: "previous_school_phone",
    label: "前学校/单位电话 / Previous Employer or School Phone",
    kind: "phone",
    aliases: ["前学校/单位电话", "前学校电话", "前单位电话", "Previous Employer Or School Phone"],
  },
  {
    key: "education_name",
    label: "学校名称 / Educational Institution Name",
    kind: "text",
    aliases: ["学校名称", "教育机构名称", "Name of the Educational Institution", "Educational Institution Name"],
  },
  {
    key: "education_address",
    label: "学校地址 / Educational Institution Address",
    kind: "text",
    aliases: ["学校地址", "教育机构地址", "Educational Institution Address"],
  },
  {
    key: "education_phone",
    label: "学校电话 / Educational Institution Phone",
    kind: "phone",
    aliases: ["学校电话", "教育机构电话", "Educational Institution Phone"],
  },
]

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s_\-()（）:：.。,，/\\]+/g, "")
}

function normalizeAscii(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
}

function sanitizeText(value: string) {
  let text = normalizeAscii(value).toUpperCase().trim()
  if (!text) return ""

  const replacements: Array<[RegExp, string]> = [
    [/[,，。、;；:：/\\\.]+/g, " "],
    [/[()[\]{}"]/g, " "],
    [/[“”]/g, " "],
    [/[‘’`]/g, "'"],
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

function sanitizeNativeName(value: string) {
  return normalizeChineseName(value)
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

  const chineseName = sanitizeNativeName(rawValues.get("chinese_name") || "")
  const derivedTelecodes = chineseName && hasHanCharacters(chineseName) ? deriveTelecodesFromChineseName(chineseName) : null

  const fields = FIELD_CONFIGS.map<Ds160PrecheckField>((config) => {
    const original = rawValues.get(config.key) || ""
    const warnings: string[] = []
    let cleaned = ""

    if (config.kind === "phone") {
      cleaned = sanitizePhone(original)
    } else if (config.kind === "nativeName") {
      cleaned = sanitizeNativeName(original)
    } else if (config.kind === "telecode") {
      const normalizedOriginal = normalizeTelecodeValue(original)
      const derivedValue =
        config.key === "telecode_surname"
          ? (derivedTelecodes?.telecodeSurname || "")
          : (derivedTelecodes?.telecodeGivenName || "")

      if (derivedTelecodes) {
        cleaned = derivedValue

        if (!original && derivedValue) {
          warnings.push("已根据中文名自动生成")
        } else if (!original) {
          warnings.push("中文名未能生成该字段，请人工确认")
        } else {
          warnings.push("已忽略 Excel 中填写的电报码，统一按中文名重新生成")
        }

        if (original && normalizedOriginal && !isValidTelecodeValue(normalizedOriginal)) {
          warnings.push("Excel 中原电报码长度不是 4 位分组，已忽略")
        }

        if (derivedTelecodes.unresolvedChars.length) {
          warnings.push(`中文名含未收录字符：${Array.from(new Set(derivedTelecodes.unresolvedChars)).join("")}`)
        }
      } else {
        cleaned = normalizedOriginal

        if (!original) {
          warnings.push("Excel 中未识别到该字段")
        } else if (normalizedOriginal !== original.trim()) {
          warnings.push("已标准化为 4 位分组电码")
        }

        if (original && normalizedOriginal && !isValidTelecodeValue(normalizedOriginal)) {
          warnings.push("电报码长度不是 4 位分组，请人工确认")
        }
      }
    } else {
      cleaned = sanitizeText(original)
    }

    if (config.kind === "nativeName") {
      if (!original) {
        warnings.push("Excel 中未识别到该字段")
      } else if (cleaned !== original.trim()) {
        warnings.push("已去除空格后作为中文姓名使用")
      }
    } else if (config.kind !== "telecode") {
      if (!original) {
        warnings.push("Excel 中未识别到该字段")
      } else if (!cleaned) {
        warnings.push("清洗后为空，请人工检查原始内容是否含过多不支持字符")
      } else if (cleaned !== original.trim()) {
        warnings.push("已按 DS-160 字符规则做清洗")
      }
    }

    return {
      key: config.key,
      label: config.label,
      original,
      cleaned,
      changed: Boolean(original) ? cleaned !== original.trim() : Boolean(cleaned),
      missing: !original && !cleaned,
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

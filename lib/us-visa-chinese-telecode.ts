import { codeToNumber } from "chinese-commercial-code-convertor"

const COMPOUND_SURNAMES = new Set([
  "万俟",
  "上官",
  "东方",
  "东宫",
  "东郭",
  "东里",
  "仲孙",
  "仲长",
  "令狐",
  "公乘",
  "公仲",
  "公仪",
  "公伯",
  "公冶",
  "公孙",
  "公山",
  "公巫",
  "公户",
  "公玉",
  "公祖",
  "公良",
  "公西",
  "公门",
  "公坚",
  "公羊",
  "公羽",
  "公皙",
  "公析",
  "公罔",
  "公肩",
  "公言",
  "公钥",
  "单于",
  "南宫",
  "南荣",
  "南门",
  "司马",
  "司空",
  "司寇",
  "司徒",
  "司城",
  "呼延",
  "壤驷",
  "夏侯",
  "夹谷",
  "太叔",
  "太史",
  "子书",
  "子桑",
  "宇文",
  "宗政",
  "宰父",
  "尉迟",
  "左丘",
  "巫马",
  "微生",
  "慕容",
  "拓跋",
  "澹台",
  "濮阳",
  "漆雕",
  "澹台",
  "申屠",
  "皇甫",
  "百里",
  "第五",
  "羊舌",
  "闻人",
  "诸葛",
  "赫连",
  "轩辕",
  "钟离",
  "长孙",
  "闾丘",
  "鲜于",
  "谷梁",
  "费莫",
  "达奚",
  "褚师",
  "西门",
  "诸葛",
  "谷梁",
  "贯丘",
  "轩辕",
  "那拉",
  "完颜",
  "纳兰",
  "欧阳",
])

const NAME_SPACING_PATTERN = /[\s\u3000]+/g
const NAME_JOINER_PATTERN = /[·•・‧]/g

export type ChineseNameSplit = {
  fullName: string
  surnameChinese: string
  givenNameChinese: string
}

export type ChineseTelecodeResult = ChineseNameSplit & {
  telecodeSurname: string
  telecodeGivenName: string
  unresolvedChars: string[]
}

function normalizeText(value: unknown) {
  if (value == null) return ""
  return String(value).trim()
}

export function normalizeChineseName(value: unknown) {
  return normalizeText(value).replace(NAME_SPACING_PATTERN, "").replace(NAME_JOINER_PATTERN, "")
}

export function hasHanCharacters(value: unknown) {
  const normalized = normalizeChineseName(value)
  if (!normalized) return false
  return /[\u3400-\u9fff]/.test(normalized)
}

export function normalizeTelecodeValue(value: unknown) {
  const digits = normalizeText(value).replace(/\D+/g, "")
  if (!digits) return ""
  const groups = digits.match(/.{1,4}/g) || []
  return groups.join(" ")
}

export function isValidTelecodeValue(value: unknown) {
  const normalized = normalizeTelecodeValue(value)
  if (!normalized) return false
  return normalized.split(" ").every((group) => /^\d{4}$/.test(group))
}

export function splitChineseName(value: unknown): ChineseNameSplit {
  const fullName = normalizeChineseName(value)
  if (!fullName) {
    return {
      fullName: "",
      surnameChinese: "",
      givenNameChinese: "",
    }
  }

  if (fullName.length === 1) {
    return {
      fullName,
      surnameChinese: fullName,
      givenNameChinese: "",
    }
  }

  const compoundSurname = fullName.slice(0, 2)
  if (fullName.length >= 3 && COMPOUND_SURNAMES.has(compoundSurname)) {
    return {
      fullName,
      surnameChinese: compoundSurname,
      givenNameChinese: fullName.slice(2),
    }
  }

  return {
    fullName,
    surnameChinese: fullName.slice(0, 1),
    givenNameChinese: fullName.slice(1),
  }
}

function convertChineseSegmentToTelecode(segment: string) {
  const chars = [...normalizeChineseName(segment)]
  const unresolvedChars: string[] = []
  const codes = chars
    .map((char) => {
      const code = normalizeText(codeToNumber(char, { lang: "cn", notFoundReturn: "-1" }))
      if (!/^\d{4}$/.test(code)) {
        unresolvedChars.push(char)
        return ""
      }
      return code
    })
    .filter(Boolean)

  return {
    telecode: codes.join(" "),
    unresolvedChars,
  }
}

export function deriveTelecodesFromChineseName(value: unknown): ChineseTelecodeResult {
  const split = splitChineseName(value)
  const surname = convertChineseSegmentToTelecode(split.surnameChinese)
  const givenName = convertChineseSegmentToTelecode(split.givenNameChinese)

  return {
    ...split,
    telecodeSurname: surname.telecode,
    telecodeGivenName: givenName.telecode,
    unresolvedChars: [...surname.unresolvedChars, ...givenName.unresolvedChars],
  }
}

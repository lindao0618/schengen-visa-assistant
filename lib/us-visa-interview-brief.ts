import { read, utils } from "xlsx"

export type InterviewBriefIssue = {
  field: string
  message: string
}

export type InterviewBriefFieldMap = {
  schoolName?: string
  major?: string
  currentOccupation?: string
  hotelName?: string
  hotelCity?: string
  arrivalDate?: string
  departureDate?: string
  stayDays?: string
  tripPayer?: string
  tripPayerOther?: string
  tripPayerRelationship?: string
  hasUsVisa?: string
  previousUsTravel?: string
}

export type InterviewBriefOption = {
  label: string
  text: string
}

export type InterviewBriefBlock =
  | {
      type: "qa"
      id: string
      questionCn: string
      questionEn?: string
      answerCn: string
      answerEn?: string
      note?: string
    }
  | {
      type: "qa-options"
      id: string
      questionCn: string
      questionEn?: string
      answerCn: string
      answerEn?: string
      note?: string
      options: InterviewBriefOption[]
    }
  | {
      type: "section-title"
      id: string
      title: string
      description?: string
    }
  | {
      type: "pending-qa"
      id: string
      questionCn: string
      questionEn?: string
      placeholderCn: string
      placeholderEn?: string
    }
  | {
      type: "hotel"
      id: string
      title: string
      hotelName: string
    }

export type InterviewBriefResult = {
  fields: InterviewBriefFieldMap
  blocks: InterviewBriefBlock[]
  issues: InterviewBriefIssue[]
}

type FieldRule = {
  key: keyof InterviewBriefFieldMap | "hotelCheckinDate" | "hotelCheckoutDate"
  aliases: string[]
}

type CollectedValues = InterviewBriefFieldMap & {
  hotelCheckinDate?: string
  hotelCheckoutDate?: string
}

const FIELD_RULES: FieldRule[] = [
  { key: "schoolName", aliases: ["当前学校/单位", "present employer or school name", "current school"] },
  { key: "major", aliases: ["所学专业/课程", "course of study", "major"] },
  { key: "currentOccupation", aliases: ["当前职业", "primary occupation", "occupation"] },
  { key: "hotelName", aliases: ["酒店名称", "hotel name", "hotel_name"] },
  { key: "hotelCity", aliases: ["酒店城市", "hotel city", "hotel_city", "赴美城市", "目的地城市"] },
  { key: "arrivalDate", aliases: ["计划到达日期", "intended arrival date"] },
  { key: "departureDate", aliases: ["离开日期", "departure date"] },
  { key: "stayDays", aliases: ["计划停留天数", "停留天数", "intended stay days"] },
  { key: "tripPayer", aliases: ["旅行费用支付人", "trip payer", "trip_payer"] },
  { key: "tripPayerOther", aliases: ["其他支付者", "trip payer other", "trip_payer_other"] },
  { key: "tripPayerRelationship", aliases: ["与支付者关系", "trip payer relationship", "trip_payer_relationship"] },
  { key: "hasUsVisa", aliases: ["是否曾有美国签证", "has us visa", "has_us_visa"] },
  { key: "previousUsTravel", aliases: ["是否去过美国", "previous us travel", "previous_us_travel"] },
  { key: "hotelCheckinDate", aliases: ["入住日期", "hotel checkin date", "hotel_checkin_date"] },
  { key: "hotelCheckoutDate", aliases: ["退房日期", "hotel checkout date", "hotel_checkout_date"] },
]

const PENDING_PLACEHOLDER_CN = ""
const PENDING_PLACEHOLDER_EN = ""

function normalizeText(value: unknown) {
  if (value == null) return ""
  return String(value).trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}<>"'`~!@#$%^&*+=|\\/:;,.?，。！？、（）【】《》“”‘’_-]/g, "")
}

function isEmptyValue(value: string) {
  const normalized = normalizeText(value).toLowerCase()
  return !normalized || normalized === "-" || normalized === "n/a" || normalized === "na" || normalized === "none"
}

function isAliasLikeCell(value: string) {
  const normalized = normalizeKey(value)
  if (!normalized || /^\d+$/.test(normalized)) return false

  return FIELD_RULES.some((rule) =>
    rule.aliases.some((alias) => {
      const normalizedAlias = normalizeKey(alias)
      return normalizedAlias.length > 2 && normalized.includes(normalizedAlias)
    }),
  )
}

function isMachineKeyLike(value: string) {
  const text = normalizeText(value)
  if (!text || /^\d+$/.test(text) || /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(text)) {
    return false
  }
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(text)
}

function extractWorkbookRows(buffer: Buffer) {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false })

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const rows = utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][]

    return rows.map((row) => row.map((cell) => normalizeText(cell)))
  })
}

function findValueToRight(row: string[], startIndex: number) {
  for (let index = startIndex + 1; index < row.length; index += 1) {
    const value = normalizeText(row[index])
    if (!value || isAliasLikeCell(value) || isMachineKeyLike(value)) continue
    return value
  }
  return ""
}

function findAdjacentValue(row: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => normalizeKey(alias))

  for (let index = 0; index < row.length; index += 1) {
    const cell = normalizeKey(row[index])
    if (!cell) continue
    const matched = normalizedAliases.some((alias) => alias && cell.includes(alias))
    if (!matched) continue

    const value = findValueToRight(row, index)
    if (value) return value
  }

  return ""
}

function createValidDate(year: number, month: number, day: number) {
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

function parseDate(value?: string) {
  const text = normalizeText(value)
  if (!text) return null

  const dayFirst = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) {
    const parsed = createValidDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]))
    if (parsed) return parsed
  }

  const yearFirst = text.match(/^(\d{4})[/. -](\d{1,2})[/. -](\d{1,2})$/)
  if (yearFirst) {
    const parsed = createValidDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]))
    if (parsed) return parsed
  }

  const normalized = text.replace(/[./]/g, "-")
  const direct = new Date(normalized)
  if (!Number.isNaN(direct.getTime())) return direct

  return null
}

function formatDateCn(value?: string) {
  const parsed = parseDate(value)
  if (!parsed) return normalizeText(value)
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日`
}

function formatDateEn(value?: string) {
  const parsed = parseDate(value)
  if (!parsed) return normalizeText(value)
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function computeStayDays(arrivalDate?: string, departureDate?: string) {
  const arrival = parseDate(arrivalDate)
  const departure = parseDate(departureDate)
  if (!arrival || !departure) return undefined

  const milliseconds = departure.getTime() - arrival.getTime()
  const days = Math.round(milliseconds / (1000 * 60 * 60 * 24))
  if (days <= 0 || days > 180) return undefined

  return String(days + 1)
}

function humanizeCity(value?: string) {
  const text = normalizeText(value)
  if (!text) return ""

  if (/^[a-z\s-]+$/i.test(text)) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ")
  }

  return text
}

function collectFieldValues(buffer: Buffer): CollectedValues {
  const sheets = extractWorkbookRows(buffer)
  const values: Partial<Record<keyof CollectedValues, string>> = {}
  const arrivalParts: Record<string, string> = {}

  for (const rows of sheets) {
    for (const row of rows) {
      for (const rule of FIELD_RULES) {
        const value = findAdjacentValue(row, rule.aliases)
        if (value && (!values[rule.key] || isEmptyValue(values[rule.key] || ""))) {
          values[rule.key] = value
        }
      }

      const year = findAdjacentValue(row, ["计划到达年份", "intended_arrival_year", "arrival year"])
      const month = findAdjacentValue(row, ["计划到达月份", "intended_arrival_month", "arrival month"])
      const day = findAdjacentValue(row, ["计划到达日期", "intended_arrival_day", "arrival day"])
      if (year) arrivalParts.year = year
      if (month) arrivalParts.month = month
      if (day) arrivalParts.day = day
    }
  }

  const derivedArrivalDate =
    values.arrivalDate ||
    (arrivalParts.year && arrivalParts.month && arrivalParts.day
      ? `${arrivalParts.year}-${arrivalParts.month}-${arrivalParts.day}`
      : "")

  const arrivalDate = values.hotelCheckinDate || derivedArrivalDate
  const departureDate = values.hotelCheckoutDate || values.departureDate
  const stayDays =
    values.stayDays ||
    computeStayDays(arrivalDate, departureDate) ||
    computeStayDays(values.hotelCheckinDate, values.hotelCheckoutDate)

  return {
    schoolName: values.schoolName || undefined,
    major: values.major || undefined,
    currentOccupation: values.currentOccupation || (values.schoolName ? "Student" : undefined),
    hotelName: values.hotelName || undefined,
    hotelCity: values.hotelCity || undefined,
    arrivalDate: arrivalDate || undefined,
    departureDate: departureDate || undefined,
    stayDays: stayDays || undefined,
    tripPayer: values.tripPayer || undefined,
    tripPayerOther: values.tripPayerOther || undefined,
    tripPayerRelationship: values.tripPayerRelationship || undefined,
    hasUsVisa: values.hasUsVisa || undefined,
    previousUsTravel: values.previousUsTravel || undefined,
  }
}

function buildSchoolAnswer(fields: InterviewBriefFieldMap, issues: InterviewBriefIssue[]) {
  const schoolName = normalizeText(fields.schoolName)
  const major = normalizeText(fields.major)

  if (!schoolName) {
    issues.push({ field: "学校", message: "未识别到学校名称，请人工确认。" })
  }
  if (!major) {
    issues.push({ field: "专业", message: "未识别到专业，请人工确认。" })
  }

  return {
    cn: `我是${schoolName || "[请确认学校名称]"}的学生，我的专业是${major || "[请确认专业]"}。`,
    en: `I am a student at ${schoolName || "[please confirm the school name]"} and my major is ${major || "[please confirm the major]"}.`,
  }
}

function buildTripTimingAnswer(fields: InterviewBriefFieldMap, issues: InterviewBriefIssue[]) {
  const city = humanizeCity(fields.hotelCity) || "[请确认赴美城市]"
  const arrivalDate = normalizeText(fields.arrivalDate)
  const departureDate = normalizeText(fields.departureDate)
  const stayDays = normalizeText(fields.stayDays)

  if (!arrivalDate) {
    issues.push({ field: "出发日期", message: "未识别到赴美出发日期，请人工确认。" })
  }
  if (!departureDate) {
    issues.push({ field: "离开日期", message: "未识别到离开日期，请人工确认。" })
  }
  if (!stayDays) {
    issues.push({ field: "停留天数", message: "未识别到停留天数，请人工确认。" })
  }

  return {
    cn: `我计划${arrivalDate ? `在${formatDateCn(arrivalDate)}` : "[请确认出发日期]"}去${city}，${
      departureDate ? `并在${formatDateCn(departureDate)}` : "[请确认离开日期]"
    }离开，一共停留${stayDays || "[请确认停留天数]"}天。`,
    en: `I plan to travel to ${city} on ${arrivalDate ? formatDateEn(arrivalDate) : "[please confirm the departure date]"}, and leave on ${
      departureDate ? formatDateEn(departureDate) : "[please confirm the return date]"
    }. I will stay for ${stayDays || "[please confirm the trip length]"} days.`,
  }
}

function buildPendingQuestion(id: string, questionCn: string, questionEn?: string): InterviewBriefBlock {
  return {
    type: "pending-qa",
    id,
    questionCn,
    questionEn,
    placeholderCn: PENDING_PLACEHOLDER_CN,
    placeholderEn: PENDING_PLACEHOLDER_EN,
  }
}

export function buildUsVisaInterviewBrief(buffer: Buffer): InterviewBriefResult {
  const fields = collectFieldValues(buffer)
  const issues: InterviewBriefIssue[] = []
  const city = humanizeCity(fields.hotelCity) || "[请确认赴美城市]"
  const hotelName = normalizeText(fields.hotelName) || "[请确认第一晚酒店名称]"

  if (!normalizeText(fields.hotelCity)) {
    issues.push({ field: "赴美城市", message: "未识别到赴美城市，请人工确认。" })
  }
  if (!normalizeText(fields.hotelName)) {
    issues.push({ field: "第一晚酒店", message: "未识别到第一晚酒店信息，请人工确认。" })
  }

  const schoolAnswer = buildSchoolAnswer(fields, issues)
  const tripTimingAnswer = buildTripTimingAnswer(fields, issues)

  const blocks: InterviewBriefBlock[] = [
    {
      type: "qa",
      id: "q1",
      questionCn: "1. 为什么去美国？",
      questionEn: "Why are you going to the United States?",
      answerCn: `去${city}短期旅行。`,
      answerEn: `I am going to ${city} for a short trip.`,
    },
    {
      type: "qa-options",
      id: "q2",
      questionCn: "2. 你计划前往美国什么地方？",
      questionEn: "Where do you plan to go in the United States?",
      answerCn: city,
      answerEn: city,
      note: "如果问到为什么要去这个地方就回答：（两个答案都可以，根据自己方便记一个）",
      options: [
        {
          label: "A",
          text: `I plan to visit ${city} to explore famous landmarks such as Times Square, the Statue of Liberty, and Central Park.`,
        },
        {
          label: "B",
          text: `I want to visit ${city} as a short holiday trip during Christmas break. I have already arranged my accommodation and will stay only ${normalizeText(fields.stayDays) || "6"} days.`,
        },
      ],
    },
    {
      type: "qa",
      id: "q3",
      questionCn: "3. 待多久？什么时候？",
      questionEn: "When do you plan to go to the United States and how long are you going to stay?",
      answerCn: tripTimingAnswer.cn,
      answerEn: tripTimingAnswer.en,
    },
    {
      type: "qa",
      id: "q4",
      questionCn: "4. 是一个人去吗？",
      questionEn: "Are you going alone?",
      answerCn: "是的，我一个人去。",
      answerEn: "Yes, I will go alone.",
    },
    {
      type: "qa",
      id: "q5",
      questionCn: "5. 是学生吗？哪个学校，专业是什么？",
      questionEn: "Are you a student? Which is your school and what is your major?",
      answerCn: schoolAnswer.cn,
      answerEn: schoolAnswer.en,
    },
    {
      type: "qa",
      id: "q6",
      questionCn: "6. 谁会支付你这次的旅行费用？",
      questionEn: "Who will pay for your trip?",
      answerCn: "我自己，自己有足够的存款，同时也得到了父母的支持。",
      answerEn: "Myself. I have enough savings for this trip and have also received support from my parents.",
    },
    {
      type: "qa",
      id: "q6_1",
      questionCn: "6.1 如果问你的存款从哪来？",
      answerCn: "这是我从日常生活费中攒下来的个人储蓄。我已经计划这次旅行有一段时间了，所以一直在慢慢存钱。",
      answerEn: "It is my personal savings from my daily allowance. I have been planning this trip for a while and saved up for it gradually.",
    },
    {
      type: "qa",
      id: "q7",
      questionCn: "7. 你的学费是谁出的？",
      questionEn: "Who pays for your tuition?",
      answerCn: "父母支持我的学费。",
      answerEn: "My parents.",
    },
    {
      type: "section-title",
      id: "sensitive-title",
      title: "其他可能的问题",
      description: "敏感专业的同学必须看。",
    },
    buildPendingQuestion(
      "s1",
      "1. 你的父母是什么工作，你的父母在哪？",
      "What are your parents' jobs and where are your parents located?",
    ),
    {
      type: "qa",
      id: "s2",
      questionCn: "2. 你毕业后准备去哪个地方工作 / 你毕业后有什么打算？",
      questionEn: "Where do you plan to work after graduation / What are your plans after graduation?",
      answerCn: "毕业之后会到中国寻找工作。",
      answerEn: "I will look for a job in China after graduation.",
    },
    {
      type: "qa",
      id: "s3",
      questionCn: "3. 在美国是否有亲戚朋友？",
      questionEn: "Do you have any relatives or friends in the U.S.?",
      answerCn: "没有，在美国没有任何认识的人。如果有亲戚或朋友，请如实回答。",
      answerEn: "No, I do not know anyone in the U.S. If you do have relatives or friends there, answer truthfully.",
    },
    {
      type: "qa",
      id: "s4",
      questionCn: "4. 你会在美国找工作吗？",
      questionEn: "Will you look for a job in the U.S.?",
      answerCn: "绝对不会，我只想在中国工作。",
      answerEn: "Absolutely no. I only want to work in China.",
    },
    buildPendingQuestion(
      "s5",
      "5. 你的本科是哪个大学的？",
      "Which university did you receive your undergraduate degree from?",
    ),
    buildPendingQuestion("s6", "6. 本科专业是什么？", "What was your undergraduate major?"),
    buildPendingQuestion("s7", "7. 解释一下你的专业。", "Explain your major."),
    buildPendingQuestion("s8", "8. 你的专业有哪些课程？", "What courses are available in your major?"),
    {
      type: "qa",
      id: "s9",
      questionCn: "9. 你未来有什么打算？",
      questionEn: "What are your plans for the future?",
      answerCn: "回国找工作。",
      answerEn: "I plan to return to China and work there.",
    },
    {
      type: "qa",
      id: "s10",
      questionCn: "10. 你之前有美国签证但是没去，为什么？",
      questionEn: "You had a U.S. visa before but never traveled. Why?",
      answerCn:
        normalizeText(fields.hasUsVisa).toLowerCase() === "no"
          ? "如果没有这段经历，这个问题可以直接略过。"
          : "如果签证官问到这个问题，请按真实情况回答。",
      answerEn:
        normalizeText(fields.hasUsVisa).toLowerCase() === "no"
          ? "You can ignore this question if it does not apply to you."
          : "If the officer asks about this, please answer based on the truth.",
    },
    {
      type: "hotel",
      id: "hotel",
      title: "在美国第一晚的酒店信息（记下名字就好）",
      hotelName,
    },
  ]

  return {
    fields,
    blocks,
    issues,
  }
}

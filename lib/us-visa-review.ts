import path from "path"
import { spawn } from "child_process"

import { buildUsVisaInterviewBrief, type InterviewBriefFieldMap } from "@/lib/us-visa-interview-brief"
import { extractUsVisaExcelReviewFields } from "@/lib/us-visa-excel-audit"

export type UsVisaReviewDecision = "pass" | "needs_changes"
export type UsVisaReviewCategory = "identity" | "contact" | "travel" | "workEducation" | "background"
export type UsVisaReviewSourceKey = "excel" | "ds160" | "interviewBrief"
export type UsVisaReviewValueStatus = "match" | "mismatch" | "missing" | "not_applicable"
export type UsVisaReviewSourceStatus = "ready" | "fallback" | "missing"

export interface UsVisaReviewSourceInfo {
  key: UsVisaReviewSourceKey
  label: string
  status: UsVisaReviewSourceStatus
  description: string
  fileName?: string
}

export interface UsVisaReviewComparison {
  key: string
  category: UsVisaReviewCategory
  labelCn: string
  labelEn: string
  excelValue: string
  ds160Value: string
  interviewBriefValue: string
  ds160Status: UsVisaReviewValueStatus
  interviewBriefStatus: UsVisaReviewValueStatus
}

export interface UsVisaReviewIssue {
  source: "DS-160 生成结果" | "面试必看"
  title: string
  message: string
}

export interface UsVisaReviewResult {
  decision: UsVisaReviewDecision
  summary: string
  sources: UsVisaReviewSourceInfo[]
  blockingIssues: UsVisaReviewIssue[]
  comparisons: UsVisaReviewComparison[]
}

interface Ds160ReviewFields {
  applicationId?: string
  surname?: string
  givenName?: string
  dateOfBirth?: string
  passportNumber?: string
  homeAddress?: string
  homeCity?: string
  homeState?: string
  homeZip?: string
  primaryPhone?: string
  lastFiveYearsPhone?: string
  personalEmail?: string
  lastFiveYearsEmail?: string
  intendedArrivalDate?: string
  intendedStayDays?: string
  hotelAddress?: string
  hotelCity?: string
  hotelState?: string
  hotelZip?: string
  tripPayer?: string
  previousUsTravel?: string
  hasUsVisa?: string
  currentOccupation?: string
  presentSchoolName?: string
  presentSchoolAddress?: string
  presentSchoolCity?: string
  presentSchoolState?: string
  presentSchoolZip?: string
  presentSchoolPhone?: string
  major?: string
  usContactOrganization?: string
}

type ExcelFieldMap = Record<string, string>

type NormalizedInterviewBriefFields = {
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

type ReviewFieldDefinition = {
  key: string
  category: UsVisaReviewCategory
  labelCn: string
  labelEn: string
  excelKey?: string
  ds160Key?: keyof Ds160ReviewFields
  interviewKey?: keyof NormalizedInterviewBriefFields
}

const REVIEW_FIELDS: ReviewFieldDefinition[] = [
  { key: "applicationId", category: "identity", labelCn: "AA码", labelEn: "Application ID", excelKey: "applicationId", ds160Key: "applicationId" },
  { key: "surname", category: "identity", labelCn: "姓", labelEn: "Surname", excelKey: "surname", ds160Key: "surname" },
  { key: "givenName", category: "identity", labelCn: "名", labelEn: "Given Name", excelKey: "givenName", ds160Key: "givenName" },
  { key: "dateOfBirth", category: "identity", labelCn: "出生日期", labelEn: "Date of Birth", excelKey: "dateOfBirth", ds160Key: "dateOfBirth" },
  { key: "passportNumber", category: "identity", labelCn: "护照号", labelEn: "Passport Number", excelKey: "passportNumber", ds160Key: "passportNumber" },

  { key: "primaryPhone", category: "contact", labelCn: "主要电话", labelEn: "Primary Phone Number", excelKey: "primaryPhone", ds160Key: "primaryPhone" },
  { key: "lastFiveYearsPhone", category: "contact", labelCn: "近五年电话", labelEn: "Last Five Years Phone", excelKey: "lastFiveYearsPhone", ds160Key: "lastFiveYearsPhone" },
  { key: "personalEmail", category: "contact", labelCn: "个人邮箱", labelEn: "Personal Email Address", excelKey: "personalEmail", ds160Key: "personalEmail" },
  { key: "lastFiveYearsEmail", category: "contact", labelCn: "近五年邮箱", labelEn: "Last Five Years Email", excelKey: "lastFiveYearsEmail", ds160Key: "lastFiveYearsEmail" },
  { key: "homeAddress", category: "contact", labelCn: "家庭地址", labelEn: "Home Address", excelKey: "homeAddress", ds160Key: "homeAddress" },
  { key: "homeCity", category: "contact", labelCn: "家庭城市", labelEn: "Home City", excelKey: "homeCity", ds160Key: "homeCity" },
  { key: "homeState", category: "contact", labelCn: "家庭州省", labelEn: "Home State/Province", excelKey: "homeState", ds160Key: "homeState" },
  { key: "homeZip", category: "contact", labelCn: "家庭邮编", labelEn: "Home ZIP Code", excelKey: "homeZip", ds160Key: "homeZip" },

  { key: "arrivalDate", category: "travel", labelCn: "计划到达日期", labelEn: "Intended Date of Arrival", excelKey: "intendedArrivalDate", ds160Key: "intendedArrivalDate", interviewKey: "arrivalDate" },
  { key: "stayDays", category: "travel", labelCn: "计划停留天数", labelEn: "Intended Length of Stay", excelKey: "intendedStayDays", ds160Key: "intendedStayDays", interviewKey: "stayDays" },
  { key: "hotelAddress", category: "travel", labelCn: "在美地址", labelEn: "Address Where You Will Stay", excelKey: "hotelAddress", ds160Key: "hotelAddress" },
  { key: "hotelCity", category: "travel", labelCn: "在美城市", labelEn: "U.S. Stay City", excelKey: "hotelCity", ds160Key: "hotelCity", interviewKey: "hotelCity" },
  { key: "hotelState", category: "travel", labelCn: "在美州", labelEn: "U.S. Stay State", excelKey: "hotelState", ds160Key: "hotelState" },
  { key: "tripPayer", category: "travel", labelCn: "旅行费用支付人", labelEn: "Trip Payer", ds160Key: "tripPayer", interviewKey: "tripPayer" },
  { key: "hotelName", category: "travel", labelCn: "第一晚酒店", labelEn: "First Night Hotel", ds160Key: "usContactOrganization", interviewKey: "hotelName" },

  { key: "currentOccupation", category: "workEducation", labelCn: "当前职业", labelEn: "Primary Occupation", ds160Key: "currentOccupation", interviewKey: "currentOccupation" },
  { key: "schoolName", category: "workEducation", labelCn: "当前学校/单位", labelEn: "Present Employer or School Name", ds160Key: "presentSchoolName", interviewKey: "schoolName" },
  { key: "major", category: "workEducation", labelCn: "专业/课程", labelEn: "Course of Study / Major", ds160Key: "major", interviewKey: "major" },
  { key: "presentSchoolAddress", category: "workEducation", labelCn: "当前学校/单位地址", labelEn: "Present Employer or School Address", excelKey: "presentSchoolAddress", ds160Key: "presentSchoolAddress" },
  { key: "presentSchoolCity", category: "workEducation", labelCn: "当前学校/单位城市", labelEn: "Present Employer or School City", excelKey: "presentSchoolCity", ds160Key: "presentSchoolCity" },
  { key: "presentSchoolState", category: "workEducation", labelCn: "当前学校/单位州省", labelEn: "Present Employer or School State", excelKey: "presentSchoolState", ds160Key: "presentSchoolState" },
  { key: "presentSchoolZip", category: "workEducation", labelCn: "当前学校/单位邮编", labelEn: "Present Employer or School ZIP", excelKey: "presentSchoolZip", ds160Key: "presentSchoolZip" },
  { key: "presentSchoolPhone", category: "workEducation", labelCn: "当前学校/单位电话", labelEn: "Present Employer or School Phone", ds160Key: "presentSchoolPhone" },

  { key: "hasUsVisa", category: "background", labelCn: "是否曾有美国签证", labelEn: "Have You Ever Been Issued a U.S. Visa?", excelKey: "hasUsVisa", ds160Key: "hasUsVisa", interviewKey: "hasUsVisa" },
  { key: "previousUsTravel", category: "background", labelCn: "是否去过美国", labelEn: "Have You Ever Been in the U.S.?", excelKey: "previousUsTravel", ds160Key: "previousUsTravel", interviewKey: "previousUsTravel" },
]

const CATEGORY_LABELS: Record<UsVisaReviewCategory, string> = {
  identity: "身份信息",
  contact: "联系方式",
  travel: "赴美行程",
  workEducation: "学校 / 工作",
  background: "背景问答",
}

function normalizeText(value: unknown) {

  return value == null ? "" : String(value).trim()
}

function normalizeAscii(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeCompactText(value: string) {
  return normalizeAscii(normalizeText(value))
    .toUpperCase()
    .replace(/[，,.;:()/\\[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeName(value: string) {
  return normalizeCompactText(value).replace(/\s+/g, "")
}

function normalizePhone(value: string) {
  return normalizeText(value).replace(/\D+/g, "")
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase()
}

function normalizeBoolean(value: string) {
  const normalized = normalizeCompactText(value)
  if (!normalized) return ""
  if (["YES", "Y", "TRUE", "1", "是", "有"].includes(normalized)) return "YES"
  if (["NO", "N", "FALSE", "0", "否", "无"].includes(normalized)) return "NO"
  return normalized
}

function normalizeInteger(value: string) {
  const match = normalizeText(value).match(/\d+/)
  return match ? String(Number(match[0])) : ""
}

function parseEnglishDate(value: string) {
  const text = normalizeText(value)
  if (!text) return ""

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (iso) {
    const [, year, month, day] = iso
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const dayFirst = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (dayFirst) {
    const [, day, month, year] = dayFirst
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const monthNames: Record<string, string> = {
    JANUARY: "01",
    FEBRUARY: "02",
    MARCH: "03",
    APRIL: "04",
    MAY: "05",
    JUNE: "06",
    JULY: "07",
    AUGUST: "08",
    SEPTEMBER: "09",
    OCTOBER: "10",
    NOVEMBER: "11",
    DECEMBER: "12",
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
  }

  const english = normalizeCompactText(text).match(/^(\d{1,2})\s+([A-Z]+)\s+(\d{4})$/)
  if (english) {
    const [, day, monthName, year] = english
    const month = monthNames[monthName]
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`
  }

  return ""
}

function normalizeAddress(value: string) {
  return normalizeCompactText(value)
}

function valuesMatch(key: string, left: string, right: string) {
  if (!left && !right) return true
  if (!left || !right) return false

  if (["surname", "givenName", "schoolName", "major", "currentOccupation", "hotelName"].includes(key)) {
    return normalizeName(left) === normalizeName(right)
  }

  if (["primaryPhone", "lastFiveYearsPhone", "presentSchoolPhone"].includes(key)) {
    return normalizePhone(left) === normalizePhone(right)
  }

  if (["personalEmail", "lastFiveYearsEmail"].includes(key)) {
    return normalizeEmail(left) === normalizeEmail(right)
  }

  if (
    [
      "dateOfBirth",
      "arrivalDate",
      "intendedArrivalDate",
      "departureDate",
      "previousUsTravelArrivalDate",
    ].includes(key)
  ) {
    return parseEnglishDate(left) === parseEnglishDate(right)
  }

  if (["stayDays"].includes(key)) {
    return normalizeInteger(left) === normalizeInteger(right)
  }

  if (["hasUsVisa", "previousUsTravel"].includes(key)) {
    return normalizeBoolean(left) === normalizeBoolean(right)
  }

  if (
    [
      "homeAddress",
      "hotelAddress",
      "presentSchoolAddress",
      "homeCity",
      "homeState",
      "homeZip",
      "hotelCity",
      "hotelState",
      "presentSchoolCity",
      "presentSchoolState",
      "presentSchoolZip",
      "tripPayer",
    ].includes(key)
  ) {
    return normalizeAddress(left) === normalizeAddress(right)
  }

  if (key === "applicationId" || key === "passportNumber") {
    return normalizeCompactText(left) === normalizeCompactText(right)
  }

  return normalizeCompactText(left) === normalizeCompactText(right)
}

function parseNameProvided(value: string) {
  const text = normalizeText(value)
  if (!text) return { surname: "", givenName: "" }
  if (text.includes(",")) {
    const [surname, givenName] = text.split(",", 2)
    return { surname: normalizeText(surname), givenName: normalizeText(givenName) }
  }
  const parts = text.split(/\s+/).filter(Boolean)
  return {
    surname: parts[0] || "",
    givenName: parts.slice(1).join(" "),
  }
}

function splitLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractBlock(text: string, label: string, nextLabels: string[]) {
  const pattern = new RegExp(
    `${escapeRegex(label)}:\\s*([\\s\\S]*?)(?=\\n(?:${nextLabels.map(escapeRegex).join("|")}):|$)`,
    "i",
  )
  const match = text.match(pattern)
  return normalizeText(match?.[1] || "")
}

function extractNextAnswer(text: string, question: string) {
  const lines = splitLines(text)
  const index = lines.findIndex((line) => line === question)
  if (index === -1) return ""
  for (let pointer = index + 1; pointer < lines.length; pointer += 1) {
    const candidate = lines[pointer]
    if (!candidate) continue
    if (/^DO NOT BRING THIS TO YOUR INTERVIEW$/i.test(candidate)) continue
    return candidate
  }
  return ""
}

function parseAddressTail(value: string) {
  const lines = splitLines(value)
  if (lines.length === 0) {
    return { address: "", city: "", state: "", zip: "" }
  }
  if (lines.length === 1) {
    return { address: lines[0], city: "", state: "", zip: "" }
  }

  const address = lines.slice(0, -1).join(" ")
  const tail = lines[lines.length - 1]
  const match = tail.match(/^(.+?),\s*([A-Z .'-]+)\s+([A-Z0-9-]+)$/i)
  if (!match) {
    return { address: lines.join(" "), city: "", state: "", zip: "" }
  }

  return {
    address,
    city: normalizeText(match[1]),
    state: normalizeText(match[2]),
    zip: normalizeText(match[3]),
  }
}

async function extractPdfText(absolutePath: string) {
  const scriptPath = path.join(process.cwd(), "scripts", "extract_pdf_text.py")
  return new Promise<string>((resolve, reject) => {
    const pythonCmd = process.platform === "win32" ? "python" : "python3"
    const proc = spawn(pythonCmd, [scriptPath, absolutePath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || "PDF 文本提取失败"))
        return
      }

      try {
        const parsed = JSON.parse(stdout.trim()) as { success?: boolean; text?: string; error?: string }
        if (!parsed.success) {
          reject(new Error(parsed.error || "PDF 文本提取失败"))
          return
        }
        resolve(parsed.text || "")
      } catch (error) {
        reject(error instanceof Error ? error : new Error("PDF 文本提取结果解析失败"))
      }
    })
  })
}

function parseDs160Personal(text: string) {
  const nameBlock = extractBlock(text, "Name Provided", ["Full Name in Native Alphabet"])
  const name = parseNameProvided(nameBlock)
  const homeBlock = extractBlock(text, "Home Address", ["City"])
  const homeCity = extractBlock(text, "City", ["State/Province"])
  const homeState = extractBlock(text, "State/Province", ["Postal Zone/ZIP Code", "Postal Zone/Zip Code"])
  const homeZip = extractBlock(text, "Postal Zone/ZIP Code", ["Country/Region"]) || extractBlock(text, "Postal Zone/Zip Code", ["Country/Region"])

  return {
    applicationId: (text.match(/Application ID\s+(AA[A-Z0-9]+)/i)?.[1] || "").trim(),
    surname: name.surname,
    givenName: name.givenName,
    dateOfBirth: extractBlock(text, "Date of Birth", ["Country/Region of Birth"]),
    passportNumber: extractBlock(text, "Passport/Travel Document Number", ["Passport Book Number"]),
    homeAddress: homeBlock,
    homeCity,
    homeState,
    homeZip,
    primaryPhone:
      extractBlock(text, "Primary Phone Number", ["Secondary Phone Number"]) ||
      extractBlock(text, "Phone Number", ["Secondary Phone Number"]),
    lastFiveYearsPhone: extractBlock(text, "Phone Number (1)", ["DO NOT BRING THIS TO YOUR INTERVIEW"]),
    personalEmail: extractBlock(text, "Email Address", ["Have you used additional email addresses in the last five years?"]),
    lastFiveYearsEmail: extractBlock(text, "Email Address (1)", ["Do you have a social media presence?"]),
  } satisfies Partial<Ds160ReviewFields>
}

function parseDs160Travel(text: string) {
  const addressBlock = extractBlock(text, "Address where you will stay in the U.S.", ["Person/Entity Paying for Your Trip"])
  const address = parseAddressTail(addressBlock)

  return {
    intendedArrivalDate: extractBlock(text, "Intended Date of Arrival", ["Intended Length of Stay in U.S."]),
    intendedStayDays: extractBlock(text, "Intended Length of Stay in U.S.", ["Address where you will stay in the U.S."]),
    hotelAddress: address.address,
    hotelCity: address.city,
    hotelState: address.state,
    hotelZip: address.zip,
    tripPayer: extractBlock(text, "Person/Entity Paying for Your Trip", ["Edit Travel Companions Information"]),
    previousUsTravel: extractNextAnswer(text, "Have you ever been in the U.S.?"),
    hasUsVisa: extractNextAnswer(text, "Have you ever been issued a U.S. visa?"),
  } satisfies Partial<Ds160ReviewFields>
}

function parseDs160UsContact(text: string) {
  const contactAddressBlock = extractBlock(text, "U.S. Contact Address", ["Phone Number"])
  const address = parseAddressTail(contactAddressBlock)

  return {
    usContactOrganization: extractBlock(text, "Organization Name in the U.S.", ["Relationship to You"]),
    hotelAddress: address.address,
    hotelCity: address.city,
    hotelState: address.state,
    hotelZip: address.zip,
  } satisfies Partial<Ds160ReviewFields>
}

function parseDs160WorkEducation(text: string) {
  return {
    currentOccupation: extractBlock(text, "Primary Occupation", ["Present Employer or School Name"]),
    presentSchoolName: extractBlock(text, "Present Employer or School Name", ["Present Employer or School Address"]),
    presentSchoolAddress: extractBlock(text, "Present Employer or School Address", ["City"]),
    presentSchoolCity: extractBlock(text, "City", ["State/Province"]),
    presentSchoolState: extractBlock(text, "State/Province", ["Postal Zone/Zip Code", "Postal Zone/ZIP Code"]),
    presentSchoolZip:
      extractBlock(text, "Postal Zone/Zip Code", ["Country/Region"]) ||
      extractBlock(text, "Postal Zone/ZIP Code", ["Country/Region"]),
    presentSchoolPhone: extractBlock(text, "Work Phone Number", ["Monthly Salary in Local Currency (if employed)"]),
    major: extractBlock(text, "Course of Study", ["Date of Attendance From"]),
  } satisfies Partial<Ds160ReviewFields>
}

async function parseDs160ReviewFiles(pdfPaths: string[]) {
  const collected: Ds160ReviewFields = {}

  for (const absolutePath of pdfPaths) {
    const fileName = path.basename(absolutePath).toLowerCase()
    const text = await extractPdfText(absolutePath)
    if (!text) continue

    let partial: Partial<Ds160ReviewFields> = {}
    if (fileName.includes("personal")) {
      partial = parseDs160Personal(text)
    } else if (fileName.includes("travel")) {
      partial = parseDs160Travel(text)
    } else if (fileName.includes("uscontact")) {
      partial = parseDs160UsContact(text)
    } else if (fileName.includes("workeducation")) {
      partial = parseDs160WorkEducation(text)
    }

    Object.assign(collected, Object.fromEntries(Object.entries(partial).filter(([, value]) => normalizeText(value))))
  }

  return collected
}

function normalizeInterviewBriefFields(fields: Partial<InterviewBriefFieldMap> | undefined): NormalizedInterviewBriefFields {
  if (!fields) return {}
  return {
    schoolName: normalizeText(fields.schoolName),
    major: normalizeText(fields.major),
    currentOccupation: normalizeText(fields.currentOccupation),
    hotelName: normalizeText(fields.hotelName),
    hotelCity: normalizeText(fields.hotelCity),
    arrivalDate: normalizeText(fields.arrivalDate),
    departureDate: normalizeText(fields.departureDate),
    stayDays: normalizeText(fields.stayDays),
    tripPayer: normalizeText(fields.tripPayer),
    tripPayerOther: normalizeText(fields.tripPayerOther),
    tripPayerRelationship: normalizeText(fields.tripPayerRelationship),
    hasUsVisa: normalizeText(fields.hasUsVisa),
    previousUsTravel: normalizeText(fields.previousUsTravel),
  }
}

function buildExcelCanonicalFields(buffer: Buffer) {
  const excelReview = extractUsVisaExcelReviewFields(buffer)
  const interview = buildUsVisaInterviewBrief(buffer)

  return {
    ...excelReview,
    schoolName: normalizeText(interview.fields.schoolName),
    major: normalizeText(interview.fields.major),
    currentOccupation: normalizeText(interview.fields.currentOccupation),
    hotelName: normalizeText(interview.fields.hotelName),
    hotelCity: normalizeText(excelReview.hotelCity || interview.fields.hotelCity),
    arrivalDate: normalizeText(excelReview.intendedArrivalDate || interview.fields.arrivalDate),
    departureDate: normalizeText(interview.fields.departureDate),
    stayDays: normalizeText(excelReview.intendedStayDays || interview.fields.stayDays),
    tripPayer: normalizeText(interview.fields.tripPayer),
    tripPayerOther: normalizeText(interview.fields.tripPayerOther),
    tripPayerRelationship: normalizeText(interview.fields.tripPayerRelationship),
    hasUsVisa: normalizeText(excelReview.hasUsVisa || interview.fields.hasUsVisa),
    previousUsTravel: normalizeText(excelReview.previousUsTravel || interview.fields.previousUsTravel),
  } satisfies ExcelFieldMap
}

export async function runUsVisaReview(params: {
  excelBuffer: Buffer
  ds160PdfPaths: string[]
  interviewBriefFields?: Partial<InterviewBriefFieldMap>
  interviewBriefMode?: "saved" | "rebuilt"
  ds160FileNames?: string[]
  interviewBriefFileName?: string
}) {
  const { excelBuffer, ds160PdfPaths, interviewBriefFields, interviewBriefMode = "saved", ds160FileNames, interviewBriefFileName } =
    params

  const excel = buildExcelCanonicalFields(excelBuffer)
  const sources: UsVisaReviewSourceInfo[] = [
    {
      key: "excel",
      label: "美签 Excel",
      status: "ready",
      description: "当前审核以美签 Excel 作为信息源标准。",
    },
  ]

  const blockingIssues: UsVisaReviewIssue[] = []

  let ds160: Ds160ReviewFields = {}
  if (!ds160PdfPaths.length) {
    sources.push({
      key: "ds160",
      label: "DS-160 ????",
      status: "ready",
      description: `??? ${ds160PdfPaths.length} ? DS-160 Review PDF?`,
      fileName: ds160FileNames?.join("?"),
    })
  }

  let interviewBrief: NormalizedInterviewBriefFields = {}
  if (!interviewBriefFields) {
    sources.push({
      key: "interviewBrief",
      label: "面试必看",
      status: "missing",
      description: "未找到面试必看的结构化结果，请先生成面试必看后再审核。",
    })
    blockingIssues.push({
      source: "面试必看",
      title: "缺少面试必看结果",
      message: "系统未找到面试必看的结构化结果，请先生成面试必看后再审核。",
    })
  } else {
    interviewBrief = normalizeInterviewBriefFields(interviewBriefFields)
    sources.push({
      key: "interviewBrief",
      label: "面试必看",
      status: interviewBriefMode === "saved" ? "ready" : "fallback",
      description:
        interviewBriefMode === "saved"
          ? "已读取归档的面试必看结构化结果。"
          : "未找到归档快照，已按当前 Excel 重建面试必看字段用于审核。",
      fileName: interviewBriefFileName,
    })
  }

  const comparisons: UsVisaReviewComparison[] = REVIEW_FIELDS.map((field) => {
    const excelValue = normalizeText(
      field.excelKey ? (excel as Record<string, string | undefined>)[field.excelKey] : "",
    )
    const ds160Value = normalizeText(field.ds160Key ? ds160[field.ds160Key] : "")
    const interviewValue = normalizeText(
      field.interviewKey
        ? (interviewBrief as Record<string, string | undefined>)[field.interviewKey]
        : "",
    )

    let ds160Status: UsVisaReviewValueStatus = field.ds160Key ? "missing" : "not_applicable"
    if (!field.ds160Key) {
      ds160Status = "not_applicable"
    } else if (!ds160PdfPaths.length) {
      ds160Status = "missing"
    } else if (!ds160Value) {
      ds160Status = "missing"
    } else {
      ds160Status = valuesMatch(field.key, excelValue, ds160Value) ? "match" : "mismatch"
      if (!excelValue && ds160Value) {
        ds160Status = "mismatch"
      }
    }

    let interviewStatus: UsVisaReviewValueStatus = field.interviewKey ? "missing" : "not_applicable"
    if (!field.interviewKey) {
      interviewStatus = "not_applicable"
    } else if (!interviewBriefFields) {
      interviewStatus = "missing"
    } else if (!interviewValue) {
      interviewStatus = "missing"
    } else {
      interviewStatus = valuesMatch(field.key, excelValue, interviewValue) ? "match" : "mismatch"
      if (!excelValue && interviewValue) {
        interviewStatus = "mismatch"
      }
    }

    return {
      key: field.key,
      category: field.category,
      labelCn: field.labelCn,
      labelEn: field.labelEn,
      excelValue,
      ds160Value,
      interviewBriefValue: interviewValue,
      ds160Status,
      interviewBriefStatus: interviewStatus,
    }
  })

  for (const comparison of comparisons) {
    if (comparison.ds160Status === "mismatch") {
      blockingIssues.push({
        source: "DS-160 生成结果",
        title: `${comparison.labelCn} / ${comparison.labelEn} 不一致`,
        message: `Excel：${comparison.excelValue || "未填写"}；DS-160：${comparison.ds160Value || "未识别"}`,
      })
    }
    if (comparison.interviewBriefStatus === "mismatch") {
      blockingIssues.push({
        source: "面试必看",
        title: `${comparison.labelCn} / ${comparison.labelEn} 不一致`,
        message: `Excel：${comparison.excelValue || "未填写"}；面试必看：${comparison.interviewBriefValue || "未识别"}`,
      })
    }
  }

  const decision: UsVisaReviewDecision = blockingIssues.length > 0 ? "needs_changes" : "pass"
  const summary = decision === "pass" ? "????" : "????"

  return {
    decision,
    summary,
    sources,
    blockingIssues,
    comparisons,
  } satisfies UsVisaReviewResult
}

export function groupUsVisaComparisonsByCategory(comparisons: UsVisaReviewComparison[]) {
  const grouped = new Map<UsVisaReviewCategory, UsVisaReviewComparison[]>()
  for (const comparison of comparisons) {
    if (!grouped.has(comparison.category)) {
      grouped.set(comparison.category, [])
    }
    grouped.get(comparison.category)?.push(comparison)
  }
  return Array.from(grouped.entries()).map(([category, items]) => ({
    category,
    label: CATEGORY_LABELS[category],
    items,
  }))
}

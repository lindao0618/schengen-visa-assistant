import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"
import { differenceInCalendarDays } from "date-fns"
import { read, utils } from "xlsx"

export type ComprehensiveMaterialKey =
  | "schengenExcel"
  | "fvReceipt"
  | "tlsAppointment"
  | "itinerary"
  | "hotel"
  | "flight"
  | "insurance"

export type ComprehensiveMaterialSource = {
  key: ComprehensiveMaterialKey
  label: string
  required: boolean
  sourceType: "archive" | "upload"
  fileName: string
  mimeType?: string
  absolutePath: string
}

export type ReviewIssue = {
  code: string
  title: string
  detail: string
  materials: string[]
}

export type ReviewExtractedValue = {
  label: string
  value: string
}

export type ReviewSection = {
  title: string
  items: ReviewIssue[]
}

export type ReviewMaterialSnapshot = {
  label: string
  present: boolean
  required: boolean
  sourceType?: "archive" | "upload"
  fileName?: string
}

export type ReviewMaterialOutcome = {
  key: ComprehensiveMaterialKey
  label: string
  status: "pass" | "fail" | "missing"
  required: boolean
  present: boolean
  blockingTitles: string[]
  advisoryTitles: string[]
}

export type ComprehensiveReviewDecision = "pass" | "fail"

export type ComprehensiveReviewResult = {
  decision: ComprehensiveReviewDecision
  decisionLabel: "可以递签" | "不可递签"
  summary: string
  missingCoreMaterials: string[]
  missingOptionalMaterials: string[]
  blockingIssues: ReviewIssue[]
  advisoryIssues: ReviewIssue[]
  sections: ReviewSection[]
  materials: Record<ComprehensiveMaterialKey, ReviewMaterialSnapshot>
  materialOutcomes: ReviewMaterialOutcome[]
  extracted: Array<{
    source: string
    values: ReviewExtractedValue[]
  }>
}

type ParsedExcel = {
  sourceKind?: "standard" | "tlsRegistration" | "unknown"
  fullName?: string
  familyName?: string
  givenName?: string
  birthDate?: string
  passportNumber?: string
  schengenCountry?: string
  submissionCity?: string
  email?: string
  phone?: string
  ukAddress?: string
  organization?: string
  entryDate?: string
  exitDate?: string
  hotelName?: string
  hotelAddress?: string
  hotelCity?: string
}

type ParsedFvReceipt = {
  applicationNumber?: string
  fullName?: string
  familyName?: string
  givenName?: string
  birthDate?: string
  passportNumber?: string
  nationality?: string
  schengenCountry?: string
  entryDate?: string
  exitDate?: string
  hotelName?: string
  email?: string
  phone?: string
  ukAddress?: string
  organization?: string
}

type ParsedTlsAppointment = {
  applicationNumber?: string
  fullName?: string
  appointmentDateTime?: string
  groupNumber?: string
}

type ParsedItinerary = {
  startDate?: string
  endDate?: string
  dateList: string[]
  continuous: boolean
  hotelName?: string
  hotelAddress?: string
  hotelCity?: string
  firstDepartureCity?: string
  firstArrivalCity?: string
  lastDepartureCity?: string
  lastArrivalCity?: string
}

type ParsedHotel = {
  hotelName?: string
  hotelAddress?: string
  hotelCity?: string
  checkInDate?: string
  checkOutDate?: string
  nights?: number
  guestNames: string[]
}

type ParsedFlight = {
  outboundDate?: string
  returnDate?: string
  departureCity?: string
  arrivalCity?: string
  returnDepartureCity?: string
  returnArrivalCity?: string
}

type ParsedInsurance = {
  startDate?: string
  endDate?: string
}

type ParsedSources = {
  excel?: ParsedExcel
  fvReceipt?: ParsedFvReceipt
  tlsAppointment?: ParsedTlsAppointment
  itinerary?: ParsedItinerary
  hotel?: ParsedHotel
  flight?: ParsedFlight
  insurance?: ParsedInsurance
}

export const COMPREHENSIVE_MATERIAL_CONFIG: Record<
  ComprehensiveMaterialKey,
  { label: string; required: boolean }
> = {
  schengenExcel: { label: "申根 Excel", required: true },
  fvReceipt: { label: "FV申请回执单", required: true },
  tlsAppointment: { label: "TLS预约单", required: true },
  itinerary: { label: "行程单", required: true },
  hotel: { label: "酒店订单", required: true },
  flight: { label: "机票", required: false },
  insurance: { label: "保险", required: false },
}

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  SEPT: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
}

function normalizeText(value: unknown) {
  if (value == null) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u3000"'`“”‘’（）()\[\]【】{}<>:：;；,，.。/\\|!！?？@#$%^&*_+=~-]/g, "")
}

function normalizeLetters(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

function normalizeName(value: unknown) {
  return normalizeLetters(value)
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeNameTokenKey(value: unknown) {
  const tokens = normalizeName(value).split(" ").filter(Boolean).sort()
  return tokens.join(" ")
}

function normalizeNameTokens(value: unknown) {
  return normalizeName(value).split(" ").filter(Boolean)
}

function normalizePassport(value: unknown) {
  return normalizeLetters(value).replace(/[^A-Z0-9]/g, "")
}

function normalizePhone(value: unknown) {
  return normalizeText(value).replace(/\D/g, "")
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function normalizeCountry(value: unknown) {
  const key = normalizeLetters(value)
  if (!key) return ""
  if (key.includes("FRANCE")) return "FRANCE"
  if (key.includes("UNITED KINGDOM")) return "UNITED KINGDOM"
  if (key.includes("UK")) return "UNITED KINGDOM"
  if (key.includes("GREAT BRITAIN")) return "UNITED KINGDOM"
  if (key.includes("SPAIN")) return "SPAIN"
  if (key.includes("ITALY")) return "ITALY"
  if (key.includes("GERMANY")) return "GERMANY"
  return key
}

function normalizeCity(value: unknown) {
  return normalizeLetters(value).replace(/[^A-Z\s-]/g, " ").replace(/\s+/g, " ").trim()
}

function sameCity(a?: string, b?: string) {
  if (!a || !b) return false
  const x = normalizeCity(a)
  const y = normalizeCity(b)
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)))
}

function normalizeHotelName(value: unknown) {
  return normalizeLetters(value)
    .replace(/\bHOTEL\b/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeAddress(value: unknown) {
  return normalizeLetters(value)
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeAddressForTokens(value: unknown) {
  return normalizeAddress(value)
    .replace(/\b\d{1,2}(?:ST|ND|RD|TH)\s+ARR\b/g, " ")
    .replace(/\bARRONDISSEMENT\b/g, " ")
    .replace(/\bARR\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function addressTokens(value: unknown) {
  return unique(
    normalizeAddressForTokens(value)
      .split(" ")
      .filter((token) => token && token.length > 1),
  )
}

function sameName(a?: string, b?: string) {
  if (!a || !b) return false
  return normalizeNameTokenKey(a) === normalizeNameTokenKey(b)
}

function nameContainsTokens(candidate?: string, expected?: string) {
  if (!candidate || !expected) return false
  const candidateTokens = new Set(normalizeNameTokens(candidate))
  const expectedTokens = normalizeNameTokens(expected)
  return expectedTokens.length > 0 && expectedTokens.every((token) => candidateTokens.has(token))
}

function sameValue(a?: string, b?: string, normalizer: (value: unknown) => string = normalizeText) {
  if (!a || !b) return false
  return normalizer(a) === normalizer(b)
}

function addressContains(a?: string, b?: string) {
  if (!a || !b) return false
  const leftTokens = addressTokens(a)
  const rightTokens = addressTokens(b)
  if (leftTokens.length === 0 || rightTokens.length === 0) return false

  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  const leftContainsRight = rightTokens.every((token) => leftSet.has(token))
  const rightContainsLeft = leftTokens.every((token) => rightSet.has(token))

  return leftContainsRight || rightContainsLeft
}

function hotelNamesSimilar(a?: string, b?: string) {
  if (!a || !b) return false
  const x = normalizeHotelName(a)
  const y = normalizeHotelName(b)
  return x === y || x.includes(y) || y.includes(x)
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`
}

function parseExcelSerial(serial: number) {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 90000) return undefined
  const utcDays = Math.floor(serial - 25569)
  const utcValue = utcDays * 86400
  const date = new Date(utcValue * 1000)
  if (Number.isNaN(date.getTime())) return undefined
  return toIsoDate(date)
}

function parseDateValue(value: unknown): string | undefined {
  if (value == null) return undefined
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toIsoDate(value)
  if (typeof value === "number") return parseExcelSerial(value)

  const raw = normalizeText(value)
  if (!raw) return undefined

  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw)
    const parsedSerial = parseExcelSerial(serial)
    if (parsedSerial) return parsedSerial
  }

  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    if (!Number.isNaN(date.getTime())) return toIsoDate(date)
  }

  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (match) {
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
    if (!Number.isNaN(date.getTime())) return toIsoDate(date)
  }

  match = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (match) {
    const month = MONTHS[match[1].slice(0, 3).toUpperCase()]
    if (month) {
      const date = new Date(Number(match[3]), month - 1, Number(match[2]))
      if (!Number.isNaN(date.getTime())) return toIsoDate(date)
    }
  }

  match = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toUpperCase()]
    if (month) {
      const date = new Date(Number(match[3]), month - 1, Number(match[1]))
      if (!Number.isNaN(date.getTime())) return toIsoDate(date)
    }
  }

  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) return toIsoDate(date)
  return undefined
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function parseAllDates(text: string) {
  const values: string[] = []
  const patterns = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g,
    /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi,
  ]
  for (const pattern of patterns) {
    const matches = text.match(pattern) || []
    for (const match of matches) {
      const parsed = parseDateValue(match)
      if (parsed) values.push(parsed)
    }
  }
  return unique(values).sort()
}

function parseDayMonthDates(text: string, fallbackYear?: number) {
  const values: string[] = []
  const regex =
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi
  for (const match of text.matchAll(regex)) {
    const month = MONTHS[match[2].slice(0, 3).toUpperCase()]
    if (!month) continue
    const year = fallbackYear || new Date().getFullYear()
    const date = new Date(year, month - 1, Number(match[1]))
    if (!Number.isNaN(date.getTime())) values.push(toIsoDate(date))
  }
  return unique(values)
}

function splitDocumentLines(text: string, preserveInnerSpacing = false) {
  return text
    .split(/\r?\n/)
    .map((line) => (preserveInnerSpacing ? line.replace(/\t/g, " ").trim() : normalizeText(line)))
    .filter(Boolean)
}

function extractEmailAddress(text: string) {
  return extractRegexValue(text, /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i)
}

function extractPhoneNumber(text: string) {
  return extractRegexValue(text, /(\+?\d[\d\s()-]{7,}\d)/)
}

function inferDateFromDayMonth(dayValue: string | undefined, monthLine: string | undefined, fallbackYear?: number) {
  const day = dayValue ? Number(dayValue) : Number.NaN
  if (!Number.isFinite(day) || day < 1 || day > 31 || !monthLine) return undefined
  const monthMatch = monthLine.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*/i)
  if (!monthMatch) return undefined
  const month = MONTHS[monthMatch[1].slice(0, 3).toUpperCase()]
  if (!month) return undefined
  const year = fallbackYear || new Date().getFullYear()
  return toIsoDate(new Date(year, month - 1, day))
}

function getFallbackYearFromText(text: string) {
  const firstDate = parseAllDates(text)[0]
  if (!firstDate) return undefined
  const year = new Date(firstDate).getFullYear()
  return Number.isFinite(year) ? year : undefined
}

function extractSectionLines(lines: string[], startPattern: RegExp, endPattern?: RegExp) {
  const startIndex = lines.findIndex((line) => startPattern.test(line))
  if (startIndex < 0) return []
  if (!endPattern) return lines.slice(startIndex)
  const relativeEndIndex = lines.slice(startIndex + 1).findIndex((line) => endPattern.test(line))
  if (relativeEndIndex < 0) return lines.slice(startIndex)
  return lines.slice(startIndex, startIndex + 1 + relativeEndIndex)
}

function extractFieldFromLines(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map((label) => normalizeKey(label))
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const normalized = normalizeKey(line)
    const matchedLabel = normalizedLabels.find((label) => normalized.includes(label))
    if (!matchedLabel) continue

    const colonIndex = line.indexOf(":")
    if (colonIndex >= 0 && colonIndex < line.length - 1) {
      const candidate = normalizeText(line.slice(colonIndex + 1))
      if (candidate) return candidate
    }

    const nextLine = normalizeText(lines[index + 1] || "")
    if (nextLine && !normalizedLabels.some((label) => normalizeKey(nextLine).includes(label))) {
      return nextLine
    }
  }
  return ""
}

function extractFieldFromSections(sections: string[][], labels: string[]) {
  for (const section of sections) {
    if (!section.length) continue
    const value = extractFieldFromLines(section, labels)
    if (value) return value
  }
  return ""
}

function cleanNameValue(value: string) {
  return normalizeText(value)
    .replace(/\b(for official use only|date of application|application number)\b.*$/i, "")
    .trim()
}

function splitGuestNames(value: string) {
  return value
    .split(/\s*,\s*|\s+and\s+|\s*&\s*|\s*\/\s*/i)
    .map((part) => normalizeText(part))
    .filter(Boolean)
}

function extractRegexValue(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  return match?.[1] ? normalizeText(match[1]) : ""
}

function findExcelValue(rowsBySheet: unknown[][][], labels: string[]) {
  const normalizedLabels = labels.map((label) => normalizeKey(label))
  for (const rows of rowsBySheet) {
    for (const row of rows) {
      const normalizedRow = row.map((cell) => normalizeText(cell))
      for (let index = 0; index < normalizedRow.length; index += 1) {
        const cellKey = normalizeKey(normalizedRow[index])
        if (!cellKey) continue
        const matched = normalizedLabels.some((label) => cellKey.includes(label))
        if (!matched) continue
        const candidate = normalizedRow[index + 1] || normalizedRow[index + 2] || ""
        if (candidate) return candidate
      }
    }
  }
  return ""
}

function detectExcelSourceKind(rowsBySheet: unknown[][][]): ParsedExcel["sourceKind"] {
  const headerKeys = unique(
    rowsBySheet.flatMap((rows) =>
      rows
        .slice(0, 2)
        .flatMap((row) => row.map((cell) => normalizeKey(cell)).filter(Boolean)),
    ),
  )

  const hasTlsCore = ["邮箱", "密码", "申请参考号", "申请城市"].every((label) =>
    headerKeys.some((key) => key.includes(normalizeKey(label))),
  )
  const hasIdentity = ["姓氏", "名字", "出生日期", "护照编号", "护照号码"].some((label) =>
    headerKeys.some((key) => key.includes(normalizeKey(label))),
  )
  const hasAddressOrTravel = [
    "入境申根国的日期",
    "离开申根国的日期",
    "英国地址",
    "street,currentaddressintheuk",
    "city,currentaddressintheuk",
    "postcode,currentaddressintheuk",
    "酒店名称",
    "酒店地址",
  ].some((label) => headerKeys.some((key) => key.includes(normalizeKey(label))))

  if (hasIdentity || hasAddressOrTravel) return "standard"
  if (hasTlsCore) return "tlsRegistration"
  return "unknown"
}

function joinAddressParts(parts: Array<string | undefined>) {
  const deduped: string[] = []
  for (const part of parts.map((value) => normalizeText(value)).filter(Boolean) as string[]) {
    if (!deduped.some((existing) => normalizeAddress(existing) === normalizeAddress(part))) {
      deduped.push(part)
    }
  }
  return deduped.join(", ")
}

function parseBookingColumnDates(compact: string, fallbackYear?: number, nights?: number) {
  const summaryStart = compact.search(/CHECK-IN/i)
  const summaryEndCandidates = [compact.search(/\bAddress:/i), compact.search(/\bPRICE\b/i)].filter(
    (index) => index >= 0,
  )
  if (summaryStart < 0 || summaryEndCandidates.length === 0) {
    return { checkInDate: undefined, checkOutDate: undefined }
  }

  const summary = compact.slice(summaryStart, Math.min(...summaryEndCandidates))
  const dayMatches = Array.from(summary.matchAll(/\b(\d{1,2})\b/g)).map((match) => Number(match[1]))
  const monthMatches = Array.from(
    summary.matchAll(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi,
    ),
  ).map((match) => MONTHS[match[1].slice(0, 3).toUpperCase()])

  if (dayMatches.length < 2 || monthMatches.length < 2) {
    return { checkInDate: undefined, checkOutDate: undefined }
  }

  const year = fallbackYear || new Date().getFullYear()
  const candidatePairs = [
    { startDay: dayMatches[0], startMonth: monthMatches[0], endDay: dayMatches[1], endMonth: monthMatches[1] },
    { startDay: dayMatches[0], startMonth: monthMatches[1], endDay: dayMatches[1], endMonth: monthMatches[0] },
    { startDay: dayMatches[1], startMonth: monthMatches[0], endDay: dayMatches[0], endMonth: monthMatches[1] },
    { startDay: dayMatches[1], startMonth: monthMatches[1], endDay: dayMatches[0], endMonth: monthMatches[0] },
  ]

  for (const candidate of candidatePairs) {
    if (!candidate.startMonth || !candidate.endMonth) continue
    const start = new Date(year, candidate.startMonth - 1, candidate.startDay)
    const end = new Date(year, candidate.endMonth - 1, candidate.endDay)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
    const diff = differenceInCalendarDays(end, start)
    if (diff < 0 || diff > 45) continue
    if (nights != null && diff !== nights) continue
    return {
      checkInDate: toIsoDate(start),
      checkOutDate: toIsoDate(end),
    }
  }

  return { checkInDate: undefined, checkOutDate: undefined }
}

function cityFromAddress(address?: string) {
  if (!address) return undefined
  const match = address.match(/\b\d{5}\s+([A-Za-z][A-Za-z .'-]+?)(?:,|\s+FRANCE|\s*$)/i)
  return match ? normalizeText(match[1]) : undefined
}

function buildMaterialSnapshots(materials: Partial<Record<ComprehensiveMaterialKey, ComprehensiveMaterialSource>>) {
  const result = {} as Record<ComprehensiveMaterialKey, ReviewMaterialSnapshot>
  for (const key of Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[]) {
    const config = COMPREHENSIVE_MATERIAL_CONFIG[key]
    const material = materials[key]
    result[key] = {
      label: config.label,
      required: config.required,
      present: Boolean(material),
      sourceType: material?.sourceType,
      fileName: material?.fileName,
    }
  }
  return result
}

function buildMaterialOutcomes(
  materials: Partial<Record<ComprehensiveMaterialKey, ComprehensiveMaterialSource>>,
  blockingIssues: ReviewIssue[],
  advisoryIssues: ReviewIssue[],
): ReviewMaterialOutcome[] {
  const blockingByMaterial = new Map<string, string[]>()
  const advisoryByMaterial = new Map<string, string[]>()

  for (const issue of blockingIssues) {
    for (const material of issue.materials) {
      const titles = blockingByMaterial.get(material) || []
      titles.push(issue.title)
      blockingByMaterial.set(material, unique(titles))
    }
  }

  for (const issue of advisoryIssues) {
    for (const material of issue.materials) {
      const titles = advisoryByMaterial.get(material) || []
      titles.push(issue.title)
      advisoryByMaterial.set(material, unique(titles))
    }
  }

  return (Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[]).map((key) => {
    const config = COMPREHENSIVE_MATERIAL_CONFIG[key]
    const present = Boolean(materials[key])
    const blockingTitles = blockingByMaterial.get(config.label) || []
    const advisoryTitles = advisoryByMaterial.get(config.label) || []

    return {
      key,
      label: config.label,
      status: present ? (blockingTitles.length > 0 ? "fail" : "pass") : "missing",
      required: config.required,
      present,
      blockingTitles,
      advisoryTitles,
    }
  })
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

async function extractDocumentText(source: ComprehensiveMaterialSource) {
  const ext = path.extname(source.fileName || source.absolutePath).toLowerCase()
  if (ext === ".pdf") {
    return extractPdfText(source.absolutePath)
  }
  if (ext === ".docx") {
    const mammoth = (await import("mammoth")) as unknown as {
      extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>
    }
    const buffer = await fs.readFile(source.absolutePath)
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ""
  }
  if (ext === ".txt" || ext === ".json") {
    return fs.readFile(source.absolutePath, "utf8")
  }
  return ""
}

function parseExcelSource(buffer: Buffer): ParsedExcel {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false })
  const rowsBySheet = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    return utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][]
  })

  const aliases: Partial<Record<keyof ParsedExcel, string[]>> = {
    fullName: ["英文姓名", "姓名拼音", "applicantname", "name"],
    familyName: ["姓氏", "familyname", "surname"],
    givenName: ["名字", "firstname", "givenname"],
    birthDate: ["出生日期", "dateofbirth", "birthdate"],
    passportNumber: ["护照号码", "护照号", "passportnumber", "numberoftraveldocument"],
    schengenCountry: ["申根国家", "所要办理的申根国家", "schengencountrytoapplyfor", "申请国家"],
    submissionCity: ["递签城市", "visasubmissioncity", "tlscity"],
    email: ["邮箱账号", "邮箱地址", "emailaccount", "emailaddress", "email"],
    phone: ["你的电话", "电话号码", "phonenumber", "phone"],
    ukAddress: ["英国地址", "streetcurrentaddressintheuk", "居住地址", "homeaddress"],
    organization: ["大学名称", "学校名称", "工作单位", "companyname", "universityname"],
    entryDate: ["入境申根日期", "入境申根国的日期", "arrivaldate", "dateofarrivalinschengen"],
    exitDate: ["离境申根日期", "离开申根国的日期", "departuredate", "dateofdeparturefromschengen"],
    hotelName: ["酒店名称", "hotelname"],
    hotelAddress: ["酒店地址", "hoteladdress"],
    hotelCity: ["酒店城市", "hotelcity"],
  }

  const values: Partial<Record<keyof ParsedExcel, string>> = {}
  for (const rows of rowsBySheet) {
    for (const row of rows) {
      const normalizedRow = row.map((cell) => normalizeText(cell))
      for (let index = 0; index < normalizedRow.length; index += 1) {
        const cellKey = normalizeKey(normalizedRow[index])
        if (!cellKey) continue
        for (const [field, fieldAliases] of Object.entries(aliases) as Array<[keyof ParsedExcel, string[]]>) {
          if (values[field]) continue
          const matched = fieldAliases.some((alias) => cellKey.includes(normalizeKey(alias)))
          if (!matched) continue
          const candidate = normalizedRow[index + 1] || normalizedRow[index + 2] || ""
          if (candidate) values[field] = candidate
        }
      }
    }
  }

  if (values.familyName || values.givenName) {
    values.fullName = [values.familyName, values.givenName].filter(Boolean).join(" ")
  }

  const ukStreet =
    findExcelValue(rowsBySheet, ["街道", "street,currentaddressintheuk", "street"]) || values.ukAddress || ""
  const ukCity = findExcelValue(rowsBySheet, ["城市", "city,currentaddressintheuk", "currentcityofresidence"]) || ""
  const ukPostcode =
    findExcelValue(rowsBySheet, ["邮政编码", "postcode,currentaddressintheuk", "postcode"]) || ""
  const hotelPostcode = findExcelValue(rowsBySheet, ["酒店邮编", "hotelpostcode"]) || ""
  const mergedUkAddress = joinAddressParts([ukStreet, ukCity, ukPostcode])
  const mergedHotelAddress = joinAddressParts([values.hotelAddress, hotelPostcode, values.hotelCity])

  return {
    fullName: values.fullName,
    familyName: values.familyName,
    givenName: values.givenName,
    birthDate: parseDateValue(values.birthDate),
    passportNumber: values.passportNumber,
    schengenCountry: values.schengenCountry,
    submissionCity: values.submissionCity,
    email: values.email,
    phone: values.phone,
    ukAddress: mergedUkAddress || values.ukAddress,
    organization: values.organization,
    entryDate: parseDateValue(values.entryDate),
    exitDate: parseDateValue(values.exitDate),
    hotelName: values.hotelName,
    hotelAddress: mergedHotelAddress || values.hotelAddress,
    hotelCity: values.hotelCity || cityFromAddress(mergedHotelAddress || values.hotelAddress),
  }
}

function parseExcelSourceV2(buffer: Buffer): ParsedExcel {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false })
  const rowsBySheet = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    return utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][]
  })

  const aliases: Partial<Record<keyof ParsedExcel, string[]>> = {
    fullName: ["鑻辨枃濮撳悕", "濮撳悕鎷奸煶", "applicantname", "name"],
    familyName: ["濮撴皬", "familyname", "surname", "濮撴皬", "surname/family name"],
    givenName: ["鍚嶅瓧", "firstname", "givenname", "first name"],
    birthDate: ["鍑虹敓鏃ユ湡", "dateofbirth", "birthdate"],
    passportNumber: ["鎶ょ収鍙风爜", "passportnumber", "numberoftraveldocument", "鎶ょ収缂栧彿"],
    schengenCountry: ["鐢虫牴鍥藉", "鎵€瑕佸姙鐞嗙殑鐢虫牴鍥藉", "schengencountrytoapplyfor", "鐢宠鍥藉"],
    submissionCity: ["閫掔鍩庡競", "visasubmissioncity", "tlscity", "鐢宠鍩庡競"],
    email: ["閭璐﹀彿", "閭鍦板潃", "emailaccount", "emailaddress", "email", "閭"],
    phone: ["浣犵殑鐢佃瘽", "鐢佃瘽鍙风爜", "phonenumber", "phone", "鎵嬫満鍙风爜"],
    ukAddress: ["鑻卞浗鍦板潃", "streetcurrentaddressintheuk", "灞呬綇鍦板潃", "homeaddress"],
    organization: ["澶у鍚嶇О", "瀛︽牎鍚嶇О", "宸ヤ綔鍗曚綅", "companyname", "universityname"],
    entryDate: ["鍏ュ鐢虫牴鏃ユ湡", "鍏ュ鐢虫牴鍥界殑鏃ユ湡", "arrivaldate", "dateofarrivalinschengen"],
    exitDate: ["绂诲鐢虫牴鏃ユ湡", "绂诲紑鐢虫牴鍥界殑鏃ユ湡", "departuredate", "dateofdeparturefromschengen"],
    hotelName: ["閰掑簵鍚嶇О", "hotelname"],
    hotelAddress: ["閰掑簵鍦板潃", "hoteladdress"],
    hotelCity: ["閰掑簵鍩庡競", "hotelcity"],
  }

  const sourceKind = detectExcelSourceKind(rowsBySheet)
  const values: Partial<Record<keyof ParsedExcel, string>> = {}

  for (const rows of rowsBySheet) {
    for (const row of rows) {
      const normalizedRow = row.map((cell) => normalizeText(cell))
      for (let index = 0; index < normalizedRow.length; index += 1) {
        const cellKey = normalizeKey(normalizedRow[index])
        if (!cellKey) continue
        for (const [field, fieldAliases] of Object.entries(aliases) as Array<[keyof ParsedExcel, string[]]>) {
          if (values[field]) continue
          const matched = fieldAliases.some((alias) => cellKey.includes(normalizeKey(alias)))
          if (!matched) continue
          const candidate = normalizedRow[index + 1] || normalizedRow[index + 2] || ""
          if (candidate) values[field] = candidate
        }
      }
    }
  }

  if (values.familyName || values.givenName) {
    values.fullName = [values.familyName, values.givenName].filter(Boolean).join(" ")
  }

  const ukStreet =
    findExcelValue(rowsBySheet, ["琛楅亾,currentaddressintheuk", "street,currentaddressintheuk", "鑻卞浗鍦板潃"]) ||
    values.ukAddress ||
    ""
  const ukCity =
    findExcelValue(rowsBySheet, ["鍩庡競,currentaddressintheuk", "city,currentaddressintheuk", "currentcityofresidence"]) || ""
  const ukPostcode =
    findExcelValue(rowsBySheet, ["閭斂缂栫爜,currentaddressintheuk", "postcode,currentaddressintheuk"]) || ""
  const hotelPostcode = findExcelValue(rowsBySheet, ["閰掑簵閭紪", "hotelpostcode"]) || ""
  const mergedUkAddress = joinAddressParts([ukStreet, ukCity, ukPostcode])
  const mergedHotelAddress = joinAddressParts([values.hotelAddress, hotelPostcode, values.hotelCity])

  return {
    sourceKind,
    fullName: values.fullName,
    familyName: values.familyName,
    givenName: values.givenName,
    birthDate: parseDateValue(values.birthDate),
    passportNumber: values.passportNumber,
    schengenCountry: values.schengenCountry,
    submissionCity: values.submissionCity,
    email: values.email,
    phone: values.phone,
    ukAddress: mergedUkAddress || values.ukAddress,
    organization: values.organization,
    entryDate: parseDateValue(values.entryDate),
    exitDate: parseDateValue(values.exitDate),
    hotelName: values.hotelName,
    hotelAddress: mergedHotelAddress || values.hotelAddress,
    hotelCity: values.hotelCity || cityFromAddress(mergedHotelAddress || values.hotelAddress),
  }
}

function parseFvReceiptText(text: string): ParsedFvReceipt {
  const lines = splitDocumentLines(text)
  const receiptLines = extractSectionLines(lines, /registration receipt/i)
  const applicantContactLines = extractSectionLines(
    lines,
    /applicant.?s home address and email address/i,
    /residence in a country other than|current occupation|\b20\./i,
  )
  const applicantContactText = applicantContactLines.join("\n")
  const applicantAddress = applicantContactLines
    .slice(1)
    .filter((line) => !extractEmailAddress(line) && !extractPhoneNumber(line))
    .join(", ")
  const familyName = cleanNameValue(
    extractFieldFromSections([receiptLines, lines], ["last name/s", "surname [family name]", "surname", "family name", "last name"]),
  )
  const givenName = cleanNameValue(
    extractFieldFromSections([receiptLines, lines], ["first name/s", "first name(s) [given name(s)]", "first name", "given name"]),
  )
  const birthDateRaw = extractFieldFromSections([receiptLines, lines], ["date of birth", "birth date"])
  const passportRaw =
    extractRegexValue(text, /number of travel document[^A-Z0-9]*([A-Z]{1,3}\d{5,10})/i) ||
    extractFieldFromLines(lines, ["travel document number", "passport number"]) ||
    extractRegexValue(text, /\b([A-Z]{1,3}\d{5,10})\b/)
  const entryDateRaw =
    extractRegexValue(text, /(\d{1,2}[/-]\d{1,2}[/-]\d{4})\s*:?\s*Intended date of arrival/i) ||
    extractRegexValue(text, /date of arrival[^0-9]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i) ||
    extractFieldFromLines(lines, ["date of arrival", "arrival date", "entry date"]) ||
    extractRegexValue(text, /arrival[^0-9]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)
  const exitDateRaw =
    extractRegexValue(text, /(\d{1,2}[/-]\d{1,2}[/-]\d{4})\s*:?\s*Intended date of departure/i) ||
    extractRegexValue(text, /date of departure[^0-9]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i) ||
    extractFieldFromLines(lines, ["date of departure", "departure date", "exit date"]) ||
    extractRegexValue(text, /departure[^0-9]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)
  const hotelName =
    extractRegexValue(text, /(HOTEL\s+[A-Z0-9][A-Z0-9\s.'&-]+)\s*(?:\r?\n)\s*2\/4/i) ||
    extractFieldFromLines(lines, ["name of hotel", "hotel", "accommodation"]) ||
    lines.find((line) => /hotel\s+[a-z]/i.test(line) && !/booking|confirmation/i.test(line)) ||
    ""

  return {
    applicationNumber:
      extractRegexValue(text, /reference of the application[^A-Z0-9]*(FRA[0-9A-Z]+)/i) ||
      extractRegexValue(text, /\*(FRA[0-9A-Z]+)\*/i) ||
      extractRegexValue(text, /\b(FRA[0-9A-Z]+)\b/i),
    familyName,
    givenName,
    fullName: [familyName, givenName].filter(Boolean).join(" "),
    birthDate: parseDateValue(birthDateRaw),
    passportNumber: passportRaw,
    nationality: extractFieldFromLines(lines, ["nationality", "current nationality"]),
    schengenCountry:
      extractFieldFromLines(lines, ["main destination", "member state of destination"]) ||
      (text.includes("France") ? "France" : ""),
    entryDate: parseDateValue(entryDateRaw),
    exitDate: parseDateValue(exitDateRaw),
    hotelName,
    email:
      extractEmailAddress(applicantContactText) ||
      extractFieldFromLines(applicantContactLines, ["email", "email address"]) ||
      extractFieldFromLines(lines, ["email", "email address"]) ||
      extractEmailAddress(text),
    phone:
      extractPhoneNumber(applicantContactText) ||
      extractFieldFromLines(applicantContactLines, ["telephone", "phone"]) ||
      extractFieldFromLines(lines, ["telephone", "phone"]) ||
      extractPhoneNumber(text),
    ukAddress:
      applicantAddress ||
      extractFieldFromLines(applicantContactLines, ["address", "street"]) ||
      extractFieldFromLines(lines, ["address", "street"]) ||
      extractRegexValue(text, /address[^A-Za-z0-9]*([^\n]+)/i),
    organization: extractFieldFromLines(lines, ["school", "employer", "company", "university"]),
  }
}

function parseTlsAppointmentText(text: string): ParsedTlsAppointment {
  const lines = splitDocumentLines(text)
  const applicationNumber = extractRegexValue(text, /\b(FRA[0-9A-Z]+)\b/i)
  const groupNumber = extractRegexValue(text, /group\s*number[^0-9]*(\d+)/i)
  const dateCandidates = parseAllDates(text)
  const fullName =
    extractRegexValue(text, /\b([A-Z][A-Z\s.'-]+)\s*-\s*FRA[0-9A-Z]+\b/) ||
    extractFieldFromLines(lines, ["applicant", "name"]) ||
    lines.find((line) => /^[A-Z][A-Z\s.'-]{5,}$/.test(normalizeLetters(line))) ||
    ""
  const appointmentDateTime =
    extractRegexValue(text, /(?:your\s+)?appointment(?:\s+time|\s+date)?[^A-Za-z0-9]*([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*[AP]M)/i) ||
    extractRegexValue(text, /([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*[AP]M)/i) ||
    dateCandidates[0]

  return {
    applicationNumber,
    fullName,
    appointmentDateTime,
    groupNumber,
  }
}

function buildExtractedSnapshotsV2(parsed: ParsedSources) {
  const snapshots: ComprehensiveReviewResult["extracted"] = []

  const pushSnapshot = (source: string, values: Array<[string, string | undefined]>) => {
    const filtered = values
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => ({ label, value: value as string }))
    if (filtered.length) {
      snapshots.push({ source, values: filtered })
    }
  }

  pushSnapshot("申根 Excel", [
    ["姓名", parsed.excel?.fullName],
    ["出生日期", parsed.excel?.birthDate],
    ["护照号", parsed.excel?.passportNumber],
    ["递签城市", parsed.excel?.submissionCity],
    ["入境日期", parsed.excel?.entryDate],
    ["离境日期", parsed.excel?.exitDate],
    ["酒店名称", parsed.excel?.hotelName],
    ["酒店城市", parsed.excel?.hotelCity],
  ])

  pushSnapshot("FV申请回执单", [
    ["申请号", parsed.fvReceipt?.applicationNumber],
    ["姓名", parsed.fvReceipt?.fullName],
    ["出生日期", parsed.fvReceipt?.birthDate],
    ["护照号", parsed.fvReceipt?.passportNumber],
    ["入境日期", parsed.fvReceipt?.entryDate],
    ["离境日期", parsed.fvReceipt?.exitDate],
    ["酒店名称", parsed.fvReceipt?.hotelName],
  ])

  pushSnapshot("TLS预约单", [
    ["申请号", parsed.tlsAppointment?.applicationNumber],
    ["姓名", parsed.tlsAppointment?.fullName],
    ["预约时间", parsed.tlsAppointment?.appointmentDateTime],
    ["Group Number", parsed.tlsAppointment?.groupNumber],
  ])

  pushSnapshot("行程单", [
    ["开始日期", parsed.itinerary?.startDate],
    ["结束日期", parsed.itinerary?.endDate],
    ["首程", [parsed.itinerary?.firstDepartureCity, parsed.itinerary?.firstArrivalCity].filter(Boolean).join(" -> ")],
    ["末程", [parsed.itinerary?.lastDepartureCity, parsed.itinerary?.lastArrivalCity].filter(Boolean).join(" -> ")],
    ["酒店名称", parsed.itinerary?.hotelName],
    ["酒店城市", parsed.itinerary?.hotelCity],
  ])

  pushSnapshot("酒店订单", [
    ["酒店名称", parsed.hotel?.hotelName],
    ["酒店城市", parsed.hotel?.hotelCity],
    ["入住日期", parsed.hotel?.checkInDate],
    ["退房日期", parsed.hotel?.checkOutDate],
    ["晚数", parsed.hotel?.nights != null ? String(parsed.hotel.nights) : undefined],
  ])

  pushSnapshot("机票", [
    ["去程日期", parsed.flight?.outboundDate],
    ["返程日期", parsed.flight?.returnDate],
    ["去程路线", [parsed.flight?.departureCity, parsed.flight?.arrivalCity].filter(Boolean).join(" -> ")],
    ["返程路线", [parsed.flight?.returnDepartureCity, parsed.flight?.returnArrivalCity].filter(Boolean).join(" -> ")],
  ])

  pushSnapshot("保险", [
    ["起保日期", parsed.insurance?.startDate],
    ["截止日期", parsed.insurance?.endDate],
  ])

  return snapshots
}

function buildExtractedSnapshotsV3(parsed: ParsedSources) {
  const snapshots = buildExtractedSnapshotsV2(parsed)
  return snapshots.map((snapshot) => {
    if (snapshot.source !== "閰掑簵璁㈠崟") return snapshot

    const values = [...snapshot.values]
    if (parsed.hotel?.guestNames.length) {
      values.splice(1, 0, { label: "瀹㈡埛濮撳悕", value: parsed.hotel.guestNames.join(", ") })
    }
    if (parsed.hotel?.hotelAddress) {
      values.splice(2, 0, { label: "閰掑簵鍦板潃", value: parsed.hotel.hotelAddress })
    }

    return {
      ...snapshot,
      values,
    }
  })
}

function buildExtractedSnapshotsV4(parsed: ParsedSources) {
  const snapshots = buildExtractedSnapshotsV2(parsed)
  return snapshots.map((snapshot) => {
    if (snapshot.source !== "酒店订单") return snapshot

    const values = [...snapshot.values]
    if (parsed.hotel?.guestNames.length) {
      values.splice(1, 0, { label: "客户姓名", value: parsed.hotel.guestNames.join(", ") })
    }
    if (parsed.hotel?.hotelAddress) {
      values.splice(2, 0, { label: "酒店地址", value: parsed.hotel.hotelAddress })
    }

    return {
      ...snapshot,
      values,
    }
  })
}

function parseItineraryText(text: string): ParsedItinerary {
  const lines = text.split(/\r?\n/).map((line) => normalizeText(line)).filter(Boolean)
  const dateList = parseAllDates(text)
  const routeLines = lines.filter((line) => /\s-\s/.test(line))
  const firstRoute = routeLines[0] || ""
  const lastRoute = routeLines[routeLines.length - 1] || firstRoute
  const hotelAddress =
    lines.find((line) => /\b\d{5}\s+[A-Za-z]/.test(line) && /france/i.test(line)) || ""
  const hotelName = lines.find((line) => /hotel|hôtel/i.test(line)) || ""
  const startDate = dateList[0]
  const endDate = dateList[dateList.length - 1]
  let continuous = true
  for (let index = 1; index < dateList.length; index += 1) {
    const previous = new Date(dateList[index - 1])
    const current = new Date(dateList[index])
    if (differenceInCalendarDays(current, previous) !== 1) {
      continuous = false
      break
    }
  }

  const firstParts = firstRoute.split("-").map((item) => normalizeText(item))
  const lastParts = lastRoute.split("-").map((item) => normalizeText(item))

  return {
    startDate,
    endDate,
    dateList,
    continuous,
    hotelName,
    hotelAddress,
    hotelCity: cityFromAddress(hotelAddress),
    firstDepartureCity: firstParts[0],
    firstArrivalCity: firstParts[1],
    lastDepartureCity: lastParts[0],
    lastArrivalCity: lastParts[1],
  }
}

function parseHotelText(text: string): ParsedHotel {
  const lines = text.split(/\r?\n/).map((line) => normalizeText(line)).filter(Boolean)
  const hotelName =
    lines.find((line) => /hotel|hôtel/i.test(line)) ||
    extractFieldFromLines(lines, ["property", "hotel"])
  const hotelAddress =
    lines.find((line) => /\b\d{5}\s+[A-Za-z]/.test(line) && /france/i.test(line)) ||
    extractFieldFromLines(lines, ["address"])
  const checkInRaw =
    extractFieldFromLines(lines, ["check-in", "check in", "入住"]) ||
    extractRegexValue(text, /check[- ]?in[^A-Za-z0-9]*(.+)/i)
  const checkOutRaw =
    extractFieldFromLines(lines, ["check-out", "check out", "退房"]) ||
    extractRegexValue(text, /check[- ]?out[^A-Za-z0-9]*(.+)/i)
  const guestName =
    extractFieldFromLines(lines, ["guest name", "guest"]) ||
    lines.find((line) => /^[A-Z][A-Z\s.'-]{5,}$/.test(normalizeLetters(line))) ||
    ""
  const nightsValue = extractRegexValue(text, /(\d+)\s+nights?/i)

  return {
    hotelName,
    hotelAddress,
    hotelCity: cityFromAddress(hotelAddress),
    checkInDate: parseDateValue(checkInRaw),
    checkOutDate: parseDateValue(checkOutRaw),
    nights: nightsValue ? Number(nightsValue) : undefined,
    guestNames: guestName ? [guestName] : [],
  }
}

function parseFlightText(text: string): ParsedFlight {
  const lines = text.split(/\r?\n/).map((line) => normalizeText(line)).filter(Boolean)
  const dates = parseAllDates(text)
  const routeLines = lines.filter((line) => /\s-\s/.test(line) || /→|->/.test(line))
  const firstRoute = routeLines[0] || ""
  const lastRoute = routeLines[routeLines.length - 1] || firstRoute
  const splitRoute = (route: string) =>
    route
      .replace(/→|->/g, "-")
      .split("-")
      .map((item) => normalizeText(item))
      .filter(Boolean)

  const firstParts = splitRoute(firstRoute)
  const lastParts = splitRoute(lastRoute)

  return {
    outboundDate: dates[0],
    returnDate: dates[dates.length - 1],
    departureCity: firstParts[0],
    arrivalCity: firstParts[1],
    returnDepartureCity: lastParts[0],
    returnArrivalCity: lastParts[1],
  }
}

function parseInsuranceText(text: string): ParsedInsurance {
  const dates = parseAllDates(text)
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  }
}

function parseStructuredItineraryText(text: string): ParsedItinerary {
  const lines = splitDocumentLines(text, true)
  const compact = normalizeText(text)
  const rowLines = lines.filter((line) => /^\d+\s+\d{2}\/\d{2}\/\d{4}\b/.test(line))
  const dateList = (
    rowLines.length
      ? unique(
          rowLines
            .map((line) => parseDateValue(line.match(/^\d+\s+(\d{2}\/\d{2}\/\d{4})/)?.[1]))
            .filter((value): value is string => Boolean(value)),
        )
      : parseAllDates(text)
  ).sort()
  const hotelName =
    extractRegexValue(compact, /Hotel:\s*(.+?)(?=\s+Address:|$)/i) ||
    lines.find((line) => /^Hotel:\s*/i.test(line))?.replace(/^Hotel:\s*/i, "").trim() ||
    ""
  const hotelAddress =
    extractRegexValue(compact, /Address:\s*(.+?)(?=\s+Phone:|$)/i) ||
    lines.find((line) => /\b\d{5}\s+[A-Za-z]/.test(line) && /france/i.test(line)) ||
    ""

  const routeMatches = Array.from(
    compact.matchAll(
      /\b\d+\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Za-z][A-Za-z .'-]*?)\s*(?:➔|->|→)\s*([A-Za-z][A-Za-z .'-]*?)(?=\s+(?:Arrival|Departure|Hotel:|\d+\s+\d{2}\/\d{2}\/\d{4}|$))/gi,
    ),
  ).map((match) => ({
    date: parseDateValue(match[1]),
    from: normalizeText(match[2]),
    to: normalizeText(match[3]),
  }))

  let continuous = true
  for (let index = 1; index < dateList.length; index += 1) {
    const previous = new Date(dateList[index - 1])
    const current = new Date(dateList[index])
    if (differenceInCalendarDays(current, previous) !== 1) {
      continuous = false
      break
    }
  }

  const firstRoute = routeMatches[0] || { from: "", to: "" }
  const lastRoute = routeMatches[routeMatches.length - 1] || firstRoute

  return {
    startDate: dateList[0],
    endDate: dateList[dateList.length - 1],
    dateList,
    continuous,
    hotelName,
    hotelAddress,
    hotelCity: cityFromAddress(hotelAddress),
    firstDepartureCity: firstRoute.from,
    firstArrivalCity: firstRoute.to,
    lastDepartureCity: lastRoute.from,
    lastArrivalCity: lastRoute.to,
  }
}

function parseStructuredHotelText(text: string): ParsedHotel {
  const lines = splitDocumentLines(text, true)
  const compact = normalizeText(text)
  const hotelName =
    extractRegexValue(compact, /\b(Hotel\s+[A-Za-z0-9][A-Za-z0-9 .,'&-]+?)\s+\d{1,2}\s+\d{1,2}\s+\d+\s*\/\s*\d+\s+YOUR GROUP/i) ||
    extractRegexValue(compact, /\b(Hotel\s+[A-Za-z0-9][A-Za-z0-9 .,'&-]+?)\s+Address:/i) ||
    lines.find((line) => /hotel/i.test(line) && !/booking confirmation|hotel policies/i.test(line)) ||
    extractFieldFromLines(lines, ["property", "hotel"])
  const hotelAddress =
    extractRegexValue(compact, /Address:\s*(.+?)(?=\s+Phone:|$)/i) ||
    lines.find((line) => /\b\d{5}\s+[A-Za-z]/.test(line) && /france/i.test(line)) ||
    extractFieldFromLines(lines, ["address"])
  const guestNames = unique(
    Array.from(compact.matchAll(/Guest name:\s*(.+?)(?=\s+Number of guests:|\s+Meal Plan:|\s+£|\s+€|\s+Room\b|$)/gi))
      .flatMap((match) => splitGuestNames(match[1]))
      .filter(Boolean),
  )
  const nightsValue = extractRegexValue(compact, /(\d+)\s+nights?/i)
  const nights = nightsValue ? Number(nightsValue) : undefined
  const checkInRaw =
    extractFieldFromLines(lines, ["check-in", "check in"]) ||
    extractRegexValue(compact, /check[- ]?in[^A-Za-z0-9]*(.+?)(?=\s+check[- ]?out\b|$)/i)
  const checkOutRaw =
    extractFieldFromLines(lines, ["check-out", "check out"]) ||
    extractRegexValue(compact, /check[- ]?out[^A-Za-z0-9]*(.+?)(?=\s+rooms\b|\s+nights\b|$)/i)
  const fallbackYear = getFallbackYearFromText(text)
  const bookingColumnDates = parseBookingColumnDates(compact, fallbackYear, nights)
  const dayMonthDates = parseDayMonthDates(compact, fallbackYear)
  const numericLines = lines.filter((line) => /^\d{1,2}$/.test(line))
  const monthLines = lines.filter((line) =>
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*/i.test(line),
  )

  return {
    hotelName,
    hotelAddress,
    hotelCity: cityFromAddress(hotelAddress),
    checkInDate:
      parseDateValue(checkInRaw) ||
      bookingColumnDates.checkInDate ||
      dayMonthDates[0] ||
      inferDateFromDayMonth(numericLines[0], monthLines[0], fallbackYear),
    checkOutDate:
      parseDateValue(checkOutRaw) ||
      bookingColumnDates.checkOutDate ||
      dayMonthDates[1] ||
      inferDateFromDayMonth(numericLines[1], monthLines[1], fallbackYear),
    nights,
    guestNames,
  }
}

function buildExtractedSnapshots(parsed: ParsedSources) {
  const snapshots: ComprehensiveReviewResult["extracted"] = []

  const pushSnapshot = (source: string, values: Array<[string, string | undefined]>) => {
    const filtered = values
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => ({ label, value: value as string }))
    if (filtered.length) {
      snapshots.push({ source, values: filtered })
    }
  }

  pushSnapshot("申根 Excel", [
    ["姓名", parsed.excel?.fullName],
    ["出生日期", parsed.excel?.birthDate],
    ["护照号", parsed.excel?.passportNumber],
    ["申根国家", parsed.excel?.schengenCountry],
    ["递签城市", parsed.excel?.submissionCity],
    ["入境日期", parsed.excel?.entryDate],
    ["离境日期", parsed.excel?.exitDate],
    ["酒店名称", parsed.excel?.hotelName],
    ["酒店城市", parsed.excel?.hotelCity],
  ])

  pushSnapshot("FV 回执单", [
    ["申请号", parsed.fvReceipt?.applicationNumber],
    ["姓名", parsed.fvReceipt?.fullName],
    ["出生日期", parsed.fvReceipt?.birthDate],
    ["护照号", parsed.fvReceipt?.passportNumber],
    ["申根国家", parsed.fvReceipt?.schengenCountry],
    ["入境日期", parsed.fvReceipt?.entryDate],
    ["离境日期", parsed.fvReceipt?.exitDate],
    ["酒店名称", parsed.fvReceipt?.hotelName],
  ])

  pushSnapshot("TLS 预约单", [
    ["申请号", parsed.tlsAppointment?.applicationNumber],
    ["姓名", parsed.tlsAppointment?.fullName],
    ["预约时间", parsed.tlsAppointment?.appointmentDateTime],
    ["Group Number", parsed.tlsAppointment?.groupNumber],
  ])

  pushSnapshot("行程单", [
    ["开始日期", parsed.itinerary?.startDate],
    ["结束日期", parsed.itinerary?.endDate],
    ["首程", [parsed.itinerary?.firstDepartureCity, parsed.itinerary?.firstArrivalCity].filter(Boolean).join(" -> ")],
    ["末程", [parsed.itinerary?.lastDepartureCity, parsed.itinerary?.lastArrivalCity].filter(Boolean).join(" -> ")],
    ["酒店名称", parsed.itinerary?.hotelName],
    ["酒店城市", parsed.itinerary?.hotelCity],
  ])

  pushSnapshot("酒店订单", [
    ["酒店名称", parsed.hotel?.hotelName],
    ["酒店城市", parsed.hotel?.hotelCity],
    ["入住日期", parsed.hotel?.checkInDate],
    ["退房日期", parsed.hotel?.checkOutDate],
    ["晚数", parsed.hotel?.nights != null ? String(parsed.hotel.nights) : undefined],
  ])

  pushSnapshot("机票", [
    ["去程日期", parsed.flight?.outboundDate],
    ["返程日期", parsed.flight?.returnDate],
    ["去程路线", [parsed.flight?.departureCity, parsed.flight?.arrivalCity].filter(Boolean).join(" -> ")],
    ["返程路线", [parsed.flight?.returnDepartureCity, parsed.flight?.returnArrivalCity].filter(Boolean).join(" -> ")],
  ])

  pushSnapshot("保险", [
    ["起保日期", parsed.insurance?.startDate],
    ["截止日期", parsed.insurance?.endDate],
  ])

  return snapshots
}

function pushIssue(target: ReviewIssue[], code: string, title: string, detail: string, materials: string[]) {
  target.push({ code, title, detail, materials })
}

function getCanonicalInterval(parsed: ParsedSources) {
  return (
    (parsed.excel?.entryDate && parsed.excel?.exitDate
      ? { start: parsed.excel.entryDate, end: parsed.excel.exitDate, source: "申根 Excel" }
      : undefined) ||
    (parsed.fvReceipt?.entryDate && parsed.fvReceipt?.exitDate
      ? { start: parsed.fvReceipt.entryDate, end: parsed.fvReceipt.exitDate, source: "FV申请回执单" }
      : undefined) ||
    (parsed.itinerary?.startDate && parsed.itinerary?.endDate
      ? { start: parsed.itinerary.startDate, end: parsed.itinerary.endDate, source: "行程单" }
      : undefined) ||
    (parsed.hotel?.checkInDate && parsed.hotel?.checkOutDate
      ? { start: parsed.hotel.checkInDate, end: parsed.hotel.checkOutDate, source: "酒店订单" }
      : undefined) ||
    undefined
  )
}

function joinMissing(labels: string[]) {
  return labels.join("、")
}

function evaluateReview(
  parsed: ParsedSources,
  materials: Partial<Record<ComprehensiveMaterialKey, ComprehensiveMaterialSource>>,
): ComprehensiveReviewResult {
  const materialSnapshots = buildMaterialSnapshots(materials)
  const missingCoreMaterials = (Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[])
    .filter((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].required && !materials[key])
    .map((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].label)
  const missingOptionalMaterials = (Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[])
    .filter((key) => !COMPREHENSIVE_MATERIAL_CONFIG[key].required && !materials[key])
    .map((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].label)

  const blockingIssues: ReviewIssue[] = []
  const advisoryIssues: ReviewIssue[] = []
  const standardExcel = parsed.excel?.sourceKind === "standard" ? parsed.excel : undefined

  if (missingCoreMaterials.length > 0) {
    pushIssue(
      blockingIssues,
      "missing-core-materials",
      "核心材料缺失",
      `当前缺少 ${joinMissing(missingCoreMaterials)}，暂时不能给出可递签结论。`,
      missingCoreMaterials,
    )
  }

  if (materials.schengenExcel && parsed.excel?.sourceKind === "tlsRegistration") {
    pushIssue(
      blockingIssues,
      "excel-source-type-invalid",
      "褰撳墠涓婁紶鐨勬枃浠朵笉鏄爣鍑嗕俊鎭簮",
      "褰撳墠 Excel 鏇村儚 TLS 娉ㄥ唽琛紝涓嶆槸鐢虫牴鍔炵悊鍩烘湰淇℃伅琛紝涓嶈兘浣滀负缁煎悎瀹℃牳鐨勬爣鍑嗕俊鎭簮銆?",
      ["鐢虫牴 Excel"],
    )
  }

  if (materials.schengenExcel && parsed.excel?.sourceKind === "tlsRegistration") {
    pushIssue(
      blockingIssues,
      "excel-source-type-invalid",
      "当前上传的 Excel 不是标准信息源",
      "当前上传的 Excel 更像 TLS 注册表，不是申根办理基本信息表，不能作为综合审核标准源。",
      ["鐢虫牴 Excel"],
    )
  } else if (materials.schengenExcel && !standardExcel?.entryDate && !standardExcel?.passportNumber && !standardExcel?.fullName) {
    pushIssue(
      blockingIssues,
      "excel-parse-failed",
      "申根 Excel 关键信息未识别",
      "当前申根 Excel 存在，但系统没有识别出日期或护照号，请检查表格结构后重试。",
      ["申根 Excel"],
    )
  }

  if (materials.fvReceipt && !parsed.fvReceipt?.applicationNumber && !parsed.fvReceipt?.fullName) {
    pushIssue(
      blockingIssues,
      "fv-parse-failed",
      "FV申请回执单关键信息未识别",
      "当前 FV申请回执单存在，但系统没有识别出申请号或申请人姓名，请检查 PDF 是否正确。",
      ["FV申请回执单"],
    )
  }

  if (materials.tlsAppointment && !parsed.tlsAppointment?.applicationNumber && !parsed.tlsAppointment?.fullName) {
    pushIssue(
      blockingIssues,
      "tls-parse-failed",
      "TLS预约单关键信息未识别",
      "当前 TLS预约单存在，但系统没有识别出申请号或申请人姓名，请检查 PDF 是否正确。",
      ["TLS预约单"],
    )
  }

  if (materials.itinerary && !parsed.itinerary?.startDate && !parsed.itinerary?.endDate) {
    pushIssue(
      blockingIssues,
      "itinerary-parse-failed",
      "行程单关键信息未识别",
      "当前行程单存在，但系统没有识别出有效日期区间，请检查 PDF 是否正确。",
      ["行程单"],
    )
  }

  if (materials.hotel && !parsed.hotel?.checkInDate && !parsed.hotel?.checkOutDate) {
    pushIssue(
      blockingIssues,
      "hotel-parse-failed",
      "酒店订单关键信息未识别",
      "当前酒店订单存在，但系统没有识别出入住和退房日期，请检查 PDF 是否正确。",
      ["酒店订单"],
    )
  }

  const canonicalInterval = getCanonicalInterval(parsed)
  const expectedStayDays =
    canonicalInterval
      ? differenceInCalendarDays(new Date(canonicalInterval.end), new Date(canonicalInterval.start)) + 1
      : undefined

  if (standardExcel?.birthDate && parsed.fvReceipt?.birthDate && standardExcel.birthDate !== parsed.fvReceipt.birthDate) {
    pushIssue(blockingIssues, "birth-date-mismatch", "出生日期不一致", "申根 Excel 与 FV 回执单的出生日期不一致。", [
      "申根 Excel",
      "FV 回执单",
    ])
  }

  if (
    standardExcel?.passportNumber &&
    parsed.fvReceipt?.passportNumber &&
    !sameValue(standardExcel.passportNumber, parsed.fvReceipt.passportNumber, normalizePassport)
  ) {
    pushIssue(blockingIssues, "passport-mismatch", "护照号不一致", "申根 Excel 与 FV 回执单的护照号不一致。", [
      "申根 Excel",
      "FV 回执单",
    ])
  }

  if (standardExcel?.fullName && parsed.fvReceipt?.fullName && !sameName(standardExcel.fullName, parsed.fvReceipt.fullName)) {
    pushIssue(blockingIssues, "name-mismatch", "申请人姓名不一致", "申根 Excel 与 FV 回执单中的姓名不一致。", [
      "申根 Excel",
      "FV 回执单",
    ])
  }

  if (
    parsed.tlsAppointment?.fullName &&
    parsed.fvReceipt?.fullName &&
    !sameName(parsed.tlsAppointment.fullName, parsed.fvReceipt.fullName)
  ) {
    pushIssue(blockingIssues, "tls-name-mismatch", "TLS 与 FV 姓名不一致", "TLS 预约单中的申请人姓名与 FV 回执单不一致。", [
      "TLS 预约单",
      "FV 回执单",
    ])
  }

  if (
    parsed.tlsAppointment?.applicationNumber &&
    parsed.fvReceipt?.applicationNumber &&
    !sameValue(parsed.tlsAppointment.applicationNumber, parsed.fvReceipt.applicationNumber, normalizeText)
  ) {
    pushIssue(blockingIssues, "application-number-mismatch", "申请号不一致", "TLS 预约单与 FV 回执单的申请号不一致。", [
      "TLS 预约单",
      "FV 回执单",
    ])
  }

  const excelCountry = normalizeCountry(parsed.excel?.schengenCountry)
  const fvCountry = normalizeCountry(parsed.fvReceipt?.schengenCountry)
  if (excelCountry && fvCountry && excelCountry !== fvCountry) {
    pushIssue(blockingIssues, "main-country-mismatch", "主申请国不一致", "申根 Excel 与 FV 回执单中的主申请国不一致。", [
      "申根 Excel",
      "FV 回执单",
    ])
  }
  const effectiveCountry = fvCountry || excelCountry
  if (effectiveCountry && effectiveCountry !== "FRANCE") {
    pushIssue(blockingIssues, "not-france-main-country", "主申请国不是法国", "当前是法国申根综合审核，但材料中的主申请国不是 France。", [
      "申根 Excel",
      "FV 回执单",
    ])
  }

  if (canonicalInterval) {
    const exactSources: Array<[string, string | undefined, string | undefined]> = [
      ["申根 Excel", parsed.excel?.entryDate, parsed.excel?.exitDate],
      ["FV 回执单", parsed.fvReceipt?.entryDate, parsed.fvReceipt?.exitDate],
      ["行程单", parsed.itinerary?.startDate, parsed.itinerary?.endDate],
      ["酒店订单", parsed.hotel?.checkInDate, parsed.hotel?.checkOutDate],
      ["机票", parsed.flight?.outboundDate, parsed.flight?.returnDate],
    ]

    if (exactSources.length > 0) {
      exactSources[0] = [exactSources[0][0], standardExcel?.entryDate, standardExcel?.exitDate]
    }

    if (exactSources.length > 0) {
      exactSources[0] = [exactSources[0][0], standardExcel?.entryDate, standardExcel?.exitDate]
    }

    for (const [label, start, end] of exactSources) {
      if (!start || !end) continue
      if (start !== canonicalInterval.start || end !== canonicalInterval.end) {
        pushIssue(
          blockingIssues,
          `date-range-mismatch-${label}`,
          `${label} 时间区间不一致`,
          `${label} 的时间区间与主区间不一致，应为 ${canonicalInterval.start} 至 ${canonicalInterval.end}。`,
          [label, canonicalInterval.source],
        )
      }
    }

    if (parsed.insurance?.startDate && parsed.insurance?.endDate) {
      if (parsed.insurance.startDate > canonicalInterval.start || parsed.insurance.endDate < canonicalInterval.end) {
        pushIssue(
          blockingIssues,
          "insurance-coverage-short",
          "保险覆盖时间不足",
          `保险日期没有完整覆盖主区间 ${canonicalInterval.start} 至 ${canonicalInterval.end}。`,
          ["保险", canonicalInterval.source],
        )
      }
    }

    if (parsed.hotel?.nights != null && expectedStayDays != null) {
      const expectedNights = Math.max(expectedStayDays - 1, 0)
      if (parsed.hotel.nights !== expectedNights) {
        pushIssue(
          blockingIssues,
          "hotel-nights-mismatch",
          "酒店晚数不匹配",
          `酒店订单显示 ${parsed.hotel.nights} 晚，但按主区间应为 ${expectedNights} 晚。`,
          ["酒店订单", canonicalInterval.source],
        )
      }
    }

    if (parsed.itinerary?.dateList.length && !parsed.itinerary.continuous) {
      pushIssue(
        blockingIssues,
        "itinerary-dates-not-continuous",
        "行程单日期不连续",
        "行程单中的每日日期没有形成连续时间链，建议先修正再递签。",
        ["行程单"],
      )
    }
  }

  const hotelCities = unique(
    [standardExcel?.hotelCity, parsed.itinerary?.hotelCity, parsed.hotel?.hotelCity]
      .map((value) => normalizeCity(value))
      .filter(Boolean),
  )
  if (hotelCities.length > 1) {
    pushIssue(blockingIssues, "hotel-city-mismatch", "酒店城市不一致", "Excel、行程单或酒店订单中的酒店城市不一致。", [
      "申根 Excel",
      "行程单",
      "酒店订单",
    ])
  }

  if (
    parsed.hotel?.hotelName &&
    parsed.fvReceipt?.hotelName &&
    !hotelNamesSimilar(parsed.hotel.hotelName, parsed.fvReceipt.hotelName)
  ) {
    pushIssue(
      advisoryIssues,
      "hotel-name-different",
      "酒店名称写法不一致",
      "FV 回执单与酒店订单中的酒店名称写法不同，请人工确认是否为同一家酒店。",
      ["FV 回执单", "酒店订单"],
    )
  }

  if (
    parsed.hotel?.hotelAddress &&
    parsed.itinerary?.hotelAddress &&
    !addressContains(parsed.hotel.hotelAddress, parsed.itinerary.hotelAddress)
  ) {
    pushIssue(
      advisoryIssues,
      "hotel-address-different",
      "酒店地址写法不一致",
      "酒店订单与行程单中的酒店地址写法不同，请人工确认。",
      ["酒店订单", "行程单"],
    )
  }

  if (
    parsed.hotel?.guestNames.length &&
    parsed.fvReceipt?.fullName &&
    !parsed.hotel.guestNames.some((guest) => sameName(guest, parsed.fvReceipt?.fullName))
  ) {
    pushIssue(
      blockingIssues,
      "hotel-guest-mismatch",
      "酒店入住人无法对应申请人",
      "酒店订单中的入住人姓名无法对应 FV 回执单里的申请人姓名。",
      ["酒店订单", "FV 回执单"],
    )
  }

  if (
    standardExcel?.phone &&
    parsed.fvReceipt?.phone &&
    !sameValue(standardExcel.phone, parsed.fvReceipt.phone, normalizePhone)
  ) {
    pushIssue(
      advisoryIssues,
      "phone-mismatch",
      "联系电话不一致",
      "申根 Excel 与 FV 回执单中的联系电话不一致，建议人工确认。",
      ["申根 Excel", "FV 回执单"],
    )
  }

  if (
    standardExcel?.email &&
    parsed.fvReceipt?.email &&
    !sameValue(standardExcel.email, parsed.fvReceipt.email, normalizeEmail)
  ) {
    pushIssue(
      advisoryIssues,
      "email-mismatch",
      "邮箱不一致",
      "申根 Excel 与 FV 回执单中的邮箱不一致，建议人工确认。",
      ["申根 Excel", "FV 回执单"],
    )
  }

  if (
    standardExcel?.ukAddress &&
    parsed.fvReceipt?.ukAddress &&
    !addressContains(standardExcel.ukAddress, parsed.fvReceipt.ukAddress)
  ) {
    pushIssue(
      advisoryIssues,
      "uk-address-mismatch",
      "英国地址写法不一致",
      "申根 Excel 与 FV 回执单中的英国地址写法不同，请人工确认。",
      ["申根 Excel", "FV 回执单"],
    )
  }

  const decision: ComprehensiveReviewDecision = blockingIssues.length > 0 ? "fail" : "pass"
  const decisionLabel = decision === "pass" ? "可以递签" : "不可递签"
  const summary =
    decision === "pass"
      ? missingOptionalMaterials.length > 0
        ? `可以递签（目前材料可递签，但缺少${joinMissing(missingOptionalMaterials)}）`
        : "可以递签"
      : "不可递签"

  return {
    decision,
    decisionLabel,
    summary,
    missingCoreMaterials,
    missingOptionalMaterials,
    blockingIssues,
    advisoryIssues,
    sections: [
      { title: "必须修改", items: blockingIssues },
      { title: "建议检查", items: advisoryIssues },
    ],
    materials: materialSnapshots,
    materialOutcomes: buildMaterialOutcomes(materials, blockingIssues, advisoryIssues),
    extracted: buildExtractedSnapshotsV4(parsed),
  }
}

function evaluateReviewV2(
  parsed: ParsedSources,
  materials: Partial<Record<ComprehensiveMaterialKey, ComprehensiveMaterialSource>>,
): ComprehensiveReviewResult {
  const standardExcel = parsed.excel
  const materialSnapshots = buildMaterialSnapshots(materials)
  const missingCoreMaterials = (Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[])
    .filter((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].required && !materials[key])
    .map((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].label)
  const missingOptionalMaterials = (Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[])
    .filter((key) => !COMPREHENSIVE_MATERIAL_CONFIG[key].required && !materials[key])
    .map((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].label)

  const blockingIssues: ReviewIssue[] = []
  const advisoryIssues: ReviewIssue[] = []

  if (missingCoreMaterials.length > 0) {
    pushIssue(
      blockingIssues,
      "missing-core-materials",
      "核心材料缺失",
      `当前缺少 ${joinMissing(missingCoreMaterials)}，暂时不能给出可以递签结论。`,
      missingCoreMaterials,
    )
  }

  if (
    materials.schengenExcel &&
    parsed.excel?.sourceKind !== "tlsRegistration" &&
    !standardExcel?.entryDate &&
    !standardExcel?.passportNumber &&
    !standardExcel?.fullName
  ) {
    pushIssue(
      blockingIssues,
      "excel-parse-failed",
      "申根 Excel 关键信息未识别",
      "当前申根 Excel 存在，但系统没有识别出日期或护照号，请检查表格结构后重试。",
      ["申根 Excel"],
    )
  }

  if (materials.fvReceipt && !parsed.fvReceipt?.applicationNumber && !parsed.fvReceipt?.fullName) {
    pushIssue(
      blockingIssues,
      "fv-parse-failed",
      "FV申请回执单关键信息未识别",
      "当前 FV申请回执单存在，但系统没有识别出申请号或申请人姓名，请检查 PDF 是否正确。",
      ["FV申请回执单"],
    )
  }

  if (materials.tlsAppointment && !parsed.tlsAppointment?.applicationNumber && !parsed.tlsAppointment?.fullName) {
    pushIssue(
      blockingIssues,
      "tls-parse-failed",
      "TLS预约单关键信息未识别",
      "当前 TLS预约单存在，但系统没有识别出申请号或申请人姓名，请检查 PDF 是否正确。",
      ["TLS预约单"],
    )
  }

  if (materials.itinerary && !parsed.itinerary?.startDate && !parsed.itinerary?.endDate) {
    pushIssue(
      blockingIssues,
      "itinerary-parse-failed",
      "行程单关键信息未识别",
      "当前行程单存在，但系统没有识别出有效日期区间，请检查 PDF 是否正确。",
      ["行程单"],
    )
  }

  if (materials.hotel && !parsed.hotel?.checkInDate && !parsed.hotel?.checkOutDate) {
    pushIssue(
      blockingIssues,
      "hotel-parse-failed",
      "酒店订单关键信息未识别",
      "当前酒店订单存在，但系统没有识别出入住和退房日期，请检查 PDF 是否正确。",
      ["酒店订单"],
    )
  }

  const canonicalInterval = getCanonicalInterval(parsed)
  const expectedStayDays =
    canonicalInterval
      ? differenceInCalendarDays(new Date(canonicalInterval.end), new Date(canonicalInterval.start)) + 1
      : undefined

  if (standardExcel?.birthDate && parsed.fvReceipt?.birthDate && standardExcel.birthDate !== parsed.fvReceipt.birthDate) {
    pushIssue(
      blockingIssues,
      "birth-date-mismatch",
      "出生日期不一致",
      "申根 Excel 与 FV申请回执单中的出生日期不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.passportNumber &&
    parsed.fvReceipt?.passportNumber &&
    !sameValue(standardExcel.passportNumber, parsed.fvReceipt.passportNumber, normalizePassport)
  ) {
    pushIssue(
      blockingIssues,
      "passport-mismatch",
      "护照号不一致",
      "申根 Excel 与 FV申请回执单中的护照号不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (standardExcel?.fullName && parsed.fvReceipt?.fullName && !sameName(standardExcel.fullName, parsed.fvReceipt.fullName)) {
    pushIssue(
      blockingIssues,
      "name-mismatch",
      "申请人姓名不一致",
      "申根 Excel 与 FV申请回执单中的姓名不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    parsed.tlsAppointment?.fullName &&
    parsed.fvReceipt?.fullName &&
    !sameName(parsed.tlsAppointment.fullName, parsed.fvReceipt.fullName)
  ) {
    pushIssue(
      blockingIssues,
      "tls-name-mismatch",
      "TLS 与 FV 姓名不一致",
      "TLS预约单中的申请人姓名与 FV申请回执单不一致。",
      ["TLS预约单", "FV申请回执单"],
    )
  }

  if (
    parsed.tlsAppointment?.applicationNumber &&
    parsed.fvReceipt?.applicationNumber &&
    !sameValue(parsed.tlsAppointment.applicationNumber, parsed.fvReceipt.applicationNumber, normalizeText)
  ) {
    pushIssue(
      blockingIssues,
      "application-number-mismatch",
      "申请号不一致",
      "TLS预约单与 FV申请回执单的申请号不一致。",
      ["TLS预约单", "FV申请回执单"],
    )
  }

  if (canonicalInterval) {
    const exactSources: Array<[string, string | undefined, string | undefined]> = [
      ["申根 Excel", parsed.excel?.entryDate, parsed.excel?.exitDate],
      ["FV申请回执单", parsed.fvReceipt?.entryDate, parsed.fvReceipt?.exitDate],
      ["行程单", parsed.itinerary?.startDate, parsed.itinerary?.endDate],
      ["酒店订单", parsed.hotel?.checkInDate, parsed.hotel?.checkOutDate],
      ["机票", parsed.flight?.outboundDate, parsed.flight?.returnDate],
    ]

    for (const [label, start, end] of exactSources) {
      if (!start || !end) continue
      if (start !== canonicalInterval.start || end !== canonicalInterval.end) {
        pushIssue(
          blockingIssues,
          `date-range-mismatch-${label}`,
          `${label} 时间区间不一致`,
          `${label} 的时间区间与主区间不一致，应为 ${canonicalInterval.start} 至 ${canonicalInterval.end}。`,
          [label, canonicalInterval.source],
        )
      }
    }

    if (parsed.insurance?.startDate && parsed.insurance?.endDate) {
      if (parsed.insurance.startDate > canonicalInterval.start || parsed.insurance.endDate < canonicalInterval.end) {
        pushIssue(
          blockingIssues,
          "insurance-coverage-short",
          "保险覆盖时间不足",
          `保险日期没有完整覆盖主区间 ${canonicalInterval.start} 至 ${canonicalInterval.end}。`,
          ["保险", canonicalInterval.source],
        )
      }
    }

    if (parsed.hotel?.nights != null && expectedStayDays != null) {
      const expectedNights = Math.max(expectedStayDays - 1, 0)
      if (parsed.hotel.nights !== expectedNights) {
        pushIssue(
          blockingIssues,
          "hotel-nights-mismatch",
          "酒店晚数不匹配",
          `酒店订单显示 ${parsed.hotel.nights} 晚，但按主区间应为 ${expectedNights} 晚。`,
          ["酒店订单", canonicalInterval.source],
        )
      }
    }

    if (parsed.itinerary?.dateList.length && !parsed.itinerary.continuous) {
      pushIssue(
        blockingIssues,
        "itinerary-dates-not-continuous",
        "行程单日期不连续",
        "行程单中的每日日期没有形成连续时间链，建议先修正再递签。",
        ["行程单"],
      )
    }
  }

  const hotelCities = unique(
    [standardExcel?.hotelCity, parsed.itinerary?.hotelCity, parsed.hotel?.hotelCity]
      .map((value) => normalizeCity(value))
      .filter(Boolean),
  )
  if (hotelCities.length > 1) {
    pushIssue(
      blockingIssues,
      "hotel-city-mismatch",
      "酒店城市不一致",
      "Excel、行程单或酒店订单中的酒店城市不一致。",
      ["申根 Excel", "行程单", "酒店订单"],
    )
  }

  if (
    parsed.flight?.departureCity &&
    parsed.itinerary?.firstDepartureCity &&
    !sameCity(parsed.flight.departureCity, parsed.itinerary.firstDepartureCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-first-departure-city-mismatch",
      "机票去程出发城市与行程首日不一致",
      "机票去程出发城市与行程单首日出发城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    parsed.flight?.arrivalCity &&
    parsed.itinerary?.firstArrivalCity &&
    !sameCity(parsed.flight.arrivalCity, parsed.itinerary.firstArrivalCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-first-arrival-city-mismatch",
      "机票去程到达城市与行程首日不一致",
      "机票去程到达城市与行程单首日到达城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    parsed.flight?.returnDepartureCity &&
    parsed.itinerary?.lastDepartureCity &&
    !sameCity(parsed.flight.returnDepartureCity, parsed.itinerary.lastDepartureCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-return-departure-city-mismatch",
      "机票返程出发城市与行程末日不一致",
      "机票返程出发城市与行程单末日出发城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    parsed.flight?.returnArrivalCity &&
    parsed.itinerary?.lastArrivalCity &&
    !sameCity(parsed.flight.returnArrivalCity, parsed.itinerary.lastArrivalCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-return-arrival-city-mismatch",
      "机票返程到达城市与行程末日不一致",
      "机票返程到达城市与行程单末日到达城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    standardExcel?.hotelName &&
    parsed.fvReceipt?.hotelName &&
    !hotelNamesSimilar(standardExcel.hotelName, parsed.fvReceipt.hotelName)
  ) {
    pushIssue(
      blockingIssues,
      "excel-fv-hotel-name-different",
      "FV申请回执单酒店名称与 Excel 不一致",
      "FV申请回执单中的酒店名称与申根 Excel 不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.hotelName &&
    parsed.hotel?.hotelName &&
    !hotelNamesSimilar(standardExcel.hotelName, parsed.hotel.hotelName)
  ) {
    pushIssue(
      advisoryIssues,
      "excel-hotel-name-different",
      "Excel 与酒店订单中的酒店名称不一致",
      "申根 Excel 与酒店订单中的酒店名称写法不同，请人工确认是否为同一家酒店。",
      ["申根 Excel", "酒店订单"],
    )
  }

  if (
    standardExcel?.hotelAddress &&
    parsed.hotel?.hotelAddress &&
    !addressContains(standardExcel.hotelAddress, parsed.hotel.hotelAddress)
  ) {
    pushIssue(
      advisoryIssues,
      "excel-hotel-address-different",
      "Excel 与酒店订单中的酒店地址不一致",
      "申根 Excel 与酒店订单中的酒店地址写法不同，请人工确认。",
      ["申根 Excel", "酒店订单"],
    )
  }

  if (
    parsed.hotel?.hotelName &&
    parsed.fvReceipt?.hotelName &&
    !hotelNamesSimilar(parsed.hotel.hotelName, parsed.fvReceipt.hotelName)
  ) {
    pushIssue(
      advisoryIssues,
      "hotel-name-different",
      "酒店名称写法不一致",
      "FV申请回执单与酒店订单中的酒店名称写法不同，请人工确认是否为同一家酒店。",
      ["FV申请回执单", "酒店订单"],
    )
  }

  if (
    parsed.hotel?.hotelAddress &&
    parsed.itinerary?.hotelAddress &&
    !addressContains(parsed.hotel.hotelAddress, parsed.itinerary.hotelAddress)
  ) {
    pushIssue(
      advisoryIssues,
      "hotel-address-different",
      "酒店地址写法不一致",
      "酒店订单与行程单中的酒店地址写法不同，请人工确认。",
      ["酒店订单", "行程单"],
    )
  }

  if (
    parsed.hotel?.guestNames.length &&
    parsed.fvReceipt?.fullName &&
    !parsed.hotel.guestNames.some((guest) => nameContainsTokens(guest, parsed.fvReceipt?.fullName))
  ) {
    pushIssue(
      blockingIssues,
      "hotel-guest-mismatch",
      "酒店入住人无法对应申请人",
      "酒店订单中的入住人姓名无法对应 FV申请回执单里的申请人姓名。",
      ["酒店订单", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.phone &&
    parsed.fvReceipt?.phone &&
    !sameValue(standardExcel.phone, parsed.fvReceipt.phone, normalizePhone)
  ) {
    pushIssue(
      advisoryIssues,
      "phone-mismatch",
      "联系电话不一致",
      "申根 Excel 与 FV申请回执单中的联系电话不一致，建议人工确认。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    parsed.excel?.organization &&
    parsed.fvReceipt?.organization &&
    !sameValue(parsed.excel.organization, parsed.fvReceipt.organization, normalizeLetters)
  ) {
    pushIssue(
      advisoryIssues,
      "organization-mismatch",
      "学校或工作信息不一致",
      "申根 Excel 与 FV申请回执单中的学校或工作信息不一致，建议人工确认。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.email &&
    parsed.fvReceipt?.email &&
    !sameValue(standardExcel.email, parsed.fvReceipt.email, normalizeEmail)
  ) {
    pushIssue(
      advisoryIssues,
      "email-mismatch",
      "邮箱不一致",
      "申根 Excel 与 FV申请回执单中的邮箱不一致，建议人工确认。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.ukAddress &&
    parsed.fvReceipt?.ukAddress &&
    !addressContains(standardExcel.ukAddress, parsed.fvReceipt.ukAddress)
  ) {
    pushIssue(
      advisoryIssues,
      "uk-address-mismatch",
      "英国地址写法不一致",
      "申根 Excel 与 FV申请回执单中的英国地址写法不同，请人工确认。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  const decision: ComprehensiveReviewDecision = blockingIssues.length > 0 ? "fail" : "pass"
  const decisionLabel = decision === "pass" ? "可以递签" : "不可递签"
  const summary =
    decision === "pass"
      ? missingOptionalMaterials.length > 0
        ? `可以递签（目前材料可递签，但缺少${joinMissing(missingOptionalMaterials)}）`
        : "可以递签"
      : "不可递签"

  return {
    decision,
    decisionLabel,
    summary,
    missingCoreMaterials,
    missingOptionalMaterials,
    blockingIssues,
    advisoryIssues,
    sections: [
      { title: "必须修改", items: blockingIssues },
      { title: "建议检查", items: advisoryIssues },
    ],
    materials: materialSnapshots,
    materialOutcomes: buildMaterialOutcomes(materials, blockingIssues, advisoryIssues),
    extracted: buildExtractedSnapshots(parsed),
  }
}

function evaluateReviewV3(
  parsed: ParsedSources,
  materials: Partial<Record<ComprehensiveMaterialKey, ComprehensiveMaterialSource>>,
): ComprehensiveReviewResult {
  const standardExcel = parsed.excel?.sourceKind === "standard" ? parsed.excel : undefined
  const materialSnapshots = buildMaterialSnapshots(materials)
  const missingCoreMaterials = (Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[])
    .filter((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].required && !materials[key])
    .map((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].label)
  const missingOptionalMaterials = (Object.keys(COMPREHENSIVE_MATERIAL_CONFIG) as ComprehensiveMaterialKey[])
    .filter((key) => !COMPREHENSIVE_MATERIAL_CONFIG[key].required && !materials[key])
    .map((key) => COMPREHENSIVE_MATERIAL_CONFIG[key].label)

  const blockingIssues: ReviewIssue[] = []
  const advisoryIssues: ReviewIssue[] = []

  if (missingCoreMaterials.length > 0) {
    pushIssue(
      blockingIssues,
      "missing-core-materials",
      "核心材料缺失",
      `当前缺少 ${joinMissing(missingCoreMaterials)}，暂时不能给出可以递签结论。`,
      missingCoreMaterials,
    )
  }

  if (
    materials.schengenExcel &&
    parsed.excel?.sourceKind !== "tlsRegistration" &&
    !standardExcel?.entryDate &&
    !standardExcel?.passportNumber &&
    !standardExcel?.fullName
  ) {
    pushIssue(
      blockingIssues,
      "excel-parse-failed",
      "申根 Excel 关键信息未识别",
      "当前申根 Excel 存在，但系统没有识别出日期或护照号，请检查表格结构后重试。",
      ["申根 Excel"],
    )
  }

  if (materials.fvReceipt && !parsed.fvReceipt?.applicationNumber && !parsed.fvReceipt?.fullName) {
    pushIssue(
      blockingIssues,
      "fv-parse-failed",
      "FV申请回执单关键信息未识别",
      "当前 FV申请回执单存在，但系统没有识别出申请号或申请人姓名，请检查 PDF 是否正确。",
      ["FV申请回执单"],
    )
  }

  if (materials.tlsAppointment && !parsed.tlsAppointment?.applicationNumber && !parsed.tlsAppointment?.fullName) {
    pushIssue(
      blockingIssues,
      "tls-parse-failed",
      "TLS预约单关键信息未识别",
      "当前 TLS预约单存在，但系统没有识别出申请号或申请人姓名，请检查 PDF 是否正确。",
      ["TLS预约单"],
    )
  }

  if (materials.itinerary && !parsed.itinerary?.startDate && !parsed.itinerary?.endDate) {
    pushIssue(
      blockingIssues,
      "itinerary-parse-failed",
      "行程单关键信息未识别",
      "当前行程单存在，但系统没有识别出有效日期区间，请检查 PDF 是否正确。",
      ["行程单"],
    )
  }

  if (materials.hotel && !parsed.hotel?.checkInDate && !parsed.hotel?.checkOutDate) {
    pushIssue(
      blockingIssues,
      "hotel-parse-failed",
      "酒店订单关键信息未识别",
      "当前酒店订单存在，但系统没有识别出入住和退房日期，请检查 PDF 是否正确。",
      ["酒店订单"],
    )
  }

  const canonicalInterval = getCanonicalInterval(parsed)
  const expectedStayDays =
    canonicalInterval
      ? differenceInCalendarDays(new Date(canonicalInterval.end), new Date(canonicalInterval.start)) + 1
      : undefined

  if (standardExcel?.birthDate && parsed.fvReceipt?.birthDate && standardExcel.birthDate !== parsed.fvReceipt.birthDate) {
    pushIssue(
      blockingIssues,
      "birth-date-mismatch",
      "出生日期不一致",
      "申根 Excel 与 FV申请回执单中的出生日期不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.passportNumber &&
    parsed.fvReceipt?.passportNumber &&
    !sameValue(standardExcel.passportNumber, parsed.fvReceipt.passportNumber, normalizePassport)
  ) {
    pushIssue(
      blockingIssues,
      "passport-mismatch",
      "护照号不一致",
      "申根 Excel 与 FV申请回执单中的护照号不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (standardExcel?.fullName && parsed.fvReceipt?.fullName && !sameName(standardExcel.fullName, parsed.fvReceipt.fullName)) {
    pushIssue(
      blockingIssues,
      "name-mismatch",
      "申请人姓名不一致",
      "申根 Excel 与 FV申请回执单中的姓名不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    parsed.tlsAppointment?.fullName &&
    parsed.fvReceipt?.fullName &&
    !sameName(parsed.tlsAppointment.fullName, parsed.fvReceipt.fullName)
  ) {
    pushIssue(
      blockingIssues,
      "tls-name-mismatch",
      "TLS 与 FV 姓名不一致",
      "TLS预约单中的申请人姓名与 FV申请回执单不一致。",
      ["TLS预约单", "FV申请回执单"],
    )
  }

  if (
    parsed.tlsAppointment?.applicationNumber &&
    parsed.fvReceipt?.applicationNumber &&
    !sameValue(parsed.tlsAppointment.applicationNumber, parsed.fvReceipt.applicationNumber, normalizeText)
  ) {
    pushIssue(
      blockingIssues,
      "application-number-mismatch",
      "申请号不一致",
      "TLS预约单与 FV申请回执单的申请号不一致。",
      ["TLS预约单", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.phone &&
    parsed.fvReceipt?.phone &&
    !sameValue(standardExcel.phone, parsed.fvReceipt.phone, normalizePhone)
  ) {
    pushIssue(
      blockingIssues,
      "phone-mismatch",
      "联系电话不一致",
      "申根 Excel 与 FV申请回执单中的联系电话不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.email &&
    parsed.fvReceipt?.email &&
    !sameValue(standardExcel.email, parsed.fvReceipt.email, normalizeEmail)
  ) {
    pushIssue(
      blockingIssues,
      "email-mismatch",
      "邮箱不一致",
      "申根 Excel 与 FV申请回执单中的邮箱不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (
    standardExcel?.ukAddress &&
    parsed.fvReceipt?.ukAddress &&
    !addressContains(standardExcel.ukAddress, parsed.fvReceipt.ukAddress)
  ) {
    pushIssue(
      blockingIssues,
      "uk-address-mismatch",
      "英国地址不一致",
      "申根 Excel 与 FV申请回执单中的英国地址不一致。",
      ["申根 Excel", "FV申请回执单"],
    )
  }

  if (canonicalInterval) {
    const exactSources: Array<[string, string | undefined, string | undefined]> = [
      ["申根 Excel", parsed.excel?.entryDate, parsed.excel?.exitDate],
      ["FV申请回执单", parsed.fvReceipt?.entryDate, parsed.fvReceipt?.exitDate],
      ["行程单", parsed.itinerary?.startDate, parsed.itinerary?.endDate],
      ["酒店订单", parsed.hotel?.checkInDate, parsed.hotel?.checkOutDate],
      ["机票", parsed.flight?.outboundDate, parsed.flight?.returnDate],
    ]

    for (const [label, start, end] of exactSources) {
      if (!start || !end) continue
      if (start !== canonicalInterval.start || end !== canonicalInterval.end) {
        pushIssue(
          blockingIssues,
          `date-range-mismatch-${label}`,
          `${label} 时间区间不一致`,
          `${label} 的时间区间与主区间不一致，应为 ${canonicalInterval.start} 至 ${canonicalInterval.end}。`,
          [label, canonicalInterval.source],
        )
      }
    }

    if (parsed.insurance?.startDate && parsed.insurance?.endDate) {
      if (parsed.insurance.startDate > canonicalInterval.start || parsed.insurance.endDate < canonicalInterval.end) {
        pushIssue(
          blockingIssues,
          "insurance-coverage-short",
          "保险覆盖时间不足",
          `保险日期没有完整覆盖主区间 ${canonicalInterval.start} 至 ${canonicalInterval.end}。`,
          ["保险", canonicalInterval.source],
        )
      }
    }

    if (parsed.hotel?.nights != null && expectedStayDays != null) {
      const expectedNights = Math.max(expectedStayDays - 1, 0)
      if (parsed.hotel.nights !== expectedNights) {
        pushIssue(
          blockingIssues,
          "hotel-nights-mismatch",
          "酒店晚数不匹配",
          `酒店订单显示 ${parsed.hotel.nights} 晚，但按主区间应为 ${expectedNights} 晚。`,
          ["酒店订单", canonicalInterval.source],
        )
      }
    }

    if (parsed.itinerary?.dateList.length && !parsed.itinerary.continuous) {
      pushIssue(
        blockingIssues,
        "itinerary-dates-not-continuous",
        "行程单日期不连续",
        "行程单中的每日日期没有形成连续时间链，建议先修正再递签。",
        ["行程单"],
      )
    }
  }

  const hotelCities = unique(
    [standardExcel?.hotelCity, parsed.itinerary?.hotelCity, parsed.hotel?.hotelCity]
      .map((value) => normalizeCity(value))
      .filter(Boolean),
  )
  if (hotelCities.length > 1) {
    pushIssue(
      blockingIssues,
      "hotel-city-mismatch",
      "酒店城市不一致",
      "Excel、行程单或酒店订单中的酒店城市不一致。",
      ["申根 Excel", "行程单", "酒店订单"],
    )
  }

  if (
    parsed.flight?.departureCity &&
    parsed.itinerary?.firstDepartureCity &&
    !sameCity(parsed.flight.departureCity, parsed.itinerary.firstDepartureCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-first-departure-city-mismatch",
      "机票去程出发城市与行程首日不一致",
      "机票去程出发城市与行程单首日出发城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    parsed.flight?.arrivalCity &&
    parsed.itinerary?.firstArrivalCity &&
    !sameCity(parsed.flight.arrivalCity, parsed.itinerary.firstArrivalCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-first-arrival-city-mismatch",
      "机票去程到达城市与行程首日不一致",
      "机票去程到达城市与行程单首日到达城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    parsed.flight?.returnDepartureCity &&
    parsed.itinerary?.lastDepartureCity &&
    !sameCity(parsed.flight.returnDepartureCity, parsed.itinerary.lastDepartureCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-return-departure-city-mismatch",
      "机票返程出发城市与行程末日不一致",
      "机票返程出发城市与行程单末日出发城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    parsed.flight?.returnArrivalCity &&
    parsed.itinerary?.lastArrivalCity &&
    !sameCity(parsed.flight.returnArrivalCity, parsed.itinerary.lastArrivalCity)
  ) {
    pushIssue(
      blockingIssues,
      "flight-return-arrival-city-mismatch",
      "机票返程到达城市与行程末日不一致",
      "机票返程到达城市与行程单末日到达城市不一致。",
      ["机票", "行程单"],
    )
  }

  if (
    standardExcel?.hotelName &&
    parsed.hotel?.hotelName &&
    !hotelNamesSimilar(standardExcel.hotelName, parsed.hotel.hotelName)
  ) {
    pushIssue(
      blockingIssues,
      "excel-hotel-name-different",
      "酒店名称与申根 Excel 不一致",
      "酒店订单中的酒店名称与申根 Excel 不一致。",
      ["申根 Excel", "酒店订单"],
    )
  }

  if (
    standardExcel?.hotelAddress &&
    parsed.hotel?.hotelAddress &&
    !addressContains(standardExcel.hotelAddress, parsed.hotel.hotelAddress)
  ) {
    pushIssue(
      blockingIssues,
      "excel-hotel-address-different",
      "酒店地址与申根 Excel 不一致",
      "酒店订单中的酒店地址与申根 Excel 不一致。",
      ["申根 Excel", "酒店订单"],
    )
  }

  if (
    parsed.hotel?.hotelName &&
    parsed.fvReceipt?.hotelName &&
    !hotelNamesSimilar(parsed.hotel.hotelName, parsed.fvReceipt.hotelName)
  ) {
    pushIssue(
      blockingIssues,
      "hotel-name-different",
      "酒店名称不一致",
      "FV申请回执单与酒店订单中的酒店名称不一致。",
      ["FV申请回执单", "酒店订单"],
    )
  }

  if (
    parsed.hotel?.hotelAddress &&
    parsed.itinerary?.hotelAddress &&
    !addressContains(parsed.hotel.hotelAddress, parsed.itinerary.hotelAddress)
  ) {
    pushIssue(
      blockingIssues,
      "hotel-address-different",
      "酒店地址不一致",
      "酒店订单与行程单中的酒店地址不一致。",
      ["酒店订单", "行程单"],
    )
  }

  if (
    parsed.hotel?.hotelName &&
    parsed.itinerary?.hotelName &&
    !hotelNamesSimilar(parsed.hotel.hotelName, parsed.itinerary.hotelName)
  ) {
    pushIssue(
      blockingIssues,
      "itinerary-hotel-name-different",
      "行程单酒店名称与订单不一致",
      "行程单中的酒店名称与酒店订单不一致。",
      ["行程单", "酒店订单"],
    )
  }

  if (
    parsed.hotel?.guestNames.length &&
    parsed.fvReceipt?.fullName &&
    !parsed.hotel.guestNames.some((guest) => nameContainsTokens(guest, parsed.fvReceipt?.fullName))
  ) {
    pushIssue(
      blockingIssues,
      "hotel-guest-mismatch",
      "酒店入住人无法对应申请人",
      "酒店订单中的入住人姓名无法对应 FV申请回执单里的申请人姓名。",
      ["酒店订单", "FV申请回执单"],
    )
  }

  const decision: ComprehensiveReviewDecision = blockingIssues.length > 0 ? "fail" : "pass"
  const decisionLabel = decision === "pass" ? "可以递签" : "不可递签"
  const summary =
    decision === "pass"
      ? missingOptionalMaterials.length > 0
        ? `可以递签（目前材料可递签，但缺少${joinMissing(missingOptionalMaterials)}）`
        : "可以递签"
      : "不可递签"

  return {
    decision,
    decisionLabel,
    summary,
    missingCoreMaterials,
    missingOptionalMaterials,
    blockingIssues,
    advisoryIssues,
    sections: [
      { title: "必须修改", items: blockingIssues },
      { title: "建议检查", items: advisoryIssues },
    ],
    materials: materialSnapshots,
    materialOutcomes: buildMaterialOutcomes(materials, blockingIssues, advisoryIssues),
    extracted: buildExtractedSnapshotsV2(parsed),
  }
}

export async function runFranceComprehensiveReview(
  materials: Partial<Record<ComprehensiveMaterialKey, ComprehensiveMaterialSource>>,
): Promise<ComprehensiveReviewResult> {
  const parsed: ParsedSources = {}

  if (materials.schengenExcel) {
    const buffer = await fs.readFile(materials.schengenExcel.absolutePath)
    parsed.excel = parseExcelSourceV2(buffer)
  }
  if (materials.fvReceipt) {
    const text = await extractDocumentText(materials.fvReceipt)
    parsed.fvReceipt = parseFvReceiptText(text)
  }
  if (materials.tlsAppointment) {
    const text = await extractDocumentText(materials.tlsAppointment)
    parsed.tlsAppointment = parseTlsAppointmentText(text)
  }
  if (materials.itinerary) {
    const text = await extractDocumentText(materials.itinerary)
    parsed.itinerary = parseStructuredItineraryText(text)
  }
  if (materials.hotel) {
    const text = await extractDocumentText(materials.hotel)
    parsed.hotel = parseStructuredHotelText(text)
  }
  if (materials.flight) {
    const text = await extractDocumentText(materials.flight)
    parsed.flight = parseFlightText(text)
  }
  if (materials.insurance) {
    const text = await extractDocumentText(materials.insurance)
    parsed.insurance = parseInsuranceText(text)
  }

  return evaluateReviewV3(parsed, materials)
}

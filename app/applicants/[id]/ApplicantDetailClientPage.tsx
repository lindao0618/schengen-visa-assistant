"use client"

/* eslint-disable @next/next/no-img-element */

import { type ChangeEvent, useCallback, useEffect, useMemo } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react"
import { read, utils, write } from "xlsx"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ACTIVE_APPLICANT_CASE_KEY, ACTIVE_APPLICANT_PROFILE_KEY } from "@/components/applicant-profile-selector"
import { resolveSelectedFranceCase, resolveTlsAccountCaseSource } from "@/app/applicants/[id]/detail/cases-tab"
import { getAppRoleLabel } from "@/lib/access-control"
import { resolveApplicantDetailTab, useApplicantDetailController } from "@/app/applicants/[id]/detail/use-applicant-detail-controller"
import {
  APPLICANT_CRM_LIST_CACHE_PREFIX,
  APPLICANT_CRM_SUMMARY_CACHE_PREFIX,
  APPLICANT_DETAIL_CACHE_TTL_MS,
  APPLICANT_SELECTOR_CACHE_KEY,
  FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX,
  clearClientCache,
  clearClientCacheByPrefix,
  getApplicantDetailCacheKey,
  readClientCache,
  writeClientCache,
} from "@/lib/applicant-client-cache"
import { FRANCE_TLS_CITY_OPTIONS, getFranceTlsCityLabel } from "@/lib/france-tls-city"
import { cn } from "@/lib/utils"

const AuditDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/audit-dialog").then((mod) => mod.AuditDialog),
  { ssr: false },
)

const CreateCaseDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/create-case-dialog").then((mod) => mod.CreateCaseDialog),
  { ssr: false },
)

const CasesTabContent = dynamic(
  () => import("@/app/applicants/[id]/detail/cases-tab-content").then((mod) => mod.CasesTabContent),
  { ssr: false },
)

const MaterialPreviewDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/material-preview-dialog").then((mod) => mod.MaterialPreviewDialog),
  { ssr: false },
)

const MaterialsTab = dynamic(
  () => import("@/app/applicants/[id]/detail/materials-tab").then((mod) => mod.MaterialsTab),
  { ssr: false },
)

const ProgressTab = dynamic(
  () => import("@/app/applicants/[id]/detail/progress-tab").then((mod) => mod.ProgressTab),
  { ssr: false },
)

type ApplicantIntakeSnapshot = {
  version: number
  sourceSlot: string
  sourceOriginalName?: string
  extractedAt: string
  fieldCount: number
  fields: Record<string, string>
  items: Array<{ key: string; label: string; value: string }>
  audit: {
    ok: boolean
    errors: Array<{ field: string; message: string; value?: string }>
  }
}

type ApplicantProfileDetail = {
  id: string
  userId: string
  label: string
  name?: string
  phone?: string
  email?: string
  wechat?: string
  passportNumber?: string
  passportLast4?: string
  note?: string
  usVisa?: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
    fullIntake?: ApplicantIntakeSnapshot
  }
  schengen?: {
    country?: string
    city?: string
    fraNumber?: string
    fullIntake?: ApplicantIntakeSnapshot
  }
  files?: Record<string, { originalName: string; uploadedAt: string }>
}

type ReminderLogRecord = {
  id: string
  ruleCode: string
  channel: string
  automationMode: string
  severity: string
  templateCode: string
  sendStatus: string
  renderedContent?: string | null
  errorMessage?: string | null
  triggeredAt: string
  sentAt?: string | null
}

type StatusHistoryRecord = {
  id: string
  fromMainStatus?: string | null
  fromSubStatus?: string | null
  toMainStatus: string
  toSubStatus?: string | null
  exceptionCode?: string | null
  reason?: string | null
  operatorType: string
  operatorId?: string | null
  createdAt: string
}

type VisaCaseRecord = {
  id: string
  caseType: string
  visaType?: string | null
  applyRegion?: string | null
  tlsCity?: string | null
  bookingWindow?: string | null
  acceptVip?: string | null
  slotTime?: string | null
  mainStatus: string
  subStatus?: string | null
  exceptionCode?: string | null
  priority: string
  travelDate?: string | null
  submissionDate?: string | null
  assignedToUserId?: string | null
  assignedRole?: string | null
  isActive: boolean
  updatedAt: string
  createdAt: string
  ds160PrecheckFile?: {
    originalName: string
    uploadedAt: string
  } | null
  owner: {
    id: string
    name?: string | null
    email: string
  }
  assignedTo?: {
    id: string
    name?: string | null
    email: string
    role: string
  } | null
  latestHistory?: {
    id: string
    toMainStatus: string
    toSubStatus?: string | null
    exceptionCode?: string | null
    reason?: string | null
    createdAt: string
  } | null
  statusHistory: StatusHistoryRecord[]
  reminderLogs: ReminderLogRecord[]
}

type AssigneeOption = {
  id: string
  name?: string | null
  email: string
  role: string
}

type ApplicantDetailResponse = {
  profile: ApplicantProfileDetail
  cases: VisaCaseRecord[]
  activeCaseId?: string | null
  availableAssignees: AssigneeOption[]
}

type BasicFormState = {
  name: string
  phone: string
  email: string
  wechat: string
  passportNumber: string
  note: string
  usVisaSurname: string
  usVisaBirthYear: string
  usVisaPassportNumber: string
  schengenCountry: string
  schengenVisaCity: string
}

type CaseFormState = {
  caseType: string
  visaType: string
  applyRegion: string
  tlsCity: string
  bookingWindow: string
  acceptVip: string
  slotTime: string
  priority: string
  travelDate: string
  submissionDate: string
  assignedToUserId: string
  isActive: boolean
}

type PreviewKind = "pdf" | "image" | "excel" | "word" | "text" | "unknown"

type ExcelPreviewSheet = {
  name: string
  rows?: string[][]
}

type UsVisaExcelPreviewItem = {
  rowIndex: number
  label: string
  field: string
  value: string
  note: string
}

type UsVisaExcelPreviewSection = {
  title: string
  items: UsVisaExcelPreviewItem[]
}

type PreviewState = {
  open: boolean
  loading: boolean
  title: string
  kind: PreviewKind
  objectUrl: string
  textContent: string
  htmlContent: string
  tableRows: string[][]
  excelSheets: ExcelPreviewSheet[]
  activeExcelSheet: string
  error: string
  /** Slot key for PUT /api/applicants/.../files/[slot] (Excel only). */
  excelSlot: string
  excelOriginalName: string
  workbookArrayBuffer: ArrayBuffer | null
  excelEditMode: boolean
  excelDirty: boolean
  excelSaving: boolean
  excelSavingStatus: string
  excelPreviewMode: "form" | "table"
  excelUsVisaSections: UsVisaExcelPreviewSection[]
}

type AuditDialogState = {
  open: boolean
  title: string
  status: "running" | "success" | "error"
  issues: Array<{ field: string; message: string; value?: string }>
  scope?: "schengen" | "usVisa"
  slot?: string
  helperText?: string
  autoFixing?: boolean
  phaseIndex?: number
}

const emptyPreview: PreviewState = {
  open: false,
  loading: false,
  title: "",
  kind: "unknown",
  objectUrl: "",
  textContent: "",
  htmlContent: "",
  tableRows: [],
  excelSheets: [],
  activeExcelSheet: "",
  error: "",
  excelSlot: "",
  excelOriginalName: "",
  workbookArrayBuffer: null,
  excelEditMode: false,
  excelDirty: false,
  excelSaving: false,
  excelSavingStatus: "",
  excelPreviewMode: "table",
  excelUsVisaSections: [],
}

const emptyAuditDialog: AuditDialogState = {
  open: false,
  title: "",
  status: "running",
  issues: [],
  scope: undefined,
  slot: "",
  helperText: "",
  autoFixing: false,
  phaseIndex: 0,
}

const AUDIT_PROGRESS_STEPS = ["正在读取 Excel", "正在识别字段", "正在检查规则", "审核完成"]

const US_VISA_EXCEL_PREVIEW_SLOTS = new Set(["usVisaDs160Excel", "usVisaAisExcel", "ds160Excel", "aisExcel"])

function cloneTableRows(rows: string[][]) {
  return rows.map((row) => [...row])
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u3000"'`“”‘’()（）[\]【】{}<>:：;；,.，。!?！？\\|@#$%^&*_+=~/-]/g, "")
}

function extractExcelSheetRows(sheet: unknown): string[][] {
  if (!sheet || typeof sheet !== "object") return []

  const worksheet = sheet as Record<string, { w?: unknown; v?: unknown; z?: unknown; t?: unknown }>
  const cellRefs = Object.keys(worksheet).filter((key) => !key.startsWith("!"))
  if (!cellRefs.length) return []

  let maxRow = 0
  let maxCol = 0
  for (const ref of cellRefs) {
    const position = utils.decode_cell(ref)
    if (position.r > maxRow) maxRow = position.r
    if (position.c > maxCol) maxCol = position.c
  }

  const rows = Array.from({ length: maxRow + 1 }, () => Array.from({ length: maxCol + 1 }, () => ""))
  for (const ref of cellRefs) {
    const position = utils.decode_cell(ref)
    const cell = worksheet[ref]
    let displayValue = ""
    if (cell) {
      const formatted = typeof utils.format_cell === "function" ? utils.format_cell(cell as never) : ""
      displayValue = String(formatted || (cell.w ?? cell.v ?? ""))
    }
    rows[position.r][position.c] = displayValue
  }

  return rows
}

function parseUsVisaExcelPreviewSections(rows: string[][]): UsVisaExcelPreviewSection[] {
  const sections: UsVisaExcelPreviewSection[] = []
  let currentTitle = "基本信息"
  let currentItems: UsVisaExcelPreviewItem[] = []

  const pushCurrent = () => {
    const filtered = currentItems.filter((item) => item.label || item.field || item.value || item.note)
    if (!filtered.length) return
    sections.push({
      title: currentTitle || "未分组字段",
      items: filtered,
    })
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || []
    const label = (row[0] || "").trim()
    const field = (row[1] || "").trim()
    const value = (row[2] || "").trim()
    const note = row
      .slice(3, 6)
      .map((cell) => (cell || "").trim())
      .filter(Boolean)
      .join(" ")

    const isHeaderRow =
      normalizeKey(label) === normalizeKey("基本信息") &&
      normalizeKey(field) === normalizeKey("field") &&
      normalizeKey(value) === normalizeKey("填写内容")
    if (isHeaderRow) {
      currentTitle = "基本信息"
      continue
    }

    const isSectionRow = Boolean(label) && !field && !value
    if (isSectionRow) {
      pushCurrent()
      currentTitle = label
      currentItems = []
      continue
    }

    const hasPrimaryData = Boolean(label || field || value)
    if (!hasPrimaryData) continue

    currentItems.push({
      rowIndex: index + 1,
      label,
      field,
      value,
      note,
    })
  }

  pushCurrent()
  return sections
}

const emptyBasicForm: BasicFormState = {
  name: "",
  phone: "",
  email: "",
  wechat: "",
  passportNumber: "",
  note: "",
  usVisaSurname: "",
  usVisaBirthYear: "",
  usVisaPassportNumber: "",
  schengenCountry: "france",
  schengenVisaCity: "",
}

const emptyCaseForm: CaseFormState = {
  caseType: "france-schengen",
  visaType: "",
  applyRegion: "",
  tlsCity: "",
  bookingWindow: "",
  acceptVip: "",
  slotTime: "",
  priority: "normal",
  travelDate: "",
  submissionDate: "",
  assignedToUserId: "",
  isActive: true,
}

function getApplicantCaseStorageKey(applicantId: string) {
  return `activeApplicantCaseId:${applicantId}`
}

function persistSelectedApplicantCase(applicantId: string, caseId?: string | null) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, applicantId)

  const normalizedCaseId = caseId || ""
  if (normalizedCaseId) {
    window.localStorage.setItem(ACTIVE_APPLICANT_CASE_KEY, normalizedCaseId)
    window.localStorage.setItem(getApplicantCaseStorageKey(applicantId), normalizedCaseId)
  } else {
    window.localStorage.removeItem(ACTIVE_APPLICANT_CASE_KEY)
    window.localStorage.removeItem(getApplicantCaseStorageKey(applicantId))
  }

  window.dispatchEvent(
    new CustomEvent("active-applicant-profile-changed", {
      detail: { applicantProfileId: applicantId },
    }),
  )
  window.dispatchEvent(
    new CustomEvent("active-applicant-case-changed", {
      detail: { applicantProfileId: applicantId, caseId: normalizedCaseId || undefined },
    }),
  )
}

async function readJsonSafely<T>(response: Response) {
  const text = await response.text()
  if (!text) return null as T | null
  return JSON.parse(text) as T
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function buildBasicForm(profile?: ApplicantProfileDetail | null): BasicFormState {
  if (!profile) return emptyBasicForm
  return {
    name: profile.name || profile.label || "",
    phone: profile.phone || "",
    email: profile.email || "",
    wechat: profile.wechat || "",
    passportNumber: profile.passportNumber || "",
    note: profile.note || "",
    usVisaSurname: profile.usVisa?.surname || "",
    usVisaBirthYear: profile.usVisa?.birthYear || "",
    usVisaPassportNumber: profile.usVisa?.passportNumber || "",
    schengenCountry: profile.schengen?.country || "france",
    schengenVisaCity: profile.schengen?.city || "",
  }
}

type IntakeItemLike = { label?: string; value?: string }
type UsVisaIntakeLike = { items?: IntakeItemLike[] }

const US_VISA_LABEL_ORDER: Array<{ keyword: string; rank: number }> = [
  // 身份
  { keyword: "姓名", rank: 10 },
  { keyword: "姓", rank: 11 },
  { keyword: "名", rank: 12 },
  { keyword: "中文名", rank: 13 },
  { keyword: "电报码", rank: 14 },
  { keyword: "出生", rank: 15 },
  { keyword: "护照", rank: 16 },
  { keyword: "AA码", rank: 17 },
  // 联系方式
  { keyword: "电话", rank: 30 },
  { keyword: "邮箱", rank: 31 },
  { keyword: "地址", rank: 32 },
  { keyword: "城市", rank: 33 },
  { keyword: "州", rank: 34 },
  { keyword: "邮编", rank: 35 },
  // 行程
  { keyword: "到达", rank: 50 },
  { keyword: "停留", rank: 51 },
  { keyword: "赴美", rank: 52 },
  { keyword: "旅行", rank: 53 },
  { keyword: "酒店", rank: 54 },
]

function sortUsVisaLabels(labels: string[]) {
  const rankOf = (label: string) => {
    const hit = US_VISA_LABEL_ORDER.find((item) => label.includes(item.keyword))
    return hit ? hit.rank : 999
  }
  return [...labels].sort((a, b) => {
    const rankDiff = rankOf(a) - rankOf(b)
    if (rankDiff !== 0) return rankDiff
    return a.localeCompare(b, "zh-CN")
  })
}

function collectDetectedUsVisaFieldLabels(
  parsedUsVisaFullIntake?: UsVisaIntakeLike,
  parsedUsVisaDetails?: {
    surname?: string
    birthYear?: string
    passportNumber?: string
    chineseName?: string
    telecodeSurname?: string
    telecodeGivenName?: string
  },
) {
  const labels = (parsedUsVisaFullIntake?.items || [])
    .filter((item) => String(item?.value || "").trim())
    .map((item) => String(item?.label || "").trim())
    .filter(Boolean)

  if (labels.length > 0) {
    return sortUsVisaLabels(Array.from(new Set(labels)))
  }

  const fallback = [
    parsedUsVisaDetails?.surname ? "姓" : "",
    parsedUsVisaDetails?.birthYear ? "出生年份" : "",
    parsedUsVisaDetails?.passportNumber ? "护照号" : "",
    parsedUsVisaDetails?.chineseName ? "中文名" : "",
    parsedUsVisaDetails?.telecodeSurname ? "姓氏电报码" : "",
    parsedUsVisaDetails?.telecodeGivenName ? "名字电报码" : "",
  ].filter(Boolean) as string[]
  return sortUsVisaLabels(fallback)
}

function buildCaseForm(visaCase?: VisaCaseRecord | null): CaseFormState {
  if (!visaCase) return emptyCaseForm
  return {
    caseType: visaCase.caseType || "france-schengen",
    visaType: visaCase.visaType || "",
    applyRegion: visaCase.applyRegion || "",
    tlsCity: visaCase.tlsCity || "",
    bookingWindow: visaCase.bookingWindow || "",
    acceptVip: visaCase.acceptVip || "",
    slotTime: toDateTimeLocalValue(visaCase.slotTime),
    priority: visaCase.priority || "normal",
    travelDate: visaCase.travelDate ? visaCase.travelDate.slice(0, 10) : "",
    submissionDate: visaCase.submissionDate ? visaCase.submissionDate.slice(0, 10) : "",
    assignedToUserId: visaCase.assignedToUserId || "",
    isActive: visaCase.isActive,
  }
}

const TLS_PAYMENT_LINK = "https://visas-fr.tlscontact.com/en-us/"

type TlsAccountInfo = {
  name: string
  bookingWindow: string
  acceptVip: string
  city: string
  groupSize: string
  phone: string
  paymentAccount: string
  paymentPassword: string
  paymentLink: string
}

function isFranceSchengenCase(caseLike?: { caseType?: string | null; visaType?: string | null } | null) {
  if (!caseLike) return false
  return caseLike.caseType === "france-schengen" || caseLike.visaType === "france-schengen"
}

function toDisplayValue(value?: string | null) {
  const normalized = String(value || "").trim()
  return normalized || "-"
}

function formatTlsCityDisplay(value?: string | null) {
  const normalized = String(value || "").trim()
  if (!normalized) return "-"
  const label = getFranceTlsCityLabel(normalized)
  return label ? `${normalized} - ${label}` : normalized
}

function buildTlsAccountInfo(
  profile?: ApplicantProfileDetail | null,
  caseSource?: Pick<CaseFormState, "bookingWindow" | "acceptVip" | "tlsCity"> | null,
  fallbackTlsCity?: string,
): TlsAccountInfo {
  const schengenFields = profile?.schengen?.fullIntake?.fields || {}
  const familyName = String(schengenFields.familyName || "").trim()
  const firstName = String(schengenFields.firstName || "").trim()
  const excelEnglishName = [familyName, firstName].filter(Boolean).join(" ")
  const tlsCity = caseSource?.tlsCity?.trim() || fallbackTlsCity?.trim() || profile?.schengen?.city || ""

  return {
    name: toDisplayValue(excelEnglishName || profile?.name || profile?.label),
    bookingWindow: toDisplayValue(caseSource?.bookingWindow),
    acceptVip: toDisplayValue(caseSource?.acceptVip),
    city: formatTlsCityDisplay(tlsCity),
    groupSize: "1",
    phone: toDisplayValue(String(schengenFields.phoneUk || "").trim()),
    paymentAccount: toDisplayValue(String(schengenFields.emailAccount || "").trim()),
    paymentPassword: toDisplayValue(String(schengenFields.emailPassword || "").trim()),
    paymentLink: TLS_PAYMENT_LINK,
  }
}

function buildTlsAccountTemplateText(info: TlsAccountInfo) {
  return [
    `1.姓名：${info.name}`,
    `2.抢号区间再次确认：${info.bookingWindow}`,
    "⚠注意这个区间内任意一天都有可能",
    "抢到后不可更改 有特殊要求现在和我说哦",
    "以此次汇报为准",
    `3.是否接受vip：${info.acceptVip}`,
    `4.递签城市：${info.city}`,
    `5.人数：${info.groupSize}`,
    `6.电话：${info.phone}`,
    `7.付款账号：${info.paymentAccount}`,
    `8.付款密码：${info.paymentPassword}`,
    `9.付款链接：${info.paymentLink}`,
  ].join("\n")
}

function Section({
  title,
  description,
  tone = "slate",
  children,
}: {
  title: string
  description: string
  tone?: "slate" | "sky" | "emerald" | "amber"
  children: React.ReactNode
}) {
  const toneMap = {
    slate: {
      card: "border-slate-200 bg-white/95",
      title: "text-slate-900",
      desc: "text-slate-500",
    },
    sky: {
      card: "border-sky-200 bg-[linear-gradient(180deg,_#ffffff,_#f0f9ff)]",
      title: "text-sky-950",
      desc: "text-sky-700/80",
    },
    emerald: {
      card: "border-emerald-200 bg-[linear-gradient(180deg,_#ffffff,_#ecfdf5)]",
      title: "text-emerald-950",
      desc: "text-emerald-700/80",
    },
    amber: {
      card: "border-amber-200 bg-[linear-gradient(180deg,_#ffffff,_#fffbeb)]",
      title: "text-amber-950",
      desc: "text-amber-700/80",
    },
  } as const

  const styles = toneMap[tone]
  return (
    <Card className={cn("shadow-sm", styles.card)}>
      <CardHeader>
        <CardTitle className={cn("text-lg font-semibold", styles.title)}>{title}</CardTitle>
        <CardDescription className={cn("text-sm", styles.desc)}>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

function buildApplicantFileUrl(applicantId: string, slot: string) {
  return `/api/applicants/${encodeURIComponent(applicantId)}/files/${encodeURIComponent(slot)}`
}

function IntakeAccordionCard({
  applicantId,
  title,
  subtitle,
  tone,
  intake,
  photoSlot,
  photoLabel,
  emptyMessage,
}: {
  applicantId: string
  title: string
  subtitle: string
  tone: "sky" | "emerald"
  intake?: ApplicantIntakeSnapshot
  photoSlot?: string
  photoLabel?: string
  emptyMessage: string
}) {
  const toneMap = {
    sky: {
      wrapper: "border-sky-200/80 bg-white/80",
      trigger: "text-sky-950",
      meta: "text-sky-700/80",
      code: "border-sky-200 bg-slate-950",
      empty: "border-dashed border-sky-200 bg-white/70 text-sky-800/80",
      photo: "border-sky-200 bg-sky-50/60",
    },
    emerald: {
      wrapper: "border-emerald-200/80 bg-white/80",
      trigger: "text-emerald-950",
      meta: "text-emerald-700/80",
      code: "border-emerald-200 bg-slate-950",
      empty: "border-dashed border-emerald-200 bg-white/70 text-emerald-800/80",
      photo: "border-emerald-200 bg-emerald-50/60",
    },
  } as const

  const styles = toneMap[tone]

  if (!intake) {
    return (
      <div className={cn("rounded-2xl border px-4 py-4 text-sm", styles.empty)}>
        {emptyMessage}
      </div>
    )
  }

  const jsonText = JSON.stringify(intake, null, 2)
  const auditErrorCount = intake.audit?.errors?.length || 0
  const photoUrl = photoSlot ? buildApplicantFileUrl(applicantId, photoSlot) : ""
  const visibleItems = intake.items.filter((item) => item.value?.trim())

  return (
    <div className={cn("rounded-2xl border shadow-sm", styles.wrapper)}>
      <Accordion type="single" collapsible className="px-4">
        <AccordionItem value={`${tone}-intake`} className="border-none">
          <AccordionTrigger className={cn("py-4 text-left hover:no-underline", styles.trigger)}>
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-base font-semibold">{title}</div>
                <div className={cn("text-sm", styles.meta)}>{subtitle}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{intake.sourceSlot}</Badge>
                <Badge variant="outline">{intake.fieldCount} 字段</Badge>
                <Badge variant={auditErrorCount > 0 ? "warning" : "success"}>
                  {auditErrorCount > 0 ? `${auditErrorCount} 个审计问题` : "审计通过"}
                </Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">来源文件</div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">
                      {intake.sourceOriginalName || intake.sourceSlot}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">槽位：{intake.sourceSlot}</div>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">最近提取时间</div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(intake.extractedAt)}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      OpenClaw 后续建议直接读取这里的结构化 JSON。
                    </div>
                  </div>
                </div>
                {photoSlot ? (
                  <div className={cn("overflow-hidden rounded-2xl border", styles.photo)}>
                    <div className="border-b border-black/5 px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{photoLabel || "关联照片"}</div>
                      <div className="mt-1 text-xs text-gray-500">{photoSlot}</div>
                    </div>
                    <div className="p-3">
                      <img
                        src={photoUrl}
                        alt={photoLabel || "申请人照片"}
                        className="h-56 w-full rounded-xl bg-white object-contain"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900">完整 JSON</div>
                    <div className="text-xs text-gray-500">可直接用于 OpenClaw 读取和后续编排</div>
                  </div>
                  <div className={cn("mt-3 max-h-[460px] overflow-auto rounded-xl border p-4", styles.code)}>
                    <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-slate-100">{jsonText}</pre>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function ParsedIntakeAccordion({
  applicantId,
  title,
  subtitle,
  tone,
  intake,
  photoSlot,
  photoLabel,
  emptyMessage,
}: {
  applicantId: string
  title: string
  subtitle: string
  tone: "sky" | "emerald"
  intake?: ApplicantIntakeSnapshot
  photoSlot?: string
  photoLabel?: string
  emptyMessage: string
}) {
  const toneMap = {
    sky: {
      wrapper: "border-sky-200/80 bg-white/85",
      trigger: "text-sky-950",
      meta: "text-sky-700/80",
      code: "border-sky-200 bg-slate-950",
      empty: "border-dashed border-sky-200 bg-white/70 text-sky-800/80",
      accent: "bg-sky-50 text-sky-700 border-sky-200",
      photo: "border-sky-200 bg-sky-50/60",
    },
    emerald: {
      wrapper: "border-emerald-200/80 bg-white/85",
      trigger: "text-emerald-950",
      meta: "text-emerald-700/80",
      code: "border-emerald-200 bg-slate-950",
      empty: "border-dashed border-emerald-200 bg-white/70 text-emerald-800/80",
      accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
      photo: "border-emerald-200 bg-emerald-50/60",
    },
  } as const

  const styles = toneMap[tone]

  if (!intake) {
    return (
      <div className={cn("rounded-2xl border px-4 py-4 text-sm", styles.empty)}>
        {emptyMessage}
      </div>
    )
  }

  const jsonText = JSON.stringify(intake, null, 2)
  const auditErrorCount = intake.audit?.errors?.length || 0
  const visibleItems = intake.items.filter((item) => item.value?.trim())
  const photoUrl = photoSlot ? buildApplicantFileUrl(applicantId, photoSlot) : ""

  return (
    <div className={cn("rounded-2xl border shadow-sm", styles.wrapper)}>
      <Accordion type="single" collapsible className="px-4">
        <AccordionItem value={`${tone}-parsed-intake`} className="border-none">
          <AccordionTrigger className={cn("py-4 text-left hover:no-underline", styles.trigger)}>
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-base font-semibold">{title}</div>
                <div className={cn("text-sm", styles.meta)}>{subtitle}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{intake.sourceSlot}</Badge>
                <Badge variant="outline">{intake.fieldCount} 个字段</Badge>
                <Badge variant={auditErrorCount > 0 ? "warning" : "success"}>
                  {auditErrorCount > 0 ? `${auditErrorCount} 个问题` : "已通过"}
                </Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Source File</div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">
                      {intake.sourceOriginalName || intake.sourceSlot}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Slot: {intake.sourceSlot}</div>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Parsed At</div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(intake.extractedAt)}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      OpenClaw 建议直接读取这一层，不要先下载原始 Excel。
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/90 p-4 sm:col-span-2 xl:col-span-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Quick Stats</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      <div>
                        <div className="text-[11px] text-gray-500">字段总数</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{intake.fieldCount}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">已提取值</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{visibleItems.length}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">Audit</div>
                        <div className={cn("mt-1 text-sm font-semibold", auditErrorCount > 0 ? "text-amber-700" : "text-emerald-700")}>
                          {auditErrorCount > 0 ? `${auditErrorCount} 个问题` : "已通过"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {photoSlot ? (
                  <div className={cn("overflow-hidden rounded-2xl border", styles.photo)}>
                    <div className="border-b border-black/5 px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{photoLabel || "照片"}</div>
                      <div className="mt-1 text-xs text-gray-500">{photoSlot}</div>
                    </div>
                    <div className="p-3">
                      <img
                        src={photoUrl}
                        alt={photoLabel || "照片"}
                        className="h-56 w-full rounded-xl bg-white object-contain"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900">完整个人信息</div>
                    <div className="text-xs text-gray-500">按字段平铺，更适合人工快速浏览。</div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {visibleItems.length > 0 ? (
                      visibleItems.map((item) => (
                        <div
                          key={`${intake.sourceSlot}-${item.key}`}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                        >
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
                          <div className="mt-2 break-words text-sm font-semibold text-slate-900">{item.value}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{item.key}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 md:col-span-2 2xl:col-span-3">
                        当前没有可直接展示的字段，但完整 JSON 仍然可用。
                      </div>
                    )}
                  </div>
                </div>

                {auditErrorCount > 0 ? (
                  <div className={cn("rounded-2xl border px-4 py-4", styles.accent)}>
                    <div className="text-sm font-semibold">Audit 提醒</div>
                    <div className="mt-3 space-y-2 text-sm">
                      {intake.audit.errors.map((issue, index) => (
                        <div key={`${issue.field}-${index}`} className="rounded-xl border border-current/20 bg-white/70 px-3 py-2">
                          <div className="font-medium">{issue.field}</div>
                          <div className="mt-1">{issue.message}</div>
                          {issue.value ? <div className="mt-1 text-xs opacity-80">当前值：{issue.value}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <details className="rounded-2xl border border-white/60 bg-white/90 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                    查看原始 JSON
                  </summary>
                  <div className={cn("mt-3 max-h-[420px] overflow-auto rounded-xl border p-4", styles.code)}>
                    <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-slate-100">{jsonText}</pre>
                  </div>
                </details>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export default function ApplicantDetailClientPage({
  applicantId,
  viewerRole,
}: {
  applicantId: string
  viewerRole?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    normalizedViewerRole,
    isReadOnlyViewer,
    canEditApplicant,
    canAssignCase,
    canRunAutomation,
    loading,
    setLoading,
    message,
    setMessage,
    savingProfile,
    setSavingProfile,
    savingCase,
    setSavingCase,
    deletingApplicant,
    setDeletingApplicant,
    creatingCase,
    setCreatingCase,
    detail,
    setDetail,
    basicForm,
    setBasicForm,
    selectedCaseId,
    setSelectedCaseId,
    caseForm,
    setCaseForm,
    createCaseOpen,
    setCreateCaseOpen,
    newCaseForm,
    setNewCaseForm,
    preview,
    setPreview,
    auditDialog,
    setAuditDialog,
    detailCacheKey,
    selectedCase,
    invalidateApplicantCaches,
    primeApplicantDetailCache,
    applyDetailPayload,
  } = useApplicantDetailController({
    applicantId,
    viewerRole,
  })
  const defaultTab = useMemo(() => {
    return resolveApplicantDetailTab(searchParams.get("tab"))
  }, [searchParams])
  const selectedFranceCase = useMemo(
    () => resolveSelectedFranceCase(detail?.cases || [], selectedCase),
    [detail?.cases, selectedCase],
  )
  const tlsAccountCaseSource = useMemo(
    () => resolveTlsAccountCaseSource(selectedCase, selectedFranceCase, caseForm),
    [caseForm, selectedCase, selectedFranceCase],
  )
  const tlsAccountInfo = useMemo(
    () => buildTlsAccountInfo(detail?.profile, tlsAccountCaseSource, basicForm.schengenVisaCity),
    [basicForm.schengenVisaCity, detail?.profile, tlsAccountCaseSource],
  )
  const tlsAccountTemplateText = useMemo(() => buildTlsAccountTemplateText(tlsAccountInfo), [tlsAccountInfo])
  const auditPhaseIndex =
    auditDialog.status === "running"
      ? Math.min(auditDialog.phaseIndex ?? 0, AUDIT_PROGRESS_STEPS.length - 2)
      : AUDIT_PROGRESS_STEPS.length - 1

  useEffect(() => {
    if (!auditDialog.open || auditDialog.status !== "running") return

    const timers = [
      window.setTimeout(() => {
        setAuditDialog((prev) => (prev.open && prev.status === "running" ? { ...prev, phaseIndex: 1 } : prev))
      }, 250),
      window.setTimeout(() => {
        setAuditDialog((prev) => (prev.open && prev.status === "running" ? { ...prev, phaseIndex: 2 } : prev))
      }, 700),
    ]

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [auditDialog.open, auditDialog.status, setAuditDialog])

  const loadDetail = useCallback(async () => {
    const cached = readClientCache<ApplicantDetailResponse>(detailCacheKey)
    if (cached) {
      applyDetailPayload(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    try {
      const response = await fetch(`/api/applicants/${applicantId}`, { cache: "no-store" })
      const data = (await readJsonSafely<ApplicantDetailResponse & { error?: string }>(response)) ?? null
      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "加载申请人详情失败")
      }

      primeApplicantDetailCache(data)
      applyDetailPayload(data)
    } catch (error) {
      if (!cached) {
        setMessage(error instanceof Error ? error.message : "加载申请人详情失败")
      }
    } finally {
      setLoading(false)
    }
  }, [applicantId, applyDetailPayload, detailCacheKey, primeApplicantDetailCache, setLoading, setMessage])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    setCaseForm(buildCaseForm(selectedCase))
  }, [selectedCase, setCaseForm])

  useEffect(() => {
    if (caseForm.caseType !== "france-schengen") return
    if (caseForm.tlsCity) return
    if (!basicForm.schengenVisaCity) return
    setCaseForm((prev) => {
      if (prev.caseType !== "france-schengen" || prev.tlsCity) return prev
      return { ...prev, tlsCity: basicForm.schengenVisaCity }
    })
  }, [basicForm.schengenVisaCity, caseForm.caseType, caseForm.tlsCity, setCaseForm])

  useEffect(() => {
    if (!detail?.profile.id) return
    persistSelectedApplicantCase(detail.profile.id, selectedCaseId)
  }, [detail?.profile.id, selectedCaseId])

  const saveProfile = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能修改申请人信息")
      return
    }
    setSavingProfile(true)
    setMessage("")

    try {
      const response = await fetch(`/api/applicants/${applicantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: basicForm.name,
          phone: basicForm.phone,
          email: basicForm.email,
          wechat: basicForm.wechat,
          passportNumber: basicForm.passportNumber,
          note: basicForm.note,
          usVisa: {
            surname: basicForm.usVisaSurname,
            birthYear: basicForm.usVisaBirthYear,
            passportNumber: basicForm.usVisaPassportNumber,
          },
          schengen: {
            country: basicForm.schengenCountry,
            city: basicForm.schengenVisaCity,
          },
        }),
      })

      const data = await readJsonSafely<{ profile?: ApplicantProfileDetail; error?: string }>(response)
      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "保存申请人失败")
      }

      const nextDetail = detail ? { ...detail, profile: data.profile } : null
      if (nextDetail) {
        setDetail(nextDetail)
        primeApplicantDetailCache(nextDetail)
      }
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
      setBasicForm(buildBasicForm(data.profile))
      setMessage("申请人信息已更新")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存申请人失败")
    } finally {
      setSavingProfile(false)
    }
  }

  const copyTlsAccountTemplate = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("当前浏览器不支持自动复制")
      }
      await navigator.clipboard.writeText(tlsAccountTemplateText)
      setMessage("TLS 账号信息已复制到剪贴板")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "复制 TLS 账号信息失败")
    }
  }

  const deleteApplicant = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能删除申请人")
      return
    }
    if (!window.confirm("删除申请人后，对应材料和案件会一起删除，确定继续吗？")) return

    setDeletingApplicant(true)
    setMessage("")
    try {
      const response = await fetch(`/api/applicants/${applicantId}`, { method: "DELETE" })
      const data = await readJsonSafely<{ success?: boolean; error?: string }>(response)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "删除申请人失败")
      }
      invalidateApplicantCaches()
      router.push("/applicants")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除申请人失败")
    } finally {
      setDeletingApplicant(false)
    }
  }

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>, slot: string) => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能上传或覆盖材料")
      event.target.value = ""
      return
    }
    const file = event.target.files?.[0]
    if (!file) return

    const isSchengenExcelUpload = slot === "schengenExcel" || slot === "franceExcel"
    const isUsVisaExcelUpload =
      slot === "usVisaDs160Excel" || slot === "usVisaAisExcel" || slot === "ds160Excel" || slot === "aisExcel"
    setMessage("")
    try {
      if (isSchengenExcelUpload || isUsVisaExcelUpload) {
        setAuditDialog({
          open: true,
          title: isSchengenExcelUpload ? "申根 Excel 审核中" : "美签 Excel 审核中",
          status: "running",
          issues: [],
          scope: isSchengenExcelUpload ? "schengen" : "usVisa",
          slot,
          helperText: "",
          autoFixing: false,
          phaseIndex: 0,
        })
      }

      const formData = new FormData()
      formData.append(slot, file)
      const response = await fetch(`/api/applicants/${applicantId}/files`, {
        method: "POST",
        body: formData,
      })
      const data = await readJsonSafely<{
        profile?: ApplicantProfileDetail
        parsedUsVisaDetails?: {
          surname?: string
          givenName?: string
          birthYear?: string
          passportNumber?: string
          chineseName?: string
          telecodeSurname?: string
          telecodeGivenName?: string
        }
        parsedUsVisaFullIntake?: UsVisaIntakeLike
        parsedSchengenDetails?: { city?: string }
        schengenAudit?: {
          ok: boolean
          errors: Array<{ field: string; message: string; value?: string }>
        }
        usVisaAudit?: {
          ok: boolean
          errors: Array<{ field: string; message: string; value?: string }>
        }
        error?: string
      }>(response)

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "上传文件失败")
      }

      invalidateApplicantCaches()
      await loadDetail()

      const parsedFields = [
        ...collectDetectedUsVisaFieldLabels(data?.parsedUsVisaFullIntake, data?.parsedUsVisaDetails),
        data.parsedSchengenDetails?.city
          ? `TLS 递签城市：${getFranceTlsCityLabel(data.parsedSchengenDetails.city) || data.parsedSchengenDetails.city}`
          : "",
      ].filter(Boolean)

      setMessage(parsedFields.length > 0 ? `资料已上传，并自动识别 ${parsedFields.join("、")}` : "资料已上传")

      if (isSchengenExcelUpload) {
        const issues = data.schengenAudit?.errors || []
        const passed = Boolean(data.schengenAudit?.ok)
        setAuditDialog({
          open: true,
          title: passed ? "申根 Excel 审核通过" : "申根 Excel 审核失败",
          status: passed ? "success" : "error",
          issues: passed
            ? []
            : issues.length > 0
              ? issues
              : [{ field: "审核流程", message: "未获得有效审核结果，请重试上传。" }],
        })
        setAuditDialog((prev) => ({ ...prev, scope: "schengen", slot, helperText: "", autoFixing: false }))
      } else if (isUsVisaExcelUpload) {
        const issues = data.usVisaAudit?.errors || []
        const passed = Boolean(data.usVisaAudit?.ok)
        setAuditDialog({
          open: true,
          title: passed ? "美签 Excel 审核通过" : "美签 Excel 审核失败",
          status: passed ? "success" : "error",
          issues: passed
            ? []
            : issues.length > 0
              ? issues
              : [{ field: "审核流程", message: "未获得有效审核结果，请重试上传。" }],
        })
        setAuditDialog((prev) => ({
          ...prev,
          scope: "usVisa",
          slot,
          helperText: passed ? "" : "格式类问题可以先让系统帮你处理，剩下的再手动修改。",
          autoFixing: false,
        }))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传文件失败")
    } finally {
      event.target.value = ""
    }
  }

  const autoFixUsVisaAuditIssues = async () => {
    if (!canRunAutomation) {
      setMessage("当前角色不能触发自动化处理")
      return
    }
    if (auditDialog.scope !== "usVisa" || !auditDialog.slot || auditDialog.autoFixing) return

    setAuditDialog((prev) => ({
      ...prev,
      autoFixing: true,
      helperText: "正在处理可自动修复的格式问题，并回写到当前档案…",
    }))
    setMessage("")

    try {
      const response = await fetch(`/api/applicants/${applicantId}/files/${auditDialog.slot}/auto-fix-us-visa`, {
        method: "POST",
      })
      const data = await readJsonSafely<{
        profile?: ApplicantProfileDetail
        changed?: boolean
        fixedCount?: number
        changes?: Array<{ field: string; before: string; after: string }>
        usVisaAudit?: {
          ok: boolean
          errors: Array<{ field: string; message: string; value?: string }>
        }
        error?: string
      }>(response)

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "自动处理格式问题失败")
      }

      invalidateApplicantCaches()
      await loadDetail()

      const fixedCount = data.fixedCount || 0
      const passed = Boolean(data.usVisaAudit?.ok)
      const issues = data.usVisaAudit?.errors || []
      const helperText =
        fixedCount > 0
          ? passed
            ? `已自动处理 ${fixedCount} 处格式问题，当前这份美签 Excel 已通过审核。`
            : `已自动处理 ${fixedCount} 处格式问题，剩余问题请你手动修改。`
          : "这份 Excel 里没有检测到可自动处理的格式问题，请手动修改剩余内容。"

      setAuditDialog({
        open: true,
        title: passed ? "美签 Excel 审核通过" : "美签 Excel 审核失败",
        status: passed ? "success" : "error",
        issues: passed
          ? []
          : issues.length > 0
            ? issues
            : [{ field: "审核流程", message: "未获得有效审核结果，请重试上传。" }],
        scope: "usVisa",
        slot: auditDialog.slot,
        helperText,
        autoFixing: false,
      })

      if (fixedCount > 0) {
        setMessage(passed ? `已自动处理 ${fixedCount} 处格式问题并保存到档案` : `已自动处理 ${fixedCount} 处格式问题`)
      }
    } catch (error) {
      setAuditDialog((prev) => ({
        ...prev,
        autoFixing: false,
        helperText: error instanceof Error ? error.message : "自动处理格式问题失败",
      }))
    }
  }

  const closePreview = () => {
    setPreview((prev) => {
      if (prev.objectUrl.startsWith("blob:")) URL.revokeObjectURL(prev.objectUrl)
      return emptyPreview
    })
  }

  const selectExcelSheet = (sheetName: string) => {
    setPreview((prev) => {
      const targetSheet = prev.excelSheets.find((sheet) => sheet.name === sheetName)
      if (!targetSheet) return prev
      if (targetSheet.rows) {
        return {
          ...prev,
          activeExcelSheet: sheetName,
          tableRows: cloneTableRows(targetSheet.rows),
        }
      }
      if (!prev.workbookArrayBuffer) return prev
      const wb = read(prev.workbookArrayBuffer, { type: "array", cellDates: true, cellNF: true, cellText: true })
      const rows = extractExcelSheetRows(wb.Sheets[sheetName])
      return {
        ...prev,
        activeExcelSheet: sheetName,
        excelSheets: prev.excelSheets.map((sheet) => (sheet.name === sheetName ? { ...sheet, rows } : sheet)),
        tableRows: cloneTableRows(rows),
      }
    })
  }

  const setExcelCell = (rowIndex: number, colIndex: number, value: string) => {
    setPreview((prev) => {
      if (prev.kind !== "excel") return prev
      const sheetIndex = prev.excelSheets.findIndex((s) => s.name === prev.activeExcelSheet)
      if (sheetIndex < 0) return prev
      const nextSheets = prev.excelSheets.map((s) => ({
        ...s,
        rows: s.rows ? cloneTableRows(s.rows) : undefined,
      }))
      const rows = nextSheets[sheetIndex].rows ? cloneTableRows(nextSheets[sheetIndex].rows) : cloneTableRows(prev.tableRows)
      while (rows.length <= rowIndex) {
        rows.push([])
      }
      const row = [...rows[rowIndex]]
      while (row.length <= colIndex) {
        row.push("")
      }
      row[colIndex] = value
      rows[rowIndex] = row
      nextSheets[sheetIndex] = { ...nextSheets[sheetIndex], rows }
      return {
        ...prev,
        excelSheets: nextSheets,
        tableRows: cloneTableRows(rows),
        excelDirty: true,
      }
    })
  }

  const cancelExcelEdit = () => {
    setPreview((prev) => {
      if (prev.kind !== "excel" || !prev.workbookArrayBuffer) {
        return { ...prev, excelEditMode: false, excelDirty: false }
      }
      const wb = read(prev.workbookArrayBuffer, { type: "array", cellDates: true, cellNF: true, cellText: true })
      const activeSheetName = prev.activeExcelSheet || wb.SheetNames[0] || ""
      const activeRows = activeSheetName ? extractExcelSheetRows(wb.Sheets[activeSheetName]) : []
      return {
        ...prev,
        excelSheets: wb.SheetNames.map((sheetName) => ({
          name: sheetName,
          rows: sheetName === activeSheetName ? activeRows : undefined,
        })),
        tableRows: cloneTableRows(activeRows),
        excelEditMode: false,
        excelDirty: false,
        excelUsVisaSections: prev.excelUsVisaSections.length > 0 ? parseUsVisaExcelPreviewSections(activeRows) : prev.excelUsVisaSections,
      }
    })
  }

  const saveExcelFromPreview = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能回写 Excel 到档案")
      return
    }
    const snap = preview
    if (snap.kind !== "excel" || !snap.workbookArrayBuffer || !snap.excelSlot) return
    const slot = snap.excelSlot
    const passed = true
    setPreview((p) => ({ ...p, excelSaving: true, excelSavingStatus: "正在整理 Excel…" }))
    setMessage("")
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const wb = read(snap.workbookArrayBuffer, { type: "array" })
      for (const sh of snap.excelSheets) {
        if (!sh.rows) continue
        wb.Sheets[sh.name] = utils.aoa_to_sheet(sh.rows)
        setAuditDialog((prev) => ({
          ...prev,
          scope: "usVisa",
          slot,
          helperText: passed ? "" : "格式类问题可以先让系统帮你处理，剩下的再手动修改。",
          autoFixing: false,
        }))
      }
      const out = write(wb, { bookType: "xlsx", type: "array" })
      const u8 = out instanceof Uint8Array ? out : new Uint8Array(out)
      setPreview((p) => ({ ...p, excelSaving: true, excelSavingStatus: "正在上传到档案…" }))
      const name =
        snap.excelOriginalName ||
        snap.title ||
        `${snap.excelSlot}.xlsx`
      const response = await fetch(`/api/applicants/${applicantId}/files/${snap.excelSlot}`, {
        method: "PUT",
        body: u8,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "x-excel-original-name": encodeURIComponent(/\.xlsx$/i.test(name) ? name : name.replace(/\.xls$/i, ".xlsx")),
        },
      })
      const data = await readJsonSafely<{ profile?: ApplicantProfileDetail; error?: string }>(response)
      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "保存失败")
      }
      const nextDetail = detail ? { ...detail, profile: data.profile } : null
      if (nextDetail) {
        setDetail(nextDetail)
        primeApplicantDetailCache(nextDetail)
      } else {
        invalidateApplicantCaches()
      }
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
      setMessage("Excel 已保存到档案")
      const nextBuf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
      setPreview((p) =>
        p.kind === "excel" && p.excelSlot === snap.excelSlot
          ? {
              ...p,
              excelSheets: snap.excelSheets.map((sheet) => ({
                ...sheet,
                rows: sheet.rows ? cloneTableRows(sheet.rows) : undefined,
              })),
              workbookArrayBuffer: nextBuf,
              excelDirty: false,
              excelSaving: false,
              excelSavingStatus: "",
              excelEditMode: false,
              excelUsVisaSections:
                p.excelUsVisaSections.length > 0
                  ? parseUsVisaExcelPreviewSections(
                      snap.excelSheets.find((sheet) => sheet.name === snap.activeExcelSheet)?.rows || snap.tableRows,
                    )
                  : p.excelUsVisaSections,
            }
          : { ...p, excelSaving: false },
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
      setPreview((p) => ({ ...p, excelSaving: false, excelSavingStatus: "" }))
    }
  }

  const openPreview = async (slot: string, meta: { originalName: string; uploadedAt: string }) => {
    setPreview({
      ...emptyPreview,
      open: true,
      loading: true,
      title: meta.originalName || slot,
    })

    try {
      const fileHref = `/api/applicants/${applicantId}/files/${slot}`
      const filename = (meta.originalName || slot).toLowerCase()
      if (filename.endsWith(".pdf")) {
        setPreview((prev) => ({ ...prev, loading: false, kind: "pdf", objectUrl: fileHref }))
        return
      }
      const response = await fetch(fileHref, { credentials: "include" })
      if (!response.ok) throw new Error("读取文件失败")

      const blob = await response.blob()
      const mime = (blob.type || "").toLowerCase()
      const objectUrl = URL.createObjectURL(blob)

      if (mime.includes("pdf")) {
        setPreview((prev) => ({ ...prev, loading: false, kind: "pdf", objectUrl }))
        return
      }

      if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filename)) {
        setPreview((prev) => ({ ...prev, loading: false, kind: "image", objectUrl }))
        return
      }

      if (/\.(xlsx|xls)$/.test(filename) || mime.includes("spreadsheet") || mime.includes("excel")) {
        const arrayBuffer = await blob.arrayBuffer()
        const workbook = read(arrayBuffer, { type: "array", cellDates: true, cellNF: true, cellText: true })
        const isUsVisaExcelPreview = US_VISA_EXCEL_PREVIEW_SLOTS.has(slot)
        const firstSheetName = isUsVisaExcelPreview
          ? workbook.SheetNames.find((sheetName) => /^sheet1$/i.test(sheetName)) || workbook.SheetNames[0] || ""
          : workbook.SheetNames[0] || ""
        const firstRows = firstSheetName ? extractExcelSheetRows(workbook.Sheets[firstSheetName]) : []
        const excelSheets = isUsVisaExcelPreview
          ? firstSheetName
            ? [{ name: firstSheetName, rows: firstRows }]
            : []
          : workbook.SheetNames.map((sheetName) => ({
              name: sheetName,
              rows: sheetName === firstSheetName ? firstRows : undefined,
            }))
        const excelUsVisaSections = isUsVisaExcelPreview ? parseUsVisaExcelPreviewSections(firstRows) : []
        URL.revokeObjectURL(objectUrl)
        setPreview((prev) => ({
          ...prev,
          loading: false,
          kind: "excel",
          excelSheets,
          activeExcelSheet: firstSheetName,
          tableRows: cloneTableRows(firstRows),
          excelSlot: slot,
          excelOriginalName: meta.originalName || "",
          workbookArrayBuffer: arrayBuffer.slice(0),
          excelEditMode: false,
          excelDirty: false,
          excelSaving: false,
          excelPreviewMode: excelUsVisaSections.length > 0 ? "form" : "table",
          excelUsVisaSections,
        }))
        return
      }

      if (/\.(docx?|rtf)$/.test(filename) || mime.includes("word")) {
        const arrayBuffer = await blob.arrayBuffer()
        try {
          const mammoth = (await import("mammoth")) as unknown as {
            convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
            extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
          }
          const html = await mammoth.convertToHtml({ arrayBuffer })
          URL.revokeObjectURL(objectUrl)
          setPreview((prev) => ({ ...prev, loading: false, kind: "word", htmlContent: html.value || "" }))
          return
        } catch {
          const mammoth = (await import("mammoth")) as unknown as {
            extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
          }
          const text = await mammoth.extractRawText({ arrayBuffer })
          URL.revokeObjectURL(objectUrl)
          setPreview((prev) => ({ ...prev, loading: false, kind: "text", textContent: text.value || "" }))
          return
        }
      }

      if (mime.includes("json") || mime.startsWith("text/") || /\.(json|txt|csv|md)$/i.test(filename)) {
        const text = await blob.text()
        URL.revokeObjectURL(objectUrl)
        setPreview((prev) => ({ ...prev, loading: false, kind: "text", textContent: text }))
        return
      }

      setPreview((prev) => ({
        ...prev,
        loading: false,
        kind: "unknown",
        objectUrl,
        error: "当前格式暂不支持内嵌预览，请直接下载查看。",
      }))
    } catch (error) {
      setPreview((prev) => ({
        ...prev,
        loading: false,
        kind: "unknown",
        error: error instanceof Error ? error.message : "预览失败",
      }))
    }
  }

  const saveCase = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能修改 Case")
      return
    }
    if (!selectedCaseId) {
      setMessage("请先选择一个 Case")
      return
    }

    setSavingCase(true)
    setMessage("")
    try {
      const response = await fetch(`/api/cases/${selectedCaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseForm),
      })
      const data = await readJsonSafely<{ case?: VisaCaseRecord; error?: string }>(response)
      if (!response.ok || !data?.case) {
        throw new Error(data?.error || "保存案件失败")
      }

      invalidateApplicantCaches()
      await loadDetail()
      setSelectedCaseId(data.case.id)
      setMessage("案件信息已更新")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存案件失败")
    } finally {
      setSavingCase(false)
    }
  }

  const createCase = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能创建 Case")
      return
    }
    setCreatingCase(true)
    setMessage("")

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantProfileId: applicantId,
          ...newCaseForm,
        }),
      })
      const data = await readJsonSafely<{ case?: VisaCaseRecord; error?: string }>(response)
      if (!response.ok || !data?.case) {
        throw new Error(data?.error || "创建案件失败")
      }

      invalidateApplicantCaches()
      await loadDetail()
      setSelectedCaseId(data.case.id)
      setCreateCaseOpen(false)
      setNewCaseForm(emptyCaseForm)
      setMessage("新案件已创建")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建案件失败")
    } finally {
      setCreatingCase(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  if (!detail?.profile) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
        <Card className="w-full border-gray-200 bg-white/90">
          <CardContent className="space-y-4 p-8 text-center">
            <div className="text-lg font-semibold text-gray-900">申请人详情加载失败</div>
            <div className="text-sm text-gray-500">{message || "当前申请人不存在，或你没有访问权限。"}</div>
            <Button asChild>
              <Link href="/applicants">返回申请人列表</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const files = detail.profile.files || {}
  const usVisaIntakePhotoSlot = files.usVisaPhoto ? "usVisaPhoto" : files.photo ? "photo" : undefined

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" asChild className="px-0 text-gray-500 hover:text-gray-900">
              <Link href="/applicants">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回申请人列表
              </Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-gray-900">{detail.profile.name || detail.profile.label}</h1>
                <Badge variant={isReadOnlyViewer ? "outline" : "secondary"}>{getAppRoleLabel(normalizedViewerRole)}</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                CRM 详情页统一管理申请人基础信息、Case、材料文档、法签进度与提醒日志。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadDetail()}>
              刷新详情
            </Button>
            <Button variant="destructive" onClick={() => void deleteApplicant()} disabled={deletingApplicant || !canEditApplicant}>
              <Trash2 className="mr-2 h-4 w-4" />
              {deletingApplicant ? "删除中..." : "删除申请人"}
            </Button>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        <Tabs key={defaultTab} defaultValue={defaultTab} className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur">
            <TabsTrigger
              value="basic"
              className="h-11 w-full rounded-xl border border-transparent bg-transparent text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 data-[state=active]:!border-slate-300 data-[state=active]:!bg-white data-[state=active]:!text-slate-900 data-[state=active]:shadow-sm"
            >
              基本信息
            </TabsTrigger>
            <TabsTrigger
              value="cases"
              className="h-11 w-full rounded-xl border border-transparent bg-transparent text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 data-[state=active]:!border-slate-300 data-[state=active]:!bg-white data-[state=active]:!text-slate-900 data-[state=active]:shadow-sm"
            >
              签证 Case
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="h-11 w-full rounded-xl border border-transparent bg-transparent text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 data-[state=active]:!border-slate-300 data-[state=active]:!bg-white data-[state=active]:!text-slate-900 data-[state=active]:shadow-sm"
            >
              材料文档
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              className="h-11 w-full rounded-xl border border-transparent bg-transparent text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 data-[state=active]:!border-slate-300 data-[state=active]:!bg-white data-[state=active]:!text-slate-900 data-[state=active]:shadow-sm"
            >
              进度与日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Section title="CRM 基本信息" description="申请人主实体信息，后续搜索和 CRM 列表会优先使用这里的字段。" tone="slate">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="申请人姓名" value={basicForm.name} onChange={(value) => setBasicForm((prev) => ({ ...prev, name: value }))} disabled={isReadOnlyViewer} />
                <Field label="手机号" value={basicForm.phone} onChange={(value) => setBasicForm((prev) => ({ ...prev, phone: value }))} disabled={isReadOnlyViewer} />
                <Field label="邮箱" value={basicForm.email} onChange={(value) => setBasicForm((prev) => ({ ...prev, email: value }))} disabled={isReadOnlyViewer} />
                <Field label="微信" value={basicForm.wechat} onChange={(value) => setBasicForm((prev) => ({ ...prev, wechat: value }))} disabled={isReadOnlyViewer} />
                <Field
                  label="通用护照号"
                  value={basicForm.passportNumber}
                  onChange={(value) => setBasicForm((prev) => ({ ...prev, passportNumber: value }))}
                  disabled={isReadOnlyViewer}
                />
                <ReadOnlyField label="护照尾号" value={detail.profile.passportLast4 || "-"} />
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  rows={4}
                  value={basicForm.note}
                  onChange={(event) => setBasicForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="记录客户沟通、特殊说明或内部备注"
                  disabled={isReadOnlyViewer}
                />
              </div>
            </Section>

            <Section title="美签基础信息" description="这块会继续为 DS-160、AIS 注册和提交 DS-160 提供复用信息。" tone="sky">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ReadOnlyField label="AA 码" value={detail.profile.usVisa?.aaCode || "仅 DS-160 成功后自动回写"} />
                <Field
                  label="姓"
                  value={basicForm.usVisaSurname}
                  onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaSurname: value }))}
                  disabled={isReadOnlyViewer}
                />
                <Field
                  label="出生年份"
                  value={basicForm.usVisaBirthYear}
                  onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaBirthYear: value }))}
                  disabled={isReadOnlyViewer}
                />
                <Field
                  label="美签护照号"
                  value={basicForm.usVisaPassportNumber}
                  onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaPassportNumber: value }))}
                  disabled={isReadOnlyViewer}
                />
              </div>
              <ParsedIntakeAccordion
                applicantId={detail.profile.id}
                title="完整美签 intake"
                subtitle="展开后直接查看 Excel 已提取的完整个人信息、审计结果和照片。"
                tone="sky"
                intake={detail.profile.usVisa?.fullIntake}
                photoSlot={usVisaIntakePhotoSlot}
                photoLabel="美签照片"
                emptyMessage="还没有可用的美签 intake。先上传 DS-160 / AIS Excel，系统会自动解析并在这里沉淀完整结构化信息。"
              />
            </Section>

            <Section title="申根基础信息" description="申根国家和 TLS 递签城市会同时影响法签自动化和解释信默认值。" tone="emerald">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>申根国家</Label>
                  <Select
                    disabled={isReadOnlyViewer}
                    value={basicForm.schengenCountry || "france"}
                    onValueChange={(value) => setBasicForm((prev) => ({ ...prev, schengenCountry: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择国家" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="france">法国</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>TLS 递签城市</Label>
                  <Select
                    disabled={isReadOnlyViewer}
                    value={basicForm.schengenVisaCity || "__unset__"}
                    onValueChange={(value) =>
                      setBasicForm((prev) => ({
                        ...prev,
                        schengenVisaCity: value === "__unset__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="上传申根 Excel 后可自动匹配" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unset__">未设置</SelectItem>
                      {FRANCE_TLS_CITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.value} - {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ReadOnlyField
                  label="FRA Number"
                  value={detail.profile.schengen?.fraNumber || "-"}
                />
              </div>
              <div className="space-y-4 rounded-2xl border border-emerald-200/80 bg-white/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-emerald-950">TLS 账号信息</div>
                    <div className="text-sm text-emerald-700/80">按申根法签内容生成，直接复制给客户即可。</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => void copyTlsAccountTemplate()}
                  >
                    一键复制
                  </Button>
                </div>
                <Textarea
                  value={tlsAccountTemplateText}
                  readOnly
                  rows={12}
                  className="min-h-[320px] whitespace-pre-wrap border-emerald-200 bg-emerald-50/40 font-mono text-sm leading-7 text-emerald-950"
                />
              </div>
              <ParsedIntakeAccordion
                applicantId={detail.profile.id}
                title="完整申根 intake"
                subtitle="展开后直接查看申根 Excel 的完整结构化结果和审计提示，不再需要手动翻原表。"
                tone="emerald"
                intake={detail.profile.schengen?.fullIntake}
                emptyMessage="还没有可用的申根 intake。上传申根 Excel 后，这里会自动出现完整结构化信息。"
              />
            </Section>

            <div className="flex justify-end">
              <Button onClick={() => void saveProfile()} disabled={savingProfile || !canEditApplicant} className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
                <Save className="mr-2 h-4 w-4" />
                {savingProfile ? "保存中..." : "保存申请人"}
              </Button>
            </div>
        </TabsContent>

        <CasesTabContent
          cases={detail.cases}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={setSelectedCaseId}
          selectedCase={selectedCase}
          caseForm={caseForm}
          setCaseForm={setCaseForm}
          availableAssignees={detail.availableAssignees}
          isReadOnlyViewer={isReadOnlyViewer}
          canAssignCase={canAssignCase}
          canEditApplicant={canEditApplicant}
          savingCase={savingCase}
          onOpenCreateCase={() => setCreateCaseOpen(true)}
          onSaveCase={saveCase}
        />

          <MaterialsTab
            applicantId={applicantId}
            applicantProfileId={detail.profile.id}
            selectedCaseId={selectedCase?.id}
            files={files}
            canEditApplicant={canEditApplicant}
            canRunAutomation={canRunAutomation}
            onUpload={uploadFiles}
            onPreview={openPreview}
          />

          <ProgressTab
            applicantProfileId={detail.profile.id}
            applicantName={detail.profile.name || detail.profile.label}
            selectedCase={selectedCase}
          />
        </Tabs>
      </div>

      <CreateCaseDialog
        open={createCaseOpen}
        onOpenChange={setCreateCaseOpen}
        detail={detail}
        newCaseForm={newCaseForm}
        setNewCaseForm={setNewCaseForm}
        isReadOnlyViewer={isReadOnlyViewer}
        canAssignCase={canAssignCase}
        canEditApplicant={canEditApplicant}
        creatingCase={creatingCase}
        onCreateCase={createCase}
      />

      <MaterialPreviewDialog
        preview={preview}
        canEditApplicant={canEditApplicant}
        onClose={closePreview}
        onSelectExcelPreviewMode={(mode) => setPreview((prev) => ({ ...prev, excelPreviewMode: mode }))}
        onEnableExcelEdit={() =>
          setPreview((prev) => ({
            ...prev,
            excelEditMode: true,
            excelPreviewMode: "table",
          }))
        }
        onSaveExcelFromPreview={saveExcelFromPreview}
        onCancelExcelEdit={cancelExcelEdit}
        onSelectExcelSheet={selectExcelSheet}
        onSetExcelCell={setExcelCell}
        excelColumnMinWidthClass={excelColumnMinWidthClass}
      />

      <AuditDialog
        auditDialog={auditDialog}
        auditProgressSteps={AUDIT_PROGRESS_STEPS}
        auditPhaseIndex={auditPhaseIndex}
        canRunAutomation={canRunAutomation}
        onClose={() => setAuditDialog(emptyAuditDialog)}
        onAutoFix={autoFixUsVisaAuditIssues}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} readOnly className="bg-gray-50" />
    </div>
  )
}

function excelColumnMinWidthClass(cellIndex: number) {
  if (cellIndex === 0) return "min-w-[min(22rem,34vw)]"
  if (cellIndex === 1) return "min-w-[min(15rem,24vw)]"
  if (cellIndex === 2) return "min-w-[min(12rem,20vw)]"
  return "min-w-[7rem]"
}

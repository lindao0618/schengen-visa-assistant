"use client"

/* eslint-disable @next/next/no-img-element */

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, FileText, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { read, utils, write } from "xlsx"

import { FranceCaseProgressCard } from "@/components/france-case-progress-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ACTIVE_APPLICANT_CASE_KEY, ACTIVE_APPLICANT_PROFILE_KEY } from "@/components/applicant-profile-selector"
import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
  deriveApplicantCaseTypeFromVisaType,
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { formatFranceStatusLabel } from "@/lib/france-case-labels"
import { FRANCE_TLS_CITY_OPTIONS, getFranceTlsCityLabel } from "@/lib/france-tls-city"
import { cn } from "@/lib/utils"

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
  }
  schengen?: {
    country?: string
    city?: string
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
  rows: string[][]
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
}

type AuditDialogState = {
  open: boolean
  title: string
  status: "running" | "success" | "error"
  issues: Array<{ field: string; message: string; value?: string }>
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
}

const emptyAuditDialog: AuditDialogState = {
  open: false,
  title: "",
  status: "running",
  issues: [],
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

const SLOT_TIME_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 30
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const hh = String(hour).padStart(2, "0")
  const mm = String(minute).padStart(2, "0")
  const value = `${hh}:${mm}`
  return { value, label: value }
})

function normalizeSlashDate(value: string) {
  return value.replace(/\./g, "/").replace(/-/g, "/").trim()
}

function toInputDate(value: string) {
  const normalized = normalizeSlashDate(value)
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return ""
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function fromInputDate(value: string) {
  if (!value) return ""
  return value.replace(/-/g, "/")
}

function splitBookingWindow(value?: string | null) {
  const raw = (value || "").trim()
  if (!raw) return { start: "", end: "" }
  const compact = raw.replace(/\s+/g, " ")
  const exact = compact.match(
    /(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\s*(?:-|~|至|到|—|–)\s*(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/,
  )
  if (exact) {
    return { start: toInputDate(exact[1]), end: toInputDate(exact[2]) }
  }

  const hits = compact.match(/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/g) || []
  return {
    start: hits[0] ? toInputDate(hits[0]) : "",
    end: hits[1] ? toInputDate(hits[1]) : "",
  }
}

function mergeBookingWindow(start: string, end: string) {
  const startText = fromInputDate(start)
  const endText = fromInputDate(end)
  if (startText && endText) return `${startText} - ${endText}`
  if (startText) return startText
  if (endText) return endText
  return ""
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

const usVisaUploadedSlots = [
  { key: "usVisaPhoto", label: "美签照片", accept: "image/*" },
  { key: "usVisaDs160Excel", label: "DS-160 / AIS Excel", accept: ".xlsx,.xls" },
] as const

const usVisaSubmissionSlots = [
  { key: "usVisaDs160ConfirmationPdf", label: "DS-160 确认页 PDF", accept: ".pdf,application/pdf" },
  { key: "usVisaDs160PrecheckJson", label: "DS-160 预检查 JSON", accept: ".json,application/json" },
] as const

const usVisaInterviewBriefSlots = [
  { key: "usVisaInterviewBriefPdf", label: "面试必看 PDF", accept: ".pdf,application/pdf" },
  { key: "usVisaInterviewBriefDocx", label: "面试必看 Word", accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
] as const

const schengenUploadedSlots = [
  { key: "schengenPhoto", label: "申根照片", accept: "image/*" },
  { key: "schengenExcel", label: "申根 Excel", accept: ".xlsx,.xls" },
  { key: "passportScan", label: "护照扫描件", accept: "image/*,.pdf,application/pdf" },
] as const

const schengenSubmissionSlots = [
  { key: "franceTlsAccountsJson", label: "TLS 注册 accounts JSON", accept: ".json,application/json" },
  { key: "franceApplicationJson", label: "法国新申请 JSON", accept: ".json,application/json" },
  { key: "franceReceiptPdf", label: "法国回执单 PDF", accept: ".pdf,application/pdf" },
  { key: "franceFinalSubmissionPdf", label: "法国最终表 PDF", accept: ".pdf,application/pdf" },
] as const

const schengenMaterialDocumentSlots = [
  { key: "schengenItineraryPdf", label: "行程单 PDF", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterCnPdf", label: "解释信 PDF（中文）", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterEnPdf", label: "解释信 PDF（英文）", accept: ".pdf,application/pdf" },
  { key: "schengenHotelReservation", label: "酒店预订单材料", accept: ".pdf,.doc,.docx,image/*" },
  { key: "schengenFlightReservation", label: "机票/车票预订单材料", accept: ".pdf,.doc,.docx,image/*" },
] as const

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

function getPriorityLabel(value?: string | null) {
  if (!value) return "-"
  if (value === "urgent") return "紧急"
  if (value === "high") return "高优先级"
  return "普通"
}

function getPriorityVariant(value?: string | null) {
  if (value === "urgent") return "destructive" as const
  if (value === "high") return "warning" as const
  return "outline" as const
}

function getSendStatusBadge(status?: string | null) {
  if (status === "sent") return "success" as const
  if (status === "failed") return "destructive" as const
  if (status === "processing") return "info" as const
  return "outline" as const
}

function formatCaseStatus(mainStatus?: string | null, subStatus?: string | null, caseType?: string | null) {
  if (caseType === "france-schengen") {
    return formatFranceStatusLabel(mainStatus, subStatus)
  }
  return `${mainStatus || "-"}${subStatus ? ` / ${subStatus}` : ""}`
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

function UploadGrid({
  applicantId,
  files,
  slots,
  onUpload,
  onPreview,
  emptyMessage = "当前还没有材料。",
  tone = "slate",
}: {
  applicantId: string
  files: Record<string, { originalName: string; uploadedAt: string }>
  slots: readonly { key: string; label: string; accept: string }[]
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: { originalName: string; uploadedAt: string }) => Promise<void>
  emptyMessage?: string
  tone?: "slate" | "sky" | "emerald" | "amber"
}) {
  const toneMap = {
    slate: {
      card: "border-slate-200 bg-white",
      title: "text-slate-900",
      meta: "text-slate-500",
      empty: "text-slate-400",
      preview: "text-sky-700",
      download: "text-slate-700",
    },
    sky: {
      card: "border-sky-200 bg-sky-50/50",
      title: "text-sky-950",
      meta: "text-sky-800/70",
      empty: "text-sky-700/50",
      preview: "text-sky-700",
      download: "text-sky-900",
    },
    emerald: {
      card: "border-emerald-200 bg-emerald-50/50",
      title: "text-emerald-950",
      meta: "text-emerald-800/70",
      empty: "text-emerald-700/50",
      preview: "text-emerald-700",
      download: "text-emerald-900",
    },
    amber: {
      card: "border-amber-200 bg-amber-50/50",
      title: "text-amber-950",
      meta: "text-amber-900/70",
      empty: "text-amber-700/50",
      preview: "text-amber-700",
      download: "text-amber-900",
    },
  } as const
  const styles = toneMap[tone]

  if (!slots.length) {
    return <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">{emptyMessage}</div>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((slot) => {
        const meta = files[slot.key]
        const canPreview = Boolean(meta && !/\.docx?$/i.test(meta.originalName))
        return (
          <div key={slot.key} className={cn("rounded-2xl border p-4 shadow-sm transition", styles.card)}>
            <div className={cn("mb-2 text-base font-semibold", styles.title)}>{slot.label}</div>
            <Input type="file" accept={slot.accept} onChange={(event) => void onUpload(event, slot.key)} className="bg-white/90" />
            {meta ? (
              <div className={cn("mt-3 space-y-1 text-xs", styles.meta)}>
                <div className="truncate text-sm font-medium">{meta.originalName}</div>
                <div>{formatDateTime(meta.uploadedAt)}</div>
                <div className="flex items-center gap-3">
                  {canPreview ? (
                    <button
                      type="button"
                      className={cn("font-medium hover:underline", styles.preview)}
                      onClick={() => void onPreview(slot.key, meta)}
                    >
                      预览
                    </button>
                  ) : null}
                  <a
                    className={cn("font-medium hover:underline", styles.download)}
                    href={`/api/applicants/${applicantId}/files/${slot.key}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    下载
                  </a>
                </div>
              </div>
            ) : (
              <div className={cn("mt-3 text-xs", styles.empty)}>暂未上传</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ApplicantDetailClientPage({ applicantId }: { applicantId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingCase, setSavingCase] = useState(false)
  const [deletingApplicant, setDeletingApplicant] = useState(false)
  const [creatingCase, setCreatingCase] = useState(false)
  const [detail, setDetail] = useState<ApplicantDetailResponse | null>(null)
  const [basicForm, setBasicForm] = useState<BasicFormState>(emptyBasicForm)
  const [selectedCaseId, setSelectedCaseId] = useState("")
  const [caseForm, setCaseForm] = useState<CaseFormState>(emptyCaseForm)
  const [createCaseOpen, setCreateCaseOpen] = useState(false)
  const [newCaseForm, setNewCaseForm] = useState<CaseFormState>(emptyCaseForm)
  const [preview, setPreview] = useState<PreviewState>(emptyPreview)
  const [auditDialog, setAuditDialog] = useState<AuditDialogState>(emptyAuditDialog)

  const selectedCase = useMemo(
    () => detail?.cases.find((item) => item.id === selectedCaseId) ?? null,
    [detail?.cases, selectedCaseId],
  )

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/applicants/${applicantId}`, { cache: "no-store" })
      const data = (await readJsonSafely<ApplicantDetailResponse & { error?: string }>(response)) ?? null
      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "加载申请人详情失败")
      }

      setDetail(data)
      setBasicForm(buildBasicForm(data.profile))
      const nextCaseId = data.activeCaseId || data.cases[0]?.id || ""
      setSelectedCaseId(nextCaseId)
      setCaseForm(buildCaseForm(data.cases.find((item) => item.id === nextCaseId) || null))
      persistSelectedApplicantCase(data.profile.id, nextCaseId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载申请人详情失败")
    } finally {
      setLoading(false)
    }
  }, [applicantId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    setCaseForm(buildCaseForm(selectedCase))
  }, [selectedCase])

  useEffect(() => {
    if (caseForm.caseType !== "france-schengen") return
    if (caseForm.tlsCity) return
    if (!basicForm.schengenVisaCity) return
    setCaseForm((prev) => {
      if (prev.caseType !== "france-schengen" || prev.tlsCity) return prev
      return { ...prev, tlsCity: basicForm.schengenVisaCity }
    })
  }, [basicForm.schengenVisaCity, caseForm.caseType, caseForm.tlsCity])

  useEffect(() => {
    if (!detail?.profile.id) return
    persistSelectedApplicantCase(detail.profile.id, selectedCaseId)
  }, [detail?.profile.id, selectedCaseId])

  const saveProfile = async () => {
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

      setDetail((prev) => (prev ? { ...prev, profile: data.profile! } : prev))
      setBasicForm(buildBasicForm(data.profile))
      setMessage("申请人信息已更新")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存申请人失败")
    } finally {
      setSavingProfile(false)
    }
  }

  const deleteApplicant = async () => {
    if (!window.confirm("删除申请人后，对应材料和案件会一起删除，确定继续吗？")) return

    setDeletingApplicant(true)
    setMessage("")
    try {
      const response = await fetch(`/api/applicants/${applicantId}`, { method: "DELETE" })
      const data = await readJsonSafely<{ success?: boolean; error?: string }>(response)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "删除申请人失败")
      }
      router.push("/applicants")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除申请人失败")
    } finally {
      setDeletingApplicant(false)
    }
  }

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>, slot: string) => {
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
        parsedUsVisaDetails?: { surname?: string; birthYear?: string; passportNumber?: string }
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

      await loadDetail()

      const parsedFields = [
        data.parsedUsVisaDetails?.surname ? "姓" : "",
        data.parsedUsVisaDetails?.birthYear ? "出生年份" : "",
        data.parsedUsVisaDetails?.passportNumber ? "护照号" : "",
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
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传文件失败")
    } finally {
      event.target.value = ""
    }
  }

  const closePreview = () => {
    setPreview((prev) => {
      if (prev.objectUrl) URL.revokeObjectURL(prev.objectUrl)
      return emptyPreview
    })
  }

  const selectExcelSheet = (sheetName: string) => {
    setPreview((prev) => {
      const targetSheet = prev.excelSheets.find((sheet) => sheet.name === sheetName)
      if (!targetSheet) return prev
      return {
        ...prev,
        activeExcelSheet: sheetName,
        tableRows: targetSheet.rows.map((row) => [...row]),
      }
    })
  }

  const setExcelCell = (rowIndex: number, colIndex: number, value: string) => {
    setPreview((prev) => {
      if (prev.kind !== "excel") return prev
      const sheetIndex = prev.excelSheets.findIndex((s) => s.name === prev.activeExcelSheet)
      if (sheetIndex < 0) return prev
      const nextSheets = prev.excelSheets.map((s) => ({ ...s, rows: s.rows.map((r) => [...r]) }))
      const rows = nextSheets[sheetIndex].rows
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
        tableRows: rows.map((r) => [...r]),
        excelDirty: true,
      }
    })
  }

  const cancelExcelEdit = () => {
    setPreview((prev) => {
      if (prev.kind !== "excel" || !prev.workbookArrayBuffer) {
        return { ...prev, excelEditMode: false, excelDirty: false }
      }
      const wb = read(prev.workbookArrayBuffer, { type: "array" })
      const excelSheets = wb.SheetNames.map((sheetName) => {
        const sheet = wb.Sheets[sheetName]
        const rows = sheet
          ? (utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][]).map((row) =>
              (row as unknown[]).map((cell) => String(cell ?? "")),
            )
          : []
        return { name: sheetName, rows }
      })
      const active = excelSheets.find((s) => s.name === prev.activeExcelSheet) || excelSheets[0]
      return {
        ...prev,
        excelSheets,
        tableRows: active?.rows.map((r) => [...r]) || [],
        excelEditMode: false,
        excelDirty: false,
      }
    })
  }

  const saveExcelFromPreview = async () => {
    const snap = preview
    if (snap.kind !== "excel" || !snap.workbookArrayBuffer || !snap.excelSlot) return
    setPreview((p) => ({ ...p, excelSaving: true }))
    setMessage("")
    try {
      const wb = read(snap.workbookArrayBuffer, { type: "array" })
      for (const sh of snap.excelSheets) {
        wb.Sheets[sh.name] = utils.aoa_to_sheet(sh.rows)
      }
      const out = write(wb, { bookType: "xlsx", type: "array" })
      const u8 = out instanceof Uint8Array ? out : new Uint8Array(out)
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
      setDetail((prev) => (prev ? { ...prev, profile: data.profile! } : prev))
      setMessage("Excel 已保存到档案")
      const nextBuf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
      setPreview((p) =>
        p.kind === "excel" && p.excelSlot === snap.excelSlot
          ? {
              ...p,
              workbookArrayBuffer: nextBuf,
              excelDirty: false,
              excelSaving: false,
              excelEditMode: false,
            }
          : { ...p, excelSaving: false },
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
      setPreview((p) => ({ ...p, excelSaving: false }))
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
      const response = await fetch(`/api/applicants/${applicantId}/files/${slot}`, { credentials: "include" })
      if (!response.ok) throw new Error("读取文件失败")

      const blob = await response.blob()
      const filename = (meta.originalName || slot).toLowerCase()
      const mime = (blob.type || "").toLowerCase()
      const objectUrl = URL.createObjectURL(blob)

      if (mime.includes("pdf") || filename.endsWith(".pdf")) {
        setPreview((prev) => ({ ...prev, loading: false, kind: "pdf", objectUrl }))
        return
      }

      if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filename)) {
        setPreview((prev) => ({ ...prev, loading: false, kind: "image", objectUrl }))
        return
      }

      if (/\.(xlsx|xls)$/.test(filename) || mime.includes("spreadsheet") || mime.includes("excel")) {
        const arrayBuffer = await blob.arrayBuffer()
        const workbook = read(arrayBuffer, { type: "array" })
        const excelSheets = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName]
          const rows = sheet
            ? (utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][]).map((row) =>
                (row as unknown[]).map((cell) => String(cell ?? "")),
              )
            : []
          return {
            name: sheetName,
            rows,
          }
        })
        const firstSheet = excelSheets[0]
        URL.revokeObjectURL(objectUrl)
        setPreview((prev) => ({
          ...prev,
          loading: false,
          kind: "excel",
          excelSheets,
          activeExcelSheet: firstSheet?.name || "",
          tableRows: (firstSheet?.rows || []).map((r) => [...r]),
          excelSlot: slot,
          excelOriginalName: meta.originalName || "",
          workbookArrayBuffer: arrayBuffer.slice(0),
          excelEditMode: false,
          excelDirty: false,
          excelSaving: false,
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
  const hasUsVisaInterviewSource = Boolean(
    files.usVisaDs160Excel || files.ds160Excel || files.usVisaAisExcel || files.aisExcel,
  )
  const interviewBriefHref = `/usa-visa?tab=interview-brief&applicantProfileId=${encodeURIComponent(detail.profile.id)}${
    selectedCase ? `&caseId=${encodeURIComponent(selectedCase.id)}` : ""
  }`

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
              <h1 className="text-3xl font-semibold text-gray-900">{detail.profile.name || detail.profile.label}</h1>
              <p className="mt-1 text-sm text-gray-500">
                CRM 详情页统一管理申请人基础信息、Case、材料文档、法签进度与提醒日志。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadDetail()}>
              刷新详情
            </Button>
            <Button variant="destructive" onClick={() => void deleteApplicant()} disabled={deletingApplicant}>
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

        <Tabs defaultValue="basic" className="space-y-5">
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
                <Field label="申请人姓名" value={basicForm.name} onChange={(value) => setBasicForm((prev) => ({ ...prev, name: value }))} />
                <Field label="手机号" value={basicForm.phone} onChange={(value) => setBasicForm((prev) => ({ ...prev, phone: value }))} />
                <Field label="邮箱" value={basicForm.email} onChange={(value) => setBasicForm((prev) => ({ ...prev, email: value }))} />
                <Field label="微信" value={basicForm.wechat} onChange={(value) => setBasicForm((prev) => ({ ...prev, wechat: value }))} />
                <Field
                  label="通用护照号"
                  value={basicForm.passportNumber}
                  onChange={(value) => setBasicForm((prev) => ({ ...prev, passportNumber: value }))}
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
                />
                <Field
                  label="出生年份"
                  value={basicForm.usVisaBirthYear}
                  onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaBirthYear: value }))}
                />
                <Field
                  label="美签护照号"
                  value={basicForm.usVisaPassportNumber}
                  onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaPassportNumber: value }))}
                />
              </div>
            </Section>

            <Section title="申根基础信息" description="申根国家和 TLS 递签城市会同时影响法签自动化和解释信默认值。" tone="emerald">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>申根国家</Label>
                  <Select
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
              </div>
            </Section>

            <div className="flex justify-end">
              <Button onClick={() => void saveProfile()} disabled={savingProfile} className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
                <Save className="mr-2 h-4 w-4" />
                {savingProfile ? "保存中..." : "保存申请人"}
              </Button>
            </div>
        </TabsContent>

        <TabsContent value="cases" className="space-y-6">
          {detail.cases.length > 0 ? (
            <Section
              title="案件切换"
              description="同一个申请人可同时办理多个签证案件，点击标签即可切换当前工作案件。"
              tone="amber"
            >
              <div className="flex flex-wrap gap-3">
                {detail.cases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCaseId(item.id)}
                    className={[
                      "rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-all",
                      selectedCaseId === item.id
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-amber-200 bg-white text-amber-900 hover:border-amber-300 hover:bg-amber-50",
                    ].join(" ")}
                  >
                    {getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}
                    {item.applyRegion ? ` · ${getApplicantCrmRegionLabel(item.applyRegion)}` : ""}
                  </button>
                ))}
              </div>
            </Section>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <Section title="Case 列表" description="一个申请人可以挂多个 Case。当前激活中的 France Case 会驱动法签自动化和提醒。" tone="amber">
                <div className="space-y-3">
                  <Button onClick={() => setCreateCaseOpen(true)} className="w-full rounded-2xl bg-amber-500 text-white hover:bg-amber-600">
                    <Plus className="mr-2 h-4 w-4" />
                    新建 Case
                  </Button>

                  {detail.cases.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-800">
                      当前还没有 Case，先创建一个再继续。
                    </div>
                  ) : (
                    detail.cases.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCaseId(item.id)}
                        className={[
                          "w-full rounded-2xl border p-4 text-left shadow-sm transition-all",
                          selectedCaseId === item.id
                            ? "border-amber-500 bg-[linear-gradient(135deg,_#f59e0b,_#d97706)] text-white"
                            : "border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/60",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">
                              {getApplicantCrmVisaTypeLabel(item.visaType || item.caseType)}
                            </div>
                            <div className="mt-1 text-xs opacity-80">
                              {item.applyRegion ? getApplicantCrmRegionLabel(item.applyRegion) : "未设置地区"}
                            </div>
                          </div>
                          {item.isActive && <Badge variant={selectedCaseId === item.id ? "secondary" : "info"}>当前案件</Badge>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant={getPriorityVariant(item.priority)}>{getPriorityLabel(item.priority)}</Badge>
                          {item.exceptionCode ? <Badge variant="destructive">异常处理中</Badge> : null}
                        </div>
                        <div className="mt-3 text-xs opacity-80">最近更新：{formatDateTime(item.updatedAt)}</div>
                      </button>
                    ))
                  )}
                </div>
              </Section>

              <Section
                title="Case 详情"
                description="这里维护案件基础信息。对于 France Case，勾选“设为当前案件”后，自动化和进度条就会围绕这条 Case 运行。"
                tone="amber"
              >
                {!selectedCase ? (
                  <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-6 text-sm text-amber-800">
                    请选择左侧的 Case。
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <ReadOnlyField label="Case ID" value={selectedCase.id} />
                      <ReadOnlyField
                        label="当前状态"
                        value={formatCaseStatus(selectedCase.mainStatus, selectedCase.subStatus, selectedCase.caseType)}
                      />
                      <ReadOnlyField label="最近更新" value={formatDateTime(selectedCase.updatedAt)} />
                      <ReadOnlyField
                        label="案件类型"
                        value={getApplicantCrmVisaTypeLabel(caseForm.visaType || caseForm.caseType)}
                      />
                      <div className="space-y-2">
                        <Label>签证类型</Label>
                        <Select
                          value={caseForm.visaType || caseForm.caseType}
                          onValueChange={(value) =>
                            setCaseForm((prev) => ({
                              ...prev,
                              visaType: value,
                              caseType: deriveApplicantCaseTypeFromVisaType(value),
                              tlsCity: value === "france-schengen" ? prev.tlsCity : "",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择签证类型" />
                          </SelectTrigger>
                          <SelectContent>
                            {CRM_VISA_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>DS-160 预检查 JSON</Label>
                        {selectedCase.ds160PrecheckFile ? (
                          <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/90 p-3">
                            <div className="text-sm font-medium text-sky-950">{selectedCase.ds160PrecheckFile.originalName}</div>
                            <div className="text-xs text-sky-800/70">
                              上传时间：{formatDateTime(selectedCase.ds160PrecheckFile.uploadedAt)}
                            </div>
                            <Button variant="outline" size="sm" asChild className="border-sky-300 text-sky-800 hover:bg-sky-100">
                              <a
                                href={`/api/cases/${selectedCase.id}/precheck-file`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                查看预检查 JSON
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50/70 p-3 text-sm text-sky-800">
                            当前案件还没有保存 DS-160 预检查结果。
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>地区</Label>
                        <Select
                          value={caseForm.applyRegion || "__unset__"}
                          onValueChange={(value) =>
                            setCaseForm((prev) => ({
                              ...prev,
                              applyRegion: value === "__unset__" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择地区" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unset__">暂不设置</SelectItem>
                            {CRM_REGION_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {caseForm.caseType === "france-schengen" ? (
                        <div className="space-y-2">
                          <Label>TLS 城市</Label>
                          <Select
                            value={caseForm.tlsCity || "__unset__"}
                            onValueChange={(value) =>
                              setCaseForm((prev) => ({
                                ...prev,
                                tlsCity: value === "__unset__" ? "" : value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择 TLS 城市" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">暂不设置</SelectItem>
                              {FRANCE_TLS_CITY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <ReadOnlyField label="TLS 城市" value="-" />
                      )}
                      {caseForm.caseType === "france-schengen" ? (
                        <BookingWindowRangeField
                          label="抢号区间"
                          value={caseForm.bookingWindow}
                          onChange={(value) => setCaseForm((prev) => ({ ...prev, bookingWindow: value }))}
                        />
                      ) : (
                        <ReadOnlyField label="抢号区间" value="-" />
                      )}
                      {caseForm.caseType !== "france-schengen" ? (
                        <ReadOnlyField label="是否接受 VIP" value="-" />
                      ) : null}
                      <div className="space-y-2">
                        <Label>优先级</Label>
                        <Select
                          value={caseForm.priority}
                          onValueChange={(value) => setCaseForm((prev) => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger
                            className={
                              caseForm.priority === "urgent"
                                ? "border-red-300 bg-red-50 text-red-700"
                                : caseForm.priority === "high"
                                  ? "border-amber-300 bg-amber-50 text-amber-700"
                                  : "border-gray-200 bg-gray-50 text-gray-700"
                            }
                          >
                            <SelectValue placeholder="选择优先级" />
                          </SelectTrigger>
                          <SelectContent>
                            {CRM_PRIORITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {caseForm.caseType !== "france-schengen" ? (
                        <Field
                          label="出行时间"
                          type="date"
                          value={caseForm.travelDate}
                          onChange={(value) => setCaseForm((prev) => ({ ...prev, travelDate: value }))}
                        />
                      ) : null}
                      {caseForm.caseType !== "france-schengen" ? (
                        <Field
                          label="递签时间"
                          type="date"
                          value={caseForm.submissionDate}
                          onChange={(value) => setCaseForm((prev) => ({ ...prev, submissionDate: value }))}
                        />
                      ) : null}
                      <div className="space-y-2">
                        <Label>分配给</Label>
                        <Select
                          value={caseForm.assignedToUserId || "__unset__"}
                          onValueChange={(value) =>
                            setCaseForm((prev) => ({
                              ...prev,
                              assignedToUserId: value === "__unset__" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="未分配" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unset__">未分配</SelectItem>
                            {detail.availableAssignees.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {(option.name || option.email) + ` (${option.role})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>当前案件</Label>
                        <Select
                          value={caseForm.isActive ? "yes" : "no"}
                          onValueChange={(value) =>
                            setCaseForm((prev) => ({ ...prev, isActive: value === "yes" }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">是</SelectItem>
                            <SelectItem value="no">否</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {caseForm.caseType === "france-schengen" && (
                      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 p-4">
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-amber-950">slot 信息</div>
                          <div className="text-xs text-amber-800/70">单独维护递签时间，方便直接查看和提取。</div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <SlotTimeField
                            value={caseForm.slotTime}
                            onChange={(value) => setCaseForm((prev) => ({ ...prev, slotTime: value }))}
                          />
                          <div className="space-y-2">
                            <Label>是否接受 VIP</Label>
                            <Select
                              value={caseForm.acceptVip || "__unset__"}
                              onValueChange={(value) =>
                                setCaseForm((prev) => ({
                                  ...prev,
                                  acceptVip: value === "__unset__" ? "" : value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="请选择" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__unset__">未设置</SelectItem>
                                <SelectItem value="接受">接受</SelectItem>
                                <SelectItem value="不接受">不接受</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <ReadOnlyField label="当前 slot 展示" value={formatDateTime(caseForm.slotTime || null)} />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button onClick={() => void saveCase()} disabled={savingCase} className="rounded-2xl bg-amber-500 text-white hover:bg-amber-600">
                        <Save className="mr-2 h-4 w-4" />
                        {savingCase ? "保存中..." : "保存 Case"}
                      </Button>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          </TabsContent>

          <TabsContent value="materials" className="space-y-6">
            <Section title="美签材料" description="继续兼容 DS-160、AIS、照片检测和提交 DS-160 的现有归档结构。" tone="sky">
              <div className="space-y-5">
                <div className="rounded-2xl border border-sky-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_40%),linear-gradient(135deg,_#ffffff,_#f0f9ff)] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <FileText className="h-4 w-4 text-sky-700" />
                        面试必看生成
                      </div>
                      <div className="text-sm text-slate-600">
                        从当前申请人直接跳到美签工作台的“面试必看”页签，生成后的 Word 和 PDF 也会自动归档到下面的材料区。
                      </div>
                      <div className="text-xs text-slate-500">
                        {hasUsVisaInterviewSource
                          ? "已检测到 DS-160 / AIS Excel，可直接生成。"
                          : "当前档案里还没有可用的 DS-160 / AIS Excel，先上传后再生成会更顺。"}
                      </div>
                    </div>
                    {hasUsVisaInterviewSource ? (
                      <Button asChild className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
                        <Link href={interviewBriefHref}>
                          <FileText className="mr-2 h-4 w-4" />
                          去生成面试必看
                        </Link>
                      </Button>
                    ) : (
                      <Button disabled className="rounded-2xl">
                        <FileText className="mr-2 h-4 w-4" />
                        先上传美签 Excel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-base font-semibold text-sky-950">上传材料</div>
                  <div className="text-sm text-sky-800/70">先放照片和 DS-160 / AIS 信息表，后续自动化与材料整理都会用到。</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={usVisaUploadedSlots} onUpload={uploadFiles} onPreview={openPreview} tone="sky" />
                </div>
                <div className="space-y-3">
                  <div className="text-base font-semibold text-sky-950">递签材料</div>
                  <div className="text-sm text-sky-800/70">这里放 DS-160 确认页和预检查结果，方便后续复核与递签。</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={usVisaSubmissionSlots} onUpload={uploadFiles} onPreview={openPreview} tone="sky" />
                </div>
                <div className="space-y-3">
                  <div className="text-base font-semibold text-sky-950">面试必看材料</div>
                  <div className="text-sm text-sky-800/70">生成后的 PDF 可直接预览，Word 和 PDF 都可以从这里下载。</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={usVisaInterviewBriefSlots} onUpload={uploadFiles} onPreview={openPreview} tone="sky" />
                </div>
              </div>
            </Section>

            <Section title="申根材料" description="申根上传材料、递签材料和材料文档都统一归档在这里。" tone="emerald">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="text-base font-semibold text-emerald-950">上传材料</div>
                  <div className="text-sm text-emerald-800/70">基础照片、信息表和护照扫描件统一放这里，方便后续申根流程继续接力。</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={schengenUploadedSlots} onUpload={uploadFiles} onPreview={openPreview} tone="emerald" />
                </div>
                <div className="space-y-3">
                  <div className="text-base font-semibold text-emerald-950">递签材料</div>
                  <div className="text-sm text-emerald-800/70">TLS、申请 JSON、回执 PDF 和最终表统一归档在这一组。</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={schengenSubmissionSlots} onUpload={uploadFiles} onPreview={openPreview} tone="emerald" />
                </div>
                <div className="space-y-3">
                  <div className="text-base font-semibold text-emerald-950">材料文档</div>
                  <div className="text-sm text-emerald-800/70">行程单、解释信、预订单等辅助材料集中放这里，避免和递签件混在一起。</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={schengenMaterialDocumentSlots} onUpload={uploadFiles} onPreview={openPreview} tone="emerald" />
                </div>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            {selectedCase ? (
              <>
                {selectedCase.caseType === "france-schengen" ? (
                  <div className="rounded-3xl border border-emerald-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(236,253,245,0.92))] p-2 shadow-sm">
                    <FranceCaseProgressCard
                      applicantProfileId={detail.profile.id}
                      applicantName={detail.profile.name || detail.profile.label}
                      caseId={selectedCase.id}
                    />
                  </div>
                ) : (
                  <Section title="当前案件进度" description="当前选中的是非 France Case，这里先展示基础案件信息。" tone="emerald">
                    <div className="grid gap-4 md:grid-cols-4">
                      <ReadOnlyField
                        label="状态"
                        value={formatCaseStatus(selectedCase.mainStatus, selectedCase.subStatus, selectedCase.caseType)}
                      />
                      <ReadOnlyField label="异常" value={selectedCase.exceptionCode || "-"} />
                      <ReadOnlyField label="优先级" value={getPriorityLabel(selectedCase.priority)} />
                      <ReadOnlyField label="最近更新" value={formatDateTime(selectedCase.updatedAt)} />
                    </div>
                  </Section>
                )}

                <Section title="状态日志" description="这里直接读取 VisaCaseStatusHistory。" tone="emerald">
                  {selectedCase.statusHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-4 text-sm text-emerald-800">当前案件还没有状态日志。</div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCase.statusHistory.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-sm">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm font-semibold text-emerald-950">
                              {item.toMainStatus}
                              {item.toSubStatus ? ` / ${item.toSubStatus}` : ""}
                            </div>
                            <div className="text-xs text-emerald-800/70">{formatDateTime(item.createdAt)}</div>
                          </div>
                          {item.reason && <div className="mt-2 text-sm text-slate-700">原因：{item.reason}</div>}
                          {item.exceptionCode && (
                            <div className="mt-2 text-sm text-red-600">异常：{item.exceptionCode}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Reminder 日志" description="这里直接读取 ReminderLog，当前仍是模拟发送。" tone="slate">
                  {selectedCase.reminderLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">当前案件还没有 Reminder 日志。</div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50/90">
                        <TableRow>
                          <TableHead>触发时间</TableHead>
                          <TableHead>规则</TableHead>
                          <TableHead>渠道</TableHead>
                          <TableHead>方式</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>摘要</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCase.reminderLogs.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{formatDateTime(item.triggeredAt)}</TableCell>
                            <TableCell>{item.ruleCode}</TableCell>
                            <TableCell>{item.channel}</TableCell>
                            <TableCell>{item.automationMode}</TableCell>
                            <TableCell>
                              <Badge variant={getSendStatusBadge(item.sendStatus)}>{item.sendStatus}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[320px] truncate text-sm text-slate-500">
                              {item.renderedContent || item.errorMessage || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </Section>
              </>
            ) : (
              <Section title="进度与日志" description="先在 Case 标签页中创建或选择一个案件。" tone="emerald">
                <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-6 text-sm text-emerald-800">
                  当前还没有可展示的案件进度。
                </div>
              </Section>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createCaseOpen} onOpenChange={setCreateCaseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建 Case</DialogTitle>
            <DialogDescription>先创建一条 Case，再去推进状态、归档材料和挂提醒规则。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField
              label="案件类型"
              value={getApplicantCrmVisaTypeLabel(newCaseForm.visaType || newCaseForm.caseType)}
            />
            <div className="space-y-2">
              <Label>签证类型</Label>
              <Select
                value={newCaseForm.visaType || newCaseForm.caseType}
                onValueChange={(value) =>
                  setNewCaseForm((prev) => ({
                    ...prev,
                    visaType: value,
                    caseType: deriveApplicantCaseTypeFromVisaType(value),
                    tlsCity: value === "france-schengen" ? prev.tlsCity : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择签证类型" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_VISA_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>地区</Label>
              <Select
                value={newCaseForm.applyRegion || "__unset__"}
                onValueChange={(value) =>
                  setNewCaseForm((prev) => ({
                    ...prev,
                    applyRegion: value === "__unset__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择地区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">暂不设置</SelectItem>
                  {CRM_REGION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newCaseForm.caseType === "france-schengen" ? (
              <div className="space-y-2">
                <Label>TLS 城市</Label>
                <Select
                  value={newCaseForm.tlsCity || "__unset__"}
                  onValueChange={(value) =>
                    setNewCaseForm((prev) => ({
                      ...prev,
                      tlsCity: value === "__unset__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择 TLS 城市" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">暂不设置</SelectItem>
                    {FRANCE_TLS_CITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <ReadOnlyField label="TLS 城市" value="-" />
            )}
            {newCaseForm.caseType === "france-schengen" ? (
              <BookingWindowRangeField
                label="抢号区间"
                value={newCaseForm.bookingWindow}
                onChange={(value) => setNewCaseForm((prev) => ({ ...prev, bookingWindow: value }))}
              />
            ) : (
              <ReadOnlyField label="抢号区间" value="-" />
            )}
            {newCaseForm.caseType === "france-schengen" ? (
              <div className="space-y-2">
                <Label>是否接受 VIP</Label>
                <Select
                  value={newCaseForm.acceptVip || "__unset__"}
                  onValueChange={(value) =>
                    setNewCaseForm((prev) => ({
                      ...prev,
                      acceptVip: value === "__unset__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">未设置</SelectItem>
                    <SelectItem value="接受">接受</SelectItem>
                    <SelectItem value="不接受">不接受</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <ReadOnlyField label="是否接受 VIP" value="-" />
            )}
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select value={newCaseForm.priority} onValueChange={(value) => setNewCaseForm((prev) => ({ ...prev, priority: value }))}>
                <SelectTrigger
                  className={
                    newCaseForm.priority === "urgent"
                      ? "border-red-300 bg-red-50 text-red-700"
                      : newCaseForm.priority === "high"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-gray-200 bg-gray-50 text-gray-700"
                  }
                >
                  <SelectValue placeholder="选择优先级" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>分配给</Label>
              <Select
                value={newCaseForm.assignedToUserId || "__unset__"}
                onValueChange={(value) =>
                  setNewCaseForm((prev) => ({
                    ...prev,
                    assignedToUserId: value === "__unset__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="未分配" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">未分配</SelectItem>
                  {detail.availableAssignees.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {(option.name || option.email) + ` (${option.role})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="出行时间" type="date" value={newCaseForm.travelDate} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, travelDate: value }))} />
            <Field label="递签时间" type="date" value={newCaseForm.submissionDate} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, submissionDate: value }))} />
          </div>
            {newCaseForm.caseType === "france-schengen" && (
              <SlotTimeField
                value={newCaseForm.slotTime}
                onChange={(value) => setNewCaseForm((prev) => ({ ...prev, slotTime: value }))}
              />
            )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCaseOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void createCase()} disabled={creatingCase}>
              {creatingCase ? "创建中..." : "创建 Case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={preview.open}
        onOpenChange={(open) => {
          if (open) return
          if (preview.kind === "excel" && preview.excelEditMode && preview.excelDirty) {
            if (!window.confirm("有未保存的修改，确定关闭？")) return
          }
          closePreview()
        }}
      >
        <DialogContent
          className={cn(
            "!flex max-h-[92vh] max-w-none flex-col gap-4 overflow-hidden p-6",
            preview.kind === "excel" && preview.excelEditMode
              ? "w-[min(99.5vw,1920px)]"
              : preview.kind === "excel"
                ? "w-[min(98vw,1680px)]"
                : "w-[min(96vw,72rem)]",
          )}
        >
          <DialogHeader>
            <DialogTitle>{preview.title || "文件预览"}</DialogTitle>
            {preview.kind === "excel" ? (
              <DialogDescription>
                预览申根/美签 Excel。点击「在线编辑」可直接改单元格并保存回档案（多 Sheet 请切换标签；保存后为 .xlsx）。
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 p-3">
            {preview.loading && <div className="p-6 text-sm text-gray-500">正在加载预览...</div>}
            {!preview.loading && preview.error && <div className="p-6 text-sm text-amber-700">{preview.error}</div>}
            {!preview.loading && !preview.error && preview.kind === "pdf" && preview.objectUrl && (
              <iframe src={preview.objectUrl} className="h-[70vh] w-full rounded-xl" />
            )}
            {!preview.loading && !preview.error && preview.kind === "image" && preview.objectUrl && (
              <img src={preview.objectUrl} alt={preview.title} className="mx-auto max-h-[70vh] max-w-full object-contain" />
            )}
            {!preview.loading && !preview.error && preview.kind === "excel" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {preview.excelEditMode ? (
                    <>
                      <Button size="sm" onClick={() => void saveExcelFromPreview()} disabled={preview.excelSaving}>
                        {preview.excelSaving ? "保存中…" : "保存到档案"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancelExcelEdit()} disabled={preview.excelSaving}>
                        放弃修改
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setPreview((p) => ({ ...p, excelEditMode: true }))}>
                      在线编辑
                    </Button>
                  )}
                  {preview.excelDirty ? (
                    <span className="text-xs text-amber-700">有未保存修改</span>
                  ) : null}
                </div>
                {preview.excelSheets.length > 1 && (
                  <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                    {preview.excelSheets.map((sheet) => (
                      <Button
                        key={sheet.name}
                        variant={sheet.name === preview.activeExcelSheet ? "default" : "outline"}
                        size="sm"
                        onClick={() => selectExcelSheet(sheet.name)}
                        disabled={preview.excelSaving}
                      >
                        {sheet.name}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  {preview.activeExcelSheet ? `Sheet：${preview.activeExcelSheet}` : "Sheet：-"}
                  {" · "}
                  {preview.tableRows.length} 行
                </div>
                <div className="overflow-auto rounded-lg border border-gray-200">
                  <table className="w-max min-w-full border-collapse text-xs">
                    <tbody>
                      {(() => {
                        const maxCols =
                          preview.tableRows.length === 0
                            ? 0
                            : Math.max(...preview.tableRows.map((r) => r.length))
                        return preview.tableRows.map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`} className={rowIndex === 0 ? "bg-gray-50" : ""}>
                            <td className="sticky left-0 z-[1] w-11 min-w-[2.75rem] border bg-white px-1.5 py-1 text-right text-[11px] text-gray-400">
                              {rowIndex + 1}
                            </td>
                            {Array.from({ length: maxCols }, (_, cellIndex) => {
                              const cell = row[cellIndex] ?? ""
                              const colClass = excelColumnMinWidthClass(cellIndex)
                              return (
                                <td key={`cell-${rowIndex}-${cellIndex}`} className={cn("border p-0 align-top", colClass)}>
                                  {preview.excelEditMode ? (
                                    <Input
                                      className={cn(
                                        "h-auto min-h-8 w-full rounded-none border-0 py-1.5 text-xs shadow-none focus-visible:ring-1",
                                        colClass,
                                      )}
                                      value={cell}
                                      onChange={(e) => setExcelCell(rowIndex, cellIndex, e.target.value)}
                                      disabled={preview.excelSaving}
                                    />
                                  ) : (
                                    <div className={cn("whitespace-pre-wrap break-words px-2 py-1.5", colClass)}>
                                      {cell || ""}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                  {preview.tableRows.length === 0 && <div className="p-4 text-sm text-gray-500">Excel 内容为空。</div>}
                </div>
              </div>
            )}
            {!preview.loading && !preview.error && preview.kind === "word" && (
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: preview.htmlContent || "<p>暂无可预览内容</p>" }} />
            )}
            {!preview.loading && !preview.error && preview.kind === "text" && (
              <pre className="whitespace-pre-wrap break-words p-3 text-xs">{preview.textContent || "暂无可预览内容"}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={auditDialog.open} onOpenChange={(open) => (!open ? setAuditDialog(emptyAuditDialog) : null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className={auditDialog.status === "error" ? "text-red-600" : auditDialog.status === "success" ? "text-emerald-600" : ""}>
              {auditDialog.title}
            </DialogTitle>
            <DialogDescription>
              {auditDialog.status === "running"
                ? "系统正在对上传的 Excel 进行字段完整性与规则检查。"
                : auditDialog.status === "success"
                  ? "审核通过，可继续后续流程。"
                  : "审核发现问题，请先修正再继续。"}
            </DialogDescription>
          </DialogHeader>

          {auditDialog.status === "running" ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在审核，请稍候...
            </div>
          ) : null}

          {auditDialog.status === "error" && auditDialog.issues.length > 0 ? (
            <div className="max-h-[360px] space-y-2 overflow-auto rounded-lg border border-red-200 bg-red-50/50 p-3">
              {auditDialog.issues.map((issue, index) => (
                <div key={`${issue.field}-${index}`} className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm">
                  <div className="font-medium text-red-700">
                    {index + 1}. {issue.field}
                  </div>
                  <div className="mt-1 text-gray-700">{issue.message}</div>
                  {issue.value ? <div className="mt-1 text-xs text-gray-500">当前值：{issue.value}</div> : null}
                </div>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setAuditDialog(emptyAuditDialog)}>
              {auditDialog.status === "error" ? "我知道了，去修正" : "确定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
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

function BookingWindowRangeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const { start, end } = splitBookingWindow(value)
  const endDateInputRef = useRef<HTMLInputElement | null>(null)

  const openEndDatePicker = () => {
    const target = endDateInputRef.current
    if (!target) return
    target.focus()
    // Chromium supports showPicker() on date inputs. Fallback is focus only.
    const picker = (target as HTMLInputElement & { showPicker?: () => void }).showPicker
    if (typeof picker === "function") {
      picker.call(target)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input
          type="date"
          value={start}
          onChange={(event) => {
            const nextStart = event.target.value
            const nextEnd = end && nextStart && end < nextStart ? "" : end
            onChange(mergeBookingWindow(nextStart, nextEnd))
            if (event.target.value) {
              window.setTimeout(openEndDatePicker, 0)
            }
          }}
        />
        <Input
          ref={endDateInputRef}
          type="date"
          min={start || undefined}
          value={end}
          onChange={(event) => onChange(mergeBookingWindow(start, event.target.value))}
        />
      </div>
      <p className="text-xs text-gray-500">保存格式：YYYY/MM/DD - YYYY/MM/DD</p>
    </div>
  )
}

function splitDateTimeLocal(value: string) {
  if (!value) return { date: "", time: "" }
  const [datePart, timePart = ""] = value.split("T")
  return { date: datePart || "", time: timePart.slice(0, 5) }
}

function mergeDateTimeLocal(date: string, time: string) {
  if (!date || !time) return ""
  return `${date}T${time}`
}

function getTodayInputDate() {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function excelColumnMinWidthClass(cellIndex: number) {
  if (cellIndex === 0) return "min-w-[min(22rem,34vw)]"
  if (cellIndex === 1) return "min-w-[min(15rem,24vw)]"
  if (cellIndex === 2) return "min-w-[min(12rem,20vw)]"
  return "min-w-[7rem]"
}

function SlotTimeField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { date, time } = splitDateTimeLocal(value)

  return (
    <div className="space-y-2">
      <Label>slot时间</Label>
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          type="date"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value
            if (!nextDate) {
              onChange("")
              return
            }
            const nextTime = time || "07:00"
            onChange(mergeDateTimeLocal(nextDate, nextTime))
          }}
        />
        <Select
          value={time || "__unset__"}
          onValueChange={(next) => {
            if (next === "__unset__") {
              onChange("")
              return
            }
            const targetDate = date || getTodayInputDate()
            onChange(mergeDateTimeLocal(targetDate, next))
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择时间（07:00-16:30）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">未设置</SelectItem>
            {SLOT_TIME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-gray-500">可选时间：07:00 - 16:30，每 30 分钟一档。</p>
    </div>
  )
}

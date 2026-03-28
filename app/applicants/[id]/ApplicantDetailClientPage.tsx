"use client"

/* eslint-disable @next/next/no-img-element */

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { read, utils } from "xlsx"

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
import { ACTIVE_APPLICANT_PROFILE_KEY } from "@/components/applicant-profile-selector"
import { FRANCE_TLS_CITY_OPTIONS, getFranceTlsCityLabel } from "@/lib/france-tls-city"

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
  priority: string
  travelDate: string
  submissionDate: string
  assignedToUserId: string
  isActive: boolean
}

type PreviewKind = "pdf" | "image" | "excel" | "word" | "text" | "unknown"

type PreviewState = {
  open: boolean
  loading: boolean
  title: string
  kind: PreviewKind
  objectUrl: string
  textContent: string
  htmlContent: string
  tableRows: string[][]
  error: string
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
  error: "",
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
  priority: "normal",
  travelDate: "",
  submissionDate: "",
  assignedToUserId: "",
  isActive: true,
}

const usVisaUploadedSlots = [
  { key: "usVisaPhoto", label: "美签照片", accept: "image/*" },
  { key: "usVisaDs160Excel", label: "DS-160 / AIS Excel", accept: ".xlsx,.xls" },
] as const

const usVisaSubmissionSlots = [
  { key: "usVisaDs160ConfirmationPdf", label: "DS-160 确认页 PDF", accept: ".pdf,application/pdf" },
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
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-gray-200 bg-white/90">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
}: {
  applicantId: string
  files: Record<string, { originalName: string; uploadedAt: string }>
  slots: readonly { key: string; label: string; accept: string }[]
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: { originalName: string; uploadedAt: string }) => Promise<void>
  emptyMessage?: string
}) {
  if (!slots.length) {
    return <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">{emptyMessage}</div>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((slot) => {
        const meta = files[slot.key]
        return (
          <div key={slot.key} className="rounded-2xl border border-gray-200 p-4">
            <div className="mb-2 text-sm font-medium text-gray-900">{slot.label}</div>
            <Input type="file" accept={slot.accept} onChange={(event) => void onUpload(event, slot.key)} />
            {meta ? (
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                <div>{meta.originalName}</div>
                <div>{formatDateTime(meta.uploadedAt)}</div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => void onPreview(slot.key, meta)}
                  >
                    预览
                  </button>
                  <a
                    className="text-blue-600 hover:underline"
                    href={`/api/applicants/${applicantId}/files/${slot.key}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    下载
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-gray-400">暂未上传</div>
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
      window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, data.profile.id)
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

    setMessage("")
    try {
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
        const workbook = read(await blob.arrayBuffer(), { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
        const rows = sheet
          ? (utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][])
              .slice(0, 80)
              .map((row) => (row as unknown[]).slice(0, 20).map((cell) => String(cell ?? "")))
          : []
        URL.revokeObjectURL(objectUrl)
        setPreview((prev) => ({ ...prev, loading: false, kind: "excel", tableRows: rows }))
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

        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="cases">签证 Case</TabsTrigger>
            <TabsTrigger value="materials">材料文档</TabsTrigger>
            <TabsTrigger value="progress">进度与日志</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Section title="CRM 基本信息" description="申请人主实体信息，后续搜索和 CRM 列表会优先使用这里的字段。">
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

            <Section title="美签基础信息" description="这块会继续为 DS-160、AIS 注册和提交 DS-160 提供复用信息。">
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

            <Section title="申根基础信息" description="申根国家和 TLS 递签城市会同时影响法签自动化和解释信默认值。">
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
              <Button onClick={() => void saveProfile()} disabled={savingProfile}>
                <Save className="mr-2 h-4 w-4" />
                {savingProfile ? "保存中..." : "保存申请人"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="cases" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <Section title="Case 列表" description="一个申请人可以挂多个 Case。当前激活中的 France Case 会驱动法签自动化和提醒。">
                <div className="space-y-3">
                  <Button onClick={() => setCreateCaseOpen(true)} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    新建 Case
                  </Button>

                  {detail.cases.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">
                      当前还没有 Case，先创建一个再继续。
                    </div>
                  ) : (
                    detail.cases.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCaseId(item.id)}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-colors",
                          selectedCaseId === item.id
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-white hover:border-gray-300",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{item.visaType || item.caseType}</div>
                            <div className="mt-1 text-xs opacity-80">{item.applyRegion || "未设置地区"}</div>
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
              >
                {!selectedCase ? (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-500">
                    请选择左侧的 Case。
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <ReadOnlyField label="Case ID" value={selectedCase.id} />
                      <ReadOnlyField label="当前状态" value={`${selectedCase.mainStatus}${selectedCase.subStatus ? ` / ${selectedCase.subStatus}` : ""}`} />
                      <ReadOnlyField label="最近更新" value={formatDateTime(selectedCase.updatedAt)} />
                      <Field
                        label="案件类型"
                        value={caseForm.caseType}
                        onChange={(value) => setCaseForm((prev) => ({ ...prev, caseType: value }))}
                      />
                      <Field
                        label="签证类型"
                        value={caseForm.visaType}
                        onChange={(value) => setCaseForm((prev) => ({ ...prev, visaType: value }))}
                        placeholder="例如：France Schengen / B1/B2"
                      />
                      <Field
                        label="地区"
                        value={caseForm.applyRegion}
                        onChange={(value) => setCaseForm((prev) => ({ ...prev, applyRegion: value }))}
                      />
                      <Field
                        label="TLS 城市"
                        value={caseForm.tlsCity}
                        onChange={(value) => setCaseForm((prev) => ({ ...prev, tlsCity: value }))}
                        placeholder="例如：EDI"
                      />
                      <div className="space-y-2">
                        <Label>优先级</Label>
                        <Select
                          value={caseForm.priority}
                          onValueChange={(value) => setCaseForm((prev) => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择优先级" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">普通</SelectItem>
                            <SelectItem value="high">高优先级</SelectItem>
                            <SelectItem value="urgent">紧急</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Field
                        label="出行时间"
                        type="date"
                        value={caseForm.travelDate}
                        onChange={(value) => setCaseForm((prev) => ({ ...prev, travelDate: value }))}
                      />
                      <Field
                        label="递签时间"
                        type="date"
                        value={caseForm.submissionDate}
                        onChange={(value) => setCaseForm((prev) => ({ ...prev, submissionDate: value }))}
                      />
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
                                {(option.name || option.email) + `（${option.role}）`}
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

                    <div className="flex justify-end">
                      <Button onClick={() => void saveCase()} disabled={savingCase}>
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
            <Section title="美签材料" description="继续兼容 DS-160、AIS、照片检测和提交 DS-160 的现有归档结构。">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-900">上传材料</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={usVisaUploadedSlots} onUpload={uploadFiles} onPreview={openPreview} />
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-900">递签材料</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={usVisaSubmissionSlots} onUpload={uploadFiles} onPreview={openPreview} />
                </div>
              </div>
            </Section>

            <Section title="申根材料" description="申根上传材料、递签材料和材料文档都统一归档在这里。">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-900">上传材料</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={schengenUploadedSlots} onUpload={uploadFiles} onPreview={openPreview} />
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-900">递签材料</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={schengenSubmissionSlots} onUpload={uploadFiles} onPreview={openPreview} />
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-900">材料文档</div>
                  <UploadGrid applicantId={applicantId} files={files} slots={schengenMaterialDocumentSlots} onUpload={uploadFiles} onPreview={openPreview} />
                </div>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            {selectedCase ? (
              <>
                {selectedCase.caseType === "france-schengen" ? (
                  <FranceCaseProgressCard
                    applicantProfileId={detail.profile.id}
                    applicantName={detail.profile.name || detail.profile.label}
                    caseId={selectedCase.id}
                  />
                ) : (
                  <Section title="当前案件进度" description="当前选中的是非 France Case，这里先展示基础案件信息。">
                    <div className="grid gap-4 md:grid-cols-4">
                      <ReadOnlyField label="状态" value={`${selectedCase.mainStatus}${selectedCase.subStatus ? ` / ${selectedCase.subStatus}` : ""}`} />
                      <ReadOnlyField label="异常" value={selectedCase.exceptionCode || "-"} />
                      <ReadOnlyField label="优先级" value={getPriorityLabel(selectedCase.priority)} />
                      <ReadOnlyField label="最近更新" value={formatDateTime(selectedCase.updatedAt)} />
                    </div>
                  </Section>
                )}

                <Section title="状态日志" description="这里直接读取 VisaCaseStatusHistory。">
                  {selectedCase.statusHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">当前案件还没有状态日志。</div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCase.statusHistory.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-gray-200 bg-white/90 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm font-medium text-gray-900">
                              {item.toMainStatus}
                              {item.toSubStatus ? ` / ${item.toSubStatus}` : ""}
                            </div>
                            <div className="text-xs text-gray-500">{formatDateTime(item.createdAt)}</div>
                          </div>
                          {item.reason && <div className="mt-2 text-sm text-gray-600">原因：{item.reason}</div>}
                          {item.exceptionCode && (
                            <div className="mt-2 text-sm text-red-600">异常：{item.exceptionCode}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="Reminder 日志" description="这里直接读取 ReminderLog，当前仍是模拟发送。">
                  {selectedCase.reminderLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">当前案件还没有 Reminder 日志。</div>
                  ) : (
                    <Table>
                      <TableHeader>
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
                            <TableCell className="max-w-[320px] truncate text-sm text-gray-500">
                              {item.renderedContent || item.errorMessage || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Section>
              </>
            ) : (
              <Section title="进度与日志" description="先在 Case 标签页中创建或选择一个案件。">
                <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-500">
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
            <Field label="案件类型" value={newCaseForm.caseType} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, caseType: value }))} placeholder="例如：france-schengen / usa-visa" />
            <Field label="签证类型" value={newCaseForm.visaType} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, visaType: value }))} />
            <Field label="地区" value={newCaseForm.applyRegion} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, applyRegion: value }))} />
            <Field label="TLS 城市" value={newCaseForm.tlsCity} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, tlsCity: value }))} />
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select value={newCaseForm.priority} onValueChange={(value) => setNewCaseForm((prev) => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择优先级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="high">高优先级</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
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
                      {(option.name || option.email) + `（${option.role}）`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="出行时间" type="date" value={newCaseForm.travelDate} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, travelDate: value }))} />
            <Field label="递签时间" type="date" value={newCaseForm.submissionDate} onChange={(value) => setNewCaseForm((prev) => ({ ...prev, submissionDate: value }))} />
          </div>
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

      <Dialog open={preview.open} onOpenChange={(open) => (!open ? closePreview() : null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{preview.title || "文件预览"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-auto rounded-xl border border-gray-200 p-3">
            {preview.loading && <div className="p-6 text-sm text-gray-500">正在加载预览...</div>}
            {!preview.loading && preview.error && <div className="p-6 text-sm text-amber-700">{preview.error}</div>}
            {!preview.loading && !preview.error && preview.kind === "pdf" && preview.objectUrl && (
              <iframe src={preview.objectUrl} className="h-[70vh] w-full rounded-xl" />
            )}
            {!preview.loading && !preview.error && preview.kind === "image" && preview.objectUrl && (
              <img src={preview.objectUrl} alt={preview.title} className="mx-auto max-h-[70vh] max-w-full object-contain" />
            )}
            {!preview.loading && !preview.error && preview.kind === "excel" && (
              <table className="min-w-full border-collapse text-xs">
                <tbody>
                  {preview.tableRows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${rowIndex}-${cellIndex}`} className="border px-2 py-1 align-top">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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

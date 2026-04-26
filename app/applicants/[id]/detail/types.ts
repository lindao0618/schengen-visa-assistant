export type ApplicantIntakeSnapshot = {
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

export type ApplicantProfileDetail = {
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

export type ReminderLogRecord = {
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

export type StatusHistoryRecord = {
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

export type VisaCaseRecord = {
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

export type AssigneeOption = {
  id: string
  name?: string | null
  email: string
  role: string
}

export type ApplicantDetailResponse = {
  profile: ApplicantProfileDetail
  cases: VisaCaseRecord[]
  activeCaseId?: string | null
  availableAssignees: AssigneeOption[]
}

export type BasicFormState = {
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

export type CaseFormState = {
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

export type PreviewKind = "pdf" | "image" | "excel" | "word" | "text" | "unknown"

export type ExcelPreviewSheet = {
  name: string
  rows?: string[][]
}

export type UsVisaExcelPreviewItem = {
  rowIndex: number
  label: string
  field: string
  value: string
  note: string
}

export type UsVisaExcelPreviewSection = {
  title: string
  items: UsVisaExcelPreviewItem[]
}

export type PreviewState = {
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

export type AuditDialogState = {
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

export const emptyPreview: PreviewState = {
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

export const emptyAuditDialog: AuditDialogState = {
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

export const emptyBasicForm: BasicFormState = {
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

export const emptyCaseForm: CaseFormState = {
  caseType: "france-schengen",
  visaType: "france-schengen",
  applyRegion: "france",
  tlsCity: "",
  bookingWindow: "",
  acceptVip: "yes",
  slotTime: "",
  priority: "normal",
  travelDate: "",
  submissionDate: "",
  assignedToUserId: "",
  isActive: true,
}

export type ApplicantDetailTab = "basic" | "cases" | "materials" | "progress"

"use client"

/* eslint-disable @next/next/no-img-element */

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { resolveSelectedFranceCase, resolveTlsAccountCaseSource } from "@/app/applicants/[id]/detail/cases-tab"
import { getAppRoleLabel } from "@/lib/access-control"
import {
  ACTIVE_APPLICANT_PROFILE_KEY,
  dispatchActiveApplicantCaseChange,
  dispatchActiveApplicantProfileChange,
  writeStoredApplicantCaseId,
} from "@/lib/applicant-selection-storage"
import {
  cloneTableRows,
  excelColumnMinWidthClass,
  extractExcelSheetRows,
  parseUsVisaExcelPreviewSections,
  updateExcelPreviewCell,
} from "@/app/applicants/[id]/detail/material-preview"
import { buildBasicForm, buildCaseForm, emptyApplicantCaseForm } from "@/app/applicants/[id]/detail/form-state"
import { readJsonSafely } from "@/app/applicants/[id]/detail/json-response"
import { buildApplicantProfileUpdatePayload } from "@/app/applicants/[id]/detail/profile-save"
import { buildTlsAccountInfo, buildTlsAccountTemplateText } from "@/app/applicants/[id]/detail/tls-account"
import type {
  ApplicantFileUploadResponse,
  UsVisaAutoFixResponse,
} from "@/app/applicants/[id]/detail/upload-feedback"
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
import { shouldFetchApplicantMaterialFiles } from "@/lib/applicant-material-files"
import { cn } from "@/lib/utils"
import {
  emptyAuditDialog,
  emptyPreview,
  type ApplicantDetailResponse,
  type ApplicantDetailTab,
  type ApplicantMaterialFiles,
  type ApplicantProfileDetail,
  type VisaCaseRecord,
} from "@/app/applicants/[id]/detail/types"

const AuditDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/audit-dialog").then((mod) => mod.AuditDialog),
  { ssr: false },
)

const CreateCaseDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/create-case-dialog").then((mod) => mod.CreateCaseDialog),
  { ssr: false },
)

const BasicTabContent = dynamic(
  () => import("@/app/applicants/[id]/detail/basic-tab-content").then((mod) => mod.BasicTabContent),
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

const AUDIT_PROGRESS_STEPS = ["正在读取 Excel", "正在识别字段", "正在检查规则", "审核完成"]

function persistSelectedApplicantCase(applicantId: string, caseId?: string | null) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, applicantId)
  const normalizedCaseId = caseId || ""
  writeStoredApplicantCaseId(applicantId, normalizedCaseId)
  dispatchActiveApplicantProfileChange(applicantId)
  dispatchActiveApplicantCaseChange(applicantId, normalizedCaseId || undefined)
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
  const [activeTab, setActiveTab] = useState<ApplicantDetailTab>(defaultTab)
  const [materialFiles, setMaterialFiles] = useState<ApplicantMaterialFiles>({})
  const [materialFilesLoaded, setMaterialFilesLoaded] = useState(false)
  const [materialFilesLoading, setMaterialFilesLoading] = useState(false)
  const [materialFilesError, setMaterialFilesError] = useState("")
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
  const detailProfileId = detail?.profile.id || ""

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

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
    setMaterialFiles({})
    setMaterialFilesLoaded(false)
    setMaterialFilesError("")
  }, [detailProfileId])

  useEffect(() => {
    if (!detailProfileId) return
    if (
      !shouldFetchApplicantMaterialFiles({
        activeTab,
        hasFilesLoaded: materialFilesLoaded,
        loading: materialFilesLoading,
      })
    ) {
      return
    }

    let cancelled = false
    setMaterialFilesLoading(true)
    setMaterialFilesError("")

    fetch(`/api/applicants/${applicantId}/files`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await readJsonSafely<{ files?: ApplicantMaterialFiles; error?: string }>(response)) ?? {}
        if (!response.ok || !data.files) {
          throw new Error(data.error || "加载材料文件失败")
        }
        if (cancelled) return
        const nextFiles = data.files
        setMaterialFiles(nextFiles)
        setMaterialFilesLoaded(true)
        setDetail((prev) =>
          prev?.profile.id === detailProfileId
            ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  files: nextFiles,
                },
              }
            : prev,
        )
      })
      .catch((error) => {
        if (!cancelled) {
          setMaterialFilesError(error instanceof Error ? error.message : "加载材料文件失败")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMaterialFilesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, applicantId, detailProfileId, materialFilesLoaded, materialFilesLoading, setDetail])

  useEffect(() => {
    setCaseForm(buildCaseForm(selectedCase, emptyApplicantCaseForm))
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
        body: JSON.stringify(buildApplicantProfileUpdatePayload(basicForm)),
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

    const {
      buildApplicantUploadSuccessMessage,
      buildRunningUploadAuditDialog,
      buildUploadAuditResultDialog,
      getUploadExcelScope,
    } = await import("@/app/applicants/[id]/detail/upload-feedback")
    const uploadExcelScope = getUploadExcelScope(slot)
    setMessage("")
    try {
      if (uploadExcelScope) {
        setAuditDialog(buildRunningUploadAuditDialog(uploadExcelScope, slot))
      }

      const formData = new FormData()
      formData.append(slot, file)
      const response = await fetch(`/api/applicants/${applicantId}/files`, {
        method: "POST",
        body: formData,
      })
      const data = await readJsonSafely<ApplicantFileUploadResponse>(response)

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "上传文件失败")
      }

      invalidateApplicantCaches()
      const uploadedProfile = data.profile
      const nextFiles = uploadedProfile.files || {}
      setMaterialFiles(nextFiles)
      setMaterialFilesLoaded(true)
      setMaterialFilesError("")
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              profile: uploadedProfile,
            }
          : prev,
      )
      setBasicForm(buildBasicForm(uploadedProfile))

      setMessage(buildApplicantUploadSuccessMessage(data))

      if (uploadExcelScope) {
        setAuditDialog(
          buildUploadAuditResultDialog(
            uploadExcelScope,
            slot,
            uploadExcelScope === "schengen" ? data.schengenAudit : data.usVisaAudit,
          ),
        )
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
      const data = await readJsonSafely<UsVisaAutoFixResponse>(response)

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "自动处理格式问题失败")
      }

      invalidateApplicantCaches()
      await loadDetail()

      const { buildUsVisaAutoFixAuditDialog } = await import("@/app/applicants/[id]/detail/upload-feedback")
      const fixedCount = data.fixedCount || 0
      const passed = Boolean(data.usVisaAudit?.ok)

      setAuditDialog(buildUsVisaAutoFixAuditDialog(auditDialog.slot, fixedCount, data.usVisaAudit))

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

  const selectExcelSheet = async (sheetName: string) => {
    const { read, utils: xlsxUtils } = await import("xlsx")
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
      const rows = extractExcelSheetRows(wb.Sheets[sheetName], xlsxUtils)
      return {
        ...prev,
        activeExcelSheet: sheetName,
        excelSheets: prev.excelSheets.map((sheet) => (sheet.name === sheetName ? { ...sheet, rows } : sheet)),
        tableRows: cloneTableRows(rows),
      }
    })
  }

  const setExcelCell = (rowIndex: number, colIndex: number, value: string) => {
    setPreview((prev) => updateExcelPreviewCell(prev, rowIndex, colIndex, value))
  }

  const cancelExcelEdit = async () => {
    const { read, utils: xlsxUtils } = await import("xlsx")
    setPreview((prev) => {
      if (prev.kind !== "excel" || !prev.workbookArrayBuffer) {
        return { ...prev, excelEditMode: false, excelDirty: false }
      }
      const wb = read(prev.workbookArrayBuffer, { type: "array", cellDates: true, cellNF: true, cellText: true })
      const activeSheetName = prev.activeExcelSheet || wb.SheetNames[0] || ""
      const activeRows = activeSheetName ? extractExcelSheetRows(wb.Sheets[activeSheetName], xlsxUtils) : []
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
      const { read, utils: xlsxUtils, write } = await import("xlsx")
      const wb = read(snap.workbookArrayBuffer, { type: "array" })
      for (const sh of snap.excelSheets) {
        if (!sh.rows) continue
        wb.Sheets[sh.name] = xlsxUtils.aoa_to_sheet(sh.rows)
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
      const objectUrl = URL.createObjectURL(blob)
      const { buildMaterialPreviewUpdate } = await import("@/app/applicants/[id]/detail/material-preview-loader")
      const update = await buildMaterialPreviewUpdate({
        slot,
        filename,
        originalName: meta.originalName || "",
        blob,
        objectUrl,
      })
      setPreview((prev) => ({ ...prev, ...update }))
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
      setNewCaseForm(emptyApplicantCaseForm)
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

  const files = materialFiles

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

        <Tabs key={defaultTab} value={activeTab} onValueChange={(value) => setActiveTab(resolveApplicantDetailTab(value))} className="space-y-5">
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

          {activeTab === "basic" ? (
            <BasicTabContent
              applicantId={detail.profile.id}
              profile={detail.profile}
              basicForm={basicForm}
              setBasicForm={setBasicForm}
              tlsAccountTemplateText={tlsAccountTemplateText}
              isReadOnlyViewer={isReadOnlyViewer}
              savingProfile={savingProfile}
              canEditApplicant={canEditApplicant}
              onCopyTlsAccountTemplate={copyTlsAccountTemplate}
              onSaveProfile={saveProfile}
            />
          ) : null}

          {activeTab === "cases" ? (
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
          ) : null}

          {activeTab === "materials" ? (
            <MaterialsTab
              applicantId={applicantId}
              applicantProfileId={detail.profile.id}
              selectedCaseId={selectedCase?.id}
              files={files}
              filesLoading={materialFilesLoading}
              filesError={materialFilesError}
              canEditApplicant={canEditApplicant}
              canRunAutomation={canRunAutomation}
              onUpload={uploadFiles}
              onPreview={openPreview}
            />
          ) : null}

          {activeTab === "progress" ? (
            <ProgressTab
              applicantProfileId={detail.profile.id}
              applicantName={detail.profile.name || detail.profile.label}
              selectedCase={selectedCase}
            />
          ) : null}
        </Tabs>
      </div>

      {createCaseOpen ? (
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
      ) : null}

      {preview.open ? (
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
      ) : null}

      {auditDialog.open ? (
        <AuditDialog
          auditDialog={auditDialog}
          auditProgressSteps={AUDIT_PROGRESS_STEPS}
          auditPhaseIndex={auditPhaseIndex}
          canRunAutomation={canRunAutomation}
          onClose={() => setAuditDialog(emptyAuditDialog)}
          onAutoFix={autoFixUsVisaAuditIssues}
        />
      ) : null}
    </div>
  )
}

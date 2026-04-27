"use client"

import type { Dispatch, SetStateAction } from "react"
import { useCallback, useMemo } from "react"

import {
  APPLICANT_CRM_LIST_CACHE_PREFIX,
  APPLICANT_CRM_SUMMARY_CACHE_PREFIX,
  APPLICANT_SELECTOR_CACHE_KEY,
  FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX,
  clearClientCache,
  clearClientCacheByPrefix,
} from "@/lib/applicant-client-cache"

import { readJsonSafely } from "./json-response"
import {
  cloneTableRows,
  excelColumnMinWidthClass,
  extractExcelSheetRows,
  parseUsVisaExcelPreviewSections,
  updateExcelPreviewCell,
} from "./material-preview"
import { emptyPreview } from "./types"
import type { ApplicantDetailResponse, ApplicantProfileDetail, AuditDialogState, PreviewState } from "./types"

type UseMaterialPreviewControllerOptions = {
  applicantId: string
  canEditApplicant: boolean
  detail: ApplicantDetailResponse | null
  preview: PreviewState
  setDetail: Dispatch<SetStateAction<ApplicantDetailResponse | null>>
  setMessage: Dispatch<SetStateAction<string>>
  setPreview: Dispatch<SetStateAction<PreviewState>>
  setAuditDialog: Dispatch<SetStateAction<AuditDialogState>>
  invalidateApplicantCaches: () => void
  primeApplicantDetailCache: (data: ApplicantDetailResponse) => void
}

export function useMaterialPreviewController({
  applicantId,
  canEditApplicant,
  detail,
  preview,
  setDetail,
  setMessage,
  setPreview,
  setAuditDialog,
  invalidateApplicantCaches,
  primeApplicantDetailCache,
}: UseMaterialPreviewControllerOptions) {
  const closePreview = useCallback(() => {
    setPreview((prev) => {
      if (prev.objectUrl.startsWith("blob:")) URL.revokeObjectURL(prev.objectUrl)
      return emptyPreview
    })
  }, [setPreview])

  const selectExcelPreviewMode = useCallback(
    (mode: "form" | "table") => {
      setPreview((prev) => ({ ...prev, excelPreviewMode: mode }))
    },
    [setPreview],
  )

  const enableExcelEdit = useCallback(() => {
    setPreview((prev) => ({
      ...prev,
      excelEditMode: true,
      excelPreviewMode: "table",
    }))
  }, [setPreview])

  const selectExcelSheet = useCallback(
    async (sheetName: string) => {
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
    },
    [setPreview],
  )

  const setExcelCell = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      setPreview((prev) => updateExcelPreviewCell(prev, rowIndex, colIndex, value))
    },
    [setPreview],
  )

  const cancelExcelEdit = useCallback(async () => {
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
  }, [setPreview])

  const saveExcelFromPreview = useCallback(async () => {
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
      const name = snap.excelOriginalName || snap.title || `${snap.excelSlot}.xlsx`
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
  }, [
    applicantId,
    canEditApplicant,
    detail,
    invalidateApplicantCaches,
    preview,
    primeApplicantDetailCache,
    setAuditDialog,
    setDetail,
    setMessage,
    setPreview,
  ])

  const openPreview = useCallback(
    async (slot: string, meta: { originalName: string; uploadedAt: string }) => {
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
        const { buildMaterialPreviewUpdate } = await import("./material-preview-loader")
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
    },
    [applicantId, setPreview],
  )

  const previewDialogControls = useMemo(
    () => ({
      onClose: closePreview,
      onSelectExcelPreviewMode: selectExcelPreviewMode,
      onEnableExcelEdit: enableExcelEdit,
      onSaveExcelFromPreview: saveExcelFromPreview,
      onCancelExcelEdit: cancelExcelEdit,
      onSelectExcelSheet: selectExcelSheet,
      onSetExcelCell: setExcelCell,
      excelColumnMinWidthClass,
    }),
    [
      cancelExcelEdit,
      closePreview,
      enableExcelEdit,
      saveExcelFromPreview,
      selectExcelPreviewMode,
      selectExcelSheet,
      setExcelCell,
    ],
  )

  return {
    openPreview,
    previewDialogControls,
  }
}

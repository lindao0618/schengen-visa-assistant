import type { PreviewState } from "./types"
import {
  US_VISA_EXCEL_PREVIEW_SLOTS,
  cloneTableRows,
  extractExcelSheetRows,
  parseUsVisaExcelPreviewSections,
} from "./material-preview"

type MaterialPreviewUpdate = Partial<PreviewState>

type BuildMaterialPreviewUpdateOptions = {
  slot: string
  filename: string
  originalName?: string
  blob: Blob
  objectUrl: string
  revokeObjectUrl?: (objectUrl: string) => void
}

type MammothModule = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
  extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
}

export function buildDirectPdfPreviewUpdate(fileHref: string): MaterialPreviewUpdate {
  return {
    loading: false,
    kind: "pdf",
    objectUrl: fileHref,
  }
}

export function buildMaterialPreviewErrorUpdate(error: unknown): MaterialPreviewUpdate {
  return {
    loading: false,
    kind: "unknown",
    error: error instanceof Error ? error.message : "预览失败",
  }
}

export async function buildMaterialPreviewUpdate({
  slot,
  filename,
  originalName = "",
  blob,
  objectUrl,
  revokeObjectUrl = URL.revokeObjectURL,
}: BuildMaterialPreviewUpdateOptions): Promise<MaterialPreviewUpdate> {
  const mime = (blob.type || "").toLowerCase()
  const lowerFilename = filename.toLowerCase()

  if (mime.includes("pdf")) {
    return { loading: false, kind: "pdf", objectUrl }
  }

  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerFilename)) {
    return { loading: false, kind: "image", objectUrl }
  }

  if (/\.(xlsx|xls)$/.test(lowerFilename) || mime.includes("spreadsheet") || mime.includes("excel")) {
    const arrayBuffer = await blob.arrayBuffer()
    const { read, utils: xlsxUtils } = await import("xlsx")
    const workbook = read(arrayBuffer, { type: "array", cellDates: true, cellNF: true, cellText: true })
    const isUsVisaExcelPreview = US_VISA_EXCEL_PREVIEW_SLOTS.has(slot)
    const firstSheetName = isUsVisaExcelPreview
      ? workbook.SheetNames.find((sheetName) => /^sheet1$/i.test(sheetName)) || workbook.SheetNames[0] || ""
      : workbook.SheetNames[0] || ""
    const firstRows = firstSheetName ? extractExcelSheetRows(workbook.Sheets[firstSheetName], xlsxUtils) : []
    const excelSheets = isUsVisaExcelPreview
      ? firstSheetName
        ? [{ name: firstSheetName, rows: firstRows }]
        : []
      : workbook.SheetNames.map((sheetName) => ({
          name: sheetName,
          rows: sheetName === firstSheetName ? firstRows : undefined,
        }))
    const excelUsVisaSections = isUsVisaExcelPreview ? parseUsVisaExcelPreviewSections(firstRows) : []
    revokeObjectUrl(objectUrl)

    return {
      loading: false,
      kind: "excel",
      excelSheets,
      activeExcelSheet: firstSheetName,
      tableRows: cloneTableRows(firstRows),
      excelSlot: slot,
      excelOriginalName: originalName,
      workbookArrayBuffer: arrayBuffer.slice(0),
      excelEditMode: false,
      excelDirty: false,
      excelSaving: false,
      excelPreviewMode: excelUsVisaSections.length > 0 ? "form" : "table",
      excelUsVisaSections,
    }
  }

  if (/\.(docx?|rtf)$/.test(lowerFilename) || mime.includes("word")) {
    const arrayBuffer = await blob.arrayBuffer()
    const mammoth = (await import("mammoth")) as unknown as MammothModule
    try {
      const html = await mammoth.convertToHtml({ arrayBuffer })
      revokeObjectUrl(objectUrl)
      return { loading: false, kind: "word", htmlContent: html.value || "" }
    } catch {
      const text = await mammoth.extractRawText({ arrayBuffer })
      revokeObjectUrl(objectUrl)
      return { loading: false, kind: "text", textContent: text.value || "" }
    }
  }

  if (mime.includes("json") || mime.startsWith("text/") || /\.(json|txt|csv|md)$/i.test(lowerFilename)) {
    const text = await blob.text()
    revokeObjectUrl(objectUrl)
    return { loading: false, kind: "text", textContent: text }
  }

  return {
    loading: false,
    kind: "unknown",
    objectUrl,
    error: "当前格式暂不支持内嵌预览，请直接下载查看。",
  }
}

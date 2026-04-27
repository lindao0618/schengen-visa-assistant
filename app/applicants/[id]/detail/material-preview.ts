import type { PreviewKind, PreviewState, UsVisaExcelPreviewItem, UsVisaExcelPreviewSection } from "./types"

export const US_VISA_EXCEL_PREVIEW_SLOTS = new Set(["usVisaDs160Excel", "usVisaAisExcel", "ds160Excel", "aisExcel"])

export type XlsxUtils = {
  decode_cell: (ref: string) => { r: number; c: number }
  // xlsx's public CellObject type is intentionally hidden here to keep the heavy import lazy.
  format_cell?: (cell: any) => string
}

export function resolveApplicantPreviewMode(filename: string, mime: string): PreviewKind {
  const lowerName = filename.toLowerCase()
  const lowerMime = mime.toLowerCase()

  if (/\.(xlsx|xls)$/.test(lowerName) || lowerMime.includes("spreadsheet") || lowerMime.includes("excel")) {
    return "excel"
  }
  if (/\.(docx|doc)$/.test(lowerName) || lowerMime.includes("wordprocessingml")) {
    return "word"
  }
  if (lowerMime.startsWith("image/")) {
    return "image"
  }
  if (/\.(pdf)$/.test(lowerName) || lowerMime.includes("pdf")) {
    return "pdf"
  }
  if (lowerMime.startsWith("text/") || /\.(txt|json|md|csv)$/i.test(lowerName)) {
    return "text"
  }

  return "unknown"
}

export function getInitialExcelSheetName(sheetNames: string[], preferUsVisaSheet: boolean) {
  if (!sheetNames.length) return ""
  if (!preferUsVisaSheet) return sheetNames[0] || ""
  return sheetNames.find((name) => /^sheet1$/i.test(name)) || sheetNames[0] || ""
}

export function cloneTableRows(rows: string[][]) {
  return rows.map((row) => [...row])
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u3000"'`“”‘’()（）[\]【】{}<>:：;；,.，。!?！？\\|@#$%^&*_+=~/-]/g, "")
}

export function extractExcelSheetRows(sheet: unknown, sheetUtils: XlsxUtils): string[][] {
  if (!sheet || typeof sheet !== "object") return []

  const worksheet = sheet as Record<string, { w?: unknown; v?: unknown; z?: unknown; t?: unknown }>
  const cellRefs = Object.keys(worksheet).filter((key) => !key.startsWith("!"))
  if (!cellRefs.length) return []

  let maxRow = 0
  let maxCol = 0
  for (const ref of cellRefs) {
    const position = sheetUtils.decode_cell(ref)
    if (position.r > maxRow) maxRow = position.r
    if (position.c > maxCol) maxCol = position.c
  }

  const rows = Array.from({ length: maxRow + 1 }, () => Array.from({ length: maxCol + 1 }, () => ""))
  for (const ref of cellRefs) {
    const position = sheetUtils.decode_cell(ref)
    const cell = worksheet[ref]
    let displayValue = ""
    if (cell) {
      const formatted = typeof sheetUtils.format_cell === "function" ? sheetUtils.format_cell(cell) : ""
      displayValue = String(formatted || (cell.w ?? cell.v ?? ""))
    }
    rows[position.r][position.c] = displayValue
  }

  return rows
}

export function parseUsVisaExcelPreviewSections(rows: string[][]): UsVisaExcelPreviewSection[] {
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

export function updateExcelPreviewCell(
  preview: PreviewState,
  rowIndex: number,
  colIndex: number,
  value: string,
): PreviewState {
  if (preview.kind !== "excel") return preview
  const sheetIndex = preview.excelSheets.findIndex((sheet) => sheet.name === preview.activeExcelSheet)
  if (sheetIndex < 0) return preview

  const nextSheets = preview.excelSheets.map((sheet) => ({
    ...sheet,
    rows: sheet.rows ? cloneTableRows(sheet.rows) : undefined,
  }))
  const rows = nextSheets[sheetIndex].rows
    ? cloneTableRows(nextSheets[sheetIndex].rows)
    : cloneTableRows(preview.tableRows)

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
    ...preview,
    excelSheets: nextSheets,
    tableRows: cloneTableRows(rows),
    excelDirty: true,
  }
}

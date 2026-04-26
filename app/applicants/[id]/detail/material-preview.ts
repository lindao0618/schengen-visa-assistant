import type { PreviewKind } from "./types"

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

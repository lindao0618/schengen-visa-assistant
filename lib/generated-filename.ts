const FILESYSTEM_UNSAFE_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function sanitizeGeneratedFilenamePart(value: unknown, fallback = "applicant") {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(FILESYSTEM_UNSAFE_CHARS, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/[. ]+$/g, "")

  const safeValue = normalized.slice(0, 90)
  if (!safeValue) return fallback
  if (WINDOWS_RESERVED_NAMES.test(safeValue)) return `${safeValue}_file`
  return safeValue
}

export function buildApplicantGeneratedFilename(applicantName: unknown, label: string, extension: string) {
  const safeApplicantName = sanitizeGeneratedFilenamePart(applicantName)
  const safeLabel = sanitizeGeneratedFilenamePart(label, "file")
  const safeExtension = extension.trim().startsWith(".") ? extension.trim() : `.${extension.trim()}`

  return `${safeApplicantName}-${safeLabel}${safeExtension}`
}

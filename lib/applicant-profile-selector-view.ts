export type ApplicantBusinessTag = "usa" | "france" | "uk" | "both" | null | undefined

export type ApplicantSelectorViewProfile = {
  id: string
  label: string
  name?: string
  phone?: string
  email?: string
  wechat?: string
  passportNumber?: string
  passportLast4?: string
  updatedAt?: string
  visaType?: string
  region?: string
  businessTag?: ApplicantBusinessTag
  usVisa?: {
    aaCode?: string
    passportNumber?: string
  }
  schengen?: {
    country?: string
    city?: string
    fraNumber?: string
  }
  files?: Record<string, unknown>
}

export function formatApplicantSelectorDateTime(value?: string | null) {
  if (!value) return "暂无更新"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "暂无更新"

  return `更新于 ${date.toLocaleDateString("zh-CN")} ${date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`
}

export function getApplicantPassportTail(profile?: ApplicantSelectorViewProfile | null) {
  if (!profile) return ""
  return profile.passportLast4 || profile.passportNumber?.slice(-4) || profile.usVisa?.passportNumber?.slice(-4) || ""
}

export function getApplicantBusinessTagBadge(tag: ApplicantBusinessTag) {
  switch (tag) {
    case "both":
      return {
        label: "双办理",
        className: "border-violet-200 bg-violet-50 text-violet-700",
      }
    case "usa":
      return {
        label: "美签",
        className: "border-blue-200 bg-blue-50 text-blue-700",
      }
    case "france":
      return {
        label: "法签",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      }
    case "uk":
      return {
        label: "英签",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }
    default:
      return null
  }
}

export function hasReusableApplicantMaterials(profile: ApplicantSelectorViewProfile) {
  return Boolean(
    profile.files?.usVisaDs160Excel ||
      profile.files?.ds160Excel ||
      profile.files?.usVisaPhoto ||
      profile.files?.schengenExcel ||
      profile.files?.franceExcel,
  )
}

export function getApplicantSelectorSearchValue(profile: ApplicantSelectorViewProfile) {
  return [
    profile.name,
    profile.label,
    profile.phone,
    profile.email,
    profile.wechat,
    profile.passportNumber,
    getApplicantPassportTail(profile),
  ]
    .filter(Boolean)
    .join(" ")
}

export const APP_ROLE_VALUES = ["boss", "supervisor", "specialist", "service"] as const

export type AppRole = (typeof APP_ROLE_VALUES)[number]

export const APP_ROLE_OPTIONS: Array<{ value: AppRole; label: string }> = [
  { value: "boss", label: "老板" },
  { value: "supervisor", label: "主管" },
  { value: "specialist", label: "专员" },
  { value: "service", label: "客服" },
]

const ROLE_ALIAS_MAP: Record<string, AppRole> = {
  admin: "boss",
  boss: "boss",
  supervisor: "supervisor",
  manager: "supervisor",
  user: "specialist",
  specialist: "specialist",
  staff: "specialist",
  service: "service",
  support: "service",
  customer_service: "service",
  "customer-service": "service",
}

export function isAppRole(role: string): role is AppRole {
  return APP_ROLE_VALUES.includes(role as AppRole)
}

export function normalizeAppRole(role?: string | null): AppRole {
  const normalized = String(role || "").trim().toLowerCase()
  return ROLE_ALIAS_MAP[normalized] || "specialist"
}

export function getAppRoleLabel(role?: string | null) {
  return APP_ROLE_OPTIONS.find((option) => option.value === normalizeAppRole(role))?.label || "专员"
}

export function getStoredRoleAliases(role?: string | null): string[] {
  const normalized = normalizeAppRole(role)
  switch (normalized) {
    case "boss":
      return ["boss", "admin"]
    case "supervisor":
      return ["supervisor"]
    case "service":
      return ["service"]
    case "specialist":
    default:
      return ["specialist", "user"]
  }
}

export function canAccessAdminPortal(role?: string | null) {
  const normalized = normalizeAppRole(role)
  return normalized === "boss" || normalized === "supervisor"
}

export function canManageUsers(role?: string | null) {
  return normalizeAppRole(role) === "boss"
}

export function canReadAllApplicants(role?: string | null) {
  return normalizeAppRole(role) !== "specialist"
}

export function canWriteApplicants(role?: string | null) {
  return normalizeAppRole(role) !== "service"
}

export function isReadOnlyRole(role?: string | null) {
  return normalizeAppRole(role) === "service"
}

export function canAssignCases(role?: string | null) {
  const normalized = normalizeAppRole(role)
  return normalized === "boss" || normalized === "supervisor"
}

export function canTriggerAutomation(role?: string | null) {
  return normalizeAppRole(role) !== "service"
}

export function canBeCaseAssignee(role?: string | null) {
  return normalizeAppRole(role) !== "service"
}

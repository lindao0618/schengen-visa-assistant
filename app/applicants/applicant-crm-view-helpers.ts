import type { ApplicantCrmRow, QuickView } from "@/app/applicants/applicant-crm-types"

export const STATUS_LABELS: Record<string, string> = {
  no_case: "\u672a\u521b\u5efa\u6848\u4ef6",
  pending_payment: "\u5f85\u4ed8\u6b3e",
  preparing_docs: "\u8d44\u6599\u51c6\u5907\u4e2d",
  reviewing: "\u5ba1\u6838\u4e2d",
  docs_ready: "\u6750\u6599\u5df2\u5c31\u7eea",
  tls_processing: "TLS \u5904\u7406\u4e2d",
  slot_booked: "\u5df2\u83b7\u53d6 Slot",
  submitted: "\u5df2\u9012\u7b7e",
  completed: "\u5df2\u5b8c\u6210",
  exception: "\u5f02\u5e38\u5904\u7406\u4e2d",
}

const actionableStatuses = new Set([
  "pending_payment",
  "preparing_docs",
  "reviewing",
  "docs_ready",
  "tls_processing",
  "slot_booked",
  "exception",
])

export function getApplicantCrmStatusLabel(statusKey: string, fallbackLabel?: string) {
  return STATUS_LABELS[statusKey] || fallbackLabel || statusKey || "-"
}

export function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function matchesQuickView(row: ApplicantCrmRow, quickView: QuickView, currentUserId?: string) {
  switch (quickView) {
    case "mine":
      return row.assignee?.id === currentUserId || (!row.assignee && row.owner.id === currentUserId)
    case "review":
      return row.currentStatusKey === "reviewing" || row.currentStatusKey === "docs_ready"
    case "exception":
      return row.currentStatusKey === "exception"
    case "today":
      return actionableStatuses.has(row.currentStatusKey)
    default:
      return true
  }
}

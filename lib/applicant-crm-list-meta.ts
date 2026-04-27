export type ApplicantCrmListMetaRow = {
  groupName?: string | null
  currentStatusKey: string
  owner: {
    id: string
  }
  assignee?: {
    id: string
  } | null
}

export type ApplicantCrmQuickCounts = {
  mine: number
  review: number
  exception: number
  today: number
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

function isMine(row: ApplicantCrmListMetaRow, userId: string) {
  return row.assignee?.id === userId || (!row.assignee && row.owner.id === userId)
}

export function buildApplicantCrmQuickCounts(
  rows: ApplicantCrmListMetaRow[],
  userId: string,
): ApplicantCrmQuickCounts {
  return rows.reduce<ApplicantCrmQuickCounts>(
    (counts, row) => {
      if (isMine(row, userId)) counts.mine += 1
      if (row.currentStatusKey === "reviewing" || row.currentStatusKey === "docs_ready") counts.review += 1
      if (row.currentStatusKey === "exception") counts.exception += 1
      if (actionableStatuses.has(row.currentStatusKey)) counts.today += 1
      return counts
    },
    { mine: 0, review: 0, exception: 0, today: 0 },
  )
}

export function buildApplicantCrmGroupOptions(rows: ApplicantCrmListMetaRow[]) {
  return Array.from(new Set(rows.map((row) => row.groupName?.trim()).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  )
}

export function matchesApplicantCrmQuickView(
  row: ApplicantCrmListMetaRow,
  quickView: keyof ApplicantCrmQuickCounts | undefined,
  userId: string,
) {
  switch (quickView) {
    case "mine":
      return isMine(row, userId)
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

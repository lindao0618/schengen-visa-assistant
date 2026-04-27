export type ApplicantCrmStatusOption = {
  value: string
  label: string
}

export type ApplicantCrmRow = {
  id: string
  name: string
  groupName?: string
  phone?: string
  email?: string
  wechat?: string
  passportNumber?: string
  visaType?: string
  caseType?: string
  region?: string
  currentStatusKey: string
  currentStatusLabel: string
  priority?: string
  travelDate?: string | null
  updatedAt: string
  activeCaseId?: string | null
  owner: {
    id: string
    name?: string | null
    email: string
  }
  assignee?: {
    id: string
    name?: string | null
    email: string
  } | null
}

export type ApplicantCrmStats = {
  applicantCount: number
  activeCaseCount: number
  exceptionCaseCount: number
  updatedLast7DaysCount: number
}

export type ApplicantCrmQuickCounts = {
  mine: number
  review: number
  exception: number
  today: number
}

export type ApplicantCrmPagination = {
  totalRows: number
  limit: number
  offset: number
  hasMore: boolean
}

export type FilterOptions = {
  visaTypes: string[]
  regions: string[]
  priorities: string[]
  statuses: ApplicantCrmStatusOption[]
}

export type ApplicantsRowsResponse = {
  rows: ApplicantCrmRow[]
  pagination?: ApplicantCrmPagination
  quickCounts?: ApplicantCrmQuickCounts
  groupOptions?: string[]
  error?: string
}

export type ApplicantsSummaryResponse = {
  stats: ApplicantCrmStats
  error?: string
}

export type ApplicantsAssigneesResponse = {
  availableAssignees: Array<{
    id: string
    name?: string | null
    email: string
    role: string
  }>
  error?: string
}

export type FilterTone = "visa" | "status" | "region" | "priority"
export type QuickView = "all" | "mine" | "review" | "exception" | "today"

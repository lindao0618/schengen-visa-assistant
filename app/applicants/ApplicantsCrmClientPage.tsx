"use client"

import {
  type ReactNode,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  Clock3,
  FolderPlus,
  ListFilter,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
  getApplicantCrmPriorityLabel,
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import {
  APPLICANT_CRM_ASSIGNEES_CACHE_TTL_MS,
  APPLICANT_CRM_SUMMARY_CACHE_PREFIX,
  APPLICANT_CRM_SUMMARY_CACHE_TTL_MS,
  APPLICANT_DETAIL_CACHE_TTL_MS,
  APPLICANT_CRM_ASSIGNEES_CACHE_PREFIX,
  FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX,
  APPLICANT_CRM_LIST_CACHE_PREFIX,
  APPLICANT_CRM_LIST_CACHE_TTL_MS,
  APPLICANT_SELECTOR_CACHE_KEY,
  clearClientCache,
  clearClientCacheByPrefix,
  getApplicantCrmAssigneesCacheKey,
  getApplicantDetailCacheKey,
  getApplicantCrmListCacheKey,
  getApplicantCrmSummaryCacheKey,
  prefetchJsonIntoClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/applicant-client-cache"
import { type ApplicantDetailPrefetchSource, shouldPrefetchApplicantDetailJson } from "@/lib/applicant-list-prefetch"
import {
  canAccessAdminPortal,
  canAssignCases,
  canReadAllApplicants,
  canWriteApplicants,
  getAppRoleLabel,
  normalizeAppRole,
} from "@/lib/access-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CreateApplicantForm } from "@/app/applicants/create-applicant-dialog"
import { ApplicantCrmRowsTable } from "@/app/applicants/applicant-crm-rows-table"

const CreateApplicantDialog = dynamic(
  () => import("@/app/applicants/create-applicant-dialog").then((module) => module.CreateApplicantDialog),
  { ssr: false },
)

const APPLICANT_CRM_INITIAL_VISIBLE_ROWS = 50
const APPLICANT_CRM_VISIBLE_ROWS_STEP = 50

type ApplicantCrmStatusOption = {
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

type ApplicantCrmStats = {
  applicantCount: number
  activeCaseCount: number
  exceptionCaseCount: number
  updatedLast7DaysCount: number
}

type FilterOptions = {
  visaTypes: string[]
  regions: string[]
  priorities: string[]
  statuses: ApplicantCrmStatusOption[]
}

type ApplicantsRowsResponse = {
  rows: ApplicantCrmRow[]
  error?: string
}

type ApplicantsSummaryResponse = {
  stats: ApplicantCrmStats
  error?: string
}

type ApplicantsAssigneesResponse = {
  availableAssignees: Array<{
    id: string
    name?: string | null
    email: string
    role: string
  }>
  error?: string
}

type FilterTone = "visa" | "status" | "region" | "priority"
type QuickView = "all" | "mine" | "review" | "exception" | "today"
type BatchActionMode = "set-group" | "clear-group" | "delete" | null

const emptyCreateForm: CreateApplicantForm = {
  name: "",
  phone: "",
  email: "",
  wechat: "",
  passportNumber: "",
  note: "",
  createFirstCase: true,
  visaTypes: ["france-schengen"],
  applyRegion: "uk",
  priority: "normal",
  travelDate: "",
  assignedToUserId: "",
}

const STATUS_LABELS: Record<string, string> = {
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

const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  visaTypes: CRM_VISA_TYPE_OPTIONS.map((item) => item.value),
  regions: CRM_REGION_OPTIONS.map((item) => item.value),
  priorities: CRM_PRIORITY_OPTIONS.map((item) => item.value),
  statuses: Object.entries(STATUS_LABELS)
    .filter(([value]) => value !== "no_case")
    .map(([value, label]) => ({ value, label })),
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

const toneClassMap: Record<
  FilterTone,
  {
    active: string
    inactive: string
    dot: string
  }
> = {
  visa: {
    active: "border-blue-700 bg-blue-700 text-white shadow-sm shadow-blue-200",
    inactive: "border-blue-100 bg-blue-50/70 text-blue-900 hover:border-blue-300 hover:bg-blue-100",
    dot: "bg-blue-400",
  },
  status: {
    active: "border-cyan-700 bg-cyan-700 text-white shadow-sm shadow-cyan-200",
    inactive: "border-cyan-100 bg-cyan-50/80 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100",
    dot: "bg-cyan-400",
  },
  region: {
    active: "border-amber-600 bg-amber-500 text-white shadow-sm shadow-amber-200",
    inactive: "border-amber-100 bg-amber-50/80 text-amber-900 hover:border-amber-300 hover:bg-amber-100",
    dot: "bg-amber-400",
  },
  priority: {
    active: "border-orange-700 bg-orange-600 text-white shadow-sm shadow-orange-200",
    inactive: "border-orange-100 bg-orange-50/80 text-orange-900 hover:border-orange-300 hover:bg-orange-100",
    dot: "bg-orange-400",
  },
}

function buildSuggestedGroupName() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const hh = String(now.getHours()).padStart(2, "0")
  const mi = String(now.getMinutes()).padStart(2, "0")
  return `自定义分组 ${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function getApplicantCrmStatusLabel(statusKey: string, fallbackLabel?: string) {
  return STATUS_LABELS[statusKey] || fallbackLabel || statusKey || "-"
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function matchesQuickView(row: ApplicantCrmRow, quickView: QuickView, currentUserId?: string) {
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

function FilterGroup({
  title,
  tone,
  options,
  selected,
  onToggle,
}: {
  title: string
  tone: FilterTone
  options: Array<{ value: string; label: string }>
  selected: string[]
  onToggle: (value: string) => void
}) {
  const toneClasses = toneClassMap[tone]
  const selectedLabels = options.filter((option) => selected.includes(option.value)).map((option) => option.label)
  const summary =
    selectedLabels.length === 0
      ? "全部"
      : selectedLabels.length <= 2
        ? selectedLabels.join("、")
        : `已选 ${selectedLabels.length} 项`

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {options.length === 0 ? (
        <span className="text-sm text-gray-400">{"\u6682\u65e0\u53ef\u9009\u9879"}</span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-11 w-full justify-between rounded-2xl border px-4 text-left text-sm font-medium shadow-sm",
                selected.length > 0 ? toneClasses.active : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <ListFilter className="h-4 w-4 shrink-0" />
                <span className="truncate">{summary}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px] rounded-2xl border-gray-200 p-2">
            <DropdownMenuLabel className="px-2 py-1 text-xs uppercase tracking-[0.18em] text-gray-500">
              {title}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
                onSelect={(event) => event.preventDefault()}
                className="rounded-xl"
              >
                <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", toneClasses.dot)} />
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string
  value: number
  hint: string
  icon: ReactNode
}) {
  return (
    <Card className="border-gray-200 bg-white/90">
      <CardContent className="flex items-center justify-between p-5">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">{title}</div>
          <div className="text-3xl font-semibold text-gray-900">{value}</div>
          <div className="text-xs text-gray-400">{hint}</div>
        </div>
        <div className="rounded-2xl bg-gray-100 p-3 text-gray-700">{icon}</div>
      </CardContent>
    </Card>
  )
}

function QuickViewCard({
  title,
  value,
  hint,
  icon,
  active,
  onClick,
}: {
  title: string
  value: number
  hint: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all",
        active
          ? "border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-200"
          : "border-gray-200 bg-white/90 text-gray-900 hover:border-gray-300 hover:bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className={cn("text-sm font-medium", active ? "text-white/80" : "text-gray-500")}>{title}</div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className={cn("text-xs", active ? "text-white/75" : "text-gray-400")}>{hint}</div>
        </div>
        <div
          className={cn(
            "rounded-2xl p-3",
            active ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700",
          )}
        >
          {icon}
        </div>
      </div>
    </button>
  )
}

function SelectedFilterPill({
  label,
  tone,
  onRemove,
}: {
  label: string
  tone: FilterTone
  onRemove: () => void
}) {
  const toneClasses = toneClassMap[tone]
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        toneClasses.inactive,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", toneClasses.dot)} />
      {label}
      <span className="text-xs opacity-70">×</span>
    </button>
  )
}

export default function ApplicantsCrmClientPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const viewerRole = normalizeAppRole(session?.user?.role)
  const canOpenAdmin = canAccessAdminPortal(viewerRole)
  const canAssign = canAssignCases(viewerRole)
  const canReadAll = canReadAllApplicants(viewerRole)
  const canEditApplicants = canWriteApplicants(viewerRole)
  const [rows, setRows] = useState<ApplicantCrmRow[]>([])
  const [stats, setStats] = useState<ApplicantCrmStats>({
    applicantCount: 0,
    activeCaseCount: 0,
    exceptionCaseCount: 0,
    updatedLast7DaysCount: 0,
  })
  const [availableAssignees, setAvailableAssignees] = useState<ApplicantsAssigneesResponse["availableAssignees"]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [assigneesLoading, setAssigneesLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [keyword, setKeyword] = useState("")
  const [selectedVisaTypes, setSelectedVisaTypes] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [quickView, setQuickView] = useState<QuickView>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateApplicantForm>(emptyCreateForm)
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([])
  const [batchActionMode, setBatchActionMode] = useState<BatchActionMode>(null)
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [groupNameInput, setGroupNameInput] = useState("")
  const [visibleRowLimit, setVisibleRowLimit] = useState(APPLICANT_CRM_INITIAL_VISIBLE_ROWS)
  const initialLoadRef = useRef(true)
  const deferredKeyword = useDeferredValue(keyword.trim())
  const requestQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (deferredKeyword) params.set("keyword", deferredKeyword)
    for (const value of selectedVisaTypes) params.append("visaTypes", value)
    for (const value of selectedStatuses) params.append("statuses", value)
    for (const value of selectedRegions) params.append("regions", value)
    for (const value of selectedPriorities) params.append("priorities", value)
    params.set("includeProfiles", "0")
    params.set("includeProfileFiles", "0")
    return params.toString()
  }, [deferredKeyword, selectedPriorities, selectedRegions, selectedStatuses, selectedVisaTypes])
  const viewerCacheScope = useMemo(
    () => `${session?.user?.id || "anon"}:${session?.user?.role || ""}`,
    [session?.user?.id, session?.user?.role],
  )
  const listCacheKey = useMemo(
    () => getApplicantCrmListCacheKey(`${viewerCacheScope}:${requestQuery}`),
    [requestQuery, viewerCacheScope],
  )
  const summaryCacheKey = useMemo(
    () => getApplicantCrmSummaryCacheKey(viewerCacheScope),
    [viewerCacheScope],
  )
  const assigneesCacheKey = useMemo(
    () => getApplicantCrmAssigneesCacheKey(viewerCacheScope),
    [viewerCacheScope],
  )

  const applyApplicantsRows = useCallback((data: ApplicantsRowsResponse | null | undefined) => {
    setRows(data?.rows || [])
  }, [])

  const fetchApplicants = useCallback(
    async (mode: "auto" | "manual" = "auto") => {
      const cached = mode === "auto" ? readClientCache<ApplicantsRowsResponse>(listCacheKey) : null

      if (cached) {
        applyApplicantsRows(cached)
        setLoading(false)
        setRefreshing(false)
        initialLoadRef.current = false
      } else if (mode === "manual" || !initialLoadRef.current) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const response = await fetch(`/api/applicants?${requestQuery}`, {
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as ApplicantsRowsResponse | null
        if (!response.ok || !data?.rows) {
          throw new Error(data?.error || "\u52a0\u8f7d\u7533\u8bf7\u4eba\u5217\u8868\u5931\u8d25")
        }

        applyApplicantsRows(data)
        writeClientCache(listCacheKey, data, APPLICANT_CRM_LIST_CACHE_TTL_MS)
      } catch (error) {
        if (!cached) {
          setMessage(error instanceof Error ? error.message : "\u52a0\u8f7d\u7533\u8bf7\u4eba\u5217\u8868\u5931\u8d25")
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
        initialLoadRef.current = false
      }
    },
    [applyApplicantsRows, listCacheKey, requestQuery],
  )

  useEffect(() => {
    void fetchApplicants("auto")
  }, [fetchApplicants])

  const fetchSummary = useCallback(
    async (mode: "auto" | "manual" = "auto") => {
      const cached = mode === "auto" ? readClientCache<ApplicantsSummaryResponse>(summaryCacheKey) : null

      if (cached?.stats) {
        setStats(cached.stats)
        setSummaryLoading(false)
      } else {
        setSummaryLoading(true)
      }

      try {
        const response = await fetch("/api/applicants/summary", {
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as ApplicantsSummaryResponse | null
        if (!response.ok || !data?.stats) {
          throw new Error(data?.error || "\u52a0\u8f7d\u7edf\u8ba1\u5361\u7247\u5931\u8d25")
        }

        setStats(data.stats)
        writeClientCache(summaryCacheKey, data, APPLICANT_CRM_SUMMARY_CACHE_TTL_MS)
      } catch (error) {
        if (!cached) {
          setMessage(error instanceof Error ? error.message : "\u52a0\u8f7d\u7edf\u8ba1\u5361\u7247\u5931\u8d25")
        }
      } finally {
        setSummaryLoading(false)
      }
    },
    [summaryCacheKey],
  )

  useEffect(() => {
    void fetchSummary("auto")
  }, [fetchSummary])

  const fetchAvailableAssignees = useCallback(
    async (mode: "auto" | "manual" = "auto") => {
      if (!canAssign) {
        setAvailableAssignees([])
        setAssigneesLoading(false)
        return
      }

      const cached = mode === "auto" ? readClientCache<ApplicantsAssigneesResponse>(assigneesCacheKey) : null
      if (cached?.availableAssignees) {
        setAvailableAssignees(cached.availableAssignees)
        setAssigneesLoading(false)
      } else {
        setAssigneesLoading(true)
      }

      try {
        const response = await fetch("/api/applicants/assignees", {
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as ApplicantsAssigneesResponse | null
        if (!response.ok || !data?.availableAssignees) {
          throw new Error(data?.error || "\u52a0\u8f7d\u53ef\u5206\u914d\u6210\u5458\u5931\u8d25")
        }

        setAvailableAssignees(data.availableAssignees)
        writeClientCache(assigneesCacheKey, data, APPLICANT_CRM_ASSIGNEES_CACHE_TTL_MS)
      } catch (error) {
        if (!cached) {
          setMessage(error instanceof Error ? error.message : "\u52a0\u8f7d\u53ef\u5206\u914d\u6210\u5458\u5931\u8d25")
        }
      } finally {
        setAssigneesLoading(false)
      }
    },
    [assigneesCacheKey, canAssign],
  )

  useEffect(() => {
    if (!createDialogOpen || !canAssign) return
    void fetchAvailableAssignees("auto")
  }, [canAssign, createDialogOpen, fetchAvailableAssignees])

  const refreshCrmDashboard = useCallback(() => {
    setMessage("")
    void fetchApplicants("manual")
    void fetchSummary("manual")
    if (createDialogOpen && canAssign) {
      void fetchAvailableAssignees("manual")
    }
  }, [canAssign, createDialogOpen, fetchApplicants, fetchAvailableAssignees, fetchSummary])

  const availableGroupOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.groupName?.trim()).filter(Boolean) as string[]))
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
        .map((value) => ({ value, label: value })),
    [rows],
  )
  const displayRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!matchesQuickView(row, quickView, session?.user?.id)) return false
        if (selectedGroups.length > 0 && !selectedGroups.includes(row.groupName || "")) return false
        return true
      }),
    [quickView, rows, selectedGroups, session?.user?.id],
  )
  const visibleRows = useMemo(
    () => displayRows.slice(0, visibleRowLimit),
    [displayRows, visibleRowLimit],
  )
  const displayRowIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows])
  const selectedVisibleCount = useMemo(
    () => displayRowIds.filter((id) => selectedApplicantIds.includes(id)).length,
    [displayRowIds, selectedApplicantIds],
  )
  const allVisibleSelected = visibleRows.length > 0 && selectedVisibleCount === visibleRows.length
  const hasMoreVisibleRows = visibleRows.length < displayRows.length

  const quickCards = useMemo(() => {
    const mineCount = rows.filter((row) => matchesQuickView(row, "mine", session?.user?.id)).length
    const reviewCount = rows.filter((row) => matchesQuickView(row, "review", session?.user?.id)).length
    const exceptionCount = rows.filter((row) => matchesQuickView(row, "exception", session?.user?.id)).length
    const todayCount = rows.filter((row) => matchesQuickView(row, "today", session?.user?.id)).length

    return [
      {
        key: "mine" as const,
        title: "\u6211\u8d1f\u8d23\u7684",
        value: mineCount,
        hint: "\u6211\u521b\u5efa\u6216\u88ab\u5206\u914d\u7ed9\u6211\u7684\u7533\u8bf7\u4eba",
        icon: <BriefcaseBusiness className="h-5 w-5" />,
      },
      {
        key: "review" as const,
        title: "\u5f85\u5ba1\u6838",
        value: reviewCount,
        hint: "\u6b63\u5728\u5ba1\u6838\u6216\u6750\u6599\u5df2\u5c31\u7eea",
        icon: <Clock3 className="h-5 w-5" />,
      },
      {
        key: "exception" as const,
        title: "\u5f02\u5e38\u5904\u7406\u4e2d",
        value: exceptionCount,
        hint: "\u9700\u8981\u4f18\u5148\u8ddf\u8fdb\u7684\u5f02\u5e38\u6848\u4ef6",
        icon: <AlertCircle className="h-5 w-5" />,
      },
      {
        key: "today" as const,
        title: "\u4eca\u65e5\u8981\u63a8\u8fdb",
        value: todayCount,
        hint: "\u5f53\u524d\u4ecd\u5728\u63a8\u8fdb\u94fe\u8def\u4e2d\u7684\u6848\u4ef6",
        icon: <Sparkles className="h-5 w-5" />,
      },
    ]
  }, [rows, session?.user?.id])

  const selectedFilterItems = useMemo(() => {
    const items: Array<{ key: string; label: string; tone: FilterTone; onRemove: () => void }> = []

    for (const value of selectedVisaTypes) {
      items.push({
        key: `visa-${value}`,
        label: getApplicantCrmVisaTypeLabel(value),
        tone: "visa",
        onRemove: () => setSelectedVisaTypes((prev) => prev.filter((item) => item !== value)),
      })
    }
    for (const value of selectedStatuses) {
      items.push({
        key: `status-${value}`,
        label: getApplicantCrmStatusLabel(value),
        tone: "status",
        onRemove: () => setSelectedStatuses((prev) => prev.filter((item) => item !== value)),
      })
    }
    for (const value of selectedRegions) {
      items.push({
        key: `region-${value}`,
        label: getApplicantCrmRegionLabel(value),
        tone: "region",
        onRemove: () => setSelectedRegions((prev) => prev.filter((item) => item !== value)),
      })
    }
    for (const value of selectedPriorities) {
      items.push({
        key: `priority-${value}`,
        label: getApplicantCrmPriorityLabel(value),
        tone: "priority",
        onRemove: () => setSelectedPriorities((prev) => prev.filter((item) => item !== value)),
      })
    }
    for (const value of selectedGroups) {
      items.push({
        key: `group-${value}`,
        label: `分组：${value}`,
        tone: "visa",
        onRemove: () => setSelectedGroups((prev) => prev.filter((item) => item !== value)),
      })
    }

    return items
  }, [selectedGroups, selectedPriorities, selectedRegions, selectedStatuses, selectedVisaTypes])

  const hasFilters = useMemo(
    () =>
      Boolean(keyword.trim()) ||
      selectedVisaTypes.length > 0 ||
      selectedStatuses.length > 0 ||
      selectedRegions.length > 0 ||
      selectedPriorities.length > 0 ||
      selectedGroups.length > 0 ||
      quickView !== "all",
    [keyword, quickView, selectedGroups.length, selectedPriorities.length, selectedRegions.length, selectedStatuses.length, selectedVisaTypes.length],
  )

  const prefetchApplicantDetail = useCallback(
    (applicantId: string, source: ApplicantDetailPrefetchSource = "intent") => {
      if (!applicantId) return
      router.prefetch(`/applicants/${applicantId}`)
      if (!shouldPrefetchApplicantDetailJson({ applicantId, source })) return
      void prefetchJsonIntoClientCache(getApplicantDetailCacheKey(applicantId), `/api/applicants/${applicantId}`, {
        ttlMs: APPLICANT_DETAIL_CACHE_TTL_MS,
      }).catch(() => {
        // Ignore background prefetch errors.
      })
    },
    [router],
  )

  const openApplicantDetail = useCallback(
    (applicantId: string) => {
      router.push(`/applicants/${applicantId}`)
    },
    [router],
  )

  useEffect(() => {
    displayRows.slice(0, 3).forEach((row) => {
      prefetchApplicantDetail(row.id, "automatic")
    })
  }, [displayRows, prefetchApplicantDetail])

  useEffect(() => {
    setVisibleRowLimit(APPLICANT_CRM_INITIAL_VISIBLE_ROWS)
  }, [quickView, requestQuery, selectedGroups])

  useEffect(() => {
    setSelectedApplicantIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)))
  }, [rows])

  const clearFilters = () => {
    setKeyword("")
    setSelectedVisaTypes([])
    setSelectedStatuses([])
    setSelectedRegions([])
    setSelectedPriorities([])
    setSelectedGroups([])
    setQuickView("all")
    setMessage("")
  }

  const createApplicant = async () => {
    if (!createForm.name.trim()) {
      setMessage("\u8bf7\u5148\u586b\u5199\u7533\u8bf7\u4eba\u59d3\u540d")
      return
    }

    if (createForm.createFirstCase && createForm.visaTypes.length === 0) {
      setMessage("\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u7b7e\u8bc1\u6848\u4ef6")
      return
    }

    setCreating(true)
    setMessage("")

    try {
      const response = await fetch("/api/applicants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          visaTypes: createForm.visaTypes,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.profile?.id) {
        throw new Error(data?.error || "\u521b\u5efa\u7533\u8bf7\u4eba\u5931\u8d25")
      }

      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      clearClientCacheByPrefix(APPLICANT_CRM_ASSIGNEES_CACHE_PREFIX)
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
      window.localStorage.setItem("activeApplicantProfileId", data.profile.id)
      const firstCaseId = data?.cases?.[0]?.id || data?.case?.id
      if (firstCaseId) {
        window.localStorage.setItem("activeApplicantCaseId", firstCaseId)
      }
      setCreateDialogOpen(false)
      setCreateForm(emptyCreateForm)
      prefetchApplicantDetail(data.profile.id, "create")
      router.push(`/applicants/${data.profile.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "\u521b\u5efa\u7533\u8bf7\u4eba\u5931\u8d25")
    } finally {
      setCreating(false)
    }
  }

  const toggleApplicantSelection = (applicantId: string, checked: boolean) => {
    setSelectedApplicantIds((prev) =>
      checked ? Array.from(new Set([...prev, applicantId])) : prev.filter((id) => id !== applicantId),
    )
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedApplicantIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...displayRowIds]))
      }
      return prev.filter((id) => !displayRowIds.includes(id))
    })
  }

  const showMoreRows = () => {
    startTransition(() => {
      setVisibleRowLimit((prev) => Math.min(prev + APPLICANT_CRM_VISIBLE_ROWS_STEP, displayRows.length))
    })
  }

  const resetBatchActionState = () => {
    setBatchActionMode(null)
    setBatchActionLoading(false)
    setGroupNameInput("")
  }

  const openSetGroupDialog = () => {
    setGroupNameInput(buildSuggestedGroupName())
    setBatchActionMode("set-group")
  }

  const applyGroupToSelected = async () => {
    const ids = selectedApplicantIds
    const groupName = groupNameInput.trim()
    if (ids.length === 0) {
      setMessage("请先选择申请人")
      return
    }
    if (!groupName) {
      setMessage("请先填写组名")
      return
    }

    setBatchActionLoading(true)
    setMessage("")
    const previousRows = rows
    const previousSelectedIds = selectedApplicantIds
    setRows((prev) => prev.map((row) => (ids.includes(row.id) ? { ...row, groupName } : row)))
    setSelectedApplicantIds([])
    resetBatchActionState()
    setMessage(`正在保存分组：${groupName}`)
    try {
      const response = await fetch("/api/applicants/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, groupName }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "设置分组失败")
      }

      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      setMessage(`已将 ${data?.updatedIds?.length || ids.length} 位申请人加入分组：${groupName}`)
      void fetchApplicants("manual")
    } catch (error) {
      setRows(previousRows)
      setSelectedApplicantIds(previousSelectedIds)
      setBatchActionLoading(false)
      setMessage(error instanceof Error ? error.message : "设置分组失败")
    }
  }

  const clearGroupForSelected = async () => {
    const ids = selectedApplicantIds
    if (ids.length === 0) {
      setMessage("请先选择申请人")
      return
    }

    setBatchActionLoading(true)
    setMessage("")
    const previousRows = rows
    const previousSelectedIds = selectedApplicantIds
    setRows((prev) => prev.map((row) => (ids.includes(row.id) ? { ...row, groupName: undefined } : row)))
    setSelectedApplicantIds([])
    resetBatchActionState()
    setMessage(`正在清空 ${ids.length} 位申请人的分组`)
    try {
      const response = await fetch("/api/applicants/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, groupName: null }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "清空分组失败")
      }

      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      setMessage(`已清空 ${data?.updatedIds?.length || ids.length} 位申请人的分组`)
      void fetchApplicants("manual")
    } catch (error) {
      setRows(previousRows)
      setSelectedApplicantIds(previousSelectedIds)
      setBatchActionLoading(false)
      setMessage(error instanceof Error ? error.message : "清空分组失败")
    }
  }

  const deleteSelectedApplicants = async () => {
    const ids = selectedApplicantIds
    if (ids.length === 0) {
      setMessage("请先选择申请人")
      return
    }

    setBatchActionLoading(true)
    setMessage("")
    try {
      const response = await fetch("/api/applicants/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "批量删除失败")
      }

      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
      await fetchApplicants("manual")
      await fetchSummary("manual")
      setMessage(`已删除 ${data?.deletedIds?.length || ids.length} 位申请人`)
      setSelectedApplicantIds([])
      resetBatchActionState()
    } catch (error) {
      setBatchActionLoading(false)
      setMessage(error instanceof Error ? error.message : "批量删除失败")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                {"\u5458\u5de5\u5de5\u4f5c\u53f0"}
              </Badge>
              {canReadAll && (
                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                  {`${getAppRoleLabel(viewerRole)}视角可查看团队数据`}
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold text-gray-900">{"\u7533\u8bf7\u4eba CRM \u5de5\u4f5c\u53f0"}</h1>
              <p className="text-sm text-gray-500">
                {"\u5728\u8fd9\u91cc\u8ddf\u8fdb\u7533\u8bf7\u4eba\u3001\u6848\u4ef6\u3001\u6750\u6599\u4e0e\u81ea\u52a8\u5316\u6d41\u7a0b\uff1b\u8001\u677f\u548c\u4e3b\u7ba1\u53ef\u4ece\u540e\u53f0\u67e5\u770b\u5168\u5c40\u6570\u636e\u4e0e\u5f02\u5e38\u3002"}
              </p>
          </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canOpenAdmin && (
              <Button variant="outline" asChild>
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  {"\u7ba1\u7406\u540e\u53f0"}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={refreshCrmDashboard} disabled={refreshing || summaryLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", (refreshing || summaryLoading) && "animate-spin")} />
              {"\u5237\u65b0\u6570\u636e"}
            </Button>
            {canEditApplicants ? (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {"\u65b0\u5efa\u7533\u8bf7\u4eba"}
              </Button>
            ) : null}
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={"\u7533\u8bf7\u4eba\u603b\u6570"}
            value={stats.applicantCount}
            hint={summaryLoading ? "\u7edf\u8ba1\u5361\u7247\u5237\u65b0\u4e2d" : "\u5f53\u524d\u53ef\u89c1\u7533\u8bf7\u4eba"}
            icon={<UserPlus className="h-5 w-5" />}
          />
          <StatCard
            title={"\u6d3b\u8dc3\u6848\u4ef6\u6570"}
            value={stats.activeCaseCount}
            hint={summaryLoading ? "\u7edf\u8ba1\u5361\u7247\u5237\u65b0\u4e2d" : "\u6b63\u5728\u63a8\u8fdb\u7684 Case \u6570\u91cf"}
            icon={<BriefcaseBusiness className="h-5 w-5" />}
          />
          <StatCard
            title={"\u5f02\u5e38\u6848\u4ef6\u6570"}
            value={stats.exceptionCaseCount}
            hint={summaryLoading ? "\u7edf\u8ba1\u5361\u7247\u5237\u65b0\u4e2d" : "\u4f18\u5148\u8ddf\u8fdb\u5f02\u5e38\u4e0e\u963b\u585e"}
            icon={<AlertCircle className="h-5 w-5" />}
          />
          <StatCard
            title={"\u8fd1 7 \u5929\u66f4\u65b0"}
            value={stats.updatedLast7DaysCount}
            hint={summaryLoading ? "\u7edf\u8ba1\u5361\u7247\u5237\u65b0\u4e2d" : "\u6700\u8fd1\u6709\u52a8\u4f5c\u7684\u7533\u8bf7\u4eba"}
            icon={<CalendarClock className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          {quickCards.map((card) => (
            <QuickViewCard
              key={card.key}
              title={card.title}
              value={card.value}
              hint={card.hint}
              icon={card.icon}
              active={quickView === card.key}
              onClick={() => setQuickView((prev) => (prev === card.key ? "all" : card.key))}
            />
          ))}
        </div>

        <Card className="border-gray-200 bg-white/90">
          <CardHeader>
            <CardTitle>{"\u641c\u7d22\u4e0e\u7b5b\u9009"}</CardTitle>
            <CardDescription>{"\u70b9\u51fb\u6807\u7b7e\u5373\u53ef\u751f\u6548\u3002\u540c\u7ec4\u591a\u9009\u6309 OR\uff0c\u4e0d\u540c\u7b5b\u9009\u7ec4\u4e4b\u95f4\u6309 AND \u7ec4\u5408\u3002"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="pl-10"
                  placeholder={"\u641c\u7d22\u59d3\u540d\u3001\u624b\u673a\u53f7\u3001\u62a4\u7167\u53f7\u3001\u90ae\u7bb1\u3001\u5fae\u4fe1\u53f7"}
                />
              </div>
              <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters}>
                {"\u6e05\u7a7a\u7b5b\u9009"}
              </Button>
            </div>

            {(selectedFilterItems.length > 0 || quickView !== "all" || deferredKeyword) && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{"\u5df2\u9009\u6761\u4ef6"}</div>
                <div className="flex flex-wrap gap-2">
                  {quickView !== "all" && (
                    <SelectedFilterPill
                      label={quickCards.find((item) => item.key === quickView)?.title || "\u5feb\u6377\u7b5b\u9009"}
                      tone="status"
                      onRemove={() => setQuickView("all")}
                    />
                  )}
                  {deferredKeyword && (
                    <SelectedFilterPill
                      label={`\u5173\u952e\u8bcd\uff1a${deferredKeyword}`}
                      tone="visa"
                      onRemove={() => setKeyword("")}
                    />
                  )}
                  {selectedFilterItems.map((item) => (
                    <SelectedFilterPill
                      key={item.key}
                      label={item.label}
                      tone={item.tone}
                      onRemove={item.onRemove}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <FilterGroup
                title={"\u7b7e\u8bc1\u7c7b\u578b"}
                tone="visa"
                options={DEFAULT_FILTER_OPTIONS.visaTypes.map((item) => ({
                  value: item,
                  label: getApplicantCrmVisaTypeLabel(item),
                }))}
                selected={selectedVisaTypes}
                onToggle={(value) => setSelectedVisaTypes((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title={"\u5f53\u524d\u72b6\u6001"}
                tone="status"
                options={DEFAULT_FILTER_OPTIONS.statuses.map((item) => ({
                  value: item.value,
                  label: getApplicantCrmStatusLabel(item.value, item.label),
                }))}
                selected={selectedStatuses}
                onToggle={(value) => setSelectedStatuses((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title={"\u5730\u533a"}
                tone="region"
                options={DEFAULT_FILTER_OPTIONS.regions.map((item) => ({
                  value: item,
                  label: getApplicantCrmRegionLabel(item),
                }))}
                selected={selectedRegions}
                onToggle={(value) => setSelectedRegions((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title={"\u4f18\u5148\u7ea7"}
                tone="priority"
                options={DEFAULT_FILTER_OPTIONS.priorities.map((item) => ({
                  value: item,
                  label: getApplicantCrmPriorityLabel(item),
                }))}
                selected={selectedPriorities}
                onToggle={(value) => setSelectedPriorities((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title={"分组"}
                tone="visa"
                options={availableGroupOptions}
                selected={selectedGroups}
                onToggle={(value) => setSelectedGroups((prev) => toggleValue(prev, value))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-white/90">
          <CardHeader>
            <CardTitle>{"\u7533\u8bf7\u4eba\u5217\u8868"}</CardTitle>
            <CardDescription>
              {"\u70b9\u51fb\u884c\u6216\u201c\u67e5\u770b\u8be6\u60c5\u201d\u8fdb\u5165\u7533\u8bf7\u4eba\u5de5\u4f5c\u53f0\u3002"}
              {!loading && displayRows.length > 0 ? (
                <span className="ml-2 text-gray-400">
                  当前显示 {visibleRows.length} / {displayRows.length} 位
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEditApplicants && selectedApplicantIds.length > 0 && (
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-blue-900">已选中 {selectedApplicantIds.length} 位申请人</div>
                  <div className="text-xs text-blue-700">可以直接设置分组、清空分组，或批量删除。</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={openSetGroupDialog} disabled={batchActionLoading}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    设置分组
                  </Button>
                  <Button type="button" variant="outline" onClick={clearGroupForSelected} disabled={batchActionLoading}>
                    清空分组
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setBatchActionMode("delete")}
                    disabled={batchActionLoading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    批量删除
                  </Button>
                </div>
              </div>
            )}
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
              </div>
            ) : (
              <ApplicantCrmRowsTable
                rows={visibleRows}
                selectedApplicantIds={selectedApplicantIds}
                allVisibleSelected={allVisibleSelected}
                onToggleAllVisible={toggleSelectAllVisible}
                onToggleApplicant={toggleApplicantSelection}
                onOpenApplicant={openApplicantDetail}
                onPrefetchApplicant={prefetchApplicantDetail}
              />
            )}
            {!loading && hasMoreVisibleRows ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center">
                <div className="text-sm text-gray-500">
                  当前显示 {visibleRows.length} / {displayRows.length} 位申请人
                </div>
                <Button type="button" variant="outline" onClick={showMoreRows}>
                  加载更多申请人
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={batchActionMode === "set-group"}
        onOpenChange={(open) => {
          if (!open) resetBatchActionState()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>设置申请人分组</DialogTitle>
            <DialogDescription>
              支持自定义组名，建议带上时间，方便你后面直接按组识别。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="applicant-group-name">组名</Label>
            <Input
              id="applicant-group-name"
              value={groupNameInput}
              onChange={(event) => setGroupNameInput(event.target.value)}
              placeholder="例如：英国法签 2026-04-14 12:30"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetBatchActionState} disabled={batchActionLoading}>
              取消
            </Button>
            <Button type="button" onClick={applyGroupToSelected} disabled={batchActionLoading}>
              {batchActionLoading ? "保存中..." : "保存分组"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchActionMode === "delete"}
        onOpenChange={(open) => {
          if (!open) resetBatchActionState()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogDescription>
              将删除当前选中的 {selectedApplicantIds.length} 位申请人及其关联资料。这个操作不能撤回。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetBatchActionState} disabled={batchActionLoading}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={deleteSelectedApplicants} disabled={batchActionLoading}>
              {batchActionLoading ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {createDialogOpen ? (
        <CreateApplicantDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          createForm={createForm}
          setCreateForm={setCreateForm}
          canAssign={canAssign}
          assigneesLoading={assigneesLoading}
          availableAssignees={availableAssignees}
          creating={creating}
          onCreateApplicant={() => void createApplicant()}
        />
      ) : null}
    </div>
  )
}

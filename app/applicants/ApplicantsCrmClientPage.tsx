"use client"

import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type ApplicantCrmStatusOption = {
  value: string
  label: string
}

type ApplicantCrmRow = {
  id: string
  name: string
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

type ApplicantsResponse = {
  profiles: Array<{ id: string; label: string }>
  rows: ApplicantCrmRow[]
  stats: ApplicantCrmStats
  filterOptions: FilterOptions
  availableAssignees: Array<{
    id: string
    name?: string | null
    email: string
    role: string
  }>
  error?: string
}

type CreateApplicantForm = {
  name: string
  phone: string
  email: string
  wechat: string
  passportNumber: string
  note: string
  createFirstCase: boolean
  visaTypes: string[]
  applyRegion: string
  priority: string
  travelDate: string
  assignedToUserId: string
}

type FilterTone = "visa" | "status" | "region" | "priority"
type QuickView = "all" | "mine" | "review" | "exception" | "today"

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

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("zh-CN")
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function getStatusVariant(statusKey: string) {
  if (statusKey === "exception") return "destructive" as const
  if (statusKey === "completed") return "success" as const
  if (statusKey === "submitted" || statusKey === "slot_booked") return "info" as const
  if (statusKey === "reviewing") return "warning" as const
  return "outline" as const
}

function getPriorityBadgeClass(priority?: string) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-700"
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-gray-200 bg-gray-50 text-gray-700"
}

function getApplicantCrmStatusLabel(statusKey: string, fallbackLabel?: string) {
  return STATUS_LABELS[statusKey] || fallbackLabel || statusKey || "-"
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function toggleVisaTypeSelection(list: string[], value: string) {
  if (list.includes(value)) {
    return list.filter((item) => item !== value)
  }
  return [...list, value]
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

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.length === 0 ? (
          <span className="text-sm text-gray-400">{"\u6682\u65e0\u53ef\u9009\u9879"}</span>
        ) : (
          options.map((option) => {
            const active = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  active ? toneClasses.active : toneClasses.inactive,
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", active ? "bg-white/90" : toneClasses.dot)} />
                {option.label}
              </button>
            )
          })
        )}
      </div>
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
  const [rows, setRows] = useState<ApplicantCrmRow[]>([])
  const [stats, setStats] = useState<ApplicantCrmStats>({
    applicantCount: 0,
    activeCaseCount: 0,
    exceptionCaseCount: 0,
    updatedLast7DaysCount: 0,
  })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    visaTypes: [],
    regions: [],
    priorities: [],
    statuses: [],
  })
  const [availableAssignees, setAvailableAssignees] = useState<ApplicantsResponse["availableAssignees"]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState("")
  const [keyword, setKeyword] = useState("")
  const [selectedVisaTypes, setSelectedVisaTypes] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [quickView, setQuickView] = useState<QuickView>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateApplicantForm>(emptyCreateForm)
  const initialLoadRef = useRef(true)
  const deferredKeyword = useDeferredValue(keyword.trim())

  const fetchApplicants = useCallback(
    async (mode: "auto" | "manual" = "auto") => {
      if (mode === "manual" || !initialLoadRef.current) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const params = new URLSearchParams()
        if (deferredKeyword) params.set("keyword", deferredKeyword)
        for (const value of selectedVisaTypes) params.append("visaTypes", value)
        for (const value of selectedStatuses) params.append("statuses", value)
        for (const value of selectedRegions) params.append("regions", value)
        for (const value of selectedPriorities) params.append("priorities", value)

        const response = await fetch(`/api/applicants?${params.toString()}`, {
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as ApplicantsResponse | null
        if (!response.ok) {
          throw new Error(data?.error || "\u52a0\u8f7d\u7533\u8bf7\u4eba\u5217\u8868\u5931\u8d25")
        }

        setRows(data?.rows || [])
        setStats(
          data?.stats || {
            applicantCount: 0,
            activeCaseCount: 0,
            exceptionCaseCount: 0,
            updatedLast7DaysCount: 0,
          },
        )
        setFilterOptions(
          data?.filterOptions || {
            visaTypes: [],
            regions: [],
            priorities: [],
            statuses: [],
          },
        )
        setAvailableAssignees(data?.availableAssignees || [])
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "\u52a0\u8f7d\u7533\u8bf7\u4eba\u5217\u8868\u5931\u8d25")
      } finally {
        setLoading(false)
        setRefreshing(false)
        initialLoadRef.current = false
      }
    },
    [deferredKeyword, selectedPriorities, selectedRegions, selectedStatuses, selectedVisaTypes],
  )

  useEffect(() => {
    void fetchApplicants("auto")
  }, [fetchApplicants])

  const displayRows = useMemo(
    () => rows.filter((row) => matchesQuickView(row, quickView, session?.user?.id)),
    [quickView, rows, session?.user?.id],
  )

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

    return items
  }, [selectedPriorities, selectedRegions, selectedStatuses, selectedVisaTypes])

  const hasFilters = useMemo(
    () =>
      Boolean(keyword.trim()) ||
      selectedVisaTypes.length > 0 ||
      selectedStatuses.length > 0 ||
      selectedRegions.length > 0 ||
      selectedPriorities.length > 0 ||
      quickView !== "all",
    [keyword, quickView, selectedPriorities.length, selectedRegions.length, selectedStatuses.length, selectedVisaTypes.length],
  )

  const clearFilters = () => {
    setKeyword("")
    setSelectedVisaTypes([])
    setSelectedStatuses([])
    setSelectedRegions([])
    setSelectedPriorities([])
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

      window.localStorage.setItem("activeApplicantProfileId", data.profile.id)
      const firstCaseId = data?.cases?.[0]?.id || data?.case?.id
      if (firstCaseId) {
        window.localStorage.setItem("activeApplicantCaseId", firstCaseId)
      }
      setCreateDialogOpen(false)
      setCreateForm(emptyCreateForm)
      router.push(`/applicants/${data.profile.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "\u521b\u5efa\u7533\u8bf7\u4eba\u5931\u8d25")
    } finally {
      setCreating(false)
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
              {session?.user?.role === "admin" && (
                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                  {"\u7ba1\u7406\u5458\u53ef\u67e5\u770b\u5168\u91cf\u6570\u636e"}
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold text-gray-900">{"\u7533\u8bf7\u4eba CRM \u5de5\u4f5c\u53f0"}</h1>
              <p className="text-sm text-gray-500">
                {"\u5458\u5de5\u5728\u8fd9\u91cc\u8ddf\u8fdb\u7533\u8bf7\u4eba\u3001\u6848\u4ef6\u3001\u6750\u6599\u4e0e\u81ea\u52a8\u5316\u6d41\u7a0b\uff1b\u8001\u677f\u548c\u7ba1\u7406\u5458\u53ef\u4ece\u8001\u677f\u540e\u53f0\u67e5\u770b\u5168\u5c40\u6570\u636e\u4e0e\u5f02\u5e38\u3002"}
              </p>
          </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {session?.user?.role === "admin" && (
              <Button variant="outline" asChild>
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  {"\u8001\u677f\u540e\u53f0"}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => void fetchApplicants("manual")} disabled={refreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              {"\u5237\u65b0\u6570\u636e"}
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {"\u65b0\u5efa\u7533\u8bf7\u4eba"}
            </Button>
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
            hint={"\u5f53\u524d\u53ef\u89c1\u7533\u8bf7\u4eba"}
            icon={<UserPlus className="h-5 w-5" />}
          />
          <StatCard
            title={"\u6d3b\u8dc3\u6848\u4ef6\u6570"}
            value={stats.activeCaseCount}
            hint={"\u6b63\u5728\u63a8\u8fdb\u7684 Case \u6570\u91cf"}
            icon={<BriefcaseBusiness className="h-5 w-5" />}
          />
          <StatCard
            title={"\u5f02\u5e38\u6848\u4ef6\u6570"}
            value={stats.exceptionCaseCount}
            hint={"\u4f18\u5148\u8ddf\u8fdb\u5f02\u5e38\u4e0e\u963b\u585e"}
            icon={<AlertCircle className="h-5 w-5" />}
          />
          <StatCard
            title={"\u8fd1 7 \u5929\u66f4\u65b0"}
            value={stats.updatedLast7DaysCount}
            hint={"\u6700\u8fd1\u6709\u52a8\u4f5c\u7684\u7533\u8bf7\u4eba"}
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
                options={filterOptions.visaTypes.map((item) => ({
                  value: item,
                  label: getApplicantCrmVisaTypeLabel(item),
                }))}
                selected={selectedVisaTypes}
                onToggle={(value) => setSelectedVisaTypes((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title={"\u5f53\u524d\u72b6\u6001"}
                tone="status"
                options={filterOptions.statuses.map((item) => ({
                  value: item.value,
                  label: getApplicantCrmStatusLabel(item.value, item.label),
                }))}
                selected={selectedStatuses}
                onToggle={(value) => setSelectedStatuses((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title={"\u5730\u533a"}
                tone="region"
                options={filterOptions.regions.map((item) => ({
                  value: item,
                  label: getApplicantCrmRegionLabel(item),
                }))}
                selected={selectedRegions}
                onToggle={(value) => setSelectedRegions((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title={"\u4f18\u5148\u7ea7"}
                tone="priority"
                options={filterOptions.priorities.map((item) => ({
                  value: item,
                  label: getApplicantCrmPriorityLabel(item),
                }))}
                selected={selectedPriorities}
                onToggle={(value) => setSelectedPriorities((prev) => toggleValue(prev, value))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-white/90">
          <CardHeader>
            <CardTitle>{"\u7533\u8bf7\u4eba\u5217\u8868"}</CardTitle>
            <CardDescription>{"\u70b9\u51fb\u884c\u6216\u201c\u67e5\u770b\u8be6\u60c5\u201d\u8fdb\u5165\u7533\u8bf7\u4eba\u5de5\u4f5c\u53f0\u3002"}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{"\u7533\u8bf7\u4eba"}</TableHead>
                    <TableHead>{"\u7b7e\u8bc1\u7c7b\u578b"}</TableHead>
                    <TableHead>{"\u5730\u533a"}</TableHead>
                    <TableHead>{"\u5f53\u524d\u72b6\u6001"}</TableHead>
                    <TableHead>{"\u4f18\u5148\u7ea7"}</TableHead>
                    <TableHead>{"\u51fa\u884c\u65f6\u95f4"}</TableHead>
                    <TableHead>{"\u6700\u8fd1\u66f4\u65b0"}</TableHead>
                    <TableHead className="w-[120px]">{"\u64cd\u4f5c"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/applicants/${row.id}`)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{row.name}</div>
                          <div className="text-xs text-gray-500">
                            {row.phone || row.email || row.wechat || row.passportNumber || "\u6682\u65e0\u8054\u7cfb\u65b9\u5f0f"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getApplicantCrmVisaTypeLabel(row.visaType || row.caseType)}</TableCell>
                      <TableCell>{getApplicantCrmRegionLabel(row.region)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(row.currentStatusKey)}>
                          {getApplicantCrmStatusLabel(row.currentStatusKey, row.currentStatusLabel)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getPriorityBadgeClass(row.priority)}>
                          {getApplicantCrmPriorityLabel(row.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(row.travelDate)}</TableCell>
                      <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(`/applicants/${row.id}`)
                          }}
                        >
                          查看详情
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-500">
                        暂无符合当前筛选条件的申请人，建议调整筛选条件后重试。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{"\u65b0\u5efa\u7533\u8bf7\u4eba"}</DialogTitle>
            <DialogDescription>{"\u5148\u5efa\u7acb\u7533\u8bf7\u4eba\u6863\u6848\u3002\u5982\u679c\u9700\u8981\uff0c\u53ef\u4ee5\u540c\u65f6\u4e3a\u540c\u4e00\u7533\u8bf7\u4eba\u521b\u5efa\u4e00\u4e2a\u6216\u591a\u4e2a Case\u3002"}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{"\u59d3\u540d"}</Label>
              <Input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={"\u4f8b\u5982\uff1a\u674e\u5c1a\u8015"}
              />
            </div>
            <div className="space-y-2">
              <Label>{"\u624b\u673a\u53f7"}</Label>
              <Input
                value={createForm.phone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{"\u90ae\u7bb1"}</Label>
              <Input
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{"\u5fae\u4fe1"}</Label>
              <Input
                value={createForm.wechat}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, wechat: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{"\u62a4\u7167\u53f7"}</Label>
              <Input
                value={createForm.passportNumber}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, passportNumber: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{"\u5907\u6ce8"}</Label>
              <Textarea
                value={createForm.note}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
                rows={4}
              />
            </div>
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 md:col-span-2">
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                  checked={createForm.createFirstCase}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      createFirstCase: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block font-medium text-gray-900">{"\u521b\u5efa\u540e\u7acb\u5373\u5efa\u7acb\u6848\u4ef6"}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {"\u5efa\u6863\u540e\u53ef\u4ee5\u7acb\u5373\u8fdb\u5165\u529e\u7406\u6d41\u7a0b\u3002\u53ef\u540c\u65f6\u9009\u62e9\u591a\u4e2a\u7b7e\u8bc1\u7c7b\u578b\uff0c\u7cfb\u7edf\u4f1a\u4e3a\u540c\u4e00\u7533\u8bf7\u4eba\u521b\u5efa\u591a\u4e2a Case\u3002"}
                </span>
                </span>
              </label>

              {createForm.createFirstCase ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label>{"\u7b7e\u8bc1\u7c7b\u578b"}</Label>
                    <div className="flex flex-wrap gap-2">
                      {CRM_VISA_TYPE_OPTIONS.map((option) => {
                        const active = createForm.visaTypes.includes(option.value)
                        return (
                          <button
                            key={`${option.value}-create-case`}
                            type="button"
                            onClick={() =>
                              setCreateForm((prev) => ({
                                ...prev,
                                visaTypes: toggleVisaTypeSelection(prev.visaTypes, option.value),
                              }))
                            }
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                              active
                                ? "border-blue-700 bg-blue-700 text-white shadow-sm shadow-blue-200"
                                : "border-blue-100 bg-blue-50/70 text-blue-900 hover:border-blue-300 hover:bg-blue-100",
                            )}
                          >
                            <span className={cn("h-2 w-2 rounded-full", active ? "bg-white/90" : "bg-blue-400")} />
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-500">{"\u53ef\u540c\u65f6\u52fe\u9009\u591a\u4e2a\u7b7e\u8bc1\u7c7b\u578b\uff0c\u7cfb\u7edf\u4f1a\u81ea\u52a8\u4e3a\u540c\u4e00\u7533\u8bf7\u4eba\u521b\u5efa\u591a\u4e2a\u6848\u4ef6\u3002"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{"\u5730\u533a"}</Label>
                    <Select
                      value={createForm.applyRegion}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          applyRegion: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={"\u9009\u62e9\u5730\u533a"} />
                      </SelectTrigger>
                      <SelectContent>
                        {CRM_REGION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{"\u4f18\u5148\u7ea7"}</Label>
                    <Select
                      value={createForm.priority}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          priority: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={"\u9009\u62e9\u4f18\u5148\u7ea7"} />
                      </SelectTrigger>
                      <SelectContent>
                        {CRM_PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{"\u51fa\u884c\u65f6\u95f4"}</Label>
                    <Input
                      type="date"
                      value={createForm.travelDate}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          travelDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  {session?.user?.role === "admin" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label>{"\u5206\u914d\u7ed9\u8c01"}</Label>
                      <Select
                        value={createForm.assignedToUserId || "__unset__"}
                        onValueChange={(value) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            assignedToUserId: value === "__unset__" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={"\u6682\u4e0d\u5206\u914d"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unset__">{"\u6682\u4e0d\u5206\u914d"}</SelectItem>
                          {availableAssignees.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {(option.name || option.email) + ` (${option.role})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {"\u53d6\u6d88"}
            </Button>
            <Button onClick={() => void createApplicant()} disabled={creating}>
              {creating ? "\u521b\u5efa\u4e2d..." : "\u521b\u5efa\u5e76\u8fdb\u5165\u8be6\u60c5"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

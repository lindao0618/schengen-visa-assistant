"use client"

import {
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
  FolderPlus,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react"

import { cn } from "@/lib/utils"
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
import {
  type ApplicantDetailPrefetchSource,
  shouldPrefetchApplicantDetailJson,
  shouldPrefetchApplicantDetailRoute,
} from "@/lib/applicant-list-prefetch"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CreateApplicantForm } from "@/app/applicants/create-applicant-dialog"
import { ApplicantCrmDashboardPanel } from "@/app/applicants/applicant-crm-dashboard-panel"
import { ApplicantCrmRowsTable } from "@/app/applicants/applicant-crm-rows-table"
import type {
  ApplicantCrmRow,
  ApplicantCrmStats,
  ApplicantsAssigneesResponse,
  ApplicantsRowsResponse,
  ApplicantsSummaryResponse,
  QuickView,
} from "@/app/applicants/applicant-crm-types"
import { matchesQuickView } from "@/app/applicants/applicant-crm-view-helpers"

const CreateApplicantDialog = dynamic(
  () => import("@/app/applicants/create-applicant-dialog").then((module) => module.CreateApplicantDialog),
  { ssr: false },
)

const APPLICANT_CRM_INITIAL_VISIBLE_ROWS = 50
const APPLICANT_CRM_VISIBLE_ROWS_STEP = 50

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

function buildSuggestedGroupName() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const hh = String(now.getHours()).padStart(2, "0")
  const mi = String(now.getMinutes()).padStart(2, "0")
  return `自定义分组 ${yyyy}-${mm}-${dd} ${hh}:${mi}`
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
      if (shouldPrefetchApplicantDetailRoute({ applicantId, source })) {
        router.prefetch(`/applicants/${applicantId}`)
      }
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

        <ApplicantCrmDashboardPanel
          stats={stats}
          summaryLoading={summaryLoading}
          rows={rows}
          currentUserId={session?.user?.id}
          quickView={quickView}
          setQuickView={setQuickView}
          keyword={keyword}
          deferredKeyword={deferredKeyword}
          setKeyword={setKeyword}
          selectedVisaTypes={selectedVisaTypes}
          setSelectedVisaTypes={setSelectedVisaTypes}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
          selectedRegions={selectedRegions}
          setSelectedRegions={setSelectedRegions}
          selectedPriorities={selectedPriorities}
          setSelectedPriorities={setSelectedPriorities}
          selectedGroups={selectedGroups}
          setSelectedGroups={setSelectedGroups}
          availableGroupOptions={availableGroupOptions}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
        />

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

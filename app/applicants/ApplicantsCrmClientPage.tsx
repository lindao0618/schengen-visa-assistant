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
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

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
import { Button } from "@/components/ui/button"
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
import { ApplicantCrmListPanel } from "@/app/applicants/applicant-crm-list-panel"
import { ApplicantCrmPageHeader } from "@/app/applicants/applicant-crm-page-header"
import { shouldShowInitialMaterialUploadPrompt } from "@/lib/applicant-initial-material-upload"
import {
  getApplicantMaterialFilesHandoffKey,
  type ApplicantMaterialFileMap,
} from "@/lib/applicant-material-files"
import {
  APPLICANT_CRM_PAGE_SIZE,
  buildApplicantCrmListSearchParams,
  mergeApplicantCrmPageRows,
} from "@/app/applicants/applicant-crm-client-pagination"
import type {
  ApplicantCrmPagination,
  ApplicantCrmQuickCounts,
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

const InitialMaterialUploadDialog = dynamic(
  () => import("@/app/applicants/initial-material-upload-dialog").then((module) => module.InitialMaterialUploadDialog),
  { ssr: false },
)

const EMPTY_QUICK_COUNTS: ApplicantCrmQuickCounts = {
  mine: 0,
  review: 0,
  exception: 0,
  today: 0,
}

type BatchActionMode = "set-group" | "clear-group" | "delete" | null

type InitialUploadPromptState = {
  applicantId: string
  applicantName: string
  visaTypes: string[]
}

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
  const [quickCounts, setQuickCounts] = useState<ApplicantCrmQuickCounts>(EMPTY_QUICK_COUNTS)
  const [groupOptions, setGroupOptions] = useState<string[]>([])
  const [pagination, setPagination] = useState<ApplicantCrmPagination | undefined>()
  const [availableAssignees, setAvailableAssignees] = useState<ApplicantsAssigneesResponse["availableAssignees"]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
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
  const [initialUploadPrompt, setInitialUploadPrompt] = useState<InitialUploadPromptState | null>(null)
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([])
  const [batchActionMode, setBatchActionMode] = useState<BatchActionMode>(null)
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [groupNameInput, setGroupNameInput] = useState("")
  const initialLoadRef = useRef(true)
  const deferredKeyword = useDeferredValue(keyword.trim())
  const buildListQuery = useCallback(
    (offset = 0) =>
      buildApplicantCrmListSearchParams({
        keyword: deferredKeyword,
        selectedVisaTypes,
        selectedStatuses,
        selectedRegions,
        selectedPriorities,
        selectedGroups,
        quickView,
        limit: APPLICANT_CRM_PAGE_SIZE,
        offset,
        includeListMeta: offset === 0,
      }),
    [
      deferredKeyword,
      quickView,
      selectedGroups,
      selectedPriorities,
      selectedRegions,
      selectedStatuses,
      selectedVisaTypes,
    ],
  )
  const requestQuery = useMemo(() => buildListQuery(0), [buildListQuery])
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

  const applyApplicantsRows = useCallback(
    (data: ApplicantsRowsResponse | null | undefined, mode: "replace" | "append" = "replace") => {
      const nextRows = data?.rows || []
      startTransition(() => {
        setRows((prev) => mergeApplicantCrmPageRows(prev, nextRows, mode))
        setPagination(data?.pagination)
        if (mode === "replace" || data?.quickCounts) {
          setQuickCounts(data?.quickCounts || EMPTY_QUICK_COUNTS)
        }
        if (mode === "replace" || data?.groupOptions) {
          setGroupOptions(data?.groupOptions || [])
        }
      })
    },
    [],
  )

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

  const loadMoreApplicants = useCallback(async () => {
    if (loadingMore || !pagination?.hasMore) return

    setLoadingMore(true)
    setMessage("")
    try {
      const nextOffset = pagination.offset + pagination.limit
      const response = await fetch(`/api/applicants?${buildListQuery(nextOffset)}`, {
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ApplicantsRowsResponse | null
      if (!response.ok || !data?.rows) {
        throw new Error(data?.error || "加载更多申请人失败")
      }

      applyApplicantsRows(data, "append")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载更多申请人失败")
    } finally {
      setLoadingMore(false)
    }
  }, [applyApplicantsRows, buildListQuery, loadingMore, pagination])

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
      Array.from(new Set([...groupOptions, ...selectedGroups].map((item) => item.trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
        .map((value) => ({ value, label: value })),
    [groupOptions, selectedGroups],
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
    () => displayRows,
    [displayRows],
  )
  const displayRowIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows])
  const selectedVisibleCount = useMemo(
    () => displayRowIds.filter((id) => selectedApplicantIds.includes(id)).length,
    [displayRowIds, selectedApplicantIds],
  )
  const allVisibleSelected = visibleRows.length > 0 && selectedVisibleCount === visibleRows.length
  const totalDisplayRows = pagination?.totalRows ?? displayRows.length
  const hasMoreVisibleRows = Boolean(pagination?.hasMore)

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

  const finishInitialMaterialUpload = useCallback(
    async (
      applicantId: string,
      completion: "skip" | "uploaded" = "skip",
      uploadedFiles: ApplicantMaterialFileMap = {},
    ) => {
      clearClientCache(getApplicantDetailCacheKey(applicantId))
      clearClientCache(getApplicantDetailCacheKey(applicantId, "active"))
      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)

      if (completion === "uploaded") {
        if (Object.keys(uploadedFiles).length > 0) {
          window.sessionStorage.setItem(
            getApplicantMaterialFilesHandoffKey(applicantId),
            JSON.stringify(uploadedFiles),
          )
        }
        await prefetchJsonIntoClientCache(getApplicantDetailCacheKey(applicantId), `/api/applicants/${applicantId}`, {
          ttlMs: APPLICANT_DETAIL_CACHE_TTL_MS,
          force: true,
        }).catch(() => null)
      }

      setInitialUploadPrompt(null)
      router.push(`/applicants/${applicantId}?tab=materials`)
    },
    [router],
  )

  useEffect(() => {
    displayRows.slice(0, 3).forEach((row) => {
      prefetchApplicantDetail(row.id, "automatic")
    })
  }, [displayRows, prefetchApplicantDetail])

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

      const createdApplicantId = data.profile.id as string
      const createdApplicantName = data.profile.name || data.profile.label || createForm.name.trim()
      const createdVisaTypes = createForm.createFirstCase ? [...createForm.visaTypes] : []

      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      clearClientCacheByPrefix(APPLICANT_CRM_ASSIGNEES_CACHE_PREFIX)
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
      window.localStorage.setItem("activeApplicantProfileId", createdApplicantId)
      const firstCaseId = data?.cases?.[0]?.id || data?.case?.id
      if (firstCaseId) {
        window.localStorage.setItem("activeApplicantCaseId", firstCaseId)
      }
      setCreateDialogOpen(false)
      setCreateForm(emptyCreateForm)

      if (shouldShowInitialMaterialUploadPrompt(createdVisaTypes)) {
        setInitialUploadPrompt({
          applicantId: createdApplicantId,
          applicantName: createdApplicantName,
          visaTypes: createdVisaTypes,
        })
        return
      }

      prefetchApplicantDetail(createdApplicantId, "create")
      router.push(`/applicants/${createdApplicantId}`)
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
        <ApplicantCrmPageHeader
          canOpenAdmin={canOpenAdmin}
          canReadAll={canReadAll}
          canEditApplicants={canEditApplicants}
          viewerRoleLabel={getAppRoleLabel(viewerRole)}
          refreshing={refreshing}
          summaryLoading={summaryLoading}
          onRefresh={refreshCrmDashboard}
          onCreateApplicant={() => setCreateDialogOpen(true)}
        />

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </div>
        )}

        <ApplicantCrmDashboardPanel
          stats={stats}
          summaryLoading={summaryLoading}
          quickCounts={quickCounts}
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

        <ApplicantCrmListPanel
          rows={visibleRows}
          selectedApplicantIds={selectedApplicantIds}
          allVisibleSelected={allVisibleSelected}
          canEditApplicants={canEditApplicants}
          loading={loading}
          loadingMore={loadingMore}
          hasMoreVisibleRows={hasMoreVisibleRows}
          totalDisplayRows={totalDisplayRows}
          hasFilters={hasFilters}
          batchActionLoading={batchActionLoading}
          onToggleAllVisible={toggleSelectAllVisible}
          onToggleApplicant={toggleApplicantSelection}
          onOpenApplicant={openApplicantDetail}
          onPrefetchApplicant={prefetchApplicantDetail}
          onSetGroup={openSetGroupDialog}
          onClearGroup={clearGroupForSelected}
          onDelete={() => setBatchActionMode("delete")}
          onClearSelection={() => setSelectedApplicantIds([])}
          onLoadMore={() => void loadMoreApplicants()}
          onClearFilters={clearFilters}
          onCreateApplicant={() => setCreateDialogOpen(true)}
        />
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

      {initialUploadPrompt ? (
        <InitialMaterialUploadDialog
          open={Boolean(initialUploadPrompt)}
          applicantId={initialUploadPrompt.applicantId}
          applicantName={initialUploadPrompt.applicantName}
          visaTypes={initialUploadPrompt.visaTypes}
          onFinish={(completion, uploadedFiles) =>
            finishInitialMaterialUpload(initialUploadPrompt.applicantId, completion, uploadedFiles)
          }
        />
      ) : null}
    </div>
  )
}

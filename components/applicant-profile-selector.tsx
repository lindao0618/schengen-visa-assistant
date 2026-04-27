"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  BriefcaseBusiness,
  Check,
  ChevronsUpDown,
  Clock3,
  FolderOpen,
  PencilLine,
  Search,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  getApplicantCrmPriorityLabel,
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
  normalizeApplicantCrmVisaType,
} from "@/lib/applicant-crm-labels"
import {
  APPLICANT_DETAIL_CACHE_TTL_MS,
  APPLICANT_SELECTOR_CACHE_KEY,
  APPLICANT_SELECTOR_CACHE_TTL_MS,
  getApplicantDetailCacheKey,
  prefetchJsonIntoClientCache,
  readClientCache,
} from "@/lib/applicant-client-cache"
import {
  canWriteApplicants,
  normalizeAppRole,
} from "@/lib/access-control"
import {
  ACTIVE_APPLICANT_CASE_KEY,
  ACTIVE_APPLICANT_PROFILE_KEY,
  RECENT_APPLICANT_PROFILE_IDS_KEY,
  dispatchActiveApplicantCaseChange,
  readStoredApplicantCaseId,
  writeStoredApplicantCaseId,
} from "@/lib/applicant-selection-storage"
import {
  type ApplicantDetailPrefetchSource,
  shouldPrefetchApplicantDetailJson,
} from "@/lib/applicant-list-prefetch"
import { formatFranceStatusLabel } from "@/lib/france-case-labels"
import { cn } from "@/lib/utils"

export interface ApplicantProfileSummary {
  id: string
  label: string
  name?: string
  phone?: string
  email?: string
  wechat?: string
  passportNumber?: string
  passportLast4?: string
  updatedAt?: string
  usVisa?: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
  }
  schengen?: {
    country?: string
    city?: string
    fraNumber?: string
  }
  files?: Record<string, unknown>
}

type ApplicantCaseOption = {
  id: string
  caseType: string
  visaType?: string | null
  applyRegion?: string | null
  tlsCity?: string | null
  mainStatus: string
  subStatus?: string | null
  exceptionCode?: string | null
  priority: string
  travelDate?: string | null
  submissionDate?: string | null
  assignedToUserId?: string | null
  assignedRole?: string | null
  isActive: boolean
  updatedAt: string
  createdAt: string
}

type ApplicantSelectorRow = {
  id: string
  visaType?: string
  region?: string
  updatedAt?: string
  activeCaseId?: string | null
  currentStatusLabel?: string
  priority?: string
  owner: { id: string; name?: string | null; email: string }
  assignee?: { id: string; name?: string | null; email: string } | null
}

type ApplicantsSelectorResponse = {
  profiles?: ApplicantProfileSummary[]
  rows?: ApplicantSelectorRow[]
  selectorCasesByApplicantId?: Record<string, ApplicantCaseOption[]>
}

type ApplicantCasesResponse = {
  cases?: ApplicantCaseOption[]
}

type ApplicantSelectorOption = ApplicantProfileSummary & {
  visaType?: string
  region?: string
  updatedAt?: string
  ownerId?: string
  assigneeId?: string | null
  activeCaseId?: string | null
  currentStatusLabel?: string
  priority?: string
  businessTag?: "usa" | "france" | "uk" | "both" | null
}

export type ApplicantProfileSelectorScope = "all" | "usa-visa" | "france-schengen" | "uk-visa"

interface ApplicantProfileSelectorProps {
  scope?: ApplicantProfileSelectorScope
}

export { ACTIVE_APPLICANT_CASE_KEY, ACTIVE_APPLICANT_PROFILE_KEY }

function formatDateTime(value?: string | null) {
  if (!value) return "暂无更新"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "暂无更新"
  return `更新于 ${date.toLocaleDateString("zh-CN")} ${date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`
}

function getPassportTail(profile: ApplicantSelectorOption) {
  return profile.passportLast4 || profile.passportNumber?.slice(-4) || profile.usVisa?.passportNumber?.slice(-4) || ""
}

function readRecentIds() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_APPLICANT_PROFILE_IDS_KEY)
    const parsed = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function writeRecentIds(ids: string[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(RECENT_APPLICANT_PROFILE_IDS_KEY, JSON.stringify(ids.slice(0, 8)))
}

function buildRecentIds(nextId: string) {
  const current = readRecentIds().filter((item) => item !== nextId)
  writeRecentIds([nextId, ...current])
}

function getCaseTitle(caseItem: ApplicantCaseOption) {
  return getApplicantCrmVisaTypeLabel(caseItem.visaType || caseItem.caseType)
}

function getCaseStatusText(caseItem: ApplicantCaseOption) {
  if (caseItem.exceptionCode) return "异常处理中"
  return formatFranceStatusLabel(caseItem.mainStatus, caseItem.subStatus)
}

function getCaseSecondary(caseItem: ApplicantCaseOption) {
  const parts = [
    getApplicantCrmRegionLabel(caseItem.applyRegion),
    getApplicantCrmPriorityLabel(caseItem.priority),
    getCaseStatusText(caseItem),
  ].filter((item) => item && item !== "-")

  return parts.join(" · ")
}

function inferApplicantBusinessTag(
  profile: ApplicantProfileSummary,
  cases: ApplicantCaseOption[] | undefined,
): ApplicantSelectorOption["businessTag"] {
  const normalizedVisaTypes = new Set(
    (cases || []).map((item) => normalizeApplicantCrmVisaType(item.visaType || item.caseType)).filter(Boolean),
  )

  const hasUsa =
    normalizedVisaTypes.has("usa-visa") ||
    Boolean(
      profile.files?.usVisaDs160Excel ||
        profile.files?.ds160Excel ||
        profile.files?.usVisaPhoto ||
        profile.usVisa?.aaCode ||
        profile.usVisa?.passportNumber,
    )

  const hasFrance =
    normalizedVisaTypes.has("france-schengen") ||
    Boolean(
      profile.files?.schengenExcel ||
        profile.files?.franceExcel ||
        profile.files?.franceApplicationJson ||
        profile.schengen?.country ||
        profile.schengen?.city,
    )

  const hasUk = normalizedVisaTypes.has("uk-visa")

  if (hasUsa && hasFrance) return "both"
  if (hasUsa) return "usa"
  if (hasFrance) return "france"
  if (hasUk) return "uk"
  return null
}

function getApplicantBusinessTagBadge(tag: ApplicantSelectorOption["businessTag"]) {
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

function caseMatchesScope(caseItem: ApplicantCaseOption, scope: ApplicantProfileSelectorScope) {
  if (scope === "all") return true
  return normalizeApplicantCrmVisaType(caseItem.visaType || caseItem.caseType) === scope
}

function profileMatchesScope(
  profile: ApplicantSelectorOption,
  cases: ApplicantCaseOption[] | undefined,
  scope: ApplicantProfileSelectorScope,
) {
  if (scope === "all") return true
  const scopedCases = (cases || []).filter((item) => caseMatchesScope(item, scope))
  if (scopedCases.length > 0) return true

  if (scope === "usa-visa") {
    return Boolean(
      profile.files?.usVisaDs160Excel ||
        profile.files?.ds160Excel ||
        profile.files?.usVisaPhoto ||
        profile.usVisa?.aaCode ||
        profile.usVisa?.passportNumber,
    )
  }

  if (scope === "france-schengen") {
    return Boolean(
      profile.files?.schengenExcel ||
        profile.files?.franceExcel ||
        profile.files?.franceApplicationJson ||
        profile.schengen?.country ||
        profile.schengen?.city,
    )
  }

  if (scope === "uk-visa") {
    return Boolean((cases || []).some((item) => normalizeApplicantCrmVisaType(item.visaType || item.caseType) === "uk-visa"))
  }

  return true
}

function resolveActiveCaseId(
  cases: ApplicantCaseOption[],
  scope: ApplicantProfileSelectorScope,
  preferredCaseId?: string | null,
  fallbackCaseId?: string | null,
) {
  const scopedCases = scope === "all" ? cases : cases.filter((item) => caseMatchesScope(item, scope))
  const targetCases = scopedCases.length > 0 ? scopedCases : cases
  if (preferredCaseId && targetCases.some((item) => item.id === preferredCaseId)) return preferredCaseId
  if (fallbackCaseId && targetCases.some((item) => item.id === fallbackCaseId)) return fallbackCaseId
  return targetCases.find((item) => item.isActive)?.id ?? targetCases[0]?.id ?? null
}

function getScopeTitle(scope: ApplicantProfileSelectorScope) {
  switch (scope) {
    case "usa-visa":
      return "当前美签申请人"
    case "france-schengen":
      return "当前法签申请人"
    case "uk-visa":
      return "当前英签申请人"
    default:
      return "当前申请人档案"
  }
}

function getScopeHint(scope: ApplicantProfileSelectorScope) {
  switch (scope) {
    case "usa-visa":
      return "仅显示可用于美国签证流程的申请人，可直接切换当前办理案件。"
    case "france-schengen":
      return "仅显示可用于法国申根流程的申请人，可直接切换当前办理案件。"
    case "uk-visa":
      return "仅显示可用于英国签证流程的申请人，可直接切换当前办理案件。"
    default:
      return "申请人较多时，可直接搜索姓名、护照尾号、手机号或微信号。"
  }
}

function ApplicantOptionRow({
  profile,
  selected,
}: {
  profile: ApplicantSelectorOption
  selected: boolean
}) {
  const secondaryParts = [
    getApplicantCrmVisaTypeLabel(profile.visaType),
    getApplicantCrmRegionLabel(profile.region),
    getPassportTail(profile) ? `护照尾号 ${getPassportTail(profile)}` : "",
  ].filter((item) => item && item !== "-")

  const hasMaterials = Boolean(
    profile.files?.usVisaDs160Excel ||
      profile.files?.ds160Excel ||
      profile.files?.usVisaPhoto ||
      profile.files?.schengenExcel ||
      profile.files?.franceExcel,
  )

  const businessTag = getApplicantBusinessTagBadge(profile.businessTag)

  return (
    <div className="group flex w-full items-start gap-3 rounded-2xl border border-transparent px-1 py-1 transition-colors">
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200"
            : "border-gray-300 bg-white text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{profile.name || profile.label}</span>
          {businessTag && (
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5", businessTag.className)}>
              {businessTag.label}
            </Badge>
          )}
          {profile.usVisa?.aaCode && (
            <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-700">
              AA {profile.usVisa.aaCode}
            </Badge>
          )}
          {hasMaterials && (
            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
              资料可复用
            </Badge>
          )}
        </div>
        {secondaryParts.length > 0 && <div className="text-xs text-gray-500">{secondaryParts.join(" · ")}</div>}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {profile.phone && <span>{profile.phone}</span>}
          {!profile.phone && profile.email && <span>{profile.email}</span>}
          {!profile.phone && !profile.email && profile.wechat && <span>微信 {profile.wechat}</span>}
          <span>{formatDateTime(profile.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

export function ApplicantProfileSelector({ scope = "all" }: ApplicantProfileSelectorProps = {}) {
  const router = useRouter()
  const { data: session } = useSession()
  const viewerRole = normalizeAppRole(session?.user?.role)
  const canEditApplicants = canWriteApplicants(viewerRole)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [profiles, setProfiles] = useState<ApplicantSelectorOption[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [selectedCaseId, setSelectedCaseId] = useState("")
  const [open, setOpen] = useState(false)
  const [caseLoading, setCaseLoading] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [casesByApplicantId, setCasesByApplicantId] = useState<Record<string, ApplicantCaseOption[]>>({})

  const scopedProfiles = useMemo(
    () => profiles.filter((profile) => profileMatchesScope(profile, casesByApplicantId[profile.id], scope)),
    [casesByApplicantId, profiles, scope],
  )

  const activeProfile = useMemo(
    () => scopedProfiles.find((profile) => profile.id === selectedId) ?? null,
    [scopedProfiles, selectedId],
  )

  const currentCases = useMemo(() => {
    const allCases = selectedId ? casesByApplicantId[selectedId] ?? [] : []
    return scope === "all" ? allCases : allCases.filter((item) => caseMatchesScope(item, scope))
  }, [casesByApplicantId, scope, selectedId])
  const cachedCases = selectedId ? casesByApplicantId[selectedId] : undefined

  const activeCase = useMemo(
    () => currentCases.find((caseItem) => caseItem.id === selectedCaseId) ?? null,
    [currentCases, selectedCaseId],
  )

  const applySelectorData = useCallback(
    (data: ApplicantsSelectorResponse) => {
      const rowMap = new Map((data.rows || []).map((row) => [row.id, row]))
      const nextProfiles = ((data.profiles || []) as ApplicantProfileSummary[]).map((profile) => {
        const row = rowMap.get(profile.id)
        return {
          ...profile,
          visaType: row?.visaType,
          region: row?.region,
          updatedAt: row?.updatedAt || profile.updatedAt,
          ownerId: row?.owner.id,
          assigneeId: row?.assignee?.id ?? null,
          activeCaseId: row?.activeCaseId ?? null,
          currentStatusLabel: row?.currentStatusLabel,
          priority: row?.priority,
          businessTag: inferApplicantBusinessTag(profile, data.selectorCasesByApplicantId?.[profile.id]),
        }
      })
      setProfiles(nextProfiles)
      setCasesByApplicantId(data.selectorCasesByApplicantId || {})

      const scoped = nextProfiles.filter((profile) =>
        profileMatchesScope(profile, data.selectorCasesByApplicantId?.[profile.id], scope),
      )
      const savedId = window.localStorage.getItem(ACTIVE_APPLICANT_PROFILE_KEY) || ""
      const nextSelected = savedId && scoped.some((profile) => profile.id === savedId) ? savedId : scoped[0]?.id || ""
      setSelectedId(nextSelected)
      if (nextSelected) {
        window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, nextSelected)
        buildRecentIds(nextSelected)
      } else {
        window.localStorage.removeItem(ACTIVE_APPLICANT_PROFILE_KEY)
        setSelectedCaseId("")
      }
    },
    [scope],
  )

  const prefetchActiveApplicantDetail = useCallback(
    (source: ApplicantDetailPrefetchSource = "intent") => {
      if (!activeProfile?.id) return
      const href = `/applicants/${activeProfile.id}?tab=materials`
      router.prefetch(href)
      if (!shouldPrefetchApplicantDetailJson({ applicantId: activeProfile.id, source })) return

      void prefetchJsonIntoClientCache(
        getApplicantDetailCacheKey(activeProfile.id, "active"),
        `/api/applicants/${activeProfile.id}?view=active`,
        {
          ttlMs: APPLICANT_DETAIL_CACHE_TTL_MS,
        },
      ).catch(() => {
        // Ignore background prefetch failures.
      })
    },
    [activeProfile?.id, router],
  )

  useEffect(() => {
    const load = async () => {
      try {
        const cached = readClientCache<ApplicantsSelectorResponse>(APPLICANT_SELECTOR_CACHE_KEY)
        if (cached) {
          applySelectorData(cached)
          return
        }

        const data = await prefetchJsonIntoClientCache<ApplicantsSelectorResponse>(
          APPLICANT_SELECTOR_CACHE_KEY,
          "/api/applicants?includeProfiles=1&includeSelectorCases=1&includeProfileFiles=0&includeAvailableAssignees=0",
          { ttlMs: APPLICANT_SELECTOR_CACHE_TTL_MS },
        )
        applySelectorData(data)
      } catch (error) {
        console.error("加载申请人档案失败", error)
      }
    }

    void load()
  }, [applySelectorData])

  useEffect(() => {
    if (!selectedId) {
      setSelectedCaseId("")
      return
    }

    let cancelled = false

    const applyCaseSelection = (cases: ApplicantCaseOption[]) => {
      const nextCaseId = resolveActiveCaseId(
        cases,
        scope,
        readStoredApplicantCaseId(selectedId),
        activeProfile?.activeCaseId,
      )
      setSelectedCaseId(nextCaseId || "")
      writeStoredApplicantCaseId(selectedId, nextCaseId)
      dispatchActiveApplicantCaseChange(selectedId, nextCaseId)
    }

    if (cachedCases) {
      applyCaseSelection(cachedCases)
      return
    }

    const loadCases = async () => {
      setCaseLoading(true)
      try {
        const res = await fetch(`/api/cases?applicantProfileId=${encodeURIComponent(selectedId)}`, {
          cache: "no-store",
          credentials: "include",
        })
        if (!res.ok) {
          throw new Error("加载案件失败")
        }
        const data = (await res.json()) as ApplicantCasesResponse
        if (cancelled) return

        const cases = Array.isArray(data.cases) ? data.cases : []
        setCasesByApplicantId((current) => ({
          ...current,
          [selectedId]: cases,
        }))
        applyCaseSelection(cases)
      } catch (error) {
        if (!cancelled) {
          console.error("加载申请人案件失败", error)
          setCasesByApplicantId((current) => ({
            ...current,
            [selectedId]: current[selectedId] || [],
          }))
          applyCaseSelection(cachedCases || [])
        }
      } finally {
        if (!cancelled) {
          setCaseLoading(false)
        }
      }
    }

    void loadCases()

    return () => {
      cancelled = true
    }
  }, [activeProfile?.activeCaseId, cachedCases, scope, selectedId])

  const recentIds = useMemo(readRecentIds, [profiles, selectedId])
  const recentProfiles = useMemo(
    () =>
      recentIds
        .map((id) => scopedProfiles.find((profile) => profile.id === id))
        .filter(Boolean) as ApplicantSelectorOption[],
    [scopedProfiles, recentIds],
  )

  const mineProfiles = useMemo(() => {
    const currentUserId = session?.user?.id
    if (!currentUserId) return []
    const recentIdSet = new Set(recentProfiles.map((profile) => profile.id))
    return scopedProfiles.filter(
      (profile) =>
        !recentIdSet.has(profile.id) &&
        (profile.assigneeId === currentUserId || (!profile.assigneeId && profile.ownerId === currentUserId)),
    )
  }, [scopedProfiles, recentProfiles, session?.user?.id])

  const otherProfiles = useMemo(() => {
    const excludedIds = new Set([...recentProfiles.map((item) => item.id), ...mineProfiles.map((item) => item.id)])
    return scopedProfiles.filter((profile) => !excludedIds.has(profile.id))
  }, [mineProfiles, recentProfiles, scopedProfiles])

  const handleProfileChange = (value: string) => {
    setSelectedId(value)
    setSelectedCaseId("")
    window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, value)
    buildRecentIds(value)
    window.dispatchEvent(new CustomEvent("active-applicant-profile-changed", { detail: value }))
    setOpen(false)
  }

  const handleCaseChange = (caseId: string) => {
    if (!selectedId) return
    setSelectedCaseId(caseId)
    writeStoredApplicantCaseId(selectedId, caseId)
    dispatchActiveApplicantCaseChange(selectedId, caseId)
  }

  const activeSummary = activeCase
    ? `${getCaseTitle(activeCase)} · ${getCaseSecondary(activeCase)}`
    : [
        getApplicantCrmVisaTypeLabel(activeProfile?.visaType),
        getApplicantCrmRegionLabel(activeProfile?.region),
        getPassportTail(activeProfile || ({} as ApplicantSelectorOption))
          ? `护照尾号 ${getPassportTail(activeProfile as ApplicantSelectorOption)}`
          : "",
      ]
        .filter((item) => item && item !== "-")
        .join(" · ")

  useEffect(() => {
    const updateCompactMode = () => {
      const node = containerRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      setCompactMode(rect.top <= 80 && window.scrollY > 24)
    }

    updateCompactMode()
    window.addEventListener("scroll", updateCompactMode, { passive: true })
    window.addEventListener("resize", updateCompactMode)
    return () => {
      window.removeEventListener("scroll", updateCompactMode)
      window.removeEventListener("resize", updateCompactMode)
    }
  }, [])

  return (
    <Card
      ref={containerRef}
      className={cn(
        "sticky top-20 z-30 mb-6 overflow-hidden border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(239,246,255,0.95),_rgba(255,255,255,0.98)_45%,_rgba(248,250,252,0.98)_100%)] p-4 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.28)] backdrop-blur supports-[backdrop-filter]:bg-white/80",
        compactMode && "shadow-[0_18px_40px_-20px_rgba(15,23,42,0.32)]",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/90">
              当前办理
            </div>
            <div className="text-sm font-semibold text-gray-900">{getScopeTitle(scope)}</div>
            <Badge variant="outline" className={cn("border-gray-200 bg-gray-50 text-gray-600", compactMode && "hidden")}>
              {scopedProfiles.length} 个档案
            </Badge>
          </div>
          <div className={cn("max-w-xl text-xs leading-6 text-gray-500", compactMode && "hidden")}>{getScopeHint(scope)}</div>
          {compactMode && activeProfile ? (
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 [&>span]:rounded-full [&>span]:border [&>span]:border-slate-200 [&>span]:bg-white/85 [&>span]:px-2.5 [&>span]:py-1">
              <span className="rounded-full border border-slate-200 bg-white/85 px-2.5 py-1">{activeProfile.name || activeProfile.label}</span>
              {getPassportTail(activeProfile) ? <span>护照尾号 {getPassportTail(activeProfile)}</span> : null}
              {activeProfile.usVisa?.aaCode ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">AA {activeProfile.usVisa.aaCode}</span> : null}
              {activeProfile.schengen?.country ? <span className="rounded-full border border-slate-200 bg-white/85 px-2.5 py-1">{activeProfile.schengen.country}</span> : null}
              {activeProfile.schengen?.city ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{activeProfile.schengen.city}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(
                  "h-auto w-full justify-between gap-3 rounded-2xl border-slate-200 bg-white/90 px-4 py-3 text-left shadow-sm transition-all hover:bg-white hover:shadow-md md:w-[480px]",
                  compactMode && "md:w-[440px]",
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {activeProfile ? activeProfile.name || activeProfile.label : "选择申请人档案"}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{activeSummary || "支持按姓名、护照尾号、手机号、微信号搜索"}</span>
                  </div>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[calc(100vw-2rem)] rounded-2xl border-slate-200 p-0 shadow-2xl shadow-slate-200/60 md:w-[480px]"
              align="end"
            >
              <Command>
                <CommandInput placeholder="搜索姓名、护照尾号、手机号或微信号..." />
                <CommandList className="max-h-[420px]">
                  <CommandEmpty>没有找到匹配的申请人</CommandEmpty>

                  {recentProfiles.length > 0 && (
                    <CommandGroup heading="最近使用">
                      {recentProfiles.map((profile) => (
                        <CommandItem
                          key={`recent-${profile.id}`}
                          value={[
                            profile.name,
                            profile.label,
                            profile.phone,
                            profile.email,
                            profile.wechat,
                            profile.passportNumber,
                            getPassportTail(profile),
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onSelect={() => handleProfileChange(profile.id)}
                          className="items-start px-3 py-3"
                        >
                          <ApplicantOptionRow profile={profile} selected={profile.id === selectedId} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {mineProfiles.length > 0 && (
                    <>
                      {recentProfiles.length > 0 && <CommandSeparator />}
                      <CommandGroup heading="我负责的">
                        {mineProfiles.map((profile) => (
                          <CommandItem
                            key={`mine-${profile.id}`}
                            value={[
                              profile.name,
                              profile.label,
                              profile.phone,
                              profile.email,
                              profile.wechat,
                              profile.passportNumber,
                              getPassportTail(profile),
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onSelect={() => handleProfileChange(profile.id)}
                            className="items-start px-3 py-3"
                          >
                            <ApplicantOptionRow profile={profile} selected={profile.id === selectedId} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}

                  {otherProfiles.length > 0 && (
                    <>
                      {(recentProfiles.length > 0 || mineProfiles.length > 0) && <CommandSeparator />}
                      <CommandGroup heading="全部申请人">
                        {otherProfiles.map((profile) => (
                          <CommandItem
                            key={`all-${profile.id}`}
                            value={[
                              profile.name,
                              profile.label,
                              profile.phone,
                              profile.email,
                              profile.wechat,
                              profile.passportNumber,
                              getPassportTail(profile),
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onSelect={() => handleProfileChange(profile.id)}
                            className="items-start px-3 py-3"
                          >
                            <ApplicantOptionRow profile={profile} selected={profile.id === selectedId} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {activeProfile && (
            <Button
              variant="outline"
              className="rounded-2xl border-slate-200 bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:text-white"
              title={canEditApplicants ? "编辑当前档案" : "查看当前档案"}
              asChild
            >
              <Link
                href={`/applicants/${activeProfile.id}?tab=materials`}
                onFocus={() => prefetchActiveApplicantDetail("intent")}
                onMouseEnter={() => prefetchActiveApplicantDetail("intent")}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {canEditApplicants ? "编辑档案" : "查看档案"}
              </Link>
            </Button>
          )}

          <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/90 shadow-sm hover:bg-white" asChild>
            <Link href="/applicants">
              <FolderOpen className="mr-2 h-4 w-4" />
              管理档案
            </Link>
          </Button>
        </div>
      </div>

      {activeProfile && !compactMode && (
        <div className="mt-5 space-y-4 rounded-3xl border border-white/70 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm">
          <div className="flex flex-wrap gap-2 text-xs text-gray-600 [&>span]:rounded-full [&>span]:border [&>span]:border-slate-200 [&>span]:bg-white [&>span]:px-3 [&>span]:py-1">
            <span>姓名: {activeProfile.name || activeProfile.label}</span>
            {activeProfile.usVisa?.aaCode && <span>AA 码: {activeProfile.usVisa.aaCode}</span>}
            {getPassportTail(activeProfile) && <span>护照尾号: {getPassportTail(activeProfile)}</span>}
            {activeProfile.schengen?.country && <span>申根国家: {activeProfile.schengen.country}</span>}
            {activeProfile.schengen?.city && <span>TLS 递签城市: {activeProfile.schengen.city}</span>}
            {activeProfile.schengen?.fraNumber && <span>FRA Number: {activeProfile.schengen.fraNumber}</span>}
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-gray-400">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(activeProfile.updatedAt)}
            </span>
            {(viewerRole === "boss" || viewerRole === "supervisor") && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                管理员视角可查看全部
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                <BriefcaseBusiness className="h-4 w-4" />
              </div>
              当前签证案件
            </div>

            {caseLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-gray-500">
                正在加载该申请人的案件...
              </div>
            ) : currentCases.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {currentCases.map((caseItem) => {
                  const selected = caseItem.id === selectedCaseId
                  return (
                    <button
                      key={caseItem.id}
                      type="button"
                      onClick={() => handleCaseChange(caseItem.id)}
                      className={cn(
                        "min-w-[220px] rounded-3xl border px-4 py-3.5 text-left shadow-sm transition-all",
                        selected
                          ? "border-blue-300 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(219,234,254,0.75))] text-blue-900 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white/95 text-gray-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{getCaseTitle(caseItem)}</div>
                        {caseItem.isActive && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px]",
                              selected
                                ? "border-blue-300 bg-blue-100 text-blue-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            当前案件
                          </Badge>
                        )}
                      </div>
                      <div className={cn("mt-1 text-xs", selected ? "text-blue-700" : "text-gray-500")}>
                        {getCaseSecondary(caseItem)}
                      </div>
                      {(caseItem.travelDate || caseItem.submissionDate) && (
                        <div className={cn("mt-2 text-[11px]", selected ? "text-blue-600" : "text-gray-400")}>
                          {caseItem.travelDate ? `出行 ${new Date(caseItem.travelDate).toLocaleDateString("zh-CN")}` : ""}
                          {caseItem.travelDate && caseItem.submissionDate ? " · " : ""}
                          {caseItem.submissionDate ? `递签 ${new Date(caseItem.submissionDate).toLocaleDateString("zh-CN")}` : ""}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-500">
                当前页面范围下还没有可用案件，请先在申请人详情页创建对应案件。
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

"use client"

import { type Dispatch, memo, type ReactNode, type SetStateAction, useMemo } from "react"
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  Clock3,
  ListFilter,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react"

import {
  CRM_PRIORITY_OPTIONS,
  CRM_REGION_OPTIONS,
  CRM_VISA_TYPE_OPTIONS,
  getApplicantCrmPriorityLabel,
  getApplicantCrmRegionLabel,
  getApplicantCrmVisaTypeLabel,
} from "@/lib/applicant-crm-labels"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type {
  ApplicantCrmQuickCounts,
  ApplicantCrmStats,
  FilterOptions,
  FilterTone,
  QuickView,
} from "@/app/applicants/applicant-crm-types"
import {
  getApplicantCrmStatusLabel,
  STATUS_LABELS,
  toggleValue,
} from "@/app/applicants/applicant-crm-view-helpers"

type StringListSetter = Dispatch<SetStateAction<string[]>>

const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  visaTypes: CRM_VISA_TYPE_OPTIONS.map((item) => item.value),
  regions: CRM_REGION_OPTIONS.map((item) => item.value),
  priorities: CRM_PRIORITY_OPTIONS.map((item) => item.value),
  statuses: Object.entries(STATUS_LABELS)
    .filter(([value]) => value !== "no_case")
    .map(([value, label]) => ({ value, label })),
}

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

export const ApplicantCrmDashboardPanel = memo(function ApplicantCrmDashboardPanel({
  stats,
  summaryLoading,
  quickCounts,
  quickView,
  setQuickView,
  keyword,
  deferredKeyword,
  setKeyword,
  selectedVisaTypes,
  setSelectedVisaTypes,
  selectedStatuses,
  setSelectedStatuses,
  selectedRegions,
  setSelectedRegions,
  selectedPriorities,
  setSelectedPriorities,
  selectedGroups,
  setSelectedGroups,
  availableGroupOptions,
  hasFilters,
  onClearFilters,
}: {
  stats: ApplicantCrmStats
  summaryLoading: boolean
  quickCounts: ApplicantCrmQuickCounts
  quickView: QuickView
  setQuickView: Dispatch<SetStateAction<QuickView>>
  keyword: string
  deferredKeyword: string
  setKeyword: Dispatch<SetStateAction<string>>
  selectedVisaTypes: string[]
  setSelectedVisaTypes: StringListSetter
  selectedStatuses: string[]
  setSelectedStatuses: StringListSetter
  selectedRegions: string[]
  setSelectedRegions: StringListSetter
  selectedPriorities: string[]
  setSelectedPriorities: StringListSetter
  selectedGroups: string[]
  setSelectedGroups: StringListSetter
  availableGroupOptions: Array<{ value: string; label: string }>
  hasFilters: boolean
  onClearFilters: () => void
}) {
  const quickCards = useMemo(() => {
    return [
      {
        key: "mine" as const,
        title: "\u6211\u8d1f\u8d23\u7684",
        value: quickCounts.mine,
        hint: "\u6211\u521b\u5efa\u6216\u88ab\u5206\u914d\u7ed9\u6211\u7684\u7533\u8bf7\u4eba",
        icon: <BriefcaseBusiness className="h-5 w-5" />,
      },
      {
        key: "review" as const,
        title: "\u5f85\u5ba1\u6838",
        value: quickCounts.review,
        hint: "\u6b63\u5728\u5ba1\u6838\u6216\u6750\u6599\u5df2\u5c31\u7eea",
        icon: <Clock3 className="h-5 w-5" />,
      },
      {
        key: "exception" as const,
        title: "\u5f02\u5e38\u5904\u7406\u4e2d",
        value: quickCounts.exception,
        hint: "\u9700\u8981\u4f18\u5148\u8ddf\u8fdb\u7684\u5f02\u5e38\u6848\u4ef6",
        icon: <AlertCircle className="h-5 w-5" />,
      },
      {
        key: "today" as const,
        title: "\u4eca\u65e5\u8981\u63a8\u8fdb",
        value: quickCounts.today,
        hint: "\u5f53\u524d\u4ecd\u5728\u63a8\u8fdb\u94fe\u8def\u4e2d\u7684\u6848\u4ef6",
        icon: <Sparkles className="h-5 w-5" />,
      },
    ]
  }, [quickCounts])

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
  }, [
    selectedGroups,
    selectedPriorities,
    selectedRegions,
    selectedStatuses,
    selectedVisaTypes,
    setSelectedGroups,
    setSelectedPriorities,
    setSelectedRegions,
    setSelectedStatuses,
    setSelectedVisaTypes,
  ])

  return (
    <>
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
            <Button variant="ghost" onClick={onClearFilters} disabled={!hasFilters}>
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
    </>
  )
})

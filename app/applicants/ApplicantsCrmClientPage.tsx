"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, BriefcaseBusiness, CalendarClock, RefreshCw, Search, UserPlus } from "lucide-react"

import {
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
  error?: string
}

type CreateApplicantForm = {
  name: string
  phone: string
  email: string
  wechat: string
  passportNumber: string
  note: string
}

const emptyCreateForm: CreateApplicantForm = {
  name: "",
  phone: "",
  email: "",
  wechat: "",
  passportNumber: "",
  note: "",
}

const STATUS_LABELS: Record<string, string> = {
  no_case: "未创建案件",
  pending_payment: "待付款",
  preparing_docs: "资料准备中",
  reviewing: "审核中",
  docs_ready: "材料已就绪",
  tls_processing: "TLS 处理中",
  slot_booked: "已获取 Slot",
  submitted: "已递签",
  completed: "已完成",
  exception: "异常处理中",
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

function getApplicantCrmStatusLabel(statusKey: string, fallbackLabel?: string) {
  return STATUS_LABELS[statusKey] || fallbackLabel || statusKey || "-"
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.length === 0 ? (
          <span className="text-sm text-gray-400">暂无可选项</span>
        ) : (
          options.map((option) => {
            const active = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                className={[
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  active
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                ].join(" ")}
              >
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

export default function ApplicantsCrmClientPage() {
  const router = useRouter()
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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState("")
  const [keyword, setKeyword] = useState("")
  const [selectedVisaTypes, setSelectedVisaTypes] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateApplicantForm>(emptyCreateForm)

  const fetchApplicants = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const params = new URLSearchParams()
        if (keyword.trim()) params.set("keyword", keyword.trim())
        for (const value of selectedVisaTypes) params.append("visaTypes", value)
        for (const value of selectedStatuses) params.append("statuses", value)
        for (const value of selectedRegions) params.append("regions", value)
        for (const value of selectedPriorities) params.append("priorities", value)

        const response = await fetch(`/api/applicants?${params.toString()}`, {
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as ApplicantsResponse | null
        if (!response.ok) {
          throw new Error(data?.error || "加载申请人列表失败")
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
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "加载申请人列表失败")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [keyword, selectedPriorities, selectedRegions, selectedStatuses, selectedVisaTypes],
  )

  useEffect(() => {
    void fetchApplicants()
  }, [fetchApplicants])

  const toggleValue = (list: string[], value: string) => {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  const hasFilters = useMemo(
    () =>
      Boolean(keyword.trim()) ||
      selectedVisaTypes.length > 0 ||
      selectedStatuses.length > 0 ||
      selectedRegions.length > 0 ||
      selectedPriorities.length > 0,
    [keyword, selectedPriorities.length, selectedRegions.length, selectedStatuses.length, selectedVisaTypes.length],
  )

  const applyFilters = async () => {
    setMessage("")
    await fetchApplicants(true)
  }

  const clearFilters = async () => {
    setKeyword("")
    setSelectedVisaTypes([])
    setSelectedStatuses([])
    setSelectedRegions([])
    setSelectedPriorities([])
    setMessage("")

    setTimeout(() => {
      void fetchApplicants(true)
    }, 0)
  }

  const createApplicant = async () => {
    if (!createForm.name.trim()) {
      setMessage("请先填写申请人姓名")
      return
    }

    setCreating(true)
    setMessage("")

    try {
      const response = await fetch("/api/applicants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.profile?.id) {
        throw new Error(data?.error || "创建申请人失败")
      }

      window.localStorage.setItem("activeApplicantProfileId", data.profile.id)
      setCreateDialogOpen(false)
      setCreateForm(emptyCreateForm)
      router.push(`/applicants/${data.profile.id}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建申请人失败")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-gray-900">申请人 CRM 工作台</h1>
            <p className="text-sm text-gray-500">
              申请人、案件、材料和进度统一在这里管理。管理员可查看全部，员工默认只看自己创建的申请人或分配给自己的案件。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void fetchApplicants(true)} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              新建申请人
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
            title="申请人总数"
            value={stats.applicantCount}
            hint="当前可见申请人"
            icon={<UserPlus className="h-5 w-5" />}
          />
          <StatCard
            title="活跃案件数"
            value={stats.activeCaseCount}
            hint="处于进行中的 Case"
            icon={<BriefcaseBusiness className="h-5 w-5" />}
          />
          <StatCard
            title="异常案件数"
            value={stats.exceptionCaseCount}
            hint="当前需要人工关注"
            icon={<Badge variant="destructive">!</Badge>}
          />
          <StatCard
            title="近 7 天更新"
            value={stats.updatedLast7DaysCount}
            hint="最近有动态的申请人"
            icon={<CalendarClock className="h-5 w-5" />}
          />
        </div>

        <Card className="border-gray-200 bg-white/90">
          <CardHeader>
            <CardTitle>搜索与筛选</CardTitle>
            <CardDescription>同组多选按 OR，不同筛选组之间按 AND 组合。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="pl-10"
                  placeholder="搜索姓名、手机号、护照号、邮箱、微信号"
                />
              </div>
              <Button variant="outline" onClick={() => void applyFilters()}>
                应用筛选
              </Button>
              <Button variant="ghost" onClick={() => void clearFilters()} disabled={!hasFilters}>
                清空
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <FilterGroup
                title="签证类型"
                options={filterOptions.visaTypes.map((item) => ({
                  value: item,
                  label: getApplicantCrmVisaTypeLabel(item),
                }))}
                selected={selectedVisaTypes}
                onToggle={(value) => setSelectedVisaTypes((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title="当前状态"
                options={filterOptions.statuses.map((item) => ({
                  value: item.value,
                  label: getApplicantCrmStatusLabel(item.value, item.label),
                }))}
                selected={selectedStatuses}
                onToggle={(value) => setSelectedStatuses((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title="地区"
                options={filterOptions.regions.map((item) => ({
                  value: item,
                  label: getApplicantCrmRegionLabel(item),
                }))}
                selected={selectedRegions}
                onToggle={(value) => setSelectedRegions((prev) => toggleValue(prev, value))}
              />
              <FilterGroup
                title="优先级"
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
            <CardTitle>申请人列表</CardTitle>
            <CardDescription>点击行或“查看详情”进入申请人工作台。</CardDescription>
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
                    <TableHead>申请人</TableHead>
                    <TableHead>签证类型</TableHead>
                    <TableHead>地区</TableHead>
                    <TableHead>当前状态</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>出行时间</TableHead>
                    <TableHead>最近更新</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/applicants/${row.id}`)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{row.name}</div>
                          <div className="text-xs text-gray-500">
                            {row.phone || row.email || row.wechat || row.passportNumber || "暂无联系方式"}
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
                      <TableCell>{getApplicantCrmPriorityLabel(row.priority)}</TableCell>
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
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-gray-500">
                        当前没有符合条件的申请人。
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
            <DialogTitle>新建申请人</DialogTitle>
            <DialogDescription>先创建基础 CRM 档案，保存后进入详情页补材料和 Case。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>申请人姓名</Label>
              <Input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例如：李尚耕"
              />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input
                value={createForm.phone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>微信</Label>
              <Input
                value={createForm.wechat}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, wechat: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>护照号</Label>
              <Input
                value={createForm.passportNumber}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, passportNumber: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>备注</Label>
              <Textarea
                value={createForm.note}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void createApplicant()} disabled={creating}>
              {creating ? "创建中..." : "创建并进入详情"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

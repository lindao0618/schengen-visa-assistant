"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  FileText,
  UserPlus,
  FilePlus,
  ClipboardList,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Trash2,
  UserRound,
  FileSpreadsheet,
  RefreshCw,
  Wallet,
} from "lucide-react"
import { AuthPromptProvider, useAuthPrompt } from "@/app/usa-visa/contexts/AuthPromptContext"
import { FranceTaskList } from "./FranceTaskList"
import { ApplicantProfileSelector } from "@/components/applicant-profile-selector"
import { FranceCaseProgressCard } from "@/components/france-case-progress-card"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { getFranceTlsCityLabel, normalizeFranceTlsCity } from "@/lib/france-tls-city"
import { FranceQuickStartCard } from "./FranceQuickStartCard"

const MANUAL_OPTION = "__manual__"

interface ApplicantProfileOption {
  id: string
  label: string
  name?: string
  schengen?: {
    country?: string
    city?: string
  }
  files?: Record<string, { originalName?: string; uploadedAt?: string }>
}

interface FranceApplicantGroup {
  id: string
  applicantProfileId: string
  excelFile: File | null
}

function createFranceGroup(applicantProfileId = ""): FranceApplicantGroup {
  return {
    id: `fr-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    applicantProfileId,
    excelFile: null,
  }
}

function getProfileFranceExcel(profile: ApplicantProfileOption | undefined) {
  if (!profile?.files) return null
  return profile.files.schengenExcel || profile.files.franceExcel || null
}

function getProfileFranceApplicationJson(profile: ApplicantProfileOption | undefined) {
  if (!profile?.files) return null
  return profile.files.franceApplicationJson || null
}

function getProfileFranceTlsCity(profile: ApplicantProfileOption | undefined) {
  return normalizeFranceTlsCity(profile?.schengen?.city)
}

function formatUploadedAt(uploadedAt?: string) {
  if (!uploadedAt) return ""
  const d = new Date(uploadedAt)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("zh-CN", { hour12: false })
}

interface CaptchaBalanceInfo {
  configured: boolean
  balance: number | null
  error: string | null
}
interface CaptchaBalance {
  capsolver: CaptchaBalanceInfo
  twocaptcha: CaptchaBalanceInfo
}

function CaptchaBalanceCard() {
  const [data, setData] = useState<CaptchaBalance | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchBalance = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/captcha-balance", { cache: "no-store" })
      if (res.ok) setData(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchBalance() }, [])

  const renderItem = (label: string, info: CaptchaBalanceInfo | undefined) => {
    if (!info) return null
    if (!info.configured) return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="font-medium">{label}</span>
        <span>未配置</span>
      </div>
    )
    if (info.error) return (
      <div className="flex items-center gap-2 text-xs text-red-500">
        <span className="font-medium">{label}</span>
        <AlertCircle className="h-3.5 w-3.5" />
        <span>查询失败: {info.error}</span>
      </div>
    )
    const low = info.balance !== null && info.balance < 1
    return (
      <div className={`flex items-center gap-2 text-xs ${low ? "text-orange-500" : "text-green-600 dark:text-green-400"}`}>
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <Wallet className="h-3.5 w-3.5" />
        <span className="font-semibold">${info.balance?.toFixed(2)}</span>
        {low && <span className="text-orange-500">（余额不足，请充值）</span>}
      </div>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        <Wallet className="h-4 w-4" />
        验证码余额
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : data ? (
        <div className="flex flex-wrap gap-4">
          {renderItem("Capsolver", data.capsolver)}
          {renderItem("2Captcha", data.twocaptcha)}
        </div>
      ) : (
        <span className="text-xs text-gray-400">查询失败</span>
      )}
      <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={fetchBalance} disabled={loading}>
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        刷新
      </Button>
    </div>
  )
}

function FranceAutomationContent() {
  const { showLoginPrompt } = useAuthPrompt()
  const activeApplicant = useActiveApplicantProfile()
  const [profiles, setProfiles] = useState<ApplicantProfileOption[]>([])

  const hasSchengenProfileExcel = Boolean(activeApplicant?.files?.schengenExcel || activeApplicant?.files?.franceExcel)
  const activeApplicantName = activeApplicant?.name || activeApplicant?.label

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await fetch("/api/applicants", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        setProfiles((data.profiles || []) as ApplicantProfileOption[])
      } catch (error) {
        console.error("Failed to load applicant profiles for France automation:", error)
      }
    }

    void loadProfiles()
  }, [])
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <ApplicantProfileSelector />
        <CaptchaBalanceCard />
        <div className="mb-6">
          <FranceCaseProgressCard applicantProfileId={activeApplicant?.id} applicantName={activeApplicantName} />
        </div>
        <FranceQuickStartCard />

        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/schengen-visa/automation">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg">
              <Image src="https://flagcdn.com/w80/fr.png" alt="法国" width={40} height={40} className="object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">法签自动化</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                France-visas 注册信息提取、账号注册、生成申请、填写回执、提交最终表。
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="extract" className="w-full">
          <div className="mb-6 flex flex-col gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                FV 表（France-visas）
              </p>
              <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl border border-gray-200/50 bg-gray-100/80 p-1 shadow-lg backdrop-blur-xl sm:grid-cols-4 dark:border-white/10 dark:bg-black/50">
                <TabsTrigger value="extract" className="flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">提取+注册</span>
                </TabsTrigger>
                <TabsTrigger value="create-app" className="flex items-center justify-center gap-2">
                  <FilePlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">生成新申请</span>
                </TabsTrigger>
                <TabsTrigger value="fill-receipt" className="flex items-center justify-center gap-2">
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  <span className="truncate">填写回执单</span>
                </TabsTrigger>
                <TabsTrigger value="submit-final" className="flex items-center justify-center gap-2">
                  <Send className="h-4 w-4 shrink-0" />
                  <span className="truncate">提交最终表</span>
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                TLS 表
              </p>
              <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl border border-gray-200/50 bg-gray-100/80 p-1 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
                <TabsTrigger value="tls-register" className="flex items-center justify-center gap-2">
                  <UserPlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">TLS 账户注册</span>
                </TabsTrigger>
                <TabsTrigger value="tls-apply" className="flex items-center justify-center gap-2">
                  <Send className="h-4 w-4 shrink-0" />
                  <span className="truncate">TLS 填表提交</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="extract">
            <StepCard
              title="提取+注册"
              description="按申请组提交，系统会先提取 FV 注册信息，再继续注册 France-visas 账号。"
              apiPath="/api/schengen/france/extract-register"
              accept=".xlsx,.xls"
              buttonLabel="开始提取+注册"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["extract-register", "extract", "register"]} title="提取+注册任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="create-app">
            <StepCard
              title="生成新申请"
              description="上传 Excel，在 France-visas 中创建新的申请。"
              apiPath="/api/schengen/france/create-application"
              accept=".xlsx,.xls"
              buttonLabel="生成申请"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["create-application"]} title="生成新申请任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="fill-receipt">
            <StepCard
              title="填写回执单"
              description="上传 Excel，填写回执单并下载 PDF。"
              apiPath="/api/schengen/france/fill-receipt"
              accept=".xlsx,.xls"
              buttonLabel="填写回执单"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["fill-receipt"]} title="填写回执单任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="tls-register">
            <TlsRegisterCard
              showLoginPrompt={showLoginPrompt}
              locationDefault=""
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["tls-register"]} title="TLS 账户注册任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="tls-apply">
            <TlsApplyCard
              showLoginPrompt={showLoginPrompt}
              locationDefault=""
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["tls-apply"]} title="TLS 填表提交任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="submit-final">
            <StepCard
              title="提交最终表"
              description="上传 Excel，提交最终申请表。"
              apiPath="/api/schengen/france/submit-final"
              accept=".xlsx,.xls"
              buttonLabel="提交最终表"
              showLoginPrompt={showLoginPrompt}
              activeApplicantId={activeApplicant?.id}
              activeApplicantName={activeApplicantName}
              profiles={profiles}
              canUseApplicantProfile={hasSchengenProfileExcel}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["submit-final"]} title="提交最终表任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function StepCard({
  title,
  description,
  apiPath,
  accept,
  buttonLabel,
  showLoginPrompt,
  activeApplicantId,
  activeApplicantName,
  profiles,
  canUseApplicantProfile,
}: {
  title: string
  description: string
  apiPath: string
  accept: string
  buttonLabel: string
  showLoginPrompt: () => void
  activeApplicantId?: string
  activeApplicantName?: string
  profiles: ApplicantProfileOption[]
  canUseApplicantProfile: boolean
}) {
  const [groups, setGroups] = useState<FranceApplicantGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message?: string
    error?: string
    task_id?: string
    task_ids?: string[]
    download_excel?: string
    download_json?: string
    download_pdf?: string
  } | null>(null)

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles])

  const suggestProfileId = () => {
    const used = new Set(groups.map((group) => group.applicantProfileId).filter(Boolean))
    if (activeApplicantId && !used.has(activeApplicantId)) {
      return activeApplicantId
    }
    const unused = profiles.find((profile) => !used.has(profile.id))
    return unused?.id || activeApplicantId || ""
  }

  const addGroup = (prefillProfileId?: string) => {
    setGroups((current) => [...current, createFranceGroup(prefillProfileId ?? suggestProfileId())])
    setResult(null)
  }

  const updateGroup = (id: string, updates: Partial<FranceApplicantGroup>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...updates } : group)))
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
    setResult(null)
  }

  const getGroupProfile = (group: FranceApplicantGroup) =>
    group.applicantProfileId ? profileMap.get(group.applicantProfileId) : undefined

  const groupHasExcel = (group: FranceApplicantGroup) => !!group.excelFile || !!getProfileFranceExcel(getGroupProfile(group))

  const getGroupDisplayName = (group: FranceApplicantGroup, index: number) => {
    const profile = getGroupProfile(group)
    return profile?.name || profile?.label || `${title}申请组 ${index + 1}`
  }

  const submitOne = async (group: FranceApplicantGroup) => {
    const formData = new FormData()
    if (group.excelFile) {
      formData.append("file", group.excelFile)
    }
    if (group.applicantProfileId) {
      formData.append("applicantProfileId", group.applicantProfileId)
    }

    const res = await fetch(apiPath, { method: "POST", body: formData, credentials: "include" })
    if (res.status === 401) {
      showLoginPrompt()
      throw new Error("AUTH_REQUIRED")
    }
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || "处理失败")
    }
    return Array.isArray(data.task_ids) ? data.task_ids.length : data.task_id ? 1 : 0
  }

  const handleSubmit = async () => {
    const valid = groups.filter(groupHasExcel)
    if (valid.length === 0) {
      setResult({
        success: false,
        error: "请至少准备一个完整申请组。每组都需要一份 Excel，可以直接复用申请人档案里的申根 Excel。",
      })
      return
    }

    setLoading(true)
    setResult(null)
    const errors: string[] = []
    let createdTasks = 0

    try {
      const responses = await Promise.allSettled(valid.map((group) => submitOne(group)))
      responses.forEach((response, index) => {
        const group = valid[index]
        if (response.status === "fulfilled") {
          createdTasks += response.value
          return
        }
        if (response.reason?.message === "AUTH_REQUIRED") return
        errors.push(`${getGroupDisplayName(group, index)}: ${response.reason?.message || "失败"}`)
      })

      if (responses.some((response) => response.status === "rejected" && response.reason?.message === "AUTH_REQUIRED")) {
        return
      }

      if (createdTasks > 0 && errors.length === 0) {
        setResult({
          success: true,
          message: `已创建 ${createdTasks} 个任务，请在下方任务列表查看进度。`,
        })
        return
      }

      if (createdTasks > 0) {
        setResult({
          success: false,
          error: `已成功创建 ${createdTasks} 个任务，但有部分申请组失败：${errors.join("；")}`,
        })
        return
      }

      setResult({
        success: false,
        error: errors.join("；") || "提交失败",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-gray-200/50 bg-gradient-to-b from-white to-gray-50 shadow-2xl backdrop-blur-md dark:border-gray-800/50 dark:from-gray-900 dark:to-black">
      <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {canUseApplicantProfile && activeApplicantId && (
          <Card className="border-blue-200/30 bg-blue-50/20 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
            <div className="space-y-3">
              <div className="text-sm font-medium">按申请组处理</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {activeApplicantName || "当前申请人"} 已归档申根 Excel。你可以直接用当前档案新建一组，也可以继续添加更多申请组。
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => addGroup(activeApplicantId)} className="gap-2">
                  <UserRound className="h-4 w-4" />
                  用当前档案新增一组
                </Button>
                <Button type="button" variant="outline" onClick={() => addGroup()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  添加空白申请组
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!activeApplicantId && (
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => addGroup()} className="gap-2">
              <Plus className="h-4 w-4" />
              添加申请组
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {groups.length === 0 && (
            <div className="rounded-xl border-2 border-dashed py-8 text-center text-gray-500 dark:text-gray-400">
              先添加申请组。每一组就是一个申请人，可以直接选档案，也可以手动上传当前组使用的 Excel。
            </div>
          )}

          {groups.map((group, index) => {
            const profile = getGroupProfile(group)
            const profileExcel = getProfileFranceExcel(profile)
            const hasExcel = groupHasExcel(group)

            return (
              <Card key={group.id} className="border-2 border-[#e5e5ea] dark:border-gray-800">
                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{getGroupDisplayName(group, index)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">第 {index + 1} 组</div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(group.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="mr-1 h-4 w-4" />
                      移除
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>选择申请人档案</Label>
                    <Select
                      value={group.applicantProfileId || MANUAL_OPTION}
                      onValueChange={(value) =>
                        updateGroup(group.id, {
                          applicantProfileId: value === MANUAL_OPTION ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="直接选择已有申请人档案" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MANUAL_OPTION}>不使用档案，完全手动上传</SelectItem>
                        {profiles.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name || item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {profile && (
                    <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3 text-sm dark:border-gray-700">
                      <div className="font-medium text-gray-900 dark:text-white">已关联档案：{profile.name || profile.label}</div>
                      <div className="text-gray-600 dark:text-gray-300">
                        档案 Excel：{profileExcel?.originalName || "档案中未上传"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        当前组会优先使用档案里的申根 Excel；如果你在下面重新上传，就以这次上传为准。
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Excel 文件</Label>
                    <input
                      type="file"
                      accept={accept}
                      onChange={(event) => updateGroup(group.id, { excelFile: event.target.files?.[0] || null })}
                      className="block w-full text-sm"
                    />
                    <div className="text-sm">
                      {group.excelFile ? (
                        <p className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <FileSpreadsheet className="h-4 w-4" />
                          当前上传：{group.excelFile.name}
                        </p>
                      ) : profileExcel ? (
                        <p className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <FileSpreadsheet className="h-4 w-4" />
                          使用档案：{profileExcel.originalName}
                        </p>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400">还没有 Excel 文件</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
                    <span className={hasExcel ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      Excel：{hasExcel ? "已就绪" : "缺少"}
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {groups.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={loading} className="h-10 min-w-[180px] gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>{loading ? "处理中..." : buttonLabel}</span>
            </Button>
          </div>
        )}

        {result && (
          <Alert variant={result.success ? "default" : "destructive"} className="mt-4">
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {result.success ? result.message : result.error}
              {result.success && (result.task_id || (result.task_ids && result.task_ids.length > 0) || result.message) && (
                <p className="mt-2 text-sm text-muted-foreground">请在下方任务列表查看进度和下载链接。</p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function TlsRegisterCard({
  showLoginPrompt,
  locationDefault,
  activeApplicantId,
  activeApplicantName,
  profiles,
  canUseApplicantProfile,
}: {
  showLoginPrompt: () => void
  locationDefault: string
  activeApplicantId?: string
  activeApplicantName?: string
  profiles: ApplicantProfileOption[]
  canUseApplicantProfile: boolean
}) {
  const [location, setLocation] = useState<string>(locationDefault)
  const [applicantProfileId, setApplicantProfileId] = useState<string>(activeApplicantId || "")
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; task_id?: string; task_ids?: string[] } | null>(null)

  useEffect(() => {
    if (activeApplicantId) setApplicantProfileId(activeApplicantId)
  }, [activeApplicantId])

  const selectedProfile = useMemo(
    () => (applicantProfileId ? profiles.find((p) => p.id === applicantProfileId) : undefined),
    [applicantProfileId, profiles],
  )
  const selectedProfileExcel = getProfileFranceExcel(selectedProfile)
  const selectedHasSchengenExcel = Boolean(selectedProfileExcel)
  const selectedProfileCity = getProfileFranceTlsCity(selectedProfile) || ""
  const resolvedLocation = selectedProfileCity || location
  const selectedProfileCityLabel = getFranceTlsCityLabel(selectedProfileCity)
  const autoExcelLabel = selectedProfileExcel?.originalName || "schengenExcel"
  const autoExcelUploadedAt = formatUploadedAt(selectedProfileExcel?.uploadedAt)

  useEffect(() => {
    if (selectedProfileCity) {
      setLocation(selectedProfileCity)
    }
  }, [selectedProfileCity])

  const handleSubmit = async () => {
    if (!excelFile && !applicantProfileId.trim()) {
      setResult({ success: false, error: "请上传 Excel，或选择申请人档案自动匹配" })
      return
    }
    if (!excelFile && !selectedHasSchengenExcel) {
      setResult({ success: false, error: "所选档案没有申根 Excel，请先在「申请人」页上传申根表，或手动上传 Excel。" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      if (excelFile) formData.append("excel", excelFile)
      if (applicantProfileId.trim()) formData.append("applicantProfileId", applicantProfileId.trim())
      formData.append("location", resolvedLocation)

      const res = await fetch("/api/schengen/france/tls-register", { method: "POST", body: formData, credentials: "include" })
      if (res.status === 401) {
        showLoginPrompt()
        throw new Error("AUTH_REQUIRED")
      }
      const data = await res.json()
      if (!res.ok || !data.success) {
        setResult({ success: false, error: data.error || data.message || "TLS 注册失败" })
        return
      }
      setResult({ success: true, message: data.message, task_id: data.task_id, task_ids: data.task_ids })
    } catch (e) {
      if ((e as Error)?.message === "AUTH_REQUIRED") return
      setResult({ success: false, error: e instanceof Error ? e.message : "TLS 注册失败" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-gray-200/50 bg-gradient-to-b from-white to-gray-50 shadow-2xl backdrop-blur-md dark:border-gray-800/50 dark:from-gray-900 dark:to-black">
      <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
        <CardTitle>TLS 账户注册</CardTitle>
        <CardDescription>
          默认只用 Excel：可直接上传 Excel，或自动使用申请人档案里的申根 Excel，并自动生成 TLS 注册所需 accounts JSON。
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {canUseApplicantProfile && activeApplicantId && (
          <Alert className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20">
            <AlertDescription className="text-sm">
              当前顶部已选档案「{activeApplicantName || "申请人"}」。不上传文件时会自动使用该档案的申根 Excel 生成注册账号数据。
            </AlertDescription>
          </Alert>
        )}

        {selectedProfileCity && (
          <Alert className="border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <AlertDescription className="text-sm">
              已从申请人档案自动匹配 TLS 递签城市：{selectedProfileCity} - {selectedProfileCityLabel || selectedProfileCity}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2" hidden={Boolean(selectedProfileCity)}>
          <Label htmlFor="tls-location">TLS 地点（location）</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger id="tls-location">
              <SelectValue placeholder="选择 location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LON">LON - 伦敦</SelectItem>
              <SelectItem value="MNC">MNC - 曼彻斯特</SelectItem>
              <SelectItem value="EDI">EDI - 爱丁堡</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-register-profile">申请人档案（自动匹配来源）</Label>
          {profiles.length === 0 ? (
            <p id="tls-register-profile" className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              暂无申请人档案，可先手动上传 Excel。
            </p>
          ) : (
            <Select value={applicantProfileId || undefined} onValueChange={setApplicantProfileId}>
              <SelectTrigger id="tls-register-profile">
                <SelectValue placeholder="选择申请人档案（可选）" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name || item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-excel">Excel（可选，上传后自动转 JSON）</Label>
          <input id="tls-excel" type="file" accept=".xlsx,.xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {excelFile && <p className="text-xs text-muted-foreground">已手动选择：{excelFile.name}（将自动生成 accounts JSON）</p>}
          {!excelFile && applicantProfileId && (
            <p className="text-xs text-muted-foreground">
              自动匹配：
              {selectedProfileExcel
                ? ` 将使用档案 Excel ${autoExcelLabel}${autoExcelUploadedAt ? `（更新于 ${autoExcelUploadedAt}）` : ""}`
                : " 当前档案没有申根 Excel，请先上传后再试。"}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || (!excelFile && !applicantProfileId.trim())}
            className="h-10 min-w-[180px] gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{loading ? "处理中..." : "开始 TLS 注册"}</span>
          </Button>
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {result.success ? result.message : result.error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function TlsApplyCard({
  showLoginPrompt,
  locationDefault,
  activeApplicantId,
  activeApplicantName,
  profiles,
  canUseApplicantProfile,
}: {
  showLoginPrompt: () => void
  locationDefault: string
  activeApplicantId?: string
  activeApplicantName?: string
  profiles: ApplicantProfileOption[]
  canUseApplicantProfile: boolean
}) {
  const [location, setLocation] = useState<string>(locationDefault)
  const [applicantProfileId, setApplicantProfileId] = useState<string>(activeApplicantId || "")
  const [applicantsFile, setApplicantsFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; task_id?: string; task_ids?: string[] } | null>(null)

  useEffect(() => {
    if (activeApplicantId) setApplicantProfileId(activeApplicantId)
  }, [activeApplicantId])

  const selectedProfile = useMemo(
    () => (applicantProfileId ? profiles.find((p) => p.id === applicantProfileId) : undefined),
    [applicantProfileId, profiles],
  )
  const selectedHasSchengenExcel = Boolean(selectedProfile && getProfileFranceExcel(selectedProfile))
  const selectedProfileCity = getProfileFranceTlsCity(selectedProfile) || ""
  const resolvedLocation = selectedProfileCity || location
  const selectedProfileCityLabel = getFranceTlsCityLabel(selectedProfileCity)
  const selectedAutoApplicantsJson = getProfileFranceApplicationJson(selectedProfile)
  const autoApplicantsLabel = selectedAutoApplicantsJson?.originalName || "franceApplicationJson"
  const autoApplicantsUploadedAt = formatUploadedAt(selectedAutoApplicantsJson?.uploadedAt)

  useEffect(() => {
    if (selectedProfileCity) {
      setLocation(selectedProfileCity)
    }
  }, [selectedProfileCity])

  const handleSubmit = async () => {
    if (!applicantProfileId.trim()) {
      setResult({ success: false, error: "请选择申请人档案" })
      return
    }
    if (!selectedHasSchengenExcel) {
      setResult({ success: false, error: "所选档案没有申根 Excel，请先在「申请人」页为该档案上传，或换一个有申根表的档案。" })
      return
    }
    if (!resolvedLocation) {
      setResult({ success: false, error: "请先在申请人档案里补上 TLS 递签城市，或在这里手动选择城市" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      if (applicantsFile) formData.append("applicants", applicantsFile)
      formData.append("location", resolvedLocation)
      formData.append("applicantProfileId", applicantProfileId.trim())

      const res = await fetch("/api/schengen/france/tls-apply", { method: "POST", body: formData, credentials: "include" })
      if (res.status === 401) {
        showLoginPrompt()
        throw new Error("AUTH_REQUIRED")
      }
      const data = await res.json()
      if (!res.ok || !data.success) {
        setResult({ success: false, error: data.error || data.message || "TLS 填表失败" })
        return
      }
      setResult({ success: true, message: data.message, task_id: data.task_id, task_ids: data.task_ids })
    } catch (e) {
      if ((e as Error)?.message === "AUTH_REQUIRED") return
      setResult({ success: false, error: e instanceof Error ? e.message : "TLS 填表失败" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-gray-200/50 bg-gradient-to-b from-white to-gray-50 shadow-2xl backdrop-blur-md dark:border-gray-800/50 dark:from-gray-900 dark:to-black">
      <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
        <CardTitle>TLS 填表提交</CardTitle>
        <CardDescription>
          与填写回执单相同：TLS 登录邮箱、密码从所选档案的<strong className="font-medium text-foreground">申根 Excel</strong>自动读取（更新档案 Excel
          后即更新，无需手填）。applicants 可手动上传；不上传时自动使用「生成新申请」已存档 JSON。
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {canUseApplicantProfile && activeApplicantId && (
          <Alert className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20">
            <AlertDescription className="text-sm">
              当前顶部已选档案「{activeApplicantName || "申请人"}」含申根 Excel。你可在此选择同一档案或其他档案；账号信息均从对应档案的 Excel 解析。
            </AlertDescription>
          </Alert>
        )}

        {selectedProfileCity && (
          <Alert className="border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <AlertDescription className="text-sm">
              已从申请人档案自动匹配 TLS 递签城市：{selectedProfileCity} - {selectedProfileCityLabel || selectedProfileCity}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2" hidden={Boolean(selectedProfileCity)}>
          <Label htmlFor="tls-apply-location">TLS 地点（location）</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger id="tls-apply-location">
              <SelectValue placeholder="选择 location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LON">LON - 伦敦</SelectItem>
              <SelectItem value="MNC">MNC - 曼彻斯特</SelectItem>
              <SelectItem value="EDI">EDI - 爱丁堡</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-apply-profile">申请人档案（用于读取 Excel 中的邮箱/密码）</Label>
          {profiles.length === 0 ? (
            <p id="tls-apply-profile" className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              暂无申请人档案，请先在「申请人」页创建并上传申根 Excel。
            </p>
          ) : (
            <Select value={applicantProfileId || undefined} onValueChange={setApplicantProfileId}>
              <SelectTrigger id="tls-apply-profile">
                <SelectValue placeholder="选择申请人档案" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name || item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {applicantProfileId && !selectedHasSchengenExcel && (
            <p className="text-sm text-amber-700 dark:text-amber-400">该档案尚未上传申根 Excel。</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tls-apply-applicants">applicants 数组 json（可选，留空则自动使用档案里的生成新申请 JSON）</Label>
          <input id="tls-apply-applicants" type="file" accept=".json" onChange={(e) => setApplicantsFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          {!applicantsFile && applicantProfileId && (
            <p className="text-xs text-muted-foreground">
              自动匹配：
              {selectedAutoApplicantsJson
                ? ` 将使用档案文件 ${autoApplicantsLabel}${autoApplicantsUploadedAt ? `（更新于 ${autoApplicantsUploadedAt}）` : ""}`
                : " 当前档案还没有生成新申请 JSON，请先执行「生成新申请」或手动上传 applicants 文件。"}
            </p>
          )}
          {applicantsFile && <p className="text-xs text-muted-foreground">已手动选择：{applicantsFile.name}（本次优先使用手动文件）</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || !applicantProfileId.trim() || !selectedHasSchengenExcel}
            className="h-10 min-w-[180px] gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{loading ? "处理中..." : "开始 TLS 填表"}</span>
          </Button>
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {result.success ? result.message : result.error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default function FranceAutomationPage() {
  return (
    <AuthPromptProvider>
      <FranceAutomationContent />
    </AuthPromptProvider>
  )
}

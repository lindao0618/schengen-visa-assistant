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
} from "lucide-react"
import { AuthPromptProvider, useAuthPrompt } from "@/app/usa-visa/contexts/AuthPromptContext"
import { FranceTaskList } from "./FranceTaskList"
import { ApplicantProfileSelector } from "@/components/applicant-profile-selector"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"

const MANUAL_OPTION = "__manual__"

interface ApplicantProfileOption {
  id: string
  label: string
  name?: string
  files?: Record<string, { originalName?: string }>
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
          <TabsList className="mb-6 grid h-12 w-full grid-cols-4 rounded-2xl border border-gray-200/50 bg-gray-100/80 p-1 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
            <TabsTrigger value="extract" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              提取+注册
            </TabsTrigger>
            <TabsTrigger value="create-app" className="flex items-center gap-2">
              <FilePlus className="h-4 w-4" />
              生成新申请
            </TabsTrigger>
            <TabsTrigger value="fill-receipt" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              填写回执单
            </TabsTrigger>
            <TabsTrigger value="submit-final" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              提交最终表
            </TabsTrigger>
          </TabsList>

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

export default function FranceAutomationPage() {
  return (
    <AuthPromptProvider>
      <FranceAutomationContent />
    </AuthPromptProvider>
  )
}

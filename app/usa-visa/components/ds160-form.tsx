"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle2, Plus, Trash2, ExternalLink, UserRound, FileSpreadsheet, ImageIcon } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"

const DEFAULT_CC_EMAIL = "ukvisa20242024@163.com"
const MANUAL_OPTION = "__manual__"

interface ApplicantProfileOption {
  id: string
  label: string
  name?: string
  usVisa?: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
  }
  files?: Record<string, { originalName?: string }>
}

interface ApplicationGroup {
  id: string
  applicantProfileId: string
  excelFile: File | null
  photoFile: File | null
}

function createGroup(applicantProfileId = ""): ApplicationGroup {
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    applicantProfileId,
    excelFile: null,
    photoFile: null,
  }
}

function getProfileFile(
  profile: ApplicantProfileOption | undefined,
  candidates: string[]
) {
  if (!profile?.files) return null
  for (const slot of candidates) {
    const file = profile.files[slot]
    if (file) return file
  }
  return null
}

export function DS160Form() {
  const { showLoginPrompt } = useAuthPrompt()
  const activeApplicant = useActiveApplicantProfile()
  const [profiles, setProfiles] = useState<ApplicantProfileOption[]>([])
  const [groups, setGroups] = useState<ApplicationGroup[]>([])
  const [extraEmail, setExtraEmail] = useState(DEFAULT_CC_EMAIL)
  const [batchMode, setBatchMode] = useState<"parallel" | "sequential">("parallel")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: string; message: string } | null>(null)

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await fetch("/api/applicants", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        setProfiles((data.profiles || []) as ApplicantProfileOption[])
      } catch (error) {
        console.error("Failed to load applicant profiles for DS-160:", error)
      }
    }

    void loadProfiles()
  }, [])

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  )

  const suggestProfileId = () => {
    const used = new Set(groups.map((group) => group.applicantProfileId).filter(Boolean))
    if (activeApplicant?.id && !used.has(activeApplicant.id)) {
      return activeApplicant.id
    }
    const unused = profiles.find((profile) => !used.has(profile.id))
    return unused?.id || activeApplicant?.id || ""
  }

  const addGroup = (prefillProfileId?: string) => {
    setGroups((current) => [...current, createGroup(prefillProfileId ?? suggestProfileId())])
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
    setResult(null)
  }

  const updateGroup = (id: string, updates: Partial<ApplicationGroup>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...updates } : group)))
    setResult(null)
  }

  const getGroupProfile = (group: ApplicationGroup) =>
    group.applicantProfileId ? profileMap.get(group.applicantProfileId) : undefined

  const getGroupExcelMeta = (group: ApplicationGroup) =>
    getProfileFile(getGroupProfile(group), ["usVisaDs160Excel", "ds160Excel", "usVisaAisExcel", "aisExcel"])

  const getGroupPhotoMeta = (group: ApplicationGroup) =>
    getProfileFile(getGroupProfile(group), ["usVisaPhoto", "photo"])

  const groupHasRequiredFiles = (group: ApplicationGroup) => {
    const hasExcel = !!group.excelFile || !!getGroupExcelMeta(group)
    const hasPhoto = !!group.photoFile || !!getGroupPhotoMeta(group)
    return hasExcel && hasPhoto
  }

  const getGroupDisplayName = (group: ApplicationGroup, index: number) => {
    const profile = getGroupProfile(group)
    return profile?.name || profile?.label || `申请组 ${index + 1}`
  }

  const submitOne = async (group: ApplicationGroup): Promise<{ task_id: string } | { success: true }> => {
    const email = (extraEmail || DEFAULT_CC_EMAIL).trim()
    const formData = new FormData()

    if (group.applicantProfileId) {
      formData.append("applicantProfileId", group.applicantProfileId)
    }
    if (group.excelFile) {
      formData.append("excel", group.excelFile)
    }
    if (group.photoFile) {
      formData.append("photo", group.photoFile)
    }

    formData.append("email", email)
    formData.append("extra_email", extraEmail.trim())
    formData.append("async", "true")

    const res = await fetch("/api/usa-visa/ds160/auto-fill", { method: "POST", body: formData })
    if (res.status === 401) {
      showLoginPrompt()
      throw new Error("AUTH_REQUIRED")
    }

    const data = await res.json()
    if (data.task_id) return { task_id: data.task_id }
    if (!data.success) throw new Error(data.message || data.error || "DS-160 填表失败")
    return { success: true }
  }

  const handleBatchSubmit = async () => {
    const valid = groups.filter(groupHasRequiredFiles)
    if (valid.length === 0) {
      setResult({
        status: "error",
        message: "请至少准备一个完整申请组。每组都需要 Excel 和照片，可以来自申请人档案，也可以手动上传。",
      })
      return
    }

    setLoading(true)
    setResult(null)
    const errors: string[] = []
    const taskIds: string[] = []

    try {
      if (batchMode === "sequential") {
        for (const group of valid) {
          try {
            const response = await submitOne(group)
            if ("task_id" in response) taskIds.push(response.task_id)
          } catch (error) {
            if (error instanceof Error && error.message === "AUTH_REQUIRED") return
            errors.push(`${getGroupDisplayName(group, 0)}: ${error instanceof Error ? error.message : "失败"}`)
          }
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } else {
        const responses = await Promise.allSettled(valid.map((group) => submitOne(group)))
        responses.forEach((response, index) => {
          const group = valid[index]
          if (response.status === "fulfilled") {
            if ("task_id" in response.value) taskIds.push(response.value.task_id)
            return
          }
          if (response.reason?.message === "AUTH_REQUIRED") return
          errors.push(`${getGroupDisplayName(group, index)}: ${response.reason?.message || "失败"}`)
        })
        if (responses.some((response) => response.status === "rejected" && response.reason?.message === "AUTH_REQUIRED")) {
          return
        }
      }

      if (taskIds.length > 0 && errors.length === 0) {
        setResult({
          status: "success",
          message: `已创建 ${taskIds.length} 个 DS-160 任务，请在下方任务列表查看进度。结果会抄送到 ${(extraEmail || DEFAULT_CC_EMAIL).trim()}。`,
        })
        return
      }

      if (taskIds.length > 0) {
        setResult({
          status: "error",
          message: `已成功创建 ${taskIds.length} 个任务，但有部分申请组失败：${errors.join("；")}`,
        })
        return
      }

      setResult({
        status: "error",
        message: errors.join("；") || "批量提交失败",
      })
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") return
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : "批量提交失败",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 w-full mx-auto">
      <Card className="border-[#e5e5ea] shadow-sm overflow-hidden bg-white dark:bg-gray-900 dark:border-gray-800">
        <CardContent className="p-6 pt-6 space-y-6">
          <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start gap-4">
                <ExternalLink className="h-10 w-10 text-[#1c1c1e] dark:text-white flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">手动填表入口</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    如果需要手动填写，也可以直接访问美国政府官方 DS-160 网站。
                  </p>
                  <a
                    href="https://ceac.state.gov/genniv/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    前往官方 DS-160 填表网站
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <div className="text-lg font-semibold">申请组说明</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  一个申请组对应一个申请人。你可以直接选择申请人档案复用资料，也可以在当前组里手动上传 Excel 和照片进行覆盖。
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => addGroup(activeApplicant?.id || "")} className="gap-2">
                  <UserRound className="h-4 w-4" />
                  用当前档案新增一组
                </Button>
                <Button type="button" variant="outline" onClick={() => addGroup()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  添加空白申请组
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">申请组</Label>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                当前共 {groups.length} 组
              </div>
            </div>

            {groups.length === 0 && (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-xl">
                先添加申请组。每组都可以直接选择一个申请人档案。
              </div>
            )}

            {groups.map((group, index) => {
              const profile = getGroupProfile(group)
              const excelMeta = getGroupExcelMeta(group)
              const photoMeta = getGroupPhotoMeta(group)
              const hasExcel = !!group.excelFile || !!excelMeta
              const hasPhoto = !!group.photoFile || !!photoMeta

              return (
                <Card key={group.id} className="border-2 border-[#e5e5ea] dark:border-gray-800">
                  <CardHeader className="py-4 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{getGroupDisplayName(group, index)}</CardTitle>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        第 {index + 1} 组
                        {profile?.usVisa?.aaCode ? ` · AA 码 ${profile.usVisa.aaCode}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroup(group.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      移除
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
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
                      <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3 space-y-2 text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">
                          已关联档案：{profile.name || profile.label}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600 dark:text-gray-300">
                          <span>Excel：{excelMeta?.originalName || "档案中未上传"}</span>
                          <span>照片：{photoMeta?.originalName || "档案中未上传"}</span>
                          {profile.usVisa?.surname && <span>姓：{profile.usVisa.surname}</span>}
                          {profile.usVisa?.birthYear && <span>出生年份：{profile.usVisa.birthYear}</span>}
                          {profile.usVisa?.passportNumber && <span>护照号：{profile.usVisa.passportNumber}</span>}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          如果下面重新上传文件，会优先使用你当前上传的文件覆盖档案资料。
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Excel 数据文件</Label>
                        <Input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(event) => updateGroup(group.id, { excelFile: event.target.files?.[0] || null })}
                          className="mt-1 cursor-pointer"
                        />
                        <div className="mt-2 text-sm">
                          {group.excelFile ? (
                            <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              当前上传：{group.excelFile.name}
                            </p>
                          ) : excelMeta ? (
                            <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <FileSpreadsheet className="h-4 w-4" />
                              使用档案：{excelMeta.originalName}
                            </p>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400">还没有 Excel 文件</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>照片文件</Label>
                        <Input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(event) => updateGroup(group.id, { photoFile: event.target.files?.[0] || null })}
                          className="mt-1 cursor-pointer"
                        />
                        <div className="mt-2 text-sm">
                          {group.photoFile ? (
                            <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              当前上传：{group.photoFile.name}
                            </p>
                          ) : photoMeta ? (
                            <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <ImageIcon className="h-4 w-4" />
                              使用档案：{photoMeta.originalName}
                            </p>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400">还没有照片文件</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm flex flex-wrap gap-x-4 gap-y-2">
                      <span className={hasExcel ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        Excel：{hasExcel ? "已就绪" : "缺少"}
                      </span>
                      <span className={hasPhoto ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        照片：{hasPhoto ? "已就绪" : "缺少"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {groups.length > 0 && (
            <>
              <div>
                <Label>抄送邮箱</Label>
                <Input
                  type="email"
                  value={extraEmail}
                  onChange={(event) => setExtraEmail(event.target.value)}
                  placeholder={DEFAULT_CC_EMAIL}
                  className="mt-1"
                />
              </div>
              <div className="space-y-2">
                <Label>提交方式</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="batch-mode"
                      checked={batchMode === "parallel"}
                      onChange={() => setBatchMode("parallel")}
                      className="rounded-full"
                    />
                    <span>并行提交，同时处理多个申请人</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="batch-mode"
                      checked={batchMode === "sequential"}
                      onChange={() => setBatchMode("sequential")}
                      className="rounded-full"
                    />
                    <span>顺序提交，一个完成后再处理下一个</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4 px-6 py-6 border-t border-[#e5e5ea] dark:border-gray-800">
          <Button
            onClick={handleBatchSubmit}
            disabled={groups.length === 0 || loading}
            className="w-full md:w-3/4 lg:w-1/2 py-6 text-lg font-semibold"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                正在批量创建 DS-160 任务...
              </>
            ) : (
              "批量提交所有申请组"
            )}
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <Alert variant={result.status === "success" ? "default" : "destructive"} className="border-2">
          <AlertTitle>{result.status === "success" ? "提交完成" : "提交失败"}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

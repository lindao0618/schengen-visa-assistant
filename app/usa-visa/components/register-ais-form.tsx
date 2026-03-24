"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { UserPlus, Loader2, AlertCircle, Plus, Trash2, UserRound, FileSpreadsheet } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"

const MANUAL_OPTION = "__manual__"

interface ApplicantProfileOption {
  id: string
  label: string
  name?: string
  files?: Record<string, { originalName?: string }>
}

interface AisGroup {
  id: string
  applicantProfileId: string
  excelFile: File | null
}

function createGroup(applicantProfileId = ""): AisGroup {
  return {
    id: `ais-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    applicantProfileId,
    excelFile: null,
  }
}

function getProfileExcel(profile: ApplicantProfileOption | undefined) {
  if (!profile?.files) return null
  return (
    profile.files.usVisaDs160Excel ||
    profile.files.ds160Excel ||
    profile.files.usVisaAisExcel ||
    profile.files.aisExcel ||
    null
  )
}

export function RegisterAISForm() {
  const { showLoginPrompt } = useAuthPrompt()
  const activeApplicant = useActiveApplicantProfile()
  const [profiles, setProfiles] = useState<ApplicantProfileOption[]>([])
  const [groups, setGroups] = useState<AisGroup[]>([])
  const [password, setPassword] = useState("Visa202520252025!")
  const [extraEmail, setExtraEmail] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
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
        console.error("Failed to load profiles for AIS:", error)
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

  const updateGroup = (id: string, updates: Partial<AisGroup>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...updates } : group)))
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
    setResult(null)
  }

  const getGroupProfile = (group: AisGroup) =>
    group.applicantProfileId ? profileMap.get(group.applicantProfileId) : undefined

  const groupHasExcel = (group: AisGroup) => !!group.excelFile || !!getProfileExcel(getGroupProfile(group))

  const getGroupDisplayName = (group: AisGroup, index: number) => {
    const profile = getGroupProfile(group)
    return profile?.name || profile?.label || `申请组 ${index + 1}`
  }

  const submitOne = async (group: AisGroup) => {
    const formData = new FormData()
    if (group.excelFile) {
      formData.append("excel", group.excelFile)
    }
    if (group.applicantProfileId) {
      formData.append("applicantProfileId", group.applicantProfileId)
    }
    formData.append("password", password)
    formData.append("send_activation_email", String(sendEmail))
    formData.append("extra_email", extraEmail)

    const res = await fetch("/api/usa-visa/register-ais", { method: "POST", body: formData })
    if (res.status === 401) {
      showLoginPrompt()
      throw new Error("AUTH_REQUIRED")
    }
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || "AIS 注册失败")
    }
    return Array.isArray(data.task_ids) ? data.task_ids.length : 0
  }

  const handleBatchSubmit = async () => {
    const valid = groups.filter(groupHasExcel)
    if (valid.length === 0) {
      setResult({
        status: "error",
        message: "请至少准备一个完整申请组。每组都需要一份 Excel，可以直接使用申请人档案里的 DS-160 / AIS Excel。",
      })
      return
    }

    setLoading(true)
    setResult(null)
    const errors: string[] = []
    let createdTasks = 0

    try {
      if (batchMode === "sequential") {
        for (let index = 0; index < valid.length; index += 1) {
          const group = valid[index]
          try {
            createdTasks += await submitOne(group)
          } catch (error) {
            if (error instanceof Error && error.message === "AUTH_REQUIRED") return
            errors.push(`${getGroupDisplayName(group, index)}: ${error instanceof Error ? error.message : "失败"}`)
          }
        }
      } else {
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
      }

      if (createdTasks > 0 && errors.length === 0) {
        setResult({
          status: "success",
          message: `已创建 ${createdTasks} 个 AIS 注册任务，请在下方任务列表查看进度。`,
        })
        return
      }

      if (createdTasks > 0) {
        setResult({
          status: "error",
          message: `已成功创建 ${createdTasks} 个任务，但有部分申请组失败：${errors.join("；")}`,
        })
        return
      }

      setResult({
        status: "error",
        message: errors.join("；") || "AIS 注册提交失败",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-200/20 bg-blue-50/10 p-4 dark:bg-blue-900/10">
        <h3 className="mb-2 font-medium text-blue-600 dark:text-blue-400">AIS 账号注册</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          一个申请组对应一个申请人。每组可以直接复用申请人档案里的 Excel，也可以手动上传覆盖。
        </p>
      </Card>

      <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
        <div className="p-4 space-y-4">
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
        </div>
      </Card>

      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-xl">
            先添加申请组。每个申请组就是一个申请人的 AIS 注册任务。
          </div>
        )}

        {groups.map((group, index) => {
          const profile = getGroupProfile(group)
          const profileExcel = getProfileExcel(profile)
          const hasExcel = groupHasExcel(group)

          return (
            <Card key={group.id} className="border-2 border-[#e5e5ea] dark:border-gray-800">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{getGroupDisplayName(group, index)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">第 {index + 1} 组</div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(group.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-1" />
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
                  <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3 space-y-2 text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">已关联档案：{profile.name || profile.label}</div>
                    <div className="text-gray-600 dark:text-gray-300">
                      档案 Excel：{profileExcel?.originalName || "档案中未上传"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      AIS 默认复用 DS-160 / AIS Excel。你也可以在下面单独上传当前组使用的 Excel。
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Excel 文件</Label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => updateGroup(group.id, { excelFile: event.target.files?.[0] || null })}
                    className="block w-full text-sm"
                  />
                  <div className="text-sm">
                    {group.excelFile ? (
                      <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <FileSpreadsheet className="h-4 w-4" />
                        当前上传：{group.excelFile.name}
                      </p>
                    ) : profileExcel ? (
                      <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <FileSpreadsheet className="h-4 w-4" />
                        使用档案：{profileExcel.originalName}
                      </p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">还没有 Excel 文件</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
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
        <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
          <div className="p-4 space-y-4">
            <div>
              <Label htmlFor="password">账号密码</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="默认 Visa202520252025!"
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="send-email"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                className="rounded"
              />
              <Label htmlFor="send-email">发送激活邮件</Label>
            </div>

            <div>
              <Label htmlFor="extra-email">抄送邮箱</Label>
              <Input
                id="extra-email"
                type="email"
                value={extraEmail}
                onChange={(event) => setExtraEmail(event.target.value)}
                placeholder="可选"
                className="mt-1"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">提交方式</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ais-batch-mode"
                    checked={batchMode === "parallel"}
                    onChange={() => setBatchMode("parallel")}
                    className="rounded-full"
                  />
                  <span>并行提交，同时处理多个申请人</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ais-batch-mode"
                    checked={batchMode === "sequential"}
                    onChange={() => setBatchMode("sequential")}
                    className="rounded-full"
                  />
                  <span>顺序提交，一个完成后再处理下一个</span>
                </label>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Button onClick={handleBatchSubmit} disabled={groups.length === 0 || loading} className="w-full py-3">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在批量创建 AIS 任务...
          </>
        ) : (
          <>
            <UserPlus className="mr-2 h-5 w-5" />
            批量提交所有申请组
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.status === "success" ? "default" : "destructive"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{result.status === "success" ? "提交完成" : "提交失败"}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

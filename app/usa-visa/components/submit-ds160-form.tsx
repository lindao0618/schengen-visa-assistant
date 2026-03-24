"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileCheck, Loader2, AlertCircle, Plus, Trash2, UserRound } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"

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
  surname?: string
  birthYear?: string
  passportNumber?: string
  birthDate?: string
  fullName?: string
}

interface SubmitGroup {
  id: string
  applicantProfileId: string
  applicationId: string
  surname: string
  birthYear: string
  passportNumber: string
}

function createGroup(applicantProfileId = ""): SubmitGroup {
  return {
    id: `submit-ds160-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    applicantProfileId,
    applicationId: "",
    surname: "",
    birthYear: "",
    passportNumber: "",
  }
}

function buildGroupFromProfile(group: SubmitGroup, profile?: ApplicantProfileOption) {
  if (!profile) {
    return {
      ...group,
      applicationId: "",
      surname: "",
      birthYear: "",
      passportNumber: "",
    }
  }

  return {
    ...group,
    applicationId: profile.usVisa?.aaCode || "",
    surname: profile.usVisa?.surname || profile.surname || profile.fullName || profile.name || profile.label || "",
    birthYear: profile.usVisa?.birthYear || profile.birthYear || (profile.birthDate ? profile.birthDate.slice(0, 4) : ""),
    passportNumber: profile.usVisa?.passportNumber || profile.passportNumber || "",
  }
}

export function SubmitDS160Form() {
  const { showLoginPrompt } = useAuthPrompt()
  const activeApplicant = useActiveApplicantProfile()
  const [profiles, setProfiles] = useState<ApplicantProfileOption[]>([])
  const [groups, setGroups] = useState<SubmitGroup[]>([])
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
        console.error("Failed to load profiles for submit DS-160:", error)
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
    const profileId = prefillProfileId ?? suggestProfileId()
    const profile = profileId ? profileMap.get(profileId) : undefined
    setGroups((current) => [...current, buildGroupFromProfile(createGroup(profileId), profile)])
    setResult(null)
  }

  const updateGroup = (id: string, updates: Partial<SubmitGroup>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...updates } : group)))
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
    setResult(null)
  }

  const changeGroupProfile = (id: string, applicantProfileId: string) => {
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== id) return group
        const profile = applicantProfileId ? profileMap.get(applicantProfileId) : undefined
        return buildGroupFromProfile({ ...group, applicantProfileId }, profile)
      })
    )
    setResult(null)
  }

  const getGroupProfile = (group: SubmitGroup) =>
    group.applicantProfileId ? profileMap.get(group.applicantProfileId) : undefined

  const getGroupDisplayName = (group: SubmitGroup, index: number) => {
    const profile = getGroupProfile(group)
    return profile?.name || profile?.label || `申请组 ${index + 1}`
  }

  const groupIsReady = (group: SubmitGroup) =>
    !!group.applicationId.trim() &&
    !!group.surname.trim() &&
    !!group.birthYear.trim() &&
    !!group.passportNumber.trim()

  const submitOne = async (group: SubmitGroup) => {
    const res = await fetch("/api/usa-visa/ds160/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: group.applicationId.trim(),
        surname: group.surname.trim(),
        birth_year: group.birthYear.trim(),
        passport_number: group.passportNumber.trim(),
        applicantProfileId: group.applicantProfileId || undefined,
        test_mode: false,
      }),
    })

    if (res.status === 401) {
      showLoginPrompt()
      throw new Error("AUTH_REQUIRED")
    }

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || data.message || "提交 DS-160 失败")
    }
    if (data.task_id) return 1
    if (!data.success) {
      throw new Error(data.error || data.message || "提交 DS-160 失败")
    }
    return 1
  }

  const handleBatchSubmit = async () => {
    const valid = groups.filter(groupIsReady)
    if (valid.length === 0) {
      setResult({
        status: "error",
        message: "请至少准备一个完整申请组。每组都需要 AA 码、姓、出生年份和护照号。",
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
          message: `已创建 ${createdTasks} 个提交 DS-160 任务，请在下方任务列表查看进度。`,
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
        message: errors.join("；") || "提交 DS-160 失败",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-blue-50/10 border-blue-200/20 dark:bg-blue-900/10">
        <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2">提交 DS-160 申请表</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          一个申请组对应一个申请人。每组会自动带出前面沉淀好的 AA 码、姓、出生年份和护照号，你也可以在本次提交前临时修改。
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
            先添加申请组。每个申请组就是一个申请人的提交任务。
          </div>
        )}

        {groups.map((group, index) => {
          const profile = getGroupProfile(group)
          const ready = groupIsReady(group)

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
                    onValueChange={(value) => changeGroupProfile(group.id, value === MANUAL_OPTION ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="直接选择已有申请人档案" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MANUAL_OPTION}>不使用档案，完全手动填写</SelectItem>
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
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600 dark:text-gray-300">
                      <span>AA 码：{profile.usVisa?.aaCode || "未获取"}</span>
                      <span>姓：{profile.usVisa?.surname || profile.surname || "-"}</span>
                      <span>出生年份：{profile.usVisa?.birthYear || profile.birthYear || (profile.birthDate ? profile.birthDate.slice(0, 4) : "-")}</span>
                      <span>护照号：{profile.usVisa?.passportNumber || profile.passportNumber || "-"}</span>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Application ID（AA 码）</Label>
                    <Input
                      placeholder="例如 AA00XXXXXXXX"
                      value={group.applicationId}
                      onChange={(event) => updateGroup(group.id, { applicationId: event.target.value.toUpperCase() })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>姓</Label>
                    <Input
                      placeholder="拼音姓氏"
                      value={group.surname}
                      onChange={(event) => updateGroup(group.id, { surname: event.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>出生年份</Label>
                    <Input
                      placeholder="例如 1990"
                      value={group.birthYear}
                      onChange={(event) => updateGroup(group.id, { birthYear: event.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>护照号</Label>
                    <Input
                      placeholder="护照号码"
                      value={group.passportNumber}
                      onChange={(event) => updateGroup(group.id, { passportNumber: event.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
                  <span className={ready ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    提交资料：{ready ? "已就绪" : "缺少字段"}
                  </span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {groups.length > 0 && (
        <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
          <div className="p-4 space-y-3">
            <Label className="text-base font-semibold">提交方式</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="submit-ds160-batch-mode"
                  checked={batchMode === "parallel"}
                  onChange={() => setBatchMode("parallel")}
                  className="rounded-full"
                />
                <span>并行提交，同时处理多个申请人</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="submit-ds160-batch-mode"
                  checked={batchMode === "sequential"}
                  onChange={() => setBatchMode("sequential")}
                  className="rounded-full"
                />
                <span>顺序提交，一个完成后再处理下一个</span>
              </label>
            </div>
          </div>
        </Card>
      )}

      <Button onClick={handleBatchSubmit} disabled={groups.length === 0 || loading} className="w-full py-3">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在批量创建提交任务...
          </>
        ) : (
          <>
            <FileCheck className="mr-2 h-5 w-5" />
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

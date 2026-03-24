"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, AlertCircle, Image as ImageIcon, Camera, PaintBucket, Plus, Trash2, UserRound, Loader2 } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"

const MANUAL_OPTION = "__manual__"

interface ApplicantProfileOption {
  id: string
  label: string
  name?: string
  files?: Record<string, { originalName?: string }>
}

interface PhotoGroup {
  id: string
  applicantProfileId: string
  photoFile: File | null
}

function createGroup(applicantProfileId = ""): PhotoGroup {
  return {
    id: `photo-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    applicantProfileId,
    photoFile: null,
  }
}

function getProfilePhoto(profile: ApplicantProfileOption | undefined) {
  if (!profile?.files) return null
  return profile.files.usVisaPhoto || profile.files.photo || null
}

export function PhotoChecker() {
  const { showLoginPrompt } = useAuthPrompt()
  const activeApplicant = useActiveApplicantProfile()
  const [profiles, setProfiles] = useState<ApplicantProfileOption[]>([])
  const [groups, setGroups] = useState<PhotoGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [imageScale, setImageScale] = useState<number[]>([100])
  const [batchMode, setBatchMode] = useState<"parallel" | "sequential">("parallel")
  const [result, setResult] = useState<{ status: string; message: string } | null>(null)

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await fetch("/api/applicants", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        setProfiles((data.profiles || []) as ApplicantProfileOption[])
      } catch (error) {
        console.error("Failed to load profiles for photo checker:", error)
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

  const updateGroup = (id: string, updates: Partial<PhotoGroup>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...updates } : group)))
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
    setResult(null)
  }

  const getGroupProfile = (group: PhotoGroup) =>
    group.applicantProfileId ? profileMap.get(group.applicantProfileId) : undefined

  const groupHasPhoto = (group: PhotoGroup) => !!group.photoFile || !!getProfilePhoto(getGroupProfile(group))

  const getGroupDisplayName = (group: PhotoGroup, index: number) => {
    const profile = getGroupProfile(group)
    return profile?.name || profile?.label || `申请组 ${index + 1}`
  }

  const submitOne = async (group: PhotoGroup) => {
    const formData = new FormData()
    if (group.applicantProfileId) {
      formData.append("applicantProfileId", group.applicantProfileId)
    }
    if (group.photoFile) {
      formData.append("photo", group.photoFile)
    }
    formData.append("scale", imageScale[0].toString())
    formData.append("useWebsite", "true")
    formData.append("async", "true")

    const res = await fetch("/api/usa-visa/photo-check", { method: "POST", body: formData })
    if (res.status === 401) {
      showLoginPrompt()
      throw new Error("AUTH_REQUIRED")
    }
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || data.error || "照片检测失败")
    }
    if (!data.task_id && !data.success) {
      throw new Error(data.message || "照片检测失败")
    }
    return data
  }

  const handleBatchSubmit = async () => {
    const valid = groups.filter(groupHasPhoto)
    if (valid.length === 0) {
      setResult({
        status: "error",
        message: "请至少准备一个完整申请组。每组需要提供一张照片，可以直接使用申请人档案里的照片。",
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
            await submitOne(group)
            createdTasks += 1
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
            createdTasks += 1
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
          message: `已创建 ${createdTasks} 个照片检测任务，请在下方任务列表查看进度。`,
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
        message: errors.join("；") || "照片检测提交失败",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-blue-50/10 border-blue-200/20">
        <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2">美签照片要求说明</h3>
        <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
          <li>2x2 英寸，白底或浅灰底。</li>
          <li>正面面对镜头，五官清晰，不戴眼镜。</li>
          <li>可以直接用申请人档案里的照片，也可以在当前组临时覆盖上传。</li>
        </ul>
      </Card>

      <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-semibold">照片缩放</Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Slider
                  min={50}
                  max={150}
                  step={1}
                  value={imageScale}
                  onValueChange={setImageScale}
                />
              </div>
              <div className="w-20 text-sm text-gray-600 dark:text-gray-300 text-right">
                {imageScale[0]}%
              </div>
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
        </div>
      </Card>

      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-xl">
            先添加申请组。每个申请组就是一个申请人的照片检测任务。
          </div>
        )}

        {groups.map((group, index) => {
          const profile = getGroupProfile(group)
          const profilePhoto = getProfilePhoto(profile)
          const hasPhoto = groupHasPhoto(group)

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
                      档案照片：{profilePhoto?.originalName || "档案中未上传"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      如果下面重新上传照片，会优先使用当前上传的照片覆盖档案资料。
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>照片文件</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => updateGroup(group.id, { photoFile: event.target.files?.[0] || null })}
                    className="block w-full text-sm"
                  />
                  <div className="text-sm">
                    {group.photoFile ? (
                      <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Upload className="h-4 w-4" />
                        当前上传：{group.photoFile.name}
                      </p>
                    ) : profilePhoto ? (
                      <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" />
                        使用档案：{profilePhoto.originalName}
                      </p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">还没有照片文件</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm flex flex-wrap gap-x-4 gap-y-2">
                  <span className={hasPhoto ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    照片：{hasPhoto ? "已就绪" : "缺少"}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <Camera className="h-4 w-4" />
                    CEAC 官网检测已启用
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <PaintBucket className="h-4 w-4" />
                    按 {imageScale[0]}% 缩放
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
                  name="photo-batch-mode"
                  checked={batchMode === "parallel"}
                  onChange={() => setBatchMode("parallel")}
                  className="rounded-full"
                />
                <span>并行提交，同时处理多个申请人</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="photo-batch-mode"
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

      <Button
        onClick={handleBatchSubmit}
        disabled={groups.length === 0 || loading}
        className="w-full py-3 bg-gray-900 hover:bg-black text-white text-lg font-medium shadow-lg rounded-md border border-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 dark:border-gray-200"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在批量创建照片检测任务...
          </>
        ) : (
          "批量提交所有申请组"
        )}
      </Button>

      {result && (
        <Alert variant={result.status === "success" ? "default" : "destructive"} className="border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{result.status === "success" ? "提交完成" : "提交失败"}</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

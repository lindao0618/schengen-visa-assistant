"use client"

import { useState } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileCheck, Loader2, CheckCircle2, Plus, Trash2, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface ApplicationGroup {
  id: string
  excelFile: File | null
  photoFile: File | null
}

export function DS160Form() {
  const { showLoginPrompt } = useAuthPrompt()
  const [groups, setGroups] = useState<ApplicationGroup[]>([])
  const [extraEmail, setExtraEmail] = useState("ukvisa20242024@163.com")
  const [batchMode, setBatchMode] = useState<"parallel" | "sequential">("parallel")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: string; message: string } | null>(null)
  const addGroup = () => {
    const newId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setGroups((g) => [
      ...g,
      {
        id: newId,
        excelFile: null,
        photoFile: null,
      },
    ])
    setResult(null)
  }

  const removeGroup = (id: string) => {
    setGroups((g) => g.filter((x) => x.id !== id))
    setResult(null)
  }

  const updateGroup = (id: string, updates: Partial<ApplicationGroup>) => {
    setGroups((g) => g.map((x) => (x.id === id ? { ...x, ...updates } : x)))
    setResult(null)
  }

  const submitOne = async (app: ApplicationGroup): Promise<{ task_id: string } | { success: true }> => {
    const email = (extraEmail || "ukvisa20242024@163.com").trim()
    const formData = new FormData()
    formData.append("excel", app.excelFile!)
    formData.append("photo", app.photoFile!)
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
    if (!data.success) throw new Error(data.message || data.error || "填表失败")
    return { success: true }
  }

  const handleBatchSubmit = async () => {
    const valid = groups.filter((g) => g.excelFile && g.photoFile)
    if (valid.length === 0) {
      setResult({ status: "error", message: "请先添加至少一个申请组，并为每组选择 Excel 和照片文件" })
      return
    }

    setLoading(true)
    setResult(null)
    const errors: string[] = []
    const taskIds: string[] = []

    try {
      if (batchMode === "sequential") {
        for (let i = 0; i < valid.length; i++) {
          try {
            const r = await submitOne(valid[i])
            if ("task_id" in r) taskIds.push(r.task_id)
          } catch (e) {
            if (e instanceof Error && e.message === "AUTH_REQUIRED") return
            errors.push(`申请组 ${i + 1}: ${e instanceof Error ? e.message : "失败"}`)
          }
          await new Promise((r) => setTimeout(r, 500))
        }
      } else {
        const results = await Promise.allSettled(valid.map((g) => submitOne(g)))
        for (let i = 0; i < results.length; i++) {
          const r = results[i]
          if (r.status === "fulfilled") {
            const v = r.value
            if (v && "task_id" in v) taskIds.push(v.task_id)
          } else {
            if (r.reason?.message === "AUTH_REQUIRED") return
            errors.push(`申请组 ${i + 1}: ${r.reason?.message || "失败"}`)
          }
        }
      }

      if (taskIds.length > 0) {
        setResult({
          status: "success",
          message: `已创建 ${taskIds.length} 个任务，请在下方任务列表中查看进度。结果将发送至 ${(extraEmail || "ukvisa20242024@163.com").trim()}。`,
        })
      }
      if (errors.length > 0 && taskIds.length === 0) {
        setResult({
          status: "error",
          message: errors.join("; "),
        })
      } else if (errors.length > 0) {
        setResult({
          status: "error",
          message: `部分失败: ${errors.join("; ")}。成功创建的任务请查看下方列表。`,
        })
      }
    } catch (e) {
      if (e instanceof Error && e.message === "AUTH_REQUIRED") return
      setResult({
        status: "error",
        message: e instanceof Error ? e.message : "批量提交失败",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 w-full mx-auto">
      <Card className="border-[#e5e5ea] shadow-sm overflow-hidden bg-white dark:bg-gray-900 dark:border-gray-800">
        <CardHeader className="bg-white dark:bg-gray-900 border-b border-[#e5e5ea] dark:border-gray-800 pb-8">
          <CardTitle className="text-3xl font-bold flex items-center gap-3 text-[#1c1c1e] dark:text-white">
            <FileCheck className="h-7 w-7" />
            DS-160 批量自动填表
          </CardTitle>
          <CardDescription className="text-base mt-3 text-[#8e8e93] dark:text-gray-400">
            每个申请组包含：Excel 数据文件 + 照片文件。结果将发送至下方抄送邮箱（默认 ukvisa20242024@163.com）。
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* 官方链接 */}
          <Card className="border-[#e5e5ea] dark:border-gray-800 shadow-sm">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start gap-4">
                <ExternalLink className="h-10 w-10 text-[#1c1c1e] dark:text-white flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">手动填表</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    如需手动填写，可访问美国政府官方 DS-160 网站
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

          {/* 申请组列表 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">申请组</Label>
              <Button type="button" variant="outline" onClick={addGroup} className="gap-2">
                <Plus className="h-4 w-4" />
                添加申请组
              </Button>
            </div>

            {groups.length === 0 && (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-xl">
                请点击「添加申请组」开始批量填表
              </div>
            )}

            {groups.map((group, idx) => (
              <Card key={group.id} className="border-2 border-[#e5e5ea] dark:border-gray-800">
                <CardHeader className="py-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">申请组 {idx + 1}</CardTitle>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Excel 数据文件</Label>
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => updateGroup(group.id, { excelFile: e.target.files?.[0] || null })}
                        className="mt-1 cursor-pointer"
                      />
                      {group.excelFile && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> {group.excelFile.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>照片文件</Label>
                      <Input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => updateGroup(group.id, { photoFile: e.target.files?.[0] || null })}
                        className="mt-1 cursor-pointer"
                      />
                      {group.photoFile && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> {group.photoFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 抄送邮箱与提交模式 */}
          {groups.length > 0 && (
            <>
              <div>
                <Label>抄送邮箱（默认）</Label>
                <Input
                  type="email"
                  value={extraEmail}
                  onChange={(e) => setExtraEmail(e.target.value)}
                  placeholder="ukvisa20242024@163.com"
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
                    <span>并行提交（同时执行，速度快）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="batch-mode"
                      checked={batchMode === "sequential"}
                      onChange={() => setBatchMode("sequential")}
                      className="rounded-full"
                    />
                    <span>队列提交（顺序执行，前一个完成后再执行下一个）</span>
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
                正在批量填表...
              </>
            ) : (
              "批量提交所有申请"
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

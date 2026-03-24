"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
} from "lucide-react"
import { AuthPromptProvider, useAuthPrompt } from "@/app/usa-visa/contexts/AuthPromptContext"
import { FranceTaskList } from "./FranceTaskList"

function FranceAutomationContent() {
  const { showLoginPrompt } = useAuthPrompt()
  const [extractFiles, setExtractFiles] = useState<File[]>([])
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractResult, setExtractResult] = useState<{
    success: boolean
    message?: string
    error?: string
    task_id?: string
    download_excel?: string
    download_json?: string
  } | null>(null)

  const triggerExtractFileInput = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".xlsx,.xls"
    input.multiple = true
    input.style.display = "none"
    input.onchange = (e) => {
      const list = (e.target as HTMLInputElement).files
      if (list?.length) {
        setExtractFiles((prev) => [...prev, ...Array.from(list)])
      }
      input.remove()
    }
    document.body.appendChild(input)
    input.click()
  }
  const removeExtractFile = (index: number) => setExtractFiles((prev) => prev.filter((_, i) => i !== index))

  const handleExtractSubmit = async () => {
    if (!extractFiles.length) {
      setExtractResult({ success: false, error: "请至少添加一个含「FV注册表」的 Excel 文件" })
      return
    }
    setExtractLoading(true)
    setExtractResult(null)
    try {
      const formData = new FormData()
      extractFiles.forEach((f) => formData.append("file", f))
      const res = await fetch("/api/schengen/france/extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (res.status === 401) {
        showLoginPrompt()
        return
      }
      const data = await res.json()
      setExtractResult(data)
    } catch (e) {
      setExtractResult({ success: false, error: e instanceof Error ? e.message : "请求失败" })
    } finally {
      setExtractLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/schengen-visa/automation">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden">
              <Image src="https://flagcdn.com/w80/fr.png" alt="法国" width={40} height={40} className="object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">法签</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">France-visas 注册信息提取、账号注册、生成申请、填回执、提交</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="extract" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12 mb-6 bg-gray-100/80 dark:bg-black/50 backdrop-blur-xl p-1 rounded-2xl border border-gray-200/50 dark:border-white/10 shadow-lg">
            <TabsTrigger value="extract" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              提取注册信息
            </TabsTrigger>
            <TabsTrigger value="register" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              账号注册
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
            <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
                <CardTitle className="text-2xl font-semibold flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  提取 FV 注册信息
                </CardTitle>
                <CardDescription>
                  上传含「FV注册表」工作表的 Excel（可多选，将合并为一个结果），提取邮箱、密码等信息，生成 Excel + JSON
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 gap-2 border-dashed h-10 min-w-0"
                        onClick={triggerExtractFileInput}
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className="truncate">添加 Excel 文件</span>
                      </Button>
                      <Button onClick={handleExtractSubmit} disabled={extractLoading} className="flex-1 gap-2 h-10 min-w-0">
                        {extractLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{extractLoading ? "提取中..." : "开始提取"}</span>
                      </Button>
                    </div>
                    {extractFiles.length > 0 && (
                      <p className="mt-2 text-sm text-gray-500">已选 {extractFiles.length} 个文件</p>
                    )}
                    {extractFiles.length > 0 && (
                      <ul className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                        {extractFiles.map((f, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded px-2 py-1.5">
                            <span className="truncate">{f.name}</span>
                            <button type="button" onClick={() => removeExtractFile(i)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="移除">
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {extractResult && (
                  <Alert variant={extractResult.success ? "default" : "destructive"} className="mt-4">
                    {extractResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertDescription>
                      {extractResult.success ? extractResult.message : extractResult.error}
                      {extractResult.success && extractResult.task_id && (
                        <p className="mt-2 text-sm text-muted-foreground">请在下方的任务列表中查看进度与下载链接</p>
                      )}
                      {extractResult.success && extractResult.download_excel && !extractResult.task_id && (
                        <div className="mt-2 flex gap-2">
                          <a href={extractResult.download_excel} className="text-primary underline" download>
                            下载 Excel
                          </a>
                          {extractResult.download_json && (
                            <a href={extractResult.download_json} className="text-primary underline" download>
                              下载 JSON
                            </a>
                          )}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["extract"]} title="提取注册信息任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>

          <TabsContent value="register">
            <StepCard
              title="账号注册"
              description="上传含 FV 注册信息的 Excel，在 France-visas 网站批量注册账号"
              apiPath="/api/schengen/france/register"
              accept=".xlsx,.xls"
              buttonLabel="开始注册"
              showLoginPrompt={showLoginPrompt}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["register"]} title="账号注册任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>
          <TabsContent value="create-app">
            <StepCard
              title="生成新申请"
              description="上传 Excel，在 France-visas 上创建新申请"
              apiPath="/api/schengen/france/create-application"
              accept=".xlsx,.xls"
              buttonLabel="生成申请"
              showLoginPrompt={showLoginPrompt}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["create-application"]} title="生成新申请任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>
          <TabsContent value="fill-receipt">
            <StepCard
              title="填写回执单"
              description="上传 Excel（含邮箱、密码等），填写回执单并下载 PDF"
              apiPath="/api/schengen/france/fill-receipt"
              accept=".xlsx,.xls"
              buttonLabel="填写回执单"
              showLoginPrompt={showLoginPrompt}
            />
            <div className="mt-6">
              <FranceTaskList filterTaskTypes={["fill-receipt"]} title="填写回执单任务" pollInterval={2000} autoRefresh />
            </div>
          </TabsContent>
          <TabsContent value="submit-final">
            <StepCard
              title="提交最终表"
              description="上传 Excel，提交最终申请表"
              apiPath="/api/schengen/france/submit-final"
              accept=".xlsx,.xls"
              buttonLabel="提交最终表"
              showLoginPrompt={showLoginPrompt}
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
}: {
  title: string
  description: string
  apiPath: string
  accept: string
  buttonLabel: string
  showLoginPrompt: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
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

  const triggerFileInput = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.multiple = true
    input.style.display = "none"
    input.onchange = (e) => {
      const list = (e.target as HTMLInputElement).files
      if (list?.length) {
        setFiles((prev) => [...prev, ...Array.from(list)])
      }
      input.remove()
    }
    document.body.appendChild(input)
    input.click()
  }
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async () => {
    if (!files.length) {
      setResult({ success: false, error: "请至少添加一个 Excel 文件" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append("file", f))
      const res = await fetch(apiPath, {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (res.status === 401) {
        setResult({ success: false, error: "请先登录" })
        showLoginPrompt()
        return
      }
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "请求失败" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="backdrop-blur-md bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-gray-100 dark:border-gray-800/50">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2 border-dashed h-10 min-w-0"
                onClick={triggerFileInput}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">添加 Excel 文件</span>
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 gap-2 h-10 min-w-0">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : null}
                <span className="truncate">{loading ? "处理中..." : buttonLabel}</span>
              </Button>
            </div>
            {files.length > 0 && <p className="mt-2 text-sm text-gray-500">已选 {files.length} 个文件</p>}
            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded px-2 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="移除">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {result && (
          <Alert variant={result.success ? "default" : "destructive"} className="mt-4">
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>
              {result.success ? result.message : result.error}
              {result.success && (result.task_id || (result.task_ids && result.task_ids.length > 0)) && (
                <p className="mt-2 text-sm text-muted-foreground">请在下方的任务列表中查看进度与下载链接</p>
              )}
              {result.success && !result.task_id && (result.download_excel || result.download_json || result.download_pdf) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.download_excel && (
                    <a href={result.download_excel} className="text-primary underline" download>
                      下载 Excel
                    </a>
                  )}
                  {result.download_json && (
                    <a href={result.download_json} className="text-primary underline" download>
                      下载 JSON
                    </a>
                  )}
                  {result.download_pdf && (
                    <a href={result.download_pdf} className="text-primary underline" download>
                      下载 PDF
                    </a>
                  )}
                </div>
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

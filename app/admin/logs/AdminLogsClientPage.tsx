"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, DatabaseZap, FileText, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DbTask {
  taskId?: string
  task_id?: string
  type?: string
  status?: string
  error?: string | null
  message?: string
  user?: { email?: string | null }
}

type DbErrors = {
  usVisa: DbTask[]
  frenchVisa: DbTask[]
  material: DbTask[]
}

type LogsResponse = {
  success?: boolean
  files?: string[]
  fileContent?: string
  dbErrors?: DbErrors
  error?: string
}

const emptyDbErrors: DbErrors = {
  usVisa: [],
  frenchVisa: [],
  material: [],
}

export default function AdminLogsClientPage() {
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [fileContent, setFileContent] = useState("")
  const [selectedFile, setSelectedFile] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [dbErrors, setDbErrors] = useState<DbErrors>(emptyDbErrors)

  const failureCount = useMemo(
    () => dbErrors.usVisa.length + dbErrors.frenchVisa.length + dbErrors.material.length,
    [dbErrors],
  )
  const logLineCount = useMemo(
    () => fileContent.split(/\r?\n/).filter((line) => line.trim()).length,
    [fileContent],
  )

  const fetchLogs = useCallback(async (file?: string) => {
    setLoading(true)
    setErrorMessage("")
    try {
      const params = new URLSearchParams()
      if (file && file !== "none") params.set("file", file)
      const query = params.toString()
      const res = await fetch(`/api/admin/logs${query ? `?${query}` : ""}`, { cache: "no-store" })
      const data = (await res.json()) as LogsResponse
      if (!res.ok || !data.success) {
        throw new Error(data.error || "获取日志失败")
      }

      setFiles(data.files || [])
      setFileContent(data.fileContent || "")
      setDbErrors(data.dbErrors || emptyDbErrors)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "获取日志失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const handleFileChange = (value: string) => {
    const nextFile = value === "none" ? "" : value
    setSelectedFile(nextFile)
    void fetchLogs(nextFile)
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.12),_transparent_24rem),linear-gradient(135deg,_#ffffff,_#f8fafc)] p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200">
              系统运维
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">日志与监控</h1>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              集中查看服务器日志文件、最近失败任务和错误上下文，用于部署后排障。
            </p>
          </div>
          <Button variant="outline" onClick={() => void fetchLogs(selectedFile)} disabled={loading} className="bg-white/80 dark:bg-slate-950/60">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <MetricCard icon={<FileText className="h-4 w-4" />} label="日志文件" value={`${files.length}`} helper="LOG_DIR 可读文件数" />
          <MetricCard icon={<DatabaseZap className="h-4 w-4" />} label="失败任务" value={`${failureCount}`} helper="美签、申根、材料任务合计" />
          <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="日志行数" value={`${logLineCount}`} helper={selectedFile || "当前未选中文件"} />
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle>日志文件</CardTitle>
            <CardDescription>配置 LOG_DIR 后可查看日志文件。大文件建议只保留最近关键片段。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedFile || "none"} onValueChange={handleFileChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择日志文件" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未选择文件</SelectItem>
                {files.map((file) => (
                  <SelectItem key={file} value={file}>
                    {file}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <pre className="max-h-[34rem] min-h-[22rem] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 shadow-inner dark:border-slate-800">
              {fileContent || "未选择文件或暂无内容"}
            </pre>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle>失败任务记录</CardTitle>
            <CardDescription>最近失败的任务与错误信息，优先处理数量最多或重复出现的类型。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <TaskFailureList title="美签任务" tasks={dbErrors.usVisa} taskIdKey="taskId" />
            <TaskFailureList title="申根任务" tasks={dbErrors.frenchVisa} taskIdKey="taskId" />
            <TaskFailureList title="材料任务" tasks={dbErrors.material} taskIdKey="task_id" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-semibold text-slate-950 dark:text-white">{value}</div>
      <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{helper}</div>
    </div>
  )
}

function TaskFailureList({
  title,
  tasks,
  taskIdKey,
}: {
  title: string
  tasks: DbTask[]
  taskIdKey: "taskId" | "task_id"
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-slate-500 dark:border-slate-800">
          暂无失败记录
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task, index) => {
            const taskId = task[taskIdKey] || task.taskId || task.task_id || "-"
            return (
              <li key={`${taskId}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {taskId} · {task.type || "-"} · {task.status || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.user?.email || "无用户邮箱"}</div>
                <div className="mt-2 whitespace-pre-wrap break-all text-xs leading-5 text-red-600 dark:text-red-300">
                  {task.error || task.message || "无错误详情"}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

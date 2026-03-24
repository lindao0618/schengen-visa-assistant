"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw } from "lucide-react"

interface DbTask {
  taskId?: string
  task_id?: string
  type?: string
  status?: string
  error?: string | null
  message?: string
  user?: { email?: string | null }
}

export default function AdminLogsPage() {
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [fileContent, setFileContent] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<string>("")
  const [dbErrors, setDbErrors] = useState<{ usVisa: DbTask[]; frenchVisa: DbTask[]; material: DbTask[] }>({
    usVisa: [],
    frenchVisa: [],
    material: [],
  })

  const fetchLogs = async (file?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (file) params.set("file", file)
      const res = await fetch(`/api/admin/logs?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setFiles(data.files || [])
        setFileContent(data.fileContent || "")
        setDbErrors(data.dbErrors || { usVisa: [], frenchVisa: [], material: [] })
      }
    } catch (e) {
      console.error("获取日志失败:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleFileChange = (value: string) => {
    setSelectedFile(value)
    fetchLogs(value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">日志与监控</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">查看系统日志与失败任务</p>
        </div>
        <Button variant="outline" onClick={() => fetchLogs(selectedFile)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>日志文件</CardTitle>
          <CardDescription>配置 LOG_DIR 后可查看日志文件</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedFile} onValueChange={handleFileChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择日志文件" />
            </SelectTrigger>
            <SelectContent>
              {files.length === 0 && <SelectItem value="none">暂无文件</SelectItem>}
              {files.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <pre className="min-h-[200px] text-xs whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-900/50 rounded p-3">
            {fileContent || "未选择文件或暂无内容"}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>失败任务记录</CardTitle>
          <CardDescription>最近失败的任务与错误信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">美签任务</h3>
            {dbErrors.usVisa.length === 0 ? (
              <p className="text-gray-500">暂无失败记录</p>
            ) : (
              <ul className="space-y-1">
                {dbErrors.usVisa.map((t, idx) => (
                  <li key={`${t.taskId}-${idx}`} className="rounded border p-2">
                    {t.taskId} · {t.type} · {t.status} · {t.user?.email || "-"} · {t.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-medium mb-2">申根任务</h3>
            {dbErrors.frenchVisa.length === 0 ? (
              <p className="text-gray-500">暂无失败记录</p>
            ) : (
              <ul className="space-y-1">
                {dbErrors.frenchVisa.map((t, idx) => (
                  <li key={`${t.taskId}-${idx}`} className="rounded border p-2">
                    {t.taskId} · {t.type} · {t.status} · {t.user?.email || "-"} · {t.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-medium mb-2">材料任务</h3>
            {dbErrors.material.length === 0 ? (
              <p className="text-gray-500">暂无失败记录</p>
            ) : (
              <ul className="space-y-1">
                {dbErrors.material.map((t, idx) => (
                  <li key={`${t.task_id}-${idx}`} className="rounded border p-2">
                    {t.task_id} · {t.type} · {t.status} · {t.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

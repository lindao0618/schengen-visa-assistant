"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, RefreshCw, Eye, Trash2 } from "lucide-react"

interface AdminTask {
  taskId: string
  source: "us-visa" | "french-visa" | "material"
  type: string
  status: string
  progress: number
  message: string
  error?: string
  createdAt: string
  updatedAt?: string
  result?: unknown
  user?: { id: string; email: string; name?: string | null } | null
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [source, setSource] = useState("all")
  const [type, setType] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailTask, setDetailTask] = useState<AdminTask | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        status,
        source,
        type,
        limit: "200",
      })
      const res = await fetch(`/api/admin/tasks?${params.toString()}`)
      const data = await res.json()
      if (data.success) setTasks(data.tasks || [])
    } catch (error) {
      console.error("获取任务列表失败:", error)
    } finally {
      setLoading(false)
    }
  }, [search, source, status, type])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    setSelected(new Set())
  }, [tasks.length])

  const formatDate = (val?: string) =>
    val ? new Date(val).toLocaleString("zh-CN", { hour12: false }) : "-"

  const statusBadge = (val: string) => {
    if (val === "completed") return <Badge variant="default">完成</Badge>
    if (val === "failed") return <Badge variant="destructive">失败</Badge>
    if (val === "running") return <Badge variant="secondary">进行中</Badge>
    if (val === "pending") return <Badge variant="outline">等待中</Badge>
    return <Badge variant="outline">{val}</Badge>
  }

  const allSelected = useMemo(() => selected.size > 0 && selected.size === tasks.length, [selected, tasks])
  const selectedItems = useMemo(() => {
    return tasks.filter((t) => selected.has(`${t.source}:${t.taskId}`))
  }, [selected, tasks])

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tasks.map((t) => `${t.source}:${t.taskId}`)))
    }
  }

  const toggleOne = (task: AdminTask) => {
    const key = `${task.source}:${task.taskId}`
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (!selectedItems.length) return
    setDeleteLoading(true)
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map((t) => ({ source: t.source, taskId: t.taskId })),
        }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchTasks()
      }
    } catch (error) {
      console.error("删除任务失败:", error)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">任务管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">统一查看各类任务进度与状态</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={deleteLoading || selectedItems.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除已选 ({selectedItems.length})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>支持按来源、状态与关键字筛选</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索任务ID/消息"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                <SelectItem value="us-visa">美签</SelectItem>
                <SelectItem value="french-visa">申根/法签</SelectItem>
                <SelectItem value="material">材料生成</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">等待中</SelectItem>
                <SelectItem value="running">进行中</SelectItem>
                <SelectItem value="completed">完成</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="check-photo">照片检测</SelectItem>
                <SelectItem value="fill-ds160">DS-160 填表</SelectItem>
                <SelectItem value="submit-ds160">提交 DS160</SelectItem>
                <SelectItem value="register-ais">AIS 注册</SelectItem>
                <SelectItem value="extract">提取注册信息</SelectItem>
                <SelectItem value="register">账号注册</SelectItem>
                <SelectItem value="create-application">生成新申请</SelectItem>
                <SelectItem value="fill-receipt">填写回执单</SelectItem>
                <SelectItem value="submit-final">提交最终表</SelectItem>
                <SelectItem value="itinerary">行程单</SelectItem>
                <SelectItem value="explanation-letter">解释信</SelectItem>
                <SelectItem value="material-review">材料审核</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
          <CardDescription>共 {tasks.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="min-w-[160px]">任务ID</TableHead>
                  <TableHead className="min-w-[100px]">来源</TableHead>
                  <TableHead className="min-w-[140px]">类型</TableHead>
                  <TableHead className="min-w-[100px]">状态</TableHead>
                  <TableHead className="min-w-[80px]">进度</TableHead>
                  <TableHead className="min-w-[180px]">用户</TableHead>
                  <TableHead className="min-w-[160px]">更新时间</TableHead>
                  <TableHead className="min-w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={`${task.source}-${task.taskId}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(`${task.source}:${task.taskId}`)}
                        onChange={() => toggleOne(task)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{task.taskId}</TableCell>
                    <TableCell>{task.source}</TableCell>
                    <TableCell>{task.type}</TableCell>
                    <TableCell>{statusBadge(task.status)}</TableCell>
                    <TableCell>{task.progress || 0}%</TableCell>
                    <TableCell>{task.user?.email || "-"}</TableCell>
                    <TableCell>{formatDate(task.updatedAt || task.createdAt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailTask(task)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>任务详情</DialogTitle>
            <DialogDescription>查看该任务的状态与结果信息</DialogDescription>
          </DialogHeader>
          {detailTask && (
            <div className="space-y-2 text-sm">
              <div>任务ID：{detailTask.taskId}</div>
              <div>来源：{detailTask.source}</div>
              <div>类型：{detailTask.type}</div>
              <div>状态：{detailTask.status}</div>
              <div>进度：{detailTask.progress || 0}%</div>
              <div>用户：{detailTask.user?.email || "-"}</div>
              <div>创建时间：{formatDate(detailTask.createdAt)}</div>
              <div>更新时间：{formatDate(detailTask.updatedAt || detailTask.createdAt)}</div>
              {detailTask.message && <div>消息：{detailTask.message}</div>}
              {detailTask.error && <div className="text-red-600">错误：{detailTask.error}</div>}
              {Boolean(detailTask.result) && (
                <pre className="mt-2 max-h-64 overflow-auto rounded border bg-gray-50 p-2 text-xs">
{JSON.stringify(detailTask.result, null, 2)}
                </pre>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailTask(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

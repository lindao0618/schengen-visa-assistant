"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Eye } from "lucide-react"

type TaskSource = "us-visa" | "french-visa" | "material"

interface Task {
  taskId: string
  source: TaskSource
  type?: string | null
  status?: string | null
  progress?: number | null
  message?: string | null
  createdAt: string
  updatedAt?: string | null
  user?: {
    id?: string | null
    email?: string | null
    name?: string | null
  } | null
}

export function RecentOrders() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchRecentTasks()
  }, [])

  const fetchRecentTasks = async () => {
    try {
      const response = await fetch("/api/admin/tasks?source=all&limit=20")
      const data = await response.json()
      if (data?.success) {
        setTasks(data.tasks || [])
      } else {
        setTasks([])
      }
    } catch (error) {
      console.error("获取最近任务失败:", error)
      setTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">待处理</Badge>
      case "processing":
        return <Badge variant="default">处理中</Badge>
      case "running":
        return <Badge variant="default">运行中</Badge>
      case "approved":
        return <Badge variant="outline" className="text-green-600">已批准</Badge>
      case "success":
      case "completed":
        return <Badge variant="outline" className="text-blue-600">已完成</Badge>
      case "rejected":
      case "failed":
        return <Badge variant="destructive">已失败</Badge>
      default:
        return <Badge variant="secondary">{status || "未知"}</Badge>
    }
  }

  const getSourceBadge = (source: TaskSource) => {
    switch (source) {
      case "us-visa":
        return <Badge variant="outline">美签</Badge>
      case "french-visa":
        return <Badge variant="outline">法签</Badge>
      case "material":
        return <Badge variant="outline">材料</Badge>
      default:
        return <Badge variant="secondary">{source}</Badge>
    }
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>任务ID</TableHead>
            <TableHead>来源</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>进度</TableHead>
            <TableHead>用户邮箱</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.taskId}>
              <TableCell className="font-medium">{task.taskId}</TableCell>
              <TableCell>{getSourceBadge(task.source)}</TableCell>
              <TableCell>{task.type || "-"}</TableCell>
              <TableCell>{getStatusBadge(task.status)}</TableCell>
              <TableCell>{typeof task.progress === "number" ? `${task.progress}%` : "-"}</TableCell>
              <TableCell>{task.user?.email || "-"}</TableCell>
              <TableCell>{formatDate(task.updatedAt || task.createdAt)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/admin/tasks")}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!tasks.length && !isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-gray-500">
                暂无任务
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.push("/admin/tasks")}>
          查看所有任务
        </Button>
      </div>
    </div>
  )
}











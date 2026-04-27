"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Search, RefreshCw, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface AdminDocument {
  id: string
  type: string
  filename: string
  fileUrl: string
  status: string
  createdAt: string
  updatedAt: string
  user?: { id: string; email: string; name?: string | null }
  application?: { id: string; visaType: string; country: string; status: string }
  _count: { reviews: number }
}

export default function AdminDocumentsClientPage() {
  const [documents, setDocuments] = useState<AdminDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [type, setType] = useState("all")

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        status,
        type,
        page: "1",
        pageSize: "100",
      })
      const res = await fetch(`/api/admin/documents?${params.toString()}`)
      const data = await res.json()
      if (data.success) setDocuments(data.documents || [])
    } catch (error) {
      console.error("获取材料列表失败:", error)
    } finally {
      setLoading(false)
    }
  }, [search, status, type])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  const formatDate = (val: string) =>
    new Date(val).toLocaleString("zh-CN", { hour12: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">材料/文件管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">查看与下载用户提交材料</p>
        </div>
        <Button variant="outline" onClick={fetchDocs} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
          <CardDescription>按类型/状态/文件名筛选</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索文件名或类型"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="hotel">酒店预订</SelectItem>
                <SelectItem value="flight">机票/车票</SelectItem>
                <SelectItem value="insurance">保险</SelectItem>
                <SelectItem value="bank">银行流水</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">等待中</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="completed">完成</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>材料列表</CardTitle>
          <CardDescription>共 {documents.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">文件名</TableHead>
                  <TableHead className="min-w-[100px]">类型</TableHead>
                  <TableHead className="min-w-[100px]">状态</TableHead>
                  <TableHead className="min-w-[180px]">用户</TableHead>
                  <TableHead className="min-w-[160px]">更新时间</TableHead>
                  <TableHead className="min-w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.filename}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>
                      <Badge variant={doc.status === "failed" ? "destructive" : "outline"}>
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{doc.user?.email || "-"}</TableCell>
                    <TableCell>{formatDate(doc.updatedAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          下载
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {documents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

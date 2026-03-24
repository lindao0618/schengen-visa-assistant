"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface ContentBlock {
  id: string
  key: string
  title: string
  content: string
  updatedAt: string
}

export default function AdminContentPage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [error, setError] = useState("")

  const fetchBlocks = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/content")
      const data = await res.json()
      if (data.success) setBlocks(data.blocks || [])
    } catch (e) {
      console.error("获取内容失败:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBlocks()
  }, [])

  const handleSave = async () => {
    setError("")
    if (!key || !title || !content) {
      setError("请填写 key、标题与内容")
      return
    }
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, title, content }),
    })
    const data = await res.json()
    if (!data.success) {
      setError(data.message || "保存失败")
      return
    }
    setKey("")
    setTitle("")
    setContent("")
    await fetchBlocks()
  }

  const formatDate = (val: string) =>
    new Date(val).toLocaleString("zh-CN", { hour12: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">内容管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">配置可编辑文案块</p>
        </div>
        <Button variant="outline" onClick={fetchBlocks} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>新增/更新内容块</CardTitle>
          <CardDescription>使用唯一 key 管理文案</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="key，例如 homepage.hero" value={key} onChange={(e) => setKey(e.target.value)} />
          <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="内容" value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleSave}>保存内容</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已有内容块</CardTitle>
          <CardDescription>共 {blocks.length} 条</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocks.map((b) => (
            <div key={b.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{b.key}</div>
                <div className="text-xs text-gray-500">{formatDate(b.updatedAt)}</div>
              </div>
              <div className="text-sm text-gray-700 mt-1">{b.title}</div>
              <pre className="mt-2 text-xs whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-900/50 rounded p-2">
                {b.content}
              </pre>
            </div>
          ))}
          {blocks.length === 0 && <p className="text-sm text-gray-500">暂无内容</p>}
        </CardContent>
      </Card>
    </div>
  )
}

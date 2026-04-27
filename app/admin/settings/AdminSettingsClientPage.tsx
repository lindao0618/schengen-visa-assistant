"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw } from "lucide-react"

interface AdminSetting {
  id: string
  key: string
  valueJson: unknown
  updatedAt: string
}

export default function AdminSettingsClientPage() {
  const [settings, setSettings] = useState<AdminSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState("")
  const [valueText, setValueText] = useState("{}")
  const [error, setError] = useState("")

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/settings")
      const data = await res.json()
      if (data.success) setSettings(data.settings || [])
    } catch (e) {
      console.error("获取设置失败:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setError("")
    try {
      const parsed = JSON.parse(valueText)
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, valueJson: parsed }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.message || "保存失败")
        return
      }
      setKey("")
      setValueText("{}")
      await fetchSettings()
    } catch (e) {
      setError("JSON 格式不正确")
    }
  }

  const formatDate = (val: string) =>
    new Date(val).toLocaleString("zh-CN", { hour12: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">系统设置</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">维护全局配置（JSON）</p>
        </div>
        <Button variant="outline" onClick={fetchSettings} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>新增/更新设置</CardTitle>
          <CardDescription>使用 JSON 存储配置值</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="key，例如 LOG_DIR" value={key} onChange={(e) => setKey(e.target.value)} />
          <Textarea
            placeholder='{"path":"C:\\\\logs"}'
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            rows={6}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleSave}>保存设置</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已有设置</CardTitle>
          <CardDescription>共 {settings.length} 条</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.map((s) => (
            <div key={s.id} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.key}</div>
                <div className="text-xs text-gray-500">{formatDate(s.updatedAt)}</div>
              </div>
              <pre className="mt-2 text-xs whitespace-pre-wrap break-all bg-gray-50 dark:bg-gray-900/50 rounded p-2">
                {JSON.stringify(s.valueJson, null, 2)}
              </pre>
            </div>
          ))}
          {settings.length === 0 && <p className="text-sm text-gray-500">暂无设置</p>}
        </CardContent>
      </Card>
    </div>
  )
}

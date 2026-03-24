"use client"

import { useState, useRef } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserPlus, Loader2, CheckCircle2, AlertCircle, Plus, X } from "lucide-react"

export function RegisterAISForm() {
  const { showLoginPrompt } = useAuthPrompt()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [excelFiles, setExcelFiles] = useState<File[]>([])
  const [password, setPassword] = useState("Visa202520252025!")
  const [extraEmail, setExtraEmail] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; task_ids?: string[]; message?: string; error?: string } | null>(null)

  const handleSubmit = async () => {
    if (!excelFiles.length) {
      setResult({ success: false, error: "请上传至少一个 Excel 文件（含名、姓、个人邮箱等）" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      for (const f of excelFiles) {
        formData.append("excel", f)
      }
      formData.append("password", password)
      formData.append("send_activation_email", String(sendEmail))
      formData.append("extra_email", extraEmail)

      const res = await fetch("/api/usa-visa/register-ais", { method: "POST", body: formData })
      if (res.status === 401) {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    setExcelFiles((prev) => [...prev, ...Array.from(list)])
    e.target.value = ""
  }
  const removeFile = (idx: number) => setExcelFiles((prev) => prev.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-blue-50/10 border-blue-200/20 dark:bg-blue-900/10">
        <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2">AIS 账号注册</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          上传包含姓名、邮箱等信息的 Excel 文件（可多选），在 ais.usvisa-info.com 上自动创建签证预约账号。每个文件会生成一个任务，请在下方的「AIS 注册任务」列表中查看进度与结果。
        </p>
      </Card>

      <div className="space-y-4">
        <div>
          <Label>Excel 文件（含名、姓、个人邮箱）</Label>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 border-dashed border-2 h-10 px-4"
              >
                <Plus className="h-4 w-4" />
                添加 Excel 文件
              </Button>
              {excelFiles.length > 0 && (
                <span className="text-sm text-gray-500">已选 {excelFiles.length} 个文件</span>
              )}
            </div>
            {excelFiles.length > 0 && (
              <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {excelFiles.map((f, i) => (
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
        <div>
          <Label htmlFor="password">账号密码</Label>
          <Input
            id="password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="默认 Visa202520252025!"
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="send-email"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="send-email">发送激活指引邮件</Label>
        </div>
        <div>
          <Label htmlFor="extra-email">抄送邮箱（可选）</Label>
          <Input id="extra-email" type="email" value={extraEmail} onChange={(e) => setExtraEmail(e.target.value)} placeholder="额外接收激活邮件的邮箱" className="mt-1" />
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={loading} className="w-full py-3">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            提交中...
          </>
        ) : (
          <>
            <UserPlus className="mr-2 h-5 w-5" />
            批量注册 AIS 账号
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{result.success ? result.message : result.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

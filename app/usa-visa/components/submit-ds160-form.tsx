"use client"

import { useState } from "react"
import { useAuthPrompt } from "../contexts/AuthPromptContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileCheck, Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react"

export function SubmitDS160Form() {
  const { showLoginPrompt } = useAuthPrompt()
  const [applicationId, setApplicationId] = useState("")
  const [surname, setSurname] = useState("")
  const [birthYear, setBirthYear] = useState("")
  const [passportNumber, setPassportNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string; download_url?: string } | null>(null)

  const handleSubmit = async () => {
    if (!applicationId || !surname || !birthYear || !passportNumber) {
      setResult({ success: false, error: "请填写所有必填项" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/usa-visa/ds160/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId.trim(),
          surname: surname.trim(),
          birth_year: birthYear.trim(),
          passport_number: passportNumber.trim(),
          test_mode: false,
        }),
      })
      if (res.status === 401) {
        showLoginPrompt()
        return
      }
      const data = await res.json()
      if (data.task_id) {
        setResult({ success: true, message: "任务已创建，请在下方的任务列表中查看进度" })
      } else {
        setResult(data)
      }
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "请求失败" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-blue-50/10 border-blue-200/20 dark:bg-blue-900/10">
        <h3 className="font-medium text-blue-600 dark:text-blue-400 mb-2">提交 DS-160 申请表</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          填写已完成的 DS-160 的 AA 码、姓、出生年、护照号，提交后获取 PDF 确认页。
        </p>
      </Card>

      <div className="grid gap-4">
        <div>
          <Label htmlFor="app-id">Application ID（AA 码）</Label>
          <Input
            id="app-id"
            placeholder="例如 AA00XXXXXXXX"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="surname">姓</Label>
          <Input id="surname" placeholder="拼音姓氏" value={surname} onChange={(e) => setSurname(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="birth-year">出生年份</Label>
          <Input id="birth-year" placeholder="例如 1990" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="passport">护照号</Label>
          <Input id="passport" placeholder="护照号码" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} className="mt-1" />
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
            <FileCheck className="mr-2 h-5 w-5" />
            提交 DS-160 申请表
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {result.success ? result.message || "提交成功" : result.error}
            {result.success && result.download_url && (
              <a
                href={result.download_url}
                download
                className="ml-2 inline-flex items-center gap-1 text-primary font-medium hover:underline"
              >
                <Download className="h-4 w-4" />
                下载 PDF 确认页
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

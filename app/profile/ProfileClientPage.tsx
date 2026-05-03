"use client"

import type { ChangeEvent, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { Bell, Bot, BriefcaseBusiness, Edit, Key, ShieldCheck, Sparkles, Trash2, User } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type UserInfo = {
  name: string
  email: string
  phone: string
  address: string
  image: string
}

type AiModelQuality = "fast" | "balanced" | "reasoning"
type AiAnswerStyle = "concise" | "detailed" | "table-first" | "action-card-first"
type AiOutputFormat = "markdown" | "wechat-copy"

type AiModelOption = {
  id: string
  label: string
  quality: AiModelQuality
}

type AiPrefs = {
  defaultModel: string
  deepAnalysisEnabled: boolean
  answerStyle: AiAnswerStyle
  outputFormat: AiOutputFormat
  pinnedShortcuts: string[]
}

const emptyUserInfo: UserInfo = {
  name: "",
  email: "",
  phone: "",
  address: "",
  image: "",
}

const fallbackAiModels: AiModelOption[] = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", quality: "fast" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", quality: "reasoning" },
]

const defaultAiPrefs: AiPrefs = {
  defaultModel: "deepseek-v4-flash",
  deepAnalysisEnabled: false,
  answerStyle: "action-card-first",
  outputFormat: "wechat-copy",
  pinnedShortcuts: ["查缺漏", "生成催办话术", "启动自动化"],
}

const aiAnswerStyleOptions: Array<{ value: AiAnswerStyle; label: string; description: string }> = [
  { value: "action-card-first", label: "操作卡优先", description: "先给按钮、清单和下一步动作。" },
  { value: "table-first", label: "表格优先", description: "批量名单和筛查结果优先用表格。" },
  { value: "concise", label: "简洁", description: "只保留结论和必要动作。" },
  { value: "detailed", label: "详细", description: "适合复杂失败排查和材料解释。" },
]

const aiOutputFormatOptions: Array<{ value: AiOutputFormat; label: string; description: string }> = [
  { value: "wechat-copy", label: "微信复制格式", description: "催办话术默认适合直接粘贴到微信。" },
  { value: "markdown", label: "Markdown", description: "简报和技术排查保留结构化标题。" },
]

const applicationRows = [
  { id: "APP001", type: "申根签证", date: "2023-05-15", status: "已批准", tone: "bg-emerald-500" },
  { id: "APP002", type: "美国签证", date: "2023-07-22", status: "处理中", tone: "bg-amber-500" },
  { id: "APP003", type: "日本签证", date: "2023-09-10", status: "已提交", tone: "bg-sky-500" },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeAiQuality(value: unknown): AiModelQuality {
  return value === "balanced" || value === "reasoning" ? value : "fast"
}

function normalizeAiModels(value: unknown) {
  if (!Array.isArray(value)) return fallbackAiModels

  const models = value
    .map((item) => {
      if (!isRecord(item)) return null
      const id = typeof item.id === "string" ? item.id.trim() : ""
      if (!id) return null
      return {
        id,
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : id,
        quality: normalizeAiQuality(item.quality),
      }
    })
    .filter((item): item is AiModelOption => Boolean(item))

  return models.length ? models : fallbackAiModels
}

function normalizeAiPrefs(value: unknown) {
  const source = isRecord(value) ? value : {}
  const answerStyle = aiAnswerStyleOptions.some((item) => item.value === source.answerStyle)
    ? (source.answerStyle as AiAnswerStyle)
    : defaultAiPrefs.answerStyle
  const outputFormat = aiOutputFormatOptions.some((item) => item.value === source.outputFormat)
    ? (source.outputFormat as AiOutputFormat)
    : defaultAiPrefs.outputFormat
  const pinnedShortcuts = Array.isArray(source.pinnedShortcuts)
    ? source.pinnedShortcuts
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 8)
    : defaultAiPrefs.pinnedShortcuts

  return {
    defaultModel: typeof source.defaultModel === "string" && source.defaultModel.trim() ? source.defaultModel.trim() : defaultAiPrefs.defaultModel,
    deepAnalysisEnabled: typeof source.deepAnalysisEnabled === "boolean" ? source.deepAnalysisEnabled : defaultAiPrefs.deepAnalysisEnabled,
    answerStyle,
    outputFormat,
    pinnedShortcuts,
  }
}

export default function ProfileClientPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo>(emptyUserInfo)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [aiLoading, setAiLoading] = useState(true)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState("")
  const [aiSuccess, setAiSuccess] = useState("")
  const [availableAiModels, setAvailableAiModels] = useState<AiModelOption[]>(fallbackAiModels)
  const [aiPrefs, setAiPrefs] = useState<AiPrefs>(defaultAiPrefs)
  const [aiShortcutText, setAiShortcutText] = useState(defaultAiPrefs.pinnedShortcuts.join("\n"))

  const initials = useMemo(() => {
    const source = userInfo.name || userInfo.email || "U"
    return source.slice(0, 1).toUpperCase()
  }, [userInfo.email, userInfo.name])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")

    fetch("/api/users/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("未登录或获取用户信息失败")
        return response.json()
      })
      .then((data) => {
        if (cancelled) return
        setUserInfo({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          image: data.image || "",
        })
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(error instanceof Error ? error.message : "未登录或获取用户信息失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setAiLoading(true)
    setAiError("")

    fetch("/api/ops-agent/settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("获取 AI 设置失败")
        return response.json()
      })
      .then((data) => {
        if (cancelled) return
        const models = normalizeAiModels(data?.effective?.availableModels)
        const prefs = normalizeAiPrefs(data?.prefs || data?.effective)
        setAvailableAiModels(models)
        setAiPrefs(prefs)
        setAiShortcutText(prefs.pinnedShortcuts.join("\n"))
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableAiModels(fallbackAiModels)
          setAiPrefs(defaultAiPrefs)
          setAiShortcutText(defaultAiPrefs.pinnedShortcuts.join("\n"))
          setAiError("无法读取服务器设置，已显示默认模型。")
        }
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleEditToggle = () => {
    setIsEditing((value) => !value)
    setSuccess("")
    setError("")
  }

  const handleInfoChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUserInfo((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("avatar", file)
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const response = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) throw new Error("头像上传失败")
      const data = await response.json()
      setUserInfo((info) => ({ ...info, image: data.image || "" }))
      setSuccess("头像上传成功")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "头像上传失败")
    } finally {
      setLoading(false)
      event.target.value = ""
    }
  }

  const handleSaveChanges = async () => {
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const response = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userInfo.name,
          phone: userInfo.phone,
          address: userInfo.address,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "保存失败")
      }
      setSuccess("保存成功")
      setIsEditing(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "保存失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAiSettings = async () => {
    const pinnedShortcuts = aiShortcutText
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8)
    const payload = { ...aiPrefs, pinnedShortcuts }

    setAiSaving(true)
    setAiError("")
    setAiSuccess("")
    try {
      const response = await fetch("/api/ops-agent/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "保存 AI 设置失败")
      }

      const data = await response.json().catch(() => ({}))
      const prefs = normalizeAiPrefs(data?.prefs || payload)
      setAiPrefs(prefs)
      setAiShortcutText(prefs.pinnedShortcuts.join("\n"))
      setAiSuccess("AI 设置已保存")
    } catch (error: unknown) {
      setAiError(error instanceof Error ? error.message : "保存 AI 设置失败")
    } finally {
      setAiSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34rem),linear-gradient(180deg,_#f8fafc,_#ffffff)] px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge variant="secondary" className="rounded-full">
                账户中心
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">个人资料</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  管理个人基础信息、头像、安全选项和通知偏好。资料会用于内部案件协作和任务分配展示。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={userInfo.image || undefined} alt={userInfo.name || userInfo.email} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-slate-950">{userInfo.name || "未设置姓名"}</div>
                <div className="text-sm text-slate-500">{userInfo.email || "未读取到邮箱"}</div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <Tabs defaultValue="info" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm md:grid-cols-5">
            <ProfileTabTrigger value="info" icon={<User className="h-4 w-4" />} label="基本信息" />
            <ProfileTabTrigger value="security" icon={<Key className="h-4 w-4" />} label="安全设置" />
            <ProfileTabTrigger value="applications" icon={<BriefcaseBusiness className="h-4 w-4" />} label="申请历史" />
            <ProfileTabTrigger value="ai-settings" icon={<Bot className="h-4 w-4" />} label="AI 设置" />
            <ProfileTabTrigger value="notifications" icon={<Bell className="h-4 w-4" />} label="通知设置" />
          </TabsList>

          <TabsContent value="info">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl">基本信息</CardTitle>
                    <CardDescription>更新你的展示姓名、电话和联系地址。</CardDescription>
                  </div>
                  <Button onClick={handleEditToggle} variant="outline">
                    {isEditing ? "取消" : "编辑"}
                    <Edit className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={userInfo.image || undefined} alt={userInfo.name || userInfo.email} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <div className="font-medium text-slate-900">头像</div>
                    <p className="text-sm text-slate-500">用于系统右上角、案件协作和任务指派展示。</p>
                    {isEditing ? (
                      <label className="inline-flex cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                        更换头像
                        <input type="file" accept="image/*" name="avatar" className="hidden" onChange={handleAvatarUpload} />
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ProfileField label="姓名" name="name" value={userInfo.name} onChange={handleInfoChange} disabled={!isEditing} />
                  <ProfileField label="邮箱" name="email" value={userInfo.email} onChange={handleInfoChange} disabled />
                  <ProfileField label="电话" name="phone" value={userInfo.phone} onChange={handleInfoChange} disabled={!isEditing} />
                  <ProfileField label="地址" name="address" value={userInfo.address} onChange={handleInfoChange} disabled={!isEditing} />
                </div>

                {isEditing ? (
                  <Button onClick={handleSaveChanges} disabled={loading}>
                    {loading ? "保存中..." : "保存更改"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl">安全设置</CardTitle>
                <CardDescription>当前页面保留安全入口，后续可接入密码修改和二次验证。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
                    <ShieldCheck className="h-4 w-4" />
                    密码管理
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <PasswordField id="current-password" label="当前密码" />
                    <PasswordField id="new-password" label="新密码" />
                    <PasswordField id="confirm-password" label="确认新密码" />
                  </div>
                  <Button className="mt-4" disabled>
                    更新密码
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                  <div>
                    <div className="font-semibold text-slate-900">双因素认证</div>
                    <p className="text-sm text-slate-500">上线前建议接入短信或企业微信二次验证。</p>
                  </div>
                  <Switch id="2fa" disabled />
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="font-semibold text-red-800">账户删除</div>
                  <p className="mt-1 text-sm text-red-700">内部 SaaS 账号应由管理员统一禁用，避免误删审计记录。</p>
                  <Button variant="destructive" className="mt-3" disabled>
                    删除账户
                    <Trash2 className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl">申请历史</CardTitle>
                <CardDescription>这里展示示例申请记录，正式版本建议接入申请人 Case 数据。</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>申请 ID</TableHead>
                      <TableHead>签证类型</TableHead>
                      <TableHead>申请日期</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applicationRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>
                          <Badge className={row.tone}>{row.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-settings">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <Bot className="h-5 w-5 text-sky-600" />
                      AI 设置
                    </CardTitle>
                    <CardDescription>
                      设置 Visa Ops Agent 的默认模型、回复风格和快捷指令。服务密钥由服务器环境变量统一读取。
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full border-sky-200 bg-sky-50 text-sky-700">
                    DeepSeek V4
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {aiError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {aiError}
                  </div>
                ) : null}
                {aiSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {aiSuccess}
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ai-default-model">默认模型</Label>
                    <select
                      id="ai-default-model"
                      value={aiPrefs.defaultModel}
                      onChange={(event) => setAiPrefs((current) => ({ ...current, defaultModel: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      {availableAiModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-5 text-slate-500">
                      默认使用 deepseek-v4-flash；复杂材料排查可切到 Pro 或开启深度分析。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-answer-style">回复风格</Label>
                    <select
                      id="ai-answer-style"
                      value={aiPrefs.answerStyle}
                      onChange={(event) =>
                        setAiPrefs((current) => ({ ...current, answerStyle: event.target.value as AiAnswerStyle }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      {aiAnswerStyleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-5 text-slate-500">
                      {aiAnswerStyleOptions.find((item) => item.value === aiPrefs.answerStyle)?.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-output-format">输出格式</Label>
                    <select
                      id="ai-output-format"
                      value={aiPrefs.outputFormat}
                      onChange={(event) =>
                        setAiPrefs((current) => ({ ...current, outputFormat: event.target.value as AiOutputFormat }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      {aiOutputFormatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs leading-5 text-slate-500">
                      {aiOutputFormatOptions.find((item) => item.value === aiPrefs.outputFormat)?.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Sparkles className="h-4 w-4 text-sky-600" />
                        深度分析
                      </div>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        打开后，材料检查和失败排查会优先使用推理模型。
                      </p>
                    </div>
                    <Switch
                      id="ai-deep-analysis"
                      checked={aiPrefs.deepAnalysisEnabled}
                      onCheckedChange={(checked) =>
                        setAiPrefs((current) => ({ ...current, deepAnalysisEnabled: Boolean(checked) }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-shortcuts">快捷指令</Label>
                  <Textarea
                    id="ai-shortcuts"
                    value={aiShortcutText}
                    onChange={(event) => setAiShortcutText(event.target.value)}
                    placeholder="每行一个快捷指令，例如：查缺漏"
                    className="min-h-32"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    这些指令会显示在智能工作台底部，用于减少重复输入。
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">模型连接</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    个人中心只保存模型偏好。生产环境部署时，在服务器环境变量里放服务密钥，基础地址保持 https://api.deepseek.com。
                  </p>
                </div>

                <Button onClick={handleSaveAiSettings} disabled={aiSaving || aiLoading}>
                  {aiSaving ? "保存中..." : "保存 AI 设置"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl">通知设置</CardTitle>
                <CardDescription>管理申请状态、任务提醒和协作通知偏好。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <NotificationSwitch title="电子邮件通知" description="接收申请状态和任务更新邮件。" />
                <NotificationSwitch title="短信通知" description="接收重要节点和异常提醒短信。" />
                <NotificationSwitch title="推送通知" description="在移动设备上接收即时提醒。" />
                <div className="space-y-2">
                  <Label htmlFor="custom-notification">自定义通知</Label>
                  <Textarea id="custom-notification" placeholder="输入你希望额外接收提醒的情况..." />
                </div>
                <Button disabled>保存通知设置</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function ProfileTabTrigger({ value, icon, label }: { value: string; icon: ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="h-11 rounded-xl border border-transparent bg-transparent text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 data-[state=active]:!border-slate-300 data-[state=active]:!bg-white data-[state=active]:!text-slate-950 data-[state=active]:shadow-sm"
    >
      {icon}
      <span className="ml-2">{label}</span>
    </TabsTrigger>
  )
}

function ProfileField({
  label,
  name,
  value,
  disabled,
  onChange,
}: {
  label: string
  name: keyof UserInfo
  value: string
  disabled?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} value={value} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function PasswordField({ id, label }: { id: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" disabled />
    </div>
  )
}

function NotificationSwitch({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <Switch disabled />
    </div>
  )
}

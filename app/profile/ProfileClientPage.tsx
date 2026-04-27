"use client"

import type { ChangeEvent, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Bell, BriefcaseBusiness, Edit, Key, ShieldCheck, Trash2, User } from "lucide-react"

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

const emptyUserInfo: UserInfo = {
  name: "",
  email: "",
  phone: "",
  address: "",
  image: "",
}

const applicationRows = [
  { id: "APP001", type: "申根签证", date: "2023-05-15", status: "已批准", tone: "bg-emerald-500" },
  { id: "APP002", type: "美国签证", date: "2023-07-22", status: "处理中", tone: "bg-amber-500" },
  { id: "APP003", type: "日本签证", date: "2023-09-10", status: "已提交", tone: "bg-sky-500" },
]

export default function ProfileClientPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo>(emptyUserInfo)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

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
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm md:grid-cols-4">
            <ProfileTabTrigger value="info" icon={<User className="h-4 w-4" />} label="基本信息" />
            <ProfileTabTrigger value="security" icon={<Key className="h-4 w-4" />} label="安全设置" />
            <ProfileTabTrigger value="applications" icon={<BriefcaseBusiness className="h-4 w-4" />} label="申请历史" />
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

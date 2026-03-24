"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Bell, Edit, Key, Trash2, User } from "lucide-react"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    image: ""
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // 拉取当前用户信息
  React.useEffect(() => {
    setLoading(true)
    fetch("/api/users/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("未登录或获取用户信息失败")
        return res.json()
      })
      .then((data) => {
        setUserInfo({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          image: data.image || ""
        })
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleEditToggle = () => {
    setIsEditing(!isEditing)
    setSuccess("")
    setError("")
  }

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInfo({ ...userInfo, [e.target.name]: e.target.value })
  }

  const handleSaveChanges = async () => {
    setLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userInfo.name,
          phone: userInfo.phone,
          address: userInfo.address
        })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "保存失败")
      }
      setSuccess("保存成功！")
      setIsEditing(false)
    } catch (err: any) {
      setError(err.message || "保存失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-8">个人资料</h1>

        <Tabs defaultValue="info" className="space-y-8">
          <TabsList className="bg-zinc-900 border-zinc-800">
            <TabsTrigger value="info" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              <User className="w-4 h-4 mr-2" />
              基本信息
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
              <Key className="w-4 h-4 mr-2" />
              安全设置
            </TabsTrigger>
            <TabsTrigger
              value="applications"
              className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              申请历史
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
            >
              <Bell className="w-4 h-4 mr-2" />
              通知设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-2xl">基本信息</CardTitle>
                  <Button
                    onClick={handleEditToggle}
                    variant="outline"
                    className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                  >
                    {isEditing ? "取消" : "编辑"}
                    <Edit className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4 mb-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={userInfo.image || "/placeholder.svg?height=80&width=80"} alt={userInfo.name} />
                    <AvatarFallback>{userInfo.name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <form>
                      <label className="cursor-pointer inline-block px-4 py-2 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 rounded-md">
                        更换头像
                        <input
                          type="file"
                          accept="image/*"
                          name="avatar"
                          className="hidden"
                          onInput={async (e: React.ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const formData = new FormData()
                            formData.append("avatar", file)
                            setLoading(true)
                            setError("")
                            try {
                              const res = await fetch("/api/users/avatar", {
                                method: "POST",
                                body: formData
                              })
                              if (!res.ok) throw new Error("头像上传失败")
                              const data = await res.json()
                              setUserInfo((info) => ({ ...info, image: data.image }))
                              setSuccess("头像上传成功")
                            } catch (err: any) {
                              setError(err.message || "头像上传失败")
                            } finally {
                              setLoading(false)
                            }
                          }}
                        />
                      </label>
                    </form>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">姓名</Label>
                    <Input
                      id="name"
                      name="name"
                      value={userInfo.name}
                      onChange={handleInfoChange}
                      disabled={!isEditing}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                      id="email"
                      name="email"
                      value={userInfo.email}
                      onChange={handleInfoChange}
                      disabled={!isEditing}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">电话</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={userInfo.phone}
                      onChange={handleInfoChange}
                      disabled={!isEditing}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">地址</Label>
                    <Input
                      id="address"
                      name="address"
                      value={userInfo.address}
                      onChange={handleInfoChange}
                      disabled={!isEditing}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1"
                    />
                  </div>
                </div>
                {isEditing && (
                  <Button onClick={handleSaveChanges} className="mt-6 bg-emerald-500 hover:bg-emerald-600">
                    保存更改
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-2xl">安全设置</CardTitle>
                <CardDescription>管理您的密码和账户安全选项</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">修改密码</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">当前密码</Label>
                      <Input
                        id="current-password"
                        type="password"
                        className="bg-zinc-800 border-zinc-700 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">新密码</Label>
                      <Input
                        id="new-password"
                        type="password"
                        className="bg-zinc-800 border-zinc-700 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">确认新密码</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        className="bg-zinc-800 border-zinc-700 text-white mt-1"
                      />
                    </div>
                    <Button className="bg-emerald-500 hover:bg-emerald-600">更新密码</Button>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">双因素认证</h3>
                  <div className="flex items-center space-x-2">
                    <Switch id="2fa" />
                    <Label htmlFor="2fa">启用双因素认证</Label>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">账户删除</h3>
                  <p className="text-gray-400 mb-2">删除您的账户将永久移除所有数据，此操作不可逆。</p>
                  <Button variant="destructive" className="bg-red-500 hover:bg-red-600">
                    删除账户
                    <Trash2 className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-2xl">申请历史</CardTitle>
                <CardDescription>查看您的签证申请历史记录</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="text-white">申请ID</TableHead>
                      <TableHead className="text-white">签证类型</TableHead>
                      <TableHead className="text-white">申请日期</TableHead>
                      <TableHead className="text-white">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-zinc-800">
                      <TableCell>APP001</TableCell>
                      <TableCell>申根签证</TableCell>
                      <TableCell>2023-05-15</TableCell>
                      <TableCell>
                        <Badge className="bg-green-500">已批准</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-zinc-800">
                      <TableCell>APP002</TableCell>
                      <TableCell>美国签证</TableCell>
                      <TableCell>2023-07-22</TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-500">处理中</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-zinc-800">
                      <TableCell>APP003</TableCell>
                      <TableCell>日本签证</TableCell>
                      <TableCell>2023-09-10</TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500">已提交</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-2xl">通知设置</CardTitle>
                <CardDescription>管理您接收的通知类型</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">电子邮件通知</h3>
                    <p className="text-sm text-gray-400">接收有关申请状态更新的电子邮件</p>
                  </div>
                  <Switch id="email-notifications" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">短信通知</h3>
                    <p className="text-sm text-gray-400">接收重要更新的短信提醒</p>
                  </div>
                  <Switch id="sms-notifications" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">推送通知</h3>
                    <p className="text-sm text-gray-400">在移动设备上接收推送通知</p>
                  </div>
                  <Switch id="push-notifications" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">通知频率</h3>
                  <select className="w-full bg-zinc-800 border-zinc-700 text-white rounded-md">
                    <option>实时</option>
                    <option>每日摘要</option>
                    <option>每周摘要</option>
                  </select>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">自定义通知</h3>
                  <Textarea
                    placeholder="输入您想接收通知的其他情况..."
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <Button className="bg-emerald-500 hover:bg-emerald-600">保存通知设置</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


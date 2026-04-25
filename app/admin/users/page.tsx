"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Edit,
  Eye,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Shield,
  ShieldOff,
  Users,
} from "lucide-react"

import {
  APP_ROLE_OPTIONS,
  AppRole,
  canManageUsers,
  getAppRoleLabel,
  normalizeAppRole,
} from "@/lib/access-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface UserRecord {
  id: string
  email: string
  name: string
  status: "active" | "inactive" | "banned"
  role: AppRole
  createdAt: string
  updatedAt: string
  _count: {
    usVisaTasks: number
    frenchVisaTasks: number
    documents: number
    applications: number
  }
}

function getRoleBadge(role: AppRole) {
  switch (role) {
    case "boss":
      return <Badge className="bg-slate-900 text-white hover:bg-slate-900">老板</Badge>
    case "supervisor":
      return <Badge className="bg-blue-600 text-white hover:bg-blue-600">主管</Badge>
    case "service":
      return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">客服</Badge>
    case "specialist":
    default:
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">专员</Badge>
  }
}

function getStatusBadge(status: UserRecord["status"]) {
  switch (status) {
    case "active":
      return <Badge variant="outline" className="text-green-600">启用中</Badge>
    case "inactive":
      return <Badge variant="secondary">未启用</Badge>
    case "banned":
      return <Badge variant="destructive">已禁用</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [detailUser, setDetailUser] = useState<UserRecord | null>(null)
  const [editUser, setEditUser] = useState<UserRecord | null>(null)
  const [editName, setEditName] = useState("")
  const [editRole, setEditRole] = useState<AppRole>("specialist")
  const [editStatus, setEditStatus] = useState<UserRecord["status"]>("active")
  const [editPassword, setEditPassword] = useState("")
  const [editLoading, setEditLoading] = useState(false)

  const viewerRole = normalizeAppRole(session?.user?.role)
  const canEditUsers = canManageUsers(viewerRole)

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        status: statusFilter,
        role: roleFilter,
        page: "1",
        pageSize: "100",
      })
      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      })
      const data = await response.json()
      if (data.success) {
        setUsers(
          (data.users || []).map((user: UserRecord) => ({
            ...user,
            role: normalizeAppRole(user.role),
          })),
        )
      }
    } catch (error) {
      console.error("获取用户列表失败:", error)
    } finally {
      setIsLoading(false)
    }
  }, [roleFilter, searchTerm, statusFilter])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const stats = useMemo(() => {
    const activeCount = users.filter((user) => user.status === "active").length
    const managementCount = users.filter((user) => user.role === "boss" || user.role === "supervisor").length
    const specialistCount = users.filter((user) => user.role === "specialist").length
    const serviceCount = users.filter((user) => user.role === "service").length

    return {
      activeCount,
      managementCount,
      specialistCount,
      serviceCount,
    }
  }, [users])

  const handleStatusChange = async (userId: string, newStatus: UserRecord["status"]) => {
    if (!canEditUsers) return

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      })
      const data = await response.json()
      if (data.success) {
        setUsers((current) =>
          current.map((user) =>
            user.id === userId ? { ...user, status: newStatus } : user,
          ),
        )
      }
    } catch (error) {
      console.error("更新用户状态失败:", error)
    }
  }

  const openEdit = (user: UserRecord) => {
    if (!canEditUsers) return

    setEditUser(user)
    setEditName(user.name || "")
    setEditRole(user.role)
    setEditStatus(user.status)
    setEditPassword("")
  }

  const handleEditSave = async () => {
    if (!editUser || !canEditUsers) return

    setEditLoading(true)
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editUser.id,
          name: editName,
          role: editRole,
          status: editStatus,
          password: editPassword.trim().length > 0 ? editPassword : undefined,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setUsers((current) =>
          current.map((user) =>
            user.id === editUser.id
              ? {
                  ...user,
                  name: editName,
                  role: editRole,
                  status: editStatus,
                }
              : user,
          ),
        )
        setEditUser(null)
        setEditPassword("")
      }
    } catch (error) {
      console.error("更新用户失败:", error)
    } finally {
      setEditLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">团队账号</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            按老板、主管、专员、客服四种角色管理内部成员与状态。
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={fetchUsers}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新列表
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总账号数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">活跃账号 {stats.activeCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">后台角色</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.managementCount}</div>
            <p className="text-xs text-muted-foreground">老板 + 主管</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">专员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.specialistCount}</div>
            <p className="text-xs text-muted-foreground">处理案件与自动化</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">客服</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.serviceCount}</div>
            <p className="text-xs text-muted-foreground">只读查看与下载</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>搜索和筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="搜索姓名或邮箱..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用中</SelectItem>
                <SelectItem value="inactive">未启用</SelectItem>
                <SelectItem value="banned">已禁用</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {APP_ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("")
                setStatusFilter("all")
                setRoleFilter("all")
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              重置筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>成员列表</CardTitle>
          <CardDescription>共 {users.length} 个账号</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">账号信息</TableHead>
                  <TableHead className="min-w-[100px]">状态</TableHead>
                  <TableHead className="min-w-[120px]">角色</TableHead>
                  <TableHead className="min-w-[90px]">任务数</TableHead>
                  <TableHead className="min-w-[90px]">材料数</TableHead>
                  <TableHead className="min-w-[120px]">注册时间</TableHead>
                  <TableHead className="min-w-[120px]">最近更新</TableHead>
                  <TableHead className="min-w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name || "-"}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{user._count.usVisaTasks + user._count.frenchVisaTasks}</TableCell>
                    <TableCell>{user._count.documents}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell>{formatDate(user.updatedAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDetailUser(user)}>
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          {canEditUsers ? (
                            <DropdownMenuItem onSelect={() => openEdit(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑账号
                            </DropdownMenuItem>
                          ) : null}
                          {canEditUsers ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                handleStatusChange(
                                  user.id,
                                  user.status === "active" ? "banned" : "active",
                                )
                              }
                            >
                              {user.status === "active" ? (
                                <>
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  禁用账号
                                </>
                              ) : (
                                <>
                                  <Shield className="mr-2 h-4 w-4" />
                                  启用账号
                                </>
                              )}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detailUser} onOpenChange={(open) => !open && setDetailUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>账号详情</DialogTitle>
            <DialogDescription>查看该成员的基础信息与工作量概览。</DialogDescription>
          </DialogHeader>
          {detailUser ? (
            <div className="space-y-2 text-sm">
              <div>邮箱：{detailUser.email}</div>
              <div>姓名：{detailUser.name || "-"}</div>
              <div>角色：{getAppRoleLabel(detailUser.role)}</div>
              <div>状态：{detailUser.status}</div>
              <div>注册时间：{formatDate(detailUser.createdAt)}</div>
              <div>最近更新：{formatDate(detailUser.updatedAt)}</div>
              <div>美签任务：{detailUser._count.usVisaTasks}</div>
              <div>法签任务：{detailUser._count.frenchVisaTasks}</div>
              <div>材料数：{detailUser._count.documents}</div>
              <div>申请数：{detailUser._count.applications}</div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailUser(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑账号</DialogTitle>
            <DialogDescription>修改姓名、角色、状态，必要时可直接重置密码。</DialogDescription>
          </DialogHeader>
          {editUser ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-600">姓名</label>
                <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">角色</label>
                <Select value={editRole} onValueChange={(value) => setEditRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">状态</label>
                <Select
                  value={editStatus}
                  onValueChange={(value) => setEditStatus(value as UserRecord["status"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用中</SelectItem>
                    <SelectItem value="inactive">未启用</SelectItem>
                    <SelectItem value="banned">已禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">重置密码</label>
                <Input
                  type="password"
                  placeholder="留空则不修改"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">系统只支持重置密码，不显示原密码。</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

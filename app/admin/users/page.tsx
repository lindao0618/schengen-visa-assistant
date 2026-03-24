"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Shield,
  ShieldOff
} from "lucide-react"

interface User {
  id: string
  email: string
  name: string
  status: "active" | "inactive" | "banned"
  role: "user" | "admin"
  createdAt: string
  updatedAt: string
  _count: {
    usVisaTasks: number
    frenchVisaTasks: number
    documents: number
    applications: number
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [detailUser, setDetailUser] = useState<User | null>(null)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editName, setEditName] = useState("")
  const [editRole, setEditRole] = useState<"user" | "admin">("user")
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "banned">("active")
  const [editPassword, setEditPassword] = useState("")
  const [editLoading, setEditLoading] = useState(false)

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
      const response = await fetch(`/api/admin/users?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("获取用户列表失败:", error)
    } finally {
      setIsLoading(false)
    }
  }, [roleFilter, searchTerm, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="text-green-600">活跃</Badge>
      case "inactive":
        return <Badge variant="secondary">非活跃</Badge>
      case "banned":
        return <Badge variant="destructive">已禁用</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="default">管理员</Badge>
      case "user":
        return <Badge variant="outline">普通用户</Badge>
      default:
        return <Badge variant="secondary">{role}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      })
      const data = await response.json()
      if (data.success) {
        setUsers(users.map(user =>
          user.id === userId ? { ...user, status: newStatus as any } : user
        ))
      }
    } catch (error) {
      console.error("更新用户状态失败:", error)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      })
      const data = await response.json()
      if (data.success) {
        setUsers(users.map(user =>
          user.id === userId ? { ...user, role: newRole as any } : user
        ))
      }
    } catch (error) {
      console.error("更新用户角色失败:", error)
    }
  }

  const openEdit = (user: User) => {
    setEditUser(user)
    setEditName(user.name || "")
    setEditRole(user.role)
    setEditStatus(user.status)
    setEditPassword("")
  }

  const handleEditSave = async () => {
    if (!editUser) return
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
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editUser.id
              ? { ...u, name: editName, role: editRole, status: editStatus }
              : u
          )
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">用户管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            管理系统用户，查看用户信息和状态
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={fetchUsers}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新列表
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              活跃用户: {users.filter(u => u.status === "active").length}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.status === "active").length}</div>
            <p className="text-xs text-muted-foreground">
              占比: {users.length ? Math.round((users.filter(u => u.status === "active").length / users.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管理员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === "admin").length}</div>
            <p className="text-xs text-muted-foreground">
              系统管理员
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">禁用用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.status === "banned").length}</div>
            <p className="text-xs text-muted-foreground">
              需要关注
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和过滤 */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>搜索和过滤</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索用户名或邮箱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="active">活跃</SelectItem>
                <SelectItem value="inactive">非活跃</SelectItem>
                <SelectItem value="banned">已禁用</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有角色</SelectItem>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchTerm("")
              setStatusFilter("all")
              setRoleFilter("all")
            }}>
              <Filter className="mr-2 h-4 w-4" />
              重置过滤
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>
            共 {users.length} 个用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">用户信息</TableHead>
                  <TableHead className="min-w-[100px]">状态</TableHead>
                  <TableHead className="min-w-[100px]">角色</TableHead>
                  <TableHead className="min-w-[80px]">任务数</TableHead>
                  <TableHead className="min-w-[80px]">材料数</TableHead>
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
                        <div className="font-medium">{user.name}</div>
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
                          <DropdownMenuItem onSelect={() => openEdit(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑用户
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(user.id, user.status === "active" ? "banned" : "active")}
                          >
                            {user.status === "active" ? (
                              <>
                                <ShieldOff className="mr-2 h-4 w-4" />
                                禁用用户
                              </>
                            ) : (
                              <>
                                <Shield className="mr-2 h-4 w-4" />
                                启用用户
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRoleChange(user.id, user.role === "user" ? "admin" : "user")}
                          >
                            {user.role === "user" ? "设为管理员" : "取消管理员"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除用户
                          </DropdownMenuItem>
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
            <DialogTitle>用户详情</DialogTitle>
            <DialogDescription>查看该用户的基础信息与统计</DialogDescription>
          </DialogHeader>
          {detailUser && (
            <div className="space-y-2 text-sm">
              <div>邮箱：{detailUser.email}</div>
              <div>姓名：{detailUser.name || "-"}</div>
              <div>角色：{detailUser.role}</div>
              <div>状态：{detailUser.status}</div>
              <div>注册时间：{formatDate(detailUser.createdAt)}</div>
              <div>最近更新：{formatDate(detailUser.updatedAt)}</div>
              <div>美签任务：{detailUser._count.usVisaTasks}</div>
              <div>法签任务：{detailUser._count.frenchVisaTasks}</div>
              <div>材料数：{detailUser._count.documents}</div>
              <div>申请数：{detailUser._count.applications}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailUser(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户名称、角色与状态</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-600">姓名</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">角色</label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as "user" | "admin")}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600">状态</label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as "active" | "inactive" | "banned")}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">活跃</SelectItem>
                    <SelectItem value="inactive">非活跃</SelectItem>
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
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  出于安全原因不支持查看原密码，可在此重置。
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>取消</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

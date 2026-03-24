"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Bell, Search, Settings, User, Shield, HelpCircle } from "lucide-react"

interface AdminTaskNotice {
  taskId: string
  source: "us-visa" | "french-visa" | "material"
  type: string
  message: string
  status: string
  updatedAt?: string
  createdAt: string
}

export function Header() {
  const { data: session } = useSession()
  const [notices, setNotices] = useState<AdminTaskNotice[]>([])
  const router = useRouter()

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const res = await fetch("/api/admin/tasks?status=failed&limit=5")
        const data = await res.json()
        if (data?.success) {
          setNotices(data.tasks || [])
        }
      } catch (error) {
        console.error("获取通知失败:", error)
      }
    }
    fetchNotices()
  }, [])

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 w-full">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 搜索栏 */}
          <div className="flex flex-1 items-center space-x-4">
          <div className="relative flex-1 max-w-md mr-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="搜索用户、订单或文档..."
              className="block w-full pl-11 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center space-x-4">
          {/* 通知按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                {notices.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                    {notices.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end" forceMount>
              <DropdownMenuLabel>失败任务提醒</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notices.length === 0 && (
                <DropdownMenuItem className="text-sm text-muted-foreground">
                  暂无失败任务
                </DropdownMenuItem>
              )}
              {notices.map((task) => (
                <DropdownMenuItem
                  key={`${task.source}-${task.taskId}`}
                  className="flex flex-col items-start gap-1"
                  onClick={() => router.push("/admin/tasks?status=failed")}
                >
                  <span className="text-sm font-medium">{task.taskId}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.type} · {task.message || "失败"}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 设置按钮 */}
          <Button variant="ghost" size="sm">
            <Settings className="h-5 w-5" />
          </Button>

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {session?.user?.name?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user?.name || "管理员"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user?.email || "admin@example.com"}
                  </p>
                  <div className="flex items-center mt-1">
                    <Shield className="h-3 w-3 text-blue-500 mr-1" />
                    <span className="text-xs text-blue-600">管理员</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                个人资料
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                账户设置
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Shield className="mr-2 h-4 w-4" />
                系统设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                帮助文档
              </DropdownMenuItem>
              <DropdownMenuItem>
                关于系统
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => {
                  window.location.href = "/api/auth/signout"
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Shield className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
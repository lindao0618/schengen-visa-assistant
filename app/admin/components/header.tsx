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
    <header className="sticky top-0 z-20 w-full border-b border-white/5 bg-black/85 text-white backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex flex-1 items-center space-x-4">
          <div className="relative flex-1 max-w-md mr-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/35" />
            </div>
            <input
              type="text"
              placeholder="搜索用户、订单或文档..."
              className="pro-input pro-focus-glow block w-full rounded-2xl border border-white/5 bg-white/[0.02] py-2 pl-11 pr-16 font-mono text-sm leading-5 text-white placeholder-white/28 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-white/35">
              Cmd K
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative rounded-full border border-white/5 bg-white/[0.02] text-white/70 hover:bg-white/[0.06] hover:text-white">
                <Bell className="h-5 w-5" />
                {notices.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                    {notices.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 border-white/10 bg-[#080808] text-white" align="end" forceMount>
              <DropdownMenuLabel>失败任务提醒</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notices.length === 0 && (
                <DropdownMenuItem className="text-sm text-white/45">
                  暂无失败任务
                </DropdownMenuItem>
              )}
              {notices.map((task) => (
                <DropdownMenuItem
                  key={`${task.source}-${task.taskId}`}
                  className="flex flex-col items-start gap-1 focus:bg-white/[0.04]"
                  onClick={() => router.push("/admin/tasks?status=failed")}
                >
                  <span className="font-mono text-sm font-medium">{task.taskId}</span>
                  <span className="text-xs text-white/45">
                    {task.type} · {task.message || "失败"}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" className="rounded-full border border-white/5 bg-white/[0.02] text-white/70 hover:bg-white/[0.06] hover:text-white">
            <Settings className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full border border-white/5 bg-white/[0.02]">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                  <AvatarFallback className="bg-white text-black">
                    {session?.user?.name?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 border-white/10 bg-[#080808] text-white" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user?.name || "管理员"}
                  </p>
                  <p className="text-xs leading-none text-white/45">
                    {session?.user?.email || "admin@example.com"}
                  </p>
                  <div className="flex items-center mt-1">
                    <Shield className="h-3 w-3 text-emerald-400 mr-1" />
                    <span className="text-xs text-emerald-300">管理员</span>
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
                className="text-red-300 focus:text-red-300"
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

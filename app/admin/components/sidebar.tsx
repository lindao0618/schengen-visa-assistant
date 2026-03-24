"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  X,
  Building2,
  ClipboardList,
  FolderOpen,
  BookOpen,
  Activity
} from "lucide-react"

const navigation = [
  {
    name: "仪表板",
    href: "/admin",
    icon: LayoutDashboard,
    description: "系统概览和统计"
  },
  {
    name: "用户管理",
    href: "/admin/users",
    icon: Users,
    description: "管理用户账户"
  },
  {
    name: "任务管理",
    href: "/admin/tasks",
    icon: ClipboardList,
    description: "查看任务状态"
  },
  {
    name: "材料管理",
    href: "/admin/documents",
    icon: FolderOpen,
    description: "管理材料文件"
  },
  {
    name: "内容管理",
    href: "/admin/content",
    icon: BookOpen,
    description: "管理文案内容"
  },
  {
    name: "系统设置",
    href: "/admin/settings",
    icon: Settings,
    description: "配置系统参数"
  },
  {
    name: "日志监控",
    href: "/admin/logs",
    icon: Activity,
    description: "查看运行日志"
  }
]

export function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* 桌面端侧边栏 - 始终显示 */}
      <div className="h-full w-full bg-white border-r border-gray-200 shadow-sm flex flex-col">
        <div className="flex h-16 items-center px-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900">管理员后台</h1>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-100 text-blue-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive
                      ? "text-blue-500"
                      : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                <div className="flex-1">
                  <div>{item.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {item.description}
                  </div>
                </div>
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600 hover:text-gray-900"
            onClick={() => {
              window.location.href = "/api/auth/signout"
            }}
          >
            <LogOut className="mr-3 h-5 w-5" />
            退出登录
          </Button>
        </div>
      </div>

      {/* 移动端菜单按钮和侧边栏 */}
      <div className="lg:hidden">
        {/* 菜单按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 bg-white shadow-md border border-gray-200"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* 移动端侧边栏 */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* 背景遮罩 */}
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75" 
              onClick={() => setSidebarOpen(false)} 
            />
            
            {/* 侧边栏内容 */}
            <div className="relative flex-1 flex flex-col w-64 max-w-xs bg-white">
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <h1 className="text-lg font-bold text-gray-900">管理员后台</h1>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        isActive
                          ? "bg-blue-100 text-blue-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon
                        className={cn(
                          "mr-3 h-5 w-5 flex-shrink-0",
                          isActive
                            ? "text-blue-500"
                            : "text-gray-400 group-hover:text-gray-500"
                        )}
                      />
                      <div className="flex-1">
                        <div>{item.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </nav>
              <div className="border-t border-gray-200 p-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-600 hover:text-gray-900"
                  onClick={() => {
                    window.location.href = "/api/auth/signout"
                  }}
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  退出登录
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
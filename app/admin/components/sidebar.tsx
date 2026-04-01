"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BellRing,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  {
    name: "老板总览",
    href: "/admin",
    icon: LayoutDashboard,
    description: "全局数据、异常与系统状态",
  },
  {
    name: "用户管理",
    href: "/admin/users",
    icon: Users,
    description: "管理系统账号与权限",
  },
  {
    name: "任务管理",
    href: "/admin/tasks",
    icon: ClipboardList,
    description: "查看自动化任务与执行结果",
  },
  {
    name: "员工工作台",
    href: "/applicants",
    icon: BriefcaseBusiness,
    description: "进入申请人 CRM 与案件推进页面",
  },
  {
    name: "法签案件",
    href: "/admin/france-cases",
    icon: BellRing,
    description: "查看案件进度、提醒与异常",
  },
  {
    name: "材料管理",
    href: "/admin/documents",
    icon: FolderOpen,
    description: "统一管理材料与文档文件",
  },
  {
    name: "内容管理",
    href: "/admin/content",
    icon: BookOpen,
    description: "维护系统展示与模板内容",
  },
  {
    name: "系统设置",
    href: "/admin/settings",
    icon: Settings,
    description: "配置系统参数与运行环境",
  },
  {
    name: "日志监控",
    href: "/admin/logs",
    icon: Activity,
    description: "查看服务日志与运行状态",
  },
]

export function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const renderNavItems = (onItemClick?: () => void) =>
    navigation.map((item) => {
      const isActive = pathname === item.href
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive ? "bg-blue-100 text-blue-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          )}
          onClick={onItemClick}
        >
          <item.icon
            className={cn(
              "mr-3 h-5 w-5 flex-shrink-0",
              isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500",
            )}
          />
          <div className="flex-1">
            <div>{item.name}</div>
            <div className="truncate text-xs text-gray-500">{item.description}</div>
          </div>
        </Link>
      )
    })

  return (
    <>
      <div className="flex h-full w-full flex-col border-r border-gray-200 bg-white shadow-sm">
        <div className="flex h-16 items-center border-b border-gray-200 px-4">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">老板后台</h1>
              <p className="text-xs text-gray-500">查看全局数据与系统运营</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">{renderNavItems()}</nav>

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

      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 border border-gray-200 bg-white shadow-md"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-gray-600/75" onClick={() => setSidebarOpen(false)} />

            <div className="relative flex w-72 max-w-xs flex-1 flex-col bg-white">
              <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">老板后台</h1>
                    <p className="text-xs text-gray-500">全局数据与运营总览</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
                {renderNavItems(() => setSidebarOpen(false))}
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

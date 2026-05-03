"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { canAccessAdminPortal } from "@/lib/access-control"
import { getPublicUiPreviewSession, isPublicUiPreviewEnabled } from "@/lib/public-ui-preview"
import { Header } from "./components/header"
import { Sidebar } from "./components/sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const publicPreviewSession = getPublicUiPreviewSession()
  const activeSession = session || publicPreviewSession
  const isPublicPreview = isPublicUiPreviewEnabled()

  useEffect(() => {
    if ((status === "loading" && !publicPreviewSession) || pathname === "/admin/login") {
      return
    }

    if (!activeSession) {
      router.push("/admin/login")
      return
    }

    if (!canAccessAdminPortal(activeSession.user?.role)) {
      router.push("/dashboard")
    }
  }, [activeSession, pathname, publicPreviewSession, router, status])

  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  if ((status === "loading" && !publicPreviewSession) || !activeSession || !canAccessAdminPortal(activeSession.user?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400"></div>
          <p className="text-white/55">
            {status === "loading" && !publicPreviewSession ? "加载中..." : "正在重定向..."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <div className="fixed left-0 top-0 z-30 h-full min-w-64 w-64">
        <Sidebar />
      </div>
      <div className="ml-64 flex-1">
        <Header />
        {isPublicPreview && (
          <div className="border-b border-white/5 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
            公开预览模式：当前页面使用演示数据，真实后台数据和写操作未开放。
          </div>
        )}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

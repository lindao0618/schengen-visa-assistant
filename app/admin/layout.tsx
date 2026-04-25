"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { canAccessAdminPortal } from "@/lib/access-control"
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

  useEffect(() => {
    if (status === "loading" || pathname === "/admin/login") {
      return
    }

    if (!session) {
      router.push("/admin/login")
      return
    }

    if (!canAccessAdminPortal(session.user?.role)) {
      router.push("/dashboard")
    }
  }, [pathname, router, session, status])

  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  if (status === "loading" || !session || !canAccessAdminPortal(session.user?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">
            {status === "loading" ? "加载中..." : "正在重定向..."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="fixed left-0 top-0 z-30 h-full min-w-64 w-64">
        <Sidebar />
      </div>
      <div className="ml-64 flex-1">
        <Header />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

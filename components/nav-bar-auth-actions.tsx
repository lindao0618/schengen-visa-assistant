"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"

export function NavBarAuthActions() {
  const [mounted, setMounted] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || status === "loading") {
    return <div className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-slate-100" />
  }

  if (status === "authenticated" && session) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden h-9 items-center rounded-full border border-transparent px-4 text-sm font-medium text-slate-700 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-800 sm:inline-flex"
        >
          个人中心
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="h-9 rounded-full border border-transparent px-4 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
        >
          退出登录
        </button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/login"
        className="h-9 rounded-full border border-transparent px-4 text-sm font-medium text-slate-700 transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-800"
      >
        登录
      </Link>
      <Link
        href="/signup"
        className="h-9 rounded-full bg-blue-600 px-4 text-sm font-semibold leading-9 text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
      >
        注册
      </Link>
    </div>
  )
}

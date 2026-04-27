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
    return <div className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-gray-200" />
  }

  if (status === "authenticated" && session) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden h-9 items-center rounded-full px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-950 sm:inline-flex"
        >
          个人中心
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="h-9 rounded-full px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-950"
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
        className="h-9 rounded-full px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-950"
      >
        登录
      </Link>
      <Link
        href="/signup"
        className="h-9 rounded-full bg-gray-900 px-4 text-sm font-semibold leading-9 text-white transition hover:bg-black"
      >
        注册
      </Link>
    </div>
  )
}

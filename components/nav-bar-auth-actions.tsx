"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { ArrowRight } from "lucide-react"

export function NavBarAuthActions() {
  const [mounted, setMounted] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || status === "loading") {
    return <div className="h-11 w-28 shrink-0 animate-pulse rounded-full bg-white/10" />
  }

  if (status === "authenticated" && session) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard"
          className="pro-auth-action hidden h-11 items-center justify-center whitespace-nowrap rounded-full border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold leading-none text-white/80 transition hover:border-cyan-100/25 hover:bg-white/10 hover:text-white sm:inline-flex"
        >
          个人中心
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="pro-auth-action inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold leading-none text-white/75 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200"
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
        className="pro-auth-action inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold leading-none text-white/80 transition hover:border-cyan-100/25 hover:bg-white/10 hover:text-white"
      >
        登录
      </Link>
      <Link
        href="/signup"
        className="pro-auth-primary inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-5 text-sm font-black leading-none text-zinc-950 shadow-[0_0_34px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:bg-cyan-50"
      >
        注册
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

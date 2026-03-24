"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { useSession, signIn, signOut } from "next-auth/react"
import {
  Plane,
  FileText,
  Users,
  MessageSquare,
  Globe,
  UserCircle,
  FilePlus2,
} from "lucide-react"

const navigation = [
  {
    name: "美国签证",
    href: "/usa-visa",
    icon: Plane,
    active: (path: string) => path.startsWith("/usa-visa"),
  },
  {
    name: "申根签证",
    href: "/schengen-visa",
    icon: Globe,
    active: (path: string) => path.startsWith("/schengen-visa"),
  },
  {
    name: "材料审核",
    href: "/material-review",
    icon: FileText,
  },
  {
    name: "材料定制",
    href: "/material-customization",
    icon: FilePlus2,
    active: (path: string) => path.startsWith("/material-customization"),
  },
]

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  const { data: session, status } = useSession()
  
  // 等待组件挂载后再渲染主题切换按钮，避免水合不匹配
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = () => {
    // 使用自定义登录页面而不是默认的NextAuth登录页
    router.push('/login')
  }

  return (
    <nav className="border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm sticky top-0 z-40">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">签证助手</span>
          </Link>
          {navigation.map((item) => {
            const isActive = item.active ? item.active(pathname) : pathname === item.href
            return (
              <Button
                key={item.href}
                variant={"ghost"}
                className={cn(
                  "h-9 rounded-full px-4 transition-all duration-200",
                  isActive ? "bg-gray-900 text-white font-medium hover:bg-black hover:text-white" : "hover:bg-gray-100"
                )}
                asChild
              >
                <Link href={item.href} className="flex items-center space-x-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              </Button>
            )
          })}
        </div>
        
        {/* Auth buttons, User Profile, and Theme Toggle */}
        <div className="flex items-center space-x-2">
          {!mounted && (
            <div className="h-9 w-20 animate-pulse rounded-full bg-gray-200" />
          )}

          {mounted && status === "loading" && (
            <div className="h-9 w-20 animate-pulse rounded-full bg-gray-200" />
          )}

          {mounted && status === "unauthenticated" && !session && (
            <>
              <Button
                variant="ghost"
                className="h-9 rounded-full px-4"
                onClick={handleLogin}
              >
                登录
              </Button>
              <Button
                variant="default"
                className="h-9 rounded-full px-4"
                asChild
              >
                <Link href="/signup">注册</Link>
              </Button>
            </>
          )}

          {mounted && status === "authenticated" && session && (
            <>
              <Button
                variant="ghost"
                className="h-9 rounded-full px-4 flex items-center space-x-2"
                asChild
              >
                <Link href="/dashboard">
                  <UserCircle className="h-4 w-4 mr-1" />
                  <span>个人中心</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="h-9 rounded-full px-4"
                onClick={() => signOut()}
              >
                退出登录
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
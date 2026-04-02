"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  ChevronDown,
  FilePlus2,
  FileText,
  Globe,
  Plane,
  UserCircle,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type NavItem = {
  name: string
  href: string
  icon: typeof Plane
  active?: (path: string) => boolean
  menuItems?: Array<{
    name: string
    href: string
    description?: string
  }>
}

const navigation: NavItem[] = [
  {
    name: "美国签证",
    href: "/usa-visa",
    icon: Plane,
    active: (path) => path.startsWith("/usa-visa"),
  },
  {
    name: "申根签证",
    href: "/schengen-visa",
    icon: Globe,
    active: (path) => path.startsWith("/schengen-visa"),
    menuItems: [
      {
        name: "申根首页",
        href: "/schengen-visa",
        description: "返回申根签证总览页",
      },
      {
        name: "法国自动化",
        href: "/schengen-visa/france/automation",
        description: "直接进入法国申根自动化流程",
      },
    ],
  },
  {
    name: "材料审核",
    href: "/material-review",
    icon: FileText,
    active: (path) => path.startsWith("/material-review"),
    menuItems: [
      {
        name: "鍗曠嫭鏉愭枡瀹℃牳",
        href: "/material-review",
        description: "鍗曚竴鏂囦欢涓婁紶鍜?AI 鏉愭枡瀹℃牳",
      },
      {
        name: "缁煎悎鏉愭枡瀹℃牳",
        href: "/material-review/comprehensive",
        description: "琛岀▼銆侀厭搴椼€丗V銆乀LS 绛夎法鏉愭枡涓€鑷存€у鏍?",
      },
    ],
  },
  {
    name: "材料定制",
    href: "/material-customization",
    icon: FilePlus2,
    active: (path) => path.startsWith("/material-customization"),
  },
  {
    name: "申请人档案",
    href: "/applicants",
    icon: Users,
    active: (path) => path.startsWith("/applicants"),
  },
]

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = () => {
    router.push("/login")
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-lg font-bold text-transparent">
              签证助手
            </span>
          </Link>

          {navigation.map((item) => {
            const isActive = item.active ? item.active(pathname) : pathname === item.href

            if (item.menuItems?.length) {
              return (
                <DropdownMenu key={item.href}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-9 rounded-full px-4 transition-all duration-200",
                        isActive
                          ? "bg-gray-900 font-medium text-white hover:bg-black hover:text-white"
                          : "hover:bg-gray-100"
                      )}
                    >
                      <span className="flex items-center space-x-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 rounded-2xl p-2">
                    <DropdownMenuLabel className="px-3 py-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                      申根快捷入口
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {item.menuItems.map((menuItem) => {
                      const menuActive = pathname === menuItem.href
                      return (
                        <DropdownMenuItem
                          key={menuItem.href}
                          className={cn(
                            "flex cursor-pointer flex-col items-start gap-1 rounded-xl px-3 py-3",
                            menuActive && "bg-blue-50 text-blue-700 focus:bg-blue-50 focus:text-blue-700"
                          )}
                          onSelect={() => router.push(menuItem.href)}
                        >
                          <span className="font-medium">{menuItem.name}</span>
                          {menuItem.description ? (
                            <span className="text-xs text-gray-500">{menuItem.description}</span>
                          ) : null}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }

            return (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "h-9 rounded-full px-4 transition-all duration-200",
                  isActive
                    ? "bg-gray-900 font-medium text-white hover:bg-black hover:text-white"
                    : "hover:bg-gray-100"
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

        <div className="flex items-center space-x-2">
          {!mounted && <div className="h-9 w-20 animate-pulse rounded-full bg-gray-200" />}

          {mounted && status === "loading" && (
            <div className="h-9 w-20 animate-pulse rounded-full bg-gray-200" />
          )}

          {mounted && status === "unauthenticated" && !session && (
            <>
              <Button variant="ghost" className="h-9 rounded-full px-4" onClick={handleLogin}>
                登录
              </Button>
              <Button variant="default" className="h-9 rounded-full px-4" asChild>
                <Link href="/signup">注册</Link>
              </Button>
            </>
          )}

          {mounted && status === "authenticated" && session && (
            <>
              <Button variant="ghost" className="h-9 rounded-full px-4" asChild>
                <Link href="/dashboard" className="flex items-center space-x-2">
                  <UserCircle className="h-4 w-4" />
                  <span>个人中心</span>
                </Link>
              </Button>
              <Button variant="ghost" className="h-9 rounded-full px-4" onClick={() => signOut()}>
                退出登录
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

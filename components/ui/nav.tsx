"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "./button"
import { ChevronDown, User } from "lucide-react"

const navItems = [
  { href: "/", label: "首页" },
  {
    label: "签证服务",
    items: [
      { href: "/apply/schengen", label: "申根签证" },
      { href: "/apply/usa", label: "美国签证" },
      { href: "/apply/japan", label: "日本签证" },
      { href: "/apply/uk", label: "英国签证" },
    ],
  },
  {
    label: "资源中心",
    items: [
      { href: "/visa-info", label: "签证指南" },
      { href: "/community", label: "社区交流" },
      { href: "/material-review", label: "材料审核" },
    ],
  },
  { href: "/pricing", label: "价格" },
  { href: "/enterprise", label: "企业服务" },
]

export function Nav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && !(event.target as Element).closest(".nav-dropdown")) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [activeDropdown])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0">
              <span className="text-2xl font-bold text-emerald-500">UKSV签证助手</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navItems.map((item) => (
              <div key={item.label} className="relative nav-dropdown">
                {item.items ? (
                  <button
                    className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                    onClick={() => setActiveDropdown(activeDropdown === item.label ? null : item.label)}
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${activeDropdown === item.label ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`text-gray-400 hover:text-white transition-colors ${
                      pathname === item.href ? "text-white" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                )}

                {item.items && activeDropdown === item.label && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg py-1">
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className="block px-4 py-2 text-sm text-gray-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        onClick={() => setActiveDropdown(null)}
                      >
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:flex md:items-center md:space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
              onClick={() => router.push("/profile")}
            >
              <User className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => router.push("/register")}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6"
            >
              开始使用
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-zinc-900 border-t border-zinc-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <div key={item.label}>
                {item.items ? (
                  <>
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-gray-400 hover:text-white"
                      onClick={() => setActiveDropdown(activeDropdown === item.label ? null : item.label)}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${activeDropdown === item.label ? "rotate-180" : ""}`}
                      />
                    </button>
                    {activeDropdown === item.label && (
                      <div className="pl-4 space-y-1">
                        {item.items.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className="block px-3 py-2 text-sm text-gray-400 hover:text-white"
                            onClick={() => {
                              setActiveDropdown(null)
                              setIsOpen(false)
                            }}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`block px-3 py-2 text-gray-400 hover:text-white ${
                      pathname === item.href ? "text-white" : ""
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-zinc-800">
            <div className="flex items-center px-5">
              <Button
                variant="ghost"
                onClick={() => {
                  router.push("/login")
                  setIsOpen(false)
                }}
                className="w-full justify-center text-gray-400 hover:text-white"
              >
                登录
              </Button>
            </div>
            <div className="mt-3 px-2">
              <Button
                onClick={() => {
                  router.push("/register")
                  setIsOpen(false)
                }}
                className="w-full justify-center bg-emerald-500 hover:bg-emerald-600"
              >
                注册
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"

import { NavBarAuthActions } from "@/components/nav-bar-auth-actions"
import { ProLogo } from "@/components/pro-ui/pro-logo"
import { cn } from "@/lib/utils"

type NavItem = {
  name: string
  href: string
  menuItems?: Array<{
    name: string
    href: string
    description?: string
  }>
}

const navigation: NavItem[] = [
  {
    name: "首页",
    href: "/",
  },
  {
    name: "工作台",
    href: "/dashboard",
  },
  {
    name: "申根签证",
    href: "/schengen-visa",
    menuItems: [
      {
        name: "申根首页",
        href: "/schengen-visa",
        description: "查看申根签证产品和材料流程",
      },
      {
        name: "法国自动化",
        href: "/schengen-visa/france/automation",
        description: "进入法国申根自动化流水线",
      },
      {
        name: "荷兰实时追踪",
        href: "/schengen-visa/slot-booking",
        description: "监控阿姆斯特丹预约与材料状态",
      },
    ],
  },
  {
    name: "美国签证",
    href: "/usa-visa",
    menuItems: [
      {
        name: "美签首页",
        href: "/usa-visa",
        description: "美签全流程自动化总览",
      },
      {
        name: "美签全自动表单填写",
        href: "/usa-visa/form-automation",
        description: "照片检测、DS-160、AIS 和面签简报",
      },
      {
        name: "预约任务",
        href: "/usa-visa/appointment-booking",
        description: "进入美签预约与任务流",
      },
      {
        name: "面签简报",
        href: "/usa-visa/form-automation?tab=interview-brief",
        description: "整理 DS-160、材料与面试准备",
      },
    ],
  },
  {
    name: "材料审核",
    href: "/material-review",
    menuItems: [
      {
        name: "材料审核首页",
        href: "/material-review",
        description: "进入材料合规性深度审计引擎",
      },
      {
        name: "单独材料审核",
        href: "/material-review/individual",
        description: "逐份上传材料，单独检查每份文件",
      },
      {
        name: "综合材料审核",
        href: "/material-review/comprehensive",
        description: "申根材料交叉比对，检查时间链与身份链",
      },
      {
        name: "美签审核",
        href: "/material-review/usa-review",
        description: "对照 Excel、DS-160 和面试必看内容",
      },
    ],
  },
  {
    name: "申请人档案",
    href: "/applicants",
  },
]

function getMenuLabel(itemName: string) {
  if (itemName === "申根签证") return "Schengen Routes"
  if (itemName === "美国签证") return "US Visa Routes"
  if (itemName === "材料审核") return "Material Audit"
  return "Quick Links"
}

function isItemActive(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/"
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function NavUnderline() {
  return (
    <>
      <motion.div
        layoutId="nav-underline"
        initial={false}
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        className="absolute -bottom-2 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-cyan-300 via-emerald-200 to-cyan-200 shadow-[0_0_24px_rgba(80,255,200,0.72)]"
      />
      <motion.span
        layoutId="nav-underline-glow"
        initial={false}
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        className="pointer-events-none absolute -bottom-5 left-1/2 h-7 w-24 -translate-x-1/2 rounded-full bg-cyan-300/20 blur-2xl"
      />
    </>
  )
}

const navButtonClass =
  "relative inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-1 text-base font-semibold leading-none text-white/75 transition hover:text-white"

function scrollHomeToTop(href: string) {
  if (href !== "/" || typeof window === "undefined") return
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }))
}

export function NavBar() {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [hoveredItemName, setHoveredItemName] = useState<string | null>(null)
  const closeMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeItem = navigation.find((item) => isItemActive(pathname, item))
  const highlightedItemName = hoveredItemName ?? openMenu ?? activeItem?.name

  const cancelMenuClose = useCallback(() => {
    if (!closeMenuTimer.current) return
    clearTimeout(closeMenuTimer.current)
    closeMenuTimer.current = null
  }, [])

  const scheduleMenuClose = useCallback(() => {
    cancelMenuClose()
    closeMenuTimer.current = setTimeout(() => {
      setOpenMenu(null)
      closeMenuTimer.current = null
    }, 180)
  }, [cancelMenuClose])

  useEffect(() => {
    return () => cancelMenuClose()
  }, [cancelMenuClose])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-7">
      <div
        className="pointer-events-none absolute left-1/2 top-7 h-28 w-[min(1360px,calc(100vw-32px))] -translate-x-1/2 rounded-full opacity-90 blur-3xl"
        style={{
          background:
            "linear-gradient(90deg, rgba(80, 160, 255, 0.35) 0%, rgba(80, 255, 200, 0.25) 100%)",
        }}
      />
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto flex h-[84px] max-w-[1360px] items-center justify-between gap-8 overflow-visible rounded-full border border-cyan-100/15 bg-gradient-to-r from-[#07152c]/80 via-black/60 to-[#031f19]/70 px-10 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        style={{
          boxShadow:
            "0 28px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 90px rgba(80,255,200,0.10)",
        }}
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_18%_0%,rgba(80,160,255,0.18),transparent_32%),radial-gradient(circle_at_82%_0%,rgba(80,255,200,0.14),transparent_34%)]" />

        <div className="relative z-10 flex min-w-0 items-center gap-8">
          <ProLogo className="shrink-0" compact />
          <span className="sr-only">VISTORIA.PRO navigation</span>

          <LayoutGroup id="navbar">
            <div className="relative hidden items-center gap-7 xl:flex 2xl:gap-8">
              {navigation.map((item) => {
                const active = isItemActive(pathname, item)
                const isOpen = openMenu === item.name
                const highlighted = highlightedItemName === item.name

                if (item.menuItems?.length) {
                  return (
                    <div
                      key={item.href}
                      className="relative"
                      onMouseEnter={() => {
                        cancelMenuClose()
                        setHoveredItemName(item.name)
                      }}
                      onMouseLeave={() => {
                        setHoveredItemName(null)
                        scheduleMenuClose()
                      }}
                    >
                      <div
                        className={cn(navButtonClass, active || isOpen ? "text-white" : "text-white/70")}
                      >
                        <Link
                          href={item.href}
                          onClick={() => {
                            cancelMenuClose()
                            setHoveredItemName(null)
                            setOpenMenu(null)
                            scrollHomeToTop(item.href)
                          }}
                          className="inline-flex h-full items-center"
                        >
                          <span>{item.name}</span>
                        </Link>
                        <button
                          type="button"
                          onMouseEnter={() => {
                            cancelMenuClose()
                            setHoveredItemName(item.name)
                            setOpenMenu(item.name)
                          }}
                          onClick={() => {
                            cancelMenuClose()
                            setHoveredItemName(item.name)
                            setOpenMenu((current) => (current === item.name ? null : item.name))
                          }}
                          aria-expanded={isOpen}
                          aria-haspopup="menu"
                          aria-label={`展开${item.name}菜单`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isOpen && "rotate-180 text-white",
                            )}
                          />
                        </button>
                        {highlighted ? <NavUnderline /> : null}
                      </div>
                      {isOpen ? (
                        <span
                          aria-hidden
                          className="absolute left-1/2 top-full z-40 h-3 w-96 -translate-x-1/2"
                        />
                      ) : null}
                      <AnimatePresence>
                        {isOpen ? (
                          <motion.div
                            key={`${item.name}-dropdown`}
                            initial={{ opacity: 0, x: "-50%", y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: "-50%", y: 6, scale: 0.96 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute left-1/2 top-full z-50 mt-3 w-96 overflow-hidden rounded-[28px] border border-cyan-100/15 bg-black/[0.86] p-2 shadow-[0_28px_80px_rgba(0,0,0,0.62)] backdrop-blur-2xl"
                            role="menu"
                          >
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(80,160,255,0.12),transparent_35%),radial-gradient(circle_at_92%_16%,rgba(80,255,200,0.10),transparent_32%)]" />
                            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent" />
                            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                              {getMenuLabel(item.name)}
                            </div>
                            <div className="my-1 h-px bg-white/10" />
                            {item.menuItems.map((menuItem) => (
                              <Link
                                key={menuItem.href}
                                href={menuItem.href}
                                onClick={() => {
                                  cancelMenuClose()
                                  setHoveredItemName(null)
                                  setOpenMenu(null)
                                }}
                                className="relative flex flex-col gap-1 rounded-2xl px-3 py-3 text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                                role="menuitem"
                              >
                                <span className="font-medium">{menuItem.name}</span>
                                {menuItem.description ? (
                                  <span className="text-xs leading-5 text-white/40">{menuItem.description}</span>
                                ) : null}
                              </Link>
                            ))}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => scrollHomeToTop(item.href)}
                    onMouseEnter={() => {
                      cancelMenuClose()
                      setOpenMenu(null)
                      setHoveredItemName(item.name)
                    }}
                    onMouseLeave={() => {
                      setHoveredItemName(null)
                    }}
                    className={cn(navButtonClass, active ? "text-white" : "text-white/70")}
                  >
                    <span>{item.name}</span>
                    {highlighted ? <NavUnderline /> : null}
                  </Link>
                )
              })}
            </div>
          </LayoutGroup>
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-4">
          <div className="hidden items-center gap-3 rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-4 py-2.5 shadow-[0_0_24px_rgba(52,211,153,0.12)] lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse" />
            <span className="font-mono text-[10px] font-bold leading-none text-emerald-100/70">NODE_01: ONLINE</span>
          </div>
          <NavBarAuthActions />
        </div>
      </motion.div>
    </nav>
  )
}

import Link from "next/link"
import { NavBarAuthActions } from "@/components/nav-bar-auth-actions"

type NavItem = {
  name: string
  href: string
  iconLabel: string
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
    iconLabel: "US",
  },
  {
    name: "申根签证",
    href: "/schengen-visa",
    iconLabel: "EU",
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
    iconLabel: "审",
    menuItems: [
      {
        name: "单独材料审核",
        href: "/material-review",
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
    name: "材料定制",
    href: "/material-customization",
    iconLabel: "定",
  },
  {
    name: "申请人档案",
    href: "/applicants",
    iconLabel: "档",
  },
]

function getMenuLabel(itemName: string) {
  if (itemName === "申根签证") return "申根快捷入口"
  if (itemName === "材料审核") return "材料审核入口"
  return "快捷入口"
}

function NavBadge({ children }: { children: string }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1.5 text-[10px] font-black leading-none text-white">
      {children}
    </span>
  )
}

const navButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-950"

export function NavBar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="mr-4 flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-sm font-black text-white">
              签
            </div>
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-lg font-bold text-transparent">
              签证助手
            </span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => {
              if (item.menuItems?.length) {
                return (
                  <details key={item.href} className="group relative">
                    <summary className={`${navButtonClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                      <NavBadge>{item.iconLabel}</NavBadge>
                      <span>{item.name}</span>
                      <span className="text-xs text-gray-400 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="absolute left-0 top-11 z-50 w-72 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                        {getMenuLabel(item.name)}
                      </div>
                      <div className="my-1 h-px bg-gray-100" />
                      {item.menuItems.map((menuItem) => (
                        <Link
                          key={menuItem.href}
                          href={menuItem.href}
                          className="flex flex-col gap-1 rounded-xl px-3 py-3 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span className="font-medium">{menuItem.name}</span>
                          {menuItem.description ? (
                            <span className="text-xs leading-5 text-gray-500">{menuItem.description}</span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  </details>
                )
              }

              return (
                <Link key={item.href} href={item.href} className={navButtonClass}>
                  <NavBadge>{item.iconLabel}</NavBadge>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <NavBarAuthActions />
      </div>
    </nav>
  )
}

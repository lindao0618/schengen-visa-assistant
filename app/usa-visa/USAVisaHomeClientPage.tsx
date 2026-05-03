"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Bot,
  Brain,
  Command,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react"

type UsaTool = {
  title: string
  desc: string
  icon: LucideIcon
  href: string
  metric: string
  color: "blue" | "red" | "emerald"
  tags: string[]
  premium?: boolean
}

const usaTools: UsaTool[] = [
  {
    title: "全自动预约与表单",
    desc: "智能切分业务阶段，自动化校验照片并完成 DS-160 填写与 AIS 注册递交。",
    icon: Command,
    href: "/usa-visa/form-automation",
    metric: "0.1s/Field",
    color: "blue",
    tags: ["表单协同", "无头流转", "云端自动化"],
  },
  {
    title: "AIS Slot 极速狙击",
    desc: "基于边缘节点分布的监控引擎，穿透风控毫秒级响应，实时锁定放出槽位。",
    icon: Target,
    href: "/usa-visa/appointment-booking",
    metric: "18ms Ping",
    color: "red",
    tags: ["高可用集群", "动态风控绕行"],
  },
  {
    title: "AI 面签简报推演",
    desc: "深度解析 160 档案，结合面签官模型生成个性化高频必问 10 题与话术。",
    icon: Brain,
    href: "/usa-visa/form-automation?tab=interview-brief",
    metric: "GPT-4o",
    color: "emerald",
    premium: true,
    tags: ["多模态提取", "风险预测", "考点映射"],
  },
]

const colorMap = {
  blue: {
    icon: "text-blue-400",
    metric: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    spotlight: "pro-spotlight-blue",
  },
  red: {
    icon: "text-red-400",
    metric: "border-red-400/20 bg-red-400/10 text-red-300",
    spotlight: "pro-spotlight-amber",
  },
  emerald: {
    icon: "text-emerald-400",
    metric: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    spotlight: "pro-spotlight-emerald",
  },
} satisfies Record<UsaTool["color"], { icon: string; metric: string; spotlight: string }>

export default function USAVisaHomeClientPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.05),transparent_28rem)]" />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-40 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <section className="pro-spotlight pro-spotlight-blue relative overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] p-8 transition-colors duration-500 md:p-12">
            <div className="relative z-10 flex flex-col justify-between gap-10 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <div className="group relative mb-6 inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5">
                  <Bot className="relative z-10 h-3.5 w-3.5 text-blue-300" />
                  <span className="relative z-10 text-[10px] uppercase tracking-widest font-bold text-white/55">
                    End-to-End Robotics Platform
                  </span>
                </div>

                <h1 className="mb-6 text-5xl font-medium tracking-tight text-white md:text-6xl">
                  美签业务
                  <span className="block text-white">
                    全流程自动化
                  </span>
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-white/50 md:text-lg">
                  打破传统人工作业瓶颈。无缝集成 DS-160 智能填表流水线、AIS
                  实时预约监控与 AI 面签推演能力，提供次世代美签服务解决方案。
                </p>
              </div>

              <div className="flex shrink-0 gap-4">
                <div className="flex flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                    <Zap className="h-3 w-3 text-emerald-300" />
                    RPA Accuracy
                  </div>
                  <div className="font-mono text-4xl font-bold tracking-tighter text-emerald-300">
                    99.9<span className="text-xl">%</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                    <Target className="h-3 w-3 text-red-500" />
                    Sniper Nodes
                  </div>
                  <div className="font-mono text-4xl font-bold tracking-tighter text-red-500">
                    256<span className="text-xl">pt</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {usaTools.map((tool) => {
              const Icon = tool.icon
              const color = colorMap[tool.color]

              return (
                <motion.div
                  key={tool.title}
                  whileHover={{ scale: 1.02, translateY: -4 }}
                  onClick={() => router.push(tool.href)}
                  className={`pro-spotlight ${color.spotlight} ${tool.premium ? "pro-premium-glow" : ""} group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-white/10 active:scale-95 md:p-8`}
                >
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/5 bg-white/[0.04] shadow-inner transition-transform group-hover:scale-110">
                      <Icon className={`h-6 w-6 ${color.icon}`} />
                    </div>

                    <h2 className="mb-3 truncate text-xl font-bold tracking-tight text-white">{tool.title}</h2>
                    <span className={`mb-4 rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold ${color.metric}`}>
                      {tool.metric}
                    </span>

                    <p className="mb-6 flex-1 text-sm leading-relaxed text-white/40">{tool.desc}</p>

                    <div className="mt-auto flex flex-wrap gap-2">
                      {tool.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50 backdrop-blur-sm transition group-hover:bg-white/10"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex w-full items-center justify-between border-t border-white/5 pt-6 opacity-55 transition-opacity group-hover:opacity-100">
                    <span className="text-xs font-bold">进入模块</span>
                    <span className="pro-cta-glow inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </section>
        </motion.div>
      </main>
    </div>
  )
}

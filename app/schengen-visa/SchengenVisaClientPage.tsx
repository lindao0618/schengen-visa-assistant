"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Calendar,
  ChevronRight,
  FileCheck2,
  FileText,
  Globe2,
  Plane,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react"

import { AnimatedSection } from "@/components/ui/animated-section"

type EngineTool = {
  id: string
  title: string
  desc: string
  metric: string
  tags: string[]
  icon: LucideIcon
  link: string
  active?: boolean
}

const engineTools: EngineTool[] = [
  {
    id: "slot-booking",
    title: "Slot 极速预约",
    desc: "自研毫秒级监控引擎，深度集成 VFS、TLS、BLS 等多国签证中心接口，秒杀放出名额。",
    metric: "12ms",
    tags: ["VFS Sync", "TLS Radar", "Auto Retry"],
    icon: Calendar,
    link: "/schengen-visa/slot-booking",
    active: true,
  },
  {
    id: "automation",
    title: "自动化填表引擎",
    desc: "一键映射个人主档案到各国领事馆特定格式，拒绝繁琐的重复录入，提升效率 80%。",
    metric: "AI Core",
    tags: ["Profile Map", "Form Engine", "Error Guard"],
    icon: FileText,
    link: "/schengen-visa/automation",
    active: true,
  },
  {
    id: "materials",
    title: "申根材料准备",
    desc: "根据在读、就业状态动态生成清单，自动区分资产、行程、解释信和补充材料。",
    metric: "Checklist",
    tags: ["Asset", "Itinerary", "Letter"],
    icon: FileCheck2,
    link: "/schengen-visa/materials",
  },
]

const supportedRoutes = [
  { code: "FR", label: "法国", country: "france" },
  { code: "DE", label: "德国", country: "germany" },
  { code: "IT", label: "意大利", country: "italy" },
  { code: "ES", label: "西班牙", country: "spain" },
  { code: "CH", label: "瑞士", country: "switzerland" },
]

const routeSignalPanels = [
  { label: "Capacity", value: "18", meta: "active slot windows", tone: "emerald" },
  { label: "Embassy SLA", value: "92%", meta: "rule sync coverage", tone: "amber" },
  { label: "Visa Center", value: "5", meta: "TLS / VFS / BLS", tone: "cyan" },
] as const

const routeSignalToneClasses = {
  emerald: {
    wrapper: "border-emerald-300/15 bg-emerald-300/[0.06]",
    dot: "bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.55)]",
    value: "text-emerald-100",
  },
  amber: {
    wrapper: "border-amber-300/15 bg-amber-300/[0.055]",
    dot: "bg-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.48)]",
    value: "text-amber-100",
  },
  cyan: {
    wrapper: "border-cyan-300/15 bg-cyan-300/[0.055]",
    dot: "bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.45)]",
    value: "text-cyan-100",
  },
}

function RouteSignalPanel({ label, value, meta, tone }: (typeof routeSignalPanels)[number]) {
  const toneClasses = routeSignalToneClasses[tone]

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClasses.wrapper}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{label}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${toneClasses.dot}`} />
      </div>
      <div className={`font-mono text-2xl font-black tracking-tight ${toneClasses.value}`}>{value}</div>
      <div className="mt-1 text-[10px] font-medium text-white/32">{meta}</div>
    </div>
  )
}

function EngineCard({
  tool,
  className = "",
  variant = "default",
}: {
  tool: EngineTool
  className?: string
  variant?: "default" | "wide" | "tall"
}) {
  const router = useRouter()
  const Icon = tool.icon

  return (
    <motion.div
      whileHover={{ scale: 1.01, translateY: -2 }}
      onClick={() => router.push(tool.link)}
      className={`pro-spotlight ${tool.active ? "pro-spotlight-emerald" : "pro-spotlight-blue"} group relative flex overflow-hidden rounded-[32px] border p-6 transition-all cursor-pointer active:scale-95 md:p-8 ${
        tool.active
          ? "border-white/5 bg-white/[0.02] hover:border-emerald-300/20"
          : "border-white/5 bg-white/[0.02] hover:border-white/10"
      } ${variant === "tall" ? "min-h-[520px]" : variant === "wide" ? "min-h-[245px]" : "min-h-[300px]"} ${className}`}
    >
      {tool.active && (
        <div className="absolute left-0 top-0 h-full w-1 bg-emerald-400/70 shadow-[0_0_24px_rgba(16,185,129,0.22)]" />
      )}

      {tool.active && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle at center, rgba(52,211,153,0.55) 1.5px, transparent 1.5px)",
            backgroundSize: "16px 16px",
          }}
        />
      )}

      <div
        className={`relative z-10 flex min-h-0 flex-1 gap-6 ${
          variant === "wide" ? "flex-col md:flex-row md:items-center" : "flex-col"
        }`}
      >
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] shadow-inner transition-transform group-hover:scale-110 ${
            tool.active
              ? "border border-emerald-400/18 bg-emerald-400/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.12)]"
              : "border border-white/10 bg-white/[0.04]"
          }`}
        >
          <Icon className={`h-7 w-7 ${tool.active ? "text-emerald-300" : "text-white/50"}`} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2
              className={`truncate text-2xl font-black tracking-tight ${
                tool.active ? "text-white" : "text-white"
              }`}
            >
              {tool.title}
            </h2>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold ${
                tool.active
                  ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {tool.active && <Sparkles className="-mt-0.5 mr-1 inline-block h-2.5 w-2.5" />}
              {tool.metric}
            </span>
          </div>

          <p className="max-w-3xl text-sm leading-7 text-white/50">{tool.desc}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {tool.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
                  tool.active
                    ? "border-emerald-400/18 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-white/50 group-hover:bg-white/10"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {variant === "wide" && (
          <div className="relative hidden h-32 w-64 shrink-0 rounded-[24px] border border-white/10 bg-white/[0.03] p-6 md:block">
            <div className="absolute inset-0 rounded-[24px] border border-dashed border-emerald-400/10" />
            <div className="space-y-4">
              <div className="h-2.5 w-14 rounded-full bg-white/10" />
              <div className="h-2.5 w-full rounded-full bg-emerald-400/45" />
              <div className="h-2.5 w-28 rounded-full bg-white/[0.08]" />
              <div className="h-2.5 w-full rounded-full bg-white/[0.08]" />
            </div>
          </div>
        )}

        <div className={`mt-auto ${variant === "wide" ? "w-full md:w-auto" : "w-full"}`}>
          {tool.active ? (
            <button
              type="button"
              className="pro-cta-glow group/btn relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-8 py-4 text-sm font-bold text-black transition-all active:scale-95 md:w-auto"
            >
              启动中央引擎
              <Target className="h-4 w-4 opacity-90 transition-transform group-hover/btn:scale-110" />
            </button>
          ) : (
            <button
              type="button"
              className="group/btn flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-95 md:w-auto"
            >
              快速配置
              <ChevronRight className="h-4 w-4 opacity-50 transition-transform group-hover/btn:translate-x-1" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function SchengenVisaClientPage() {
  const router = useRouter()
  const slotTool = engineTools[0]
  const automationTool = engineTools[1]
  const materialTool = engineTools[2]

  return (
    <div className="min-h-screen overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 16% 0%, rgba(20,184,166,0.08), transparent 28rem), radial-gradient(circle at 86% 6%, rgba(245,158,11,0.05), transparent 26rem), radial-gradient(circle at 52% 30%, rgba(34,211,238,0.045), transparent 32rem), linear-gradient(180deg, #000 0%, #030504 44%, #000 100%)",
        }}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-40 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AnimatedSection>
            <section className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.02] px-4 py-2 text-[10px] uppercase tracking-widest font-black text-white/55">
                <Plane className="h-4 w-4" />
                Schengen Hub
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">申根签证全自动化</h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/50">
                智能调度预约名额、自动生成精准材料清单，化繁为简。
              </p>
            </section>
          </AnimatedSection>

          <AnimatedSection>
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,2fr)]">
              <EngineCard tool={slotTool} variant="tall" className="h-full min-h-[640px]" />

              <div className="flex h-full flex-col gap-6">
                <EngineCard tool={automationTool} variant="wide" />

                <div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
                  <EngineCard tool={materialTool} />

                  <motion.div
                    whileHover={{ scale: 1.01, translateY: -2 }}
                    className="pro-spotlight pro-premium-glow group relative flex min-h-[300px] overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.025] p-8 transition-all hover:border-amber-300/20 active:scale-95"
                  >
                    <div
                      className="absolute inset-0 pointer-events-none opacity-[0.07]"
                      style={{
                        backgroundImage: "radial-gradient(circle at center, rgba(52,211,153,0.72) 1.2px, transparent 1.2px)",
                        backgroundSize: "18px 18px",
                      }}
                    />
                    <div className="pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full bg-amber-300/[0.06] blur-[70px] transition group-hover:bg-amber-300/[0.10]" />
                    <div className="pointer-events-none absolute -bottom-28 left-6 h-56 w-56 rounded-full bg-emerald-300/[0.055] blur-[70px]" />

                    <div className="relative z-10 flex h-full flex-col">
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/42">
                            <Globe2 className="h-4 w-4" />
                            Supported Routes
                          </div>
                          <h3 className="mt-4 text-2xl font-black tracking-tight text-white">Live Route Matrix</h3>
                          <p className="mt-2 max-w-sm text-xs leading-6 text-white/42">
                            按国家规则、签证中心和预约容量同步路由状态，避免卡片内部留白。
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-white/70" />
                      </div>

                      <div className="mb-6 grid gap-3 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                        {routeSignalPanels.map((panel) => (
                          <RouteSignalPanel key={panel.label} {...panel} />
                        ))}
                      </div>

                      <div className="mt-auto grid grid-cols-5 gap-2">
                        {supportedRoutes.map((route) => (
                          <button
                            key={route.code}
                            type="button"
                            onClick={() => router.push(`/schengen-visa/${route.country}`)}
                            className="group/route relative overflow-hidden rounded-2xl border border-white/5 bg-black/20 px-2 py-4 text-center transition hover:border-emerald-400/25 hover:bg-emerald-400/10"
                          >
                            <span className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            <div className="text-2xl font-black tracking-[0.08em] text-white/62 transition group-hover/route:text-white">
                              {route.code}
                            </div>
                            <div className="mt-2 text-[10px] font-bold text-white/35">{route.label}</div>
                            <div className="mx-auto mt-3 h-1 w-8 rounded-full bg-emerald-300/35 transition group-hover/route:w-10 group-hover/route:bg-emerald-200" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </main>
    </div>
  )
}

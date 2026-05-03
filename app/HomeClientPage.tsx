"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import {
  Activity,
  ArrowRight,
  Bot,
  Clock,
  Database,
  FileCheck,
  Globe2,
  RadioTower,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ProCard } from "@/components/pro-ui/pro-card"
import { ProShell } from "@/components/pro-ui/pro-shell"
import { ProStatus } from "@/components/pro-ui/pro-status"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
}

const metricCards = [
  {
    label: "全球成功率",
    value: "95%+",
    detail: "Global Success Rate",
    tone: "emerald",
    chart: "line",
    dataKey: "score",
    data: [
      { label: "D1", score: 86 },
      { label: "D2", score: 91 },
      { label: "D3", score: 89 },
      { label: "D4", score: 94 },
      { label: "D5", score: 92 },
      { label: "D6", score: 96 },
      { label: "D7", score: 95 },
    ],
  },
  {
    label: "活跃申请",
    value: "1,248",
    detail: "Active Requests",
    tone: "cyan",
    chart: "bar",
    dataKey: "count",
    data: [
      { label: "D1", count: 142 },
      { label: "D2", count: 168 },
      { label: "D3", count: 151 },
      { label: "D4", count: 196 },
      { label: "D5", count: 176 },
      { label: "D6", count: 221 },
      { label: "D7", count: 194 },
    ],
  },
  {
    label: "自动化处理延迟",
    value: "14pt",
    detail: "Latency Optimized",
    tone: "amber",
    chart: "line",
    dataKey: "latency",
    data: [
      { label: "D1", latency: 28 },
      { label: "D2", latency: 24 },
      { label: "D3", latency: 21 },
      { label: "D4", latency: 19 },
      { label: "D5", latency: 17 },
      { label: "D6", latency: 15 },
      { label: "D7", latency: 14 },
    ],
  },
] as const

const oversightTrend = [
  { day: "Mon", applications: 82 },
  { day: "Tue", applications: 126 },
  { day: "Wed", applications: 108 },
  { day: "Thu", applications: 158 },
  { day: "Fri", applications: 141 },
  { day: "Sat", applications: 176 },
  { day: "Sun", applications: 149 },
]

const oversightStats = [
  { icon: FileCheck, label: "审核通过率", value: "89.4%", detail: "Audit pass" },
  { icon: Clock, label: "平均审核时长", value: "04m", detail: "Avg review" },
  { icon: RadioTower, label: "平均预约耗时", value: "24h", detail: "Slot pulse" },
  { icon: ShieldCheck, label: "安全文档评分", value: "AES", detail: "Secure docs" },
]

const processSteps = [
  {
    title: "身份验证",
    description: "Passport + profile match",
    status: "Verified",
    progress: 100,
    icon: UserCheck,
    tone: "emerald",
  },
  {
    title: "材料交叉核验",
    description: "Funds / itinerary / hotel logic",
    status: "Running",
    progress: 72,
    icon: SearchCheck,
    tone: "cyan",
  },
  {
    title: "预约监控",
    description: "TLS / AIS slot telemetry",
    status: "Live",
    progress: 58,
    icon: RadioTower,
    tone: "amber",
  },
  {
    title: "面签简报",
    description: "Interview brief generation",
    status: "Queued",
    progress: 34,
    icon: Bot,
    tone: "slate",
  },
] as const

const services = [
  {
    name: "申根签证",
    description: "法国、德国、西班牙等申根材料清单、预约监控和自动化流程。",
    href: "/schengen-visa",
    tag: "Schengen Hub",
    status: "Active",
    icon: Globe2,
    accent: "cyan",
  },
  {
    name: "美国签证",
    description: "DS-160、AIS 账号、付款流、面试材料和签证任务状态。",
    href: "/usa-visa",
    tag: "DS-160 Sync",
    status: "Online",
    icon: Database,
    accent: "emerald",
  },
  {
    name: "综合材料审核",
    description: "交叉比对行程、酒店、资金和身份链，提前发现高风险材料。",
    href: "/material-review/comprehensive",
    tag: "Logic Engine",
    status: "Realtime",
    icon: ShieldCheck,
    accent: "amber",
  },
  {
    name: "AI 签证顾问",
    description: "根据国家、所在地和申请人身份，生成可执行的签证建议。",
    href: "/ai-assistant",
    tag: "RAG Console",
    status: "Ready",
    icon: Bot,
    accent: "sky",
  },
] as const

const accentClasses = {
  emerald: {
    text: "text-emerald-300",
    bg: "bg-emerald-400",
    glow: "shadow-[0_0_32px_rgba(52,211,153,0.28)]",
    border: "group-hover:border-emerald-300/30",
    haze: "bg-emerald-400/20",
    stroke: "#34d399",
  },
  cyan: {
    text: "text-cyan-300",
    bg: "bg-cyan-400",
    glow: "shadow-[0_0_32px_rgba(34,211,238,0.28)]",
    border: "group-hover:border-cyan-300/30",
    haze: "bg-cyan-400/20",
    stroke: "#22d3ee",
  },
  amber: {
    text: "text-amber-300",
    bg: "bg-amber-400",
    glow: "shadow-[0_0_32px_rgba(251,191,36,0.24)]",
    border: "group-hover:border-amber-300/30",
    haze: "bg-amber-400/20",
    stroke: "#fbbf24",
  },
  sky: {
    text: "text-sky-300",
    bg: "bg-sky-400",
    glow: "shadow-[0_0_32px_rgba(56,189,248,0.26)]",
    border: "group-hover:border-sky-300/30",
    haze: "bg-sky-400/20",
    stroke: "#38bdf8",
  },
  slate: {
    text: "text-white/42",
    bg: "bg-white/35",
    glow: "shadow-[0_0_24px_rgba(255,255,255,0.14)]",
    border: "group-hover:border-white/20",
    haze: "bg-white/10",
    stroke: "#94a3b8",
  },
} as const

export default function HomeClientPage() {
  const router = useRouter()
  const { status } = useSession()

  const handleStartApplication = () => {
    if (status === "loading") return
    router.push(status === "authenticated" ? "/dashboard" : "/login")
  }

  return (
    <ProShell innerClassName="pt-32 sm:pt-36">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-24">
        <motion.header
          variants={itemVariants}
          className="grid gap-8 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_32rem] lg:items-start"
        >
          <div className="space-y-7">
            <ProStatus tone="info" className="rounded-lg">
              VISTORIA 618 PRO
            </ProStatus>
            <div className="space-y-5">
              <h1 className="max-w-4xl bg-gradient-to-r from-white via-cyan-100 to-emerald-200 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
                Architecture of Trust
              </h1>
              <p className="max-w-2xl text-base leading-8 text-white/52 sm:text-lg">
                为签证团队和申请人打造的 AI 自动化工作台，统一处理申根、美签、材料审核、预约监控和申请进度。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleStartApplication}
                disabled={status === "loading"}
                className="inline-flex h-12 items-center justify-center gap-3 rounded-2xl bg-cyan-100 px-6 text-sm font-bold text-black shadow-[0_0_34px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                进入工作台
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                href="/ai-assistant"
                className="inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.08] hover:text-cyan-100"
              >
                咨询 AI 顾问
                <Sparkles className="h-4 w-4 text-cyan-300" />
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:pt-4">
            {metricCards.map((metric) => (
              <MetricGlassCard key={metric.label} metric={metric} />
            ))}
          </div>
        </motion.header>

        <motion.section variants={itemVariants} className="grid gap-8 lg:grid-cols-12">
          <ProCard className="relative min-h-[560px] overflow-hidden p-7 sm:p-10 lg:col-span-8">
            <div className="pointer-events-none absolute -right-28 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1">
                    <Activity className="h-3 w-3 text-cyan-300" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/38">
                      Real-time Dashboard
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Intelligence Oversight</h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-white/42">
                      以材料一致性、预约状态、DS-160 数据和面试准备为核心，持续扫描近 7 天申请趋势与关键风险点。
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ProStatus tone="online">SECURED</ProStatus>
                  <ProStatus tone="info">AUTO SYNC</ProStatus>
                </div>
              </div>

              <div className="relative h-64 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025] p-4">
                <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-px opacity-30" />
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={oversightTrend} margin={{ top: 12, right: 6, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.34)", fontSize: 11 }}
                    />
                    <YAxis hide domain={[0, 200]} />
                    <Tooltip
                      cursor={{ fill: "rgba(34,211,238,0.08)" }}
                      contentStyle={{
                        background: "rgba(0,0,0,0.84)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 16,
                        color: "#fff",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.58)" }}
                    />
                    <Bar dataKey="applications" radius={[14, 14, 4, 4]} fill="url(#oversightGradient)" />
                    <defs>
                      <linearGradient id="oversightGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.92} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.28} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-4">
                {oversightStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/28">
                      <stat.icon className="h-3.5 w-3.5" />
                      {stat.detail}
                    </div>
                    <div className="mt-3 text-xl font-bold text-white">{stat.value}</div>
                    <div className="mt-1 text-xs text-white/42">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </ProCard>

          <ProCard className="relative overflow-hidden p-7 lg:col-span-4">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative z-10 mb-8 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Process Stream</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.95)]" />
            </div>
            <div className="relative z-10 space-y-6">
              {processSteps.map((step, index) => {
                const accent = accentClasses[step.tone]
                return (
                  <div key={step.title} className="group relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4">
                    {index < processSteps.length - 1 ? (
                      <div className="absolute left-[1.35rem] top-12 h-[calc(100%+0.75rem)] w-px bg-white/10" />
                    ) : null}
                    <div className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] ${accent.text} ${accent.glow}`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${accent.text}`}>
                          {step.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/38">{step.description}</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`${accent.bg} h-full rounded-full ${accent.glow}`}
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ProCard>
        </motion.section>

        <motion.section id="core-infrastructure" variants={itemVariants} className="space-y-10 border-t border-white/10 pt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Core Infrastructure</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">核心服务模块</h2>
            </div>
            <Link href="/dashboard" className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 transition hover:text-cyan-100">
              See all modules
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => {
              const accent = accentClasses[service.accent]
              return (
                <Link key={service.href} href={service.href} className="group block">
                  <ProCard
                    className={`relative flex min-h-[320px] flex-col overflow-hidden p-7 transition duration-300 hover:-translate-y-1 ${accent.border}`}
                  >
                    <div
                      className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full blur-[60px] transition-all duration-300 group-hover:scale-150 ${accent.haze}`}
                    />
                    <div className="relative z-10 flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white transition duration-300 group-hover:scale-110 group-hover:bg-white group-hover:text-black ${accent.glow}`}>
                        <service.icon className="h-6 w-6" />
                      </div>
                      <div className="text-right">
                        <div className="rounded-md bg-white/[0.05] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/35">
                          {service.tag}
                        </div>
                        <div className={`mt-2 text-[10px] font-bold uppercase ${accent.text}`}>{service.status}</div>
                      </div>
                    </div>
                    <div className="relative z-10 mt-10">
                      <h3 className="text-xl font-bold text-white">{service.name}</h3>
                      <p className="mt-4 text-sm leading-7 text-white/42">{service.description}</p>
                    </div>
                    <div className="relative z-10 mt-auto pt-8">
                      <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 transition group-hover:text-white">
                        Interface Start
                        <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
                      </div>
                    </div>
                  </ProCard>
                </Link>
              )
            })}
          </div>
        </motion.section>

        <motion.footer variants={itemVariants} className="border-t border-white/10 pt-10 text-sm text-white/35">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>VISTORIA.PRO</span>
            <span>Visa automation, material intelligence, appointment operations.</span>
          </div>
        </motion.footer>
      </motion.div>
    </ProShell>
  )
}

function MetricGlassCard({ metric }: { metric: (typeof metricCards)[number] }) {
  const accent = accentClasses[metric.tone]
  const chartColor = accent.stroke

  return (
    <ProCard className="relative overflow-hidden p-6">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full ${accent.haze} blur-3xl`} />
      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">{metric.detail}</div>
          <div className="mt-3 text-4xl font-bold tracking-tight text-white">{metric.value}</div>
          <div className={`mt-3 text-[10px] font-bold uppercase tracking-[0.16em] ${accent.text}`}>{metric.label}</div>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            {metric.chart === "bar" ? (
              <BarChart data={[...metric.data]} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey={metric.dataKey} radius={[6, 6, 2, 2]} fill={chartColor} fillOpacity={0.72} />
              </BarChart>
            ) : (
              <LineChart data={[...metric.data]} margin={{ top: 8, right: 4, left: 4, bottom: 8 }}>
                <Line
                  type="monotone"
                  dataKey={metric.dataKey}
                  stroke={chartColor}
                  strokeWidth={2.4}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </ProCard>
  )
}

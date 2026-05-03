"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  FileCheck2,
  Layers3,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react"

import { cn } from "@/lib/utils"

const auditModes = [
  {
    title: "综合材料逻辑审核",
    eyebrow: "Recommended",
    description:
      "交叉分析行程单、机票预订单与酒店确认函，识别时间链冲突、姓名拼写偏差和潜在拒签风险。",
    href: "/material-review/comprehensive",
    action: "Start full-chain scan",
    tone: "amber",
    icon: Layers3,
  },
  {
    title: "单独材料格式审计",
    eyebrow: "File-level",
    description:
      "针对单份 PDF、护照扫描件、银行流水、保险单进行合规性检查，适合前置排雷和补件复核。",
    href: "/material-review/individual",
    action: "Audit individual files",
    tone: "blue",
    icon: FileCheck2,
  },
] as const

const riskIssues = [
  {
    severity: "CRITICAL",
    code: "E-042",
    message: "Flight out date exceeds Visa duration by 2 days.",
    detail: "Return flight conflicts with declared Schengen stay window.",
    tone: "red",
  },
  {
    severity: "WARNING",
    code: "W-109",
    message: "Hotel in Paris is not fully paid (Required for FR).",
    detail: "Booking confirmation misses prepaid settlement proof.",
    tone: "amber",
  },
  {
    severity: "NOTICE",
    code: "N-201",
    message: "Bank statement is older than 14 days.",
    detail: "Refresh recommended before final submission package.",
    tone: "blue",
  },
] as const

const issueToneClassMap = {
  red: "border-red-500/22 bg-red-950/80 text-red-100",
  amber: "border-amber-500/24 bg-amber-950/75 text-amber-100",
  blue: "border-blue-500/22 bg-slate-950/85 text-blue-100",
}

const issueDotClassMap = {
  red: "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.7)]",
  amber: "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)]",
  blue: "bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.7)]",
}

function AuditModeCard({ mode }: { mode: (typeof auditModes)[number] }) {
  const Icon = mode.icon
  const isAmber = mode.tone === "amber"

  return (
    <Link
      href={mode.href}
      className={cn(
        "glass-card-dark group relative min-h-[280px] overflow-hidden rounded-[32px] p-7 transition-all duration-300 active:scale-[0.99]",
        isAmber ? "hover:border-amber-500/30" : "hover:border-blue-500/30",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-[70px] transition-opacity duration-300",
          isAmber ? "bg-amber-500/0 group-hover:bg-amber-500/10" : "bg-blue-500/0 group-hover:bg-blue-500/10",
        )}
      />
      <div className="relative z-10 flex h-full flex-col justify-between gap-10">
        <div className="flex items-start justify-between gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.04] text-white transition-all duration-300",
              isAmber
                ? "group-hover:border-amber-500 group-hover:bg-amber-500 group-hover:text-black"
                : "group-hover:border-blue-400 group-hover:bg-blue-400 group-hover:text-black",
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
              isAmber
                ? "border-amber-400/15 bg-amber-400/10 text-amber-300"
                : "border-blue-400/15 bg-blue-400/10 text-blue-300",
            )}
          >
            {mode.eyebrow}
          </span>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-white">{mode.title}</h2>
            <p className="max-w-xl text-sm leading-7 text-white/42">{mode.description}</p>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
              isAmber ? "text-amber-300" : "text-blue-300",
            )}
          >
            {mode.action}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}

function ScannerArea() {
  const isScanning = true

  return (
    <section className="glass-card-dark relative overflow-hidden rounded-[32px] p-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.035)_1px,transparent_1px)] bg-[size:34px_34px]" />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80">Dynamic Scanner Line</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">时间链与身份链扫描器</h2>
            <p className="mt-1 text-sm text-white/38">正在交叉比对行程单、机票与酒店确认函。</p>
          </div>
          <button className="pro-cta-glow rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-black active:scale-95">
            Re-audit
          </button>
        </div>

        <div className="relative min-h-[318px] overflow-hidden rounded-[28px] border border-white/5 bg-black/35 p-5">
          {isScanning ? (
            <motion.div
              aria-hidden="true"
              animate={{ top: ["0%", "100%", "0%"] }}
              className="pointer-events-none absolute left-0 right-0 z-0 h-[2px] bg-amber-500/25 shadow-[0_0_28px_rgba(251,191,36,0.38)]"
              transition={{ duration: 4.6, repeat: Infinity, ease: "linear" }}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-24 -translate-y-1/2 bg-amber-500/[0.035] blur-3xl" />

          <div className="relative z-10 space-y-4">
            {riskIssues.map((issue, index) => (
              <motion.div
                key={issue.code}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.36 }}
                className={cn("relative overflow-hidden rounded-3xl border p-5", issueToneClassMap[issue.tone])}
              >
                <span className={cn("absolute left-5 top-5 h-2 w-2 rounded-full", issueDotClassMap[issue.tone])}>
                  <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
                </span>
                <div className="ml-7 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/38">
                      {issue.severity} - {issue.code}
                    </p>
                    <p className="mt-2 text-sm font-bold text-white">{issue.message}</p>
                    <p className="mt-1 text-xs text-white/42">{issue.detail}</p>
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/35 underline underline-offset-4">
                    Fix
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ConsoleTerminal() {
  return (
    <section className="glass-card-dark relative overflow-hidden rounded-[32px] p-7">
      <div className="pointer-events-none absolute -right-20 top-6 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="relative z-10 flex items-center gap-3">
        <TerminalSquare className="h-5 w-5 text-emerald-300" />
        <h2 className="text-xl font-bold tracking-tight text-white">合规报告 (JSON)</h2>
      </div>

      <div className="relative z-10 mt-6 overflow-hidden rounded-3xl border border-white/8 bg-black/50">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">Console Terminal</span>
        </div>
        <pre className="overflow-x-auto p-6 font-mono text-[10px] leading-6 text-emerald-400">
{`{
  "visa_type": "SCHENGEN_FRANCE",
  "engine": "DEEP_COMPLIANCE_AUDIT",
  "compliance_score": 0.82,
  "risks": [
    "HOTEL_UNPAID",
    "TIMELINE_OVERLAP"
  ],
  "engine_version": "v4.0.1_BETA",
  "timestamp": "2026-05-02T06:54:20.274Z"
}`}
        </pre>
      </div>
    </section>
  )
}

function ExpertCta() {
  return (
    <motion.section
      whileHover={{ scale: 1.02 }}
      className="group relative overflow-hidden rounded-[40px] border border-white/8 bg-gradient-to-br from-white/10 to-transparent p-8"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-[80px] transition-colors duration-300 group-hover:bg-white/20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_100%,rgba(16,185,129,0.14),transparent_35%)]" />
      <div className="relative z-10 space-y-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/42">Holographic Promo Card</p>
          <h2 className="max-w-xs text-2xl font-bold tracking-tight text-white">需要专家顾问实时介入?</h2>
          <p className="text-sm leading-7 text-white/50">
            针对审核中的 Critical 错误点，由资深顾问提供 1 对 1 修订方案，提升最终递签通过率。
          </p>
        </div>
        <Link
          href="/ai-assistant"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold uppercase tracking-widest text-black active:scale-95"
        >
          Invoke expert
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.section>
  )
}

export default function AuditEngineHomeClientPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-black px-4 pb-20 pt-36 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_86%_8%,rgba(16,185,129,0.14),transparent_32%)]" />
      <div className="relative mx-auto max-w-7xl space-y-10">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Audit Engine V4
            </div>
            <div className="space-y-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">
                Deep Compliance Audit Engine
              </p>
              <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-white md:text-6xl">
                材料合规性深度审计
              </h1>
              <p className="max-w-3xl text-base leading-8 text-white/55">
                面向签证团队的 AI 诊断引擎，统一处理综合材料逻辑、单文件格式、时间链、身份链与付款证明风险。
              </p>
            </div>
          </div>

          <div className="glass-card-dark relative overflow-hidden rounded-[32px] p-6">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-56 bg-emerald-400/10 blur-3xl" />
            <div className="relative z-10 grid grid-cols-3 gap-4">
              {[
                ["95%+", "风险定位率"],
                ["1,248", "历史扫描"],
                ["14pt", "延迟优化"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                  <div className="font-mono text-2xl font-bold text-white">{value}</div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {auditModes.map((mode) => (
            <AuditModeCard key={mode.href} mode={mode} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <ScannerArea />
          <div className="space-y-6">
            <ConsoleTerminal />
            <ExpertCta />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: ScanLine, label: "Timeline Diff", text: "时间链差异扫描" },
            { icon: AlertTriangle, label: "Risk Ledger", text: "拒签风险账本" },
            { icon: BadgeCheck, label: "Final Gate", text: "递签前合规闸口" },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="glass-card-dark min-h-[148px] rounded-[28px] p-6">
                <Icon className="h-5 w-5 text-white/58" />
                <div className="mt-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{item.label}</p>
                  <p className="text-sm font-semibold leading-6 text-white">{item.text}</p>
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </main>
  )
}

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ProCardProps = {
  children: ReactNode
  className?: string
}

export function ProCard({ children, className }: ProCardProps) {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_18px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-500 hover:border-white/20",
        className,
      )}
    >
      {children}
    </div>
  )
}

type ProMetricCardProps = {
  label: string
  value: string
  detail: string
  accent?: "blue" | "green" | "amber" | "white"
  className?: string
}

const metricAccentClass = {
  blue: "text-blue-400",
  green: "text-emerald-400",
  amber: "text-amber-400",
  white: "text-white/50",
}

export function ProMetricCard({ label, value, detail, accent = "blue", className }: ProMetricCardProps) {
  return (
    <ProCard className={cn("p-6", className)}>
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">{label}</div>
      <div className="mt-3 text-4xl font-bold tracking-tight text-white">{value}</div>
      <div className={cn("mt-3 text-[10px] font-bold uppercase tracking-[0.16em]", metricAccentClass[accent])}>
        {detail}
      </div>
    </ProCard>
  )
}

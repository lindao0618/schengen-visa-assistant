import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ProStatusProps = {
  children: ReactNode
  tone?: "online" | "info" | "warning" | "danger" | "muted"
  className?: string
}

const toneClass = {
  online: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 before:bg-emerald-400",
  info: "border-blue-400/20 bg-blue-400/10 text-blue-300 before:bg-blue-400",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-300 before:bg-amber-400",
  danger: "border-red-400/20 bg-red-400/10 text-red-300 before:bg-red-400",
  muted: "border-white/10 bg-white/5 text-white/45 before:bg-white/30",
}

export function ProStatus({ children, tone = "online", className }: ProStatusProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] before:h-1.5 before:w-1.5 before:rounded-full",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

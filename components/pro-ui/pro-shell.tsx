import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ProShellProps = {
  children: ReactNode
  className?: string
  innerClassName?: string
}

export function ProShell({ children, className, innerClassName }: ProShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen overflow-hidden bg-black text-white selection:bg-white selection:text-black",
        className,
      )}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(59,130,246,0.18),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(16,185,129,0.12),transparent_24rem),linear-gradient(180deg,#000,#050505_42%,#000)]" />
      <div className={cn("relative mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8", innerClassName)}>
        {children}
      </div>
    </div>
  )
}

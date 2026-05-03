import Link from "next/link"
import Image from "next/image"

import { cn } from "@/lib/utils"

type ProLogoProps = {
  className?: string
  href?: string
  compact?: boolean
}

export function ProLogo({ className, href = "/", compact = false }: ProLogoProps) {
  const content = (
    <>
      <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-cyan-100/30 bg-white/95 p-1.5 shadow-[0_0_42px_rgba(56,189,248,0.30)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_54px_rgba(80,255,200,0.28)]">
        <Image
          src="/brand/qianshengji-logo.png"
          alt="签胜纪"
          width={500}
          height={500}
          className="h-full w-full object-contain"
          priority
        />
      </span>
      <span
        aria-label="VISTORIA.PRO"
        className={cn(
          "text-base font-black tracking-tight",
          compact && "sr-only sm:not-sr-only",
        )}
      >
        <span className="text-white">VISTORIA.</span>
        <span className="bg-gradient-to-r from-cyan-200 via-emerald-200 to-mint-200 bg-clip-text text-transparent">
          PRO
        </span>
      </span>
    </>
  )

  if (!href) {
    return (
      <div aria-label="VISTORIA.PRO" className={cn("group inline-flex items-center gap-3", className)}>
        {content}
      </div>
    )
  }

  return (
    <Link href={href} aria-label="VISTORIA.PRO" className={cn("group inline-flex items-center gap-3", className)}>
      {content}
    </Link>
  )
}

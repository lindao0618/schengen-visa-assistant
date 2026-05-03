"use client"

import { useEffect } from "react"

export function ProSpotlightProvider() {
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const spotlight = (target?.closest(".pro-spotlight") ||
        target?.closest(".pro-focus-glow")) as HTMLElement | null
      if (!spotlight) return

      const rect = spotlight.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      spotlight.style.setProperty("--spotlight-x", `${x}px`)
      spotlight.style.setProperty("--spotlight-y", `${y}px`)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    return () => window.removeEventListener("pointermove", handlePointerMove)
  }, [])

  return null
}

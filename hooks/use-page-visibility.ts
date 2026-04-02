"use client"

import { useEffect, useState } from "react"

function getInitialVisibility() {
  if (typeof document === "undefined") return true
  return document.visibilityState !== "hidden"
}

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(getInitialVisibility)

  useEffect(() => {
    if (typeof document === "undefined") return

    const syncVisibility = () => {
      setIsVisible(document.visibilityState !== "hidden")
    }

    syncVisibility()
    document.addEventListener("visibilitychange", syncVisibility)
    window.addEventListener("focus", syncVisibility)

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility)
      window.removeEventListener("focus", syncVisibility)
    }
  }, [])

  return isVisible
}

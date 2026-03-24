"use client"
import type React from "react"

// 简化的主题提供者，仅支持白天模式
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}


"use client"

import type { ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("zh-CN", { hour12: false })
}

export function Section({
  title,
  description,
  tone = "slate",
  children,
}: {
  title: string
  description: string
  tone?: "slate" | "sky" | "emerald" | "amber"
  children: ReactNode
}) {
  const toneMap = {
    slate: {
      card: "border-slate-200 bg-white/95",
      title: "text-slate-900",
      desc: "text-slate-500",
    },
    sky: {
      card: "border-sky-200 bg-[linear-gradient(180deg,_#ffffff,_#f0f9ff)]",
      title: "text-sky-950",
      desc: "text-sky-700/80",
    },
    emerald: {
      card: "border-emerald-200 bg-[linear-gradient(180deg,_#ffffff,_#ecfdf5)]",
      title: "text-emerald-950",
      desc: "text-emerald-700/80",
    },
    amber: {
      card: "border-amber-200 bg-[linear-gradient(180deg,_#ffffff,_#fffbeb)]",
      title: "text-amber-950",
      desc: "text-amber-700/80",
    },
  } as const

  const styles = toneMap[tone]
  return (
    <Card className={cn("shadow-sm", styles.card)}>
      <CardHeader>
        <CardTitle className={cn("text-lg font-semibold", styles.title)}>{title}</CardTitle>
        <CardDescription className={cn("text-sm", styles.desc)}>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} />
    </div>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} readOnly className="bg-gray-50" />
    </div>
  )
}

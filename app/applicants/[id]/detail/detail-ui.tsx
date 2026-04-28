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
      rail: "from-slate-950 to-slate-500",
    },
    sky: {
      card: "border-sky-200 bg-[linear-gradient(180deg,_#ffffff,_#f0f9ff)]",
      title: "text-sky-950",
      desc: "text-sky-700/80",
      rail: "from-sky-600 to-cyan-400",
    },
    emerald: {
      card: "border-emerald-200 bg-[linear-gradient(180deg,_#ffffff,_#ecfdf5)]",
      title: "text-emerald-950",
      desc: "text-emerald-700/80",
      rail: "from-emerald-600 to-teal-400",
    },
    amber: {
      card: "border-blue-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fbff)]",
      title: "text-blue-950",
      desc: "text-slate-600",
      rail: "from-blue-500 to-sky-300",
    },
  } as const

  const styles = toneMap[tone]
  return (
    <Card className={cn("relative overflow-hidden rounded-[1.75rem] shadow-sm shadow-slate-200/70", styles.card)}>
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", styles.rail)} />
      <CardHeader className="border-b border-slate-100/80 px-6 py-5">
        <CardTitle className={cn("text-lg font-semibold", styles.title)}>{title}</CardTitle>
        <CardDescription className={cn("text-sm", styles.desc)}>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-6 pt-5">{children}</CardContent>
    </Card>
  )
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</Label>
      {children}
    </div>
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
    <FieldShell label={label}>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-12 rounded-2xl border-slate-200 bg-white shadow-inner shadow-slate-100/60 focus-visible:ring-slate-300"
      />
    </FieldShell>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <FieldShell label={label}>
      <Input value={value} readOnly className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-slate-500" />
    </FieldShell>
  )
}

"use client"

import { useState, type ReactNode } from "react"
import {
  AtSign,
  BookOpen,
  Calendar,
  ChevronDown,
  FileText,
  Fingerprint,
  Hash,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  UserRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type DetailSectionTone = "slate" | "sky" | "emerald" | "amber"

const sectionToneMap = {
  slate: {
    card: "border-white/8 bg-[#161619]",
    title: "text-white",
    desc: "text-white/45",
    rail: "from-white/80 to-white/10",
    nav: "border-white/10 bg-white/[0.04] text-white/72 hover:border-white/20 hover:text-white",
    badge: "outline" as const,
  },
  sky: {
    card: "border-blue-500/18 bg-[#101720]",
    title: "text-white",
    desc: "text-blue-100/55",
    rail: "from-blue-400 to-cyan-300",
    nav: "border-blue-400/20 bg-blue-400/10 text-blue-100 hover:border-blue-300/35",
    badge: "info" as const,
  },
  emerald: {
    card: "border-emerald-500/18 bg-[#0f1915]",
    title: "text-white",
    desc: "text-emerald-100/55",
    rail: "from-emerald-400 to-teal-300",
    nav: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/35",
    badge: "success" as const,
  },
  amber: {
    card: "border-amber-500/18 bg-[#1b1710]",
    title: "text-white",
    desc: "text-amber-100/55",
    rail: "from-amber-400 to-orange-300",
    nav: "border-amber-400/20 bg-amber-400/10 text-amber-100 hover:border-amber-300/35",
    badge: "info" as const,
  },
} as const

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
  tone?: DetailSectionTone
  children: ReactNode
}) {
  const styles = sectionToneMap[tone]
  return (
    <Card className={cn("relative overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/30", styles.card)}>
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", styles.rail)} />
      <CardHeader className="border-b border-white/8 px-6 py-5">
        <CardTitle className={cn("text-lg font-semibold", styles.title)}>{title}</CardTitle>
        <CardDescription className={cn("text-sm", styles.desc)}>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-6 pt-5">{children}</CardContent>
    </Card>
  )
}

export function SectionJumpNav({
  items,
}: {
  items: Array<{
    id: string
    label: string
    helper?: string
    count?: string
    tone?: DetailSectionTone
  }>
}) {
  return (
    <nav className="sticky top-[160px] z-[8] rounded-[1.5rem] border border-white/8 bg-[#101012]/95 p-2 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const styles = sectionToneMap[item.tone || "slate"]
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn("rounded-2xl border px-3 py-3 text-left transition", styles.nav)}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{item.label}</span>
                {item.count ? <Badge variant={styles.badge}>{item.count}</Badge> : null}
              </span>
              {item.helper ? <span className="mt-1 block truncate text-xs opacity-75">{item.helper}</span> : null}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

export function SectionSwitchTabs({
  items,
  activeValue,
  onValueChange,
}: {
  items: Array<{
    value: string
    label: string
    helper?: string
    count?: string
    tone?: DetailSectionTone
  }>
  activeValue: string
  onValueChange: (value: string) => void
}) {
  return (
    <nav className="sticky top-[132px] z-[8] border-b border-white/10 bg-black/80 pb-0 backdrop-blur">
      <div className="flex gap-6 overflow-x-auto">
        {items.map((item) => {
          const active = item.value === activeValue
          const styles = sectionToneMap[item.tone || "slate"]
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => onValueChange(item.value)}
              className={cn(
                "relative shrink-0 border-0 bg-transparent px-0 pb-4 text-left transition",
                active ? "text-white after:absolute after:bottom-[-1px] after:left-0 after:h-0.5 after:w-full after:bg-white" : "text-white/40 hover:text-white/70",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className={cn("truncate text-sm font-semibold", active ? styles.title : "")}>
                  {item.label}
                </span>
                {item.count ? <Badge variant={active ? styles.badge : "outline"}>{item.count}</Badge> : null}
              </span>
              {item.helper ? <span className="mt-1 block max-w-[220px] truncate text-xs opacity-60">{item.helper}</span> : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function GroupedSection({
  id,
  title,
  description,
  tone = "slate",
  countLabel,
  defaultOpen = true,
  headerActions,
  children,
}: {
  id: string
  title: string
  description: string
  tone?: DetailSectionTone
  countLabel?: string
  defaultOpen?: boolean
  headerActions?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const styles = sectionToneMap[tone]

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card id={id} className={cn("scroll-mt-44 relative overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/30", styles.card)}>
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", styles.rail)} />
        <CardHeader className="border-b border-white/8 px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <CollapsibleTrigger className="group flex min-w-0 flex-1 items-start justify-between gap-3 text-left">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className={cn("text-lg font-semibold", styles.title)}>{title}</CardTitle>
                  {countLabel ? <Badge variant={styles.badge}>{countLabel}</Badge> : null}
                </div>
                <CardDescription className={cn("text-sm", styles.desc)}>{description}</CardDescription>
              </div>
              <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-white/35 transition-transform", open ? "rotate-180" : "")} />
            </CollapsibleTrigger>
            {headerActions ? <div className="flex shrink-0 flex-wrap gap-2">{headerActions}</div> : null}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-5 px-6 pb-6 pt-5">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function getFieldIcon(label: string) {
  if (label.includes("姓名") || label.includes("姓")) return <UserRound className="h-4 w-4" />
  if (label.includes("手机") || label.includes("电话")) return <Phone className="h-4 w-4" />
  if (label.includes("邮箱")) return <Mail className="h-4 w-4" />
  if (label.includes("微信")) return <MessageCircle className="h-4 w-4" />
  if (label.includes("护照")) return <BookOpen className="h-4 w-4" />
  if (label.includes("AA") || label.includes("FRA")) return <Hash className="h-4 w-4" />
  if (label.includes("城市") || label.includes("国家")) return <MapPin className="h-4 w-4" />
  if (label.includes("年份") || label.includes("时间") || label.includes("日期")) return <Calendar className="h-4 w-4" />
  if (label.includes("ID") || label.includes("尾号")) return <Fingerprint className="h-4 w-4" />
  if (label.includes("拼音") || label.includes("英文")) return <AtSign className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium text-white/40">{label}</Label>
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
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-white/28">
          {getFieldIcon(label)}
        </span>
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-12 rounded-xl border-white/10 bg-white/[0.07] pl-10 text-white placeholder:text-white/22 focus-visible:ring-2 focus-visible:ring-white/15 disabled:opacity-45"
        />
      </div>
    </FieldShell>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <FieldShell label={label}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-white/25">
          {getFieldIcon(label)}
        </span>
        <Input value={value} readOnly className="h-12 rounded-xl border-white/8 bg-white/[0.035] pl-10 text-white/55" />
      </div>
    </FieldShell>
  )
}

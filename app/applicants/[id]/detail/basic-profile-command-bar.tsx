"use client"

import { Mail, MessageCircle, Phone, Save, ShieldCheck, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function pickContact(phone: string, email: string, wechat: string) {
  if (phone) return { icon: Phone, label: phone }
  if (email) return { icon: Mail, label: email }
  if (wechat) return { icon: MessageCircle, label: wechat }
  return { icon: Phone, label: "未填写联系方式" }
}

export function BasicProfileCommandBar({
  name,
  phone,
  email,
  wechat,
  passportNumber,
  passportLast4,
  isReadOnlyViewer,
  canEditApplicant,
  savingProfile,
  onSaveProfile,
}: {
  name: string
  phone: string
  email: string
  wechat: string
  passportNumber: string
  passportLast4?: string | null
  isReadOnlyViewer: boolean
  canEditApplicant: boolean
  savingProfile: boolean
  onSaveProfile: () => Promise<void>
}) {
  const contact = pickContact(phone.trim(), email.trim(), wechat.trim())
  const ContactIcon = contact.icon
  const displayName = name.trim() || "未填写姓名"
  const passportLabel = passportNumber.trim() || (passportLast4 ? `尾号 ${passportLast4}` : "未填写护照号")
  const accessLabel = isReadOnlyViewer || !canEditApplicant ? "只读查看" : "可编辑"

  return (
    <div className="sticky top-3 z-20 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70 backdrop-blur">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-slate-950 via-sky-500 to-emerald-500" />
      <div className="flex flex-col gap-4 p-4 pl-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-slate-100 text-slate-900">
              基础资料
            </Badge>
            <Badge variant="info" className="bg-sky-100 text-sky-800">
              联系方式
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
              护照
            </Badge>
            <Badge variant={canEditApplicant ? "success" : "outline"} className={canEditApplicant ? "" : "border-slate-200 bg-slate-50 text-slate-500"}>
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              {accessLabel}
            </Badge>
          </div>

          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
            <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
              <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate font-semibold text-slate-950">{displayName}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2">
              <ContactIcon className="h-4 w-4 shrink-0 text-sky-600" />
              <span className="truncate">{contact.label}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="truncate">{passportLabel}</span>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void onSaveProfile()}
          disabled={savingProfile || !canEditApplicant}
          className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800 xl:min-w-[150px]"
        >
          <Save className="mr-2 h-4 w-4" />
          {savingProfile ? "保存中..." : "保存基础资料"}
        </Button>
      </div>
    </div>
  )
}

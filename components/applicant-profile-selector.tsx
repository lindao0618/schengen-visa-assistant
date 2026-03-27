"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export interface ApplicantProfileSummary {
  id: string
  label: string
  name?: string
  usVisa?: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
  }
  schengen?: {
    country?: string
    city?: string
  }
  files?: Record<string, unknown>
}

export const ACTIVE_APPLICANT_PROFILE_KEY = "activeApplicantProfileId"

export function ApplicantProfileSelector() {
  const [profiles, setProfiles] = useState<ApplicantProfileSummary[]>([])
  const [selectedId, setSelectedId] = useState("")
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId]
  )

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/applicants", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const nextProfiles = (data.profiles || []) as ApplicantProfileSummary[]
        setProfiles(nextProfiles)
        const savedId = window.localStorage.getItem(ACTIVE_APPLICANT_PROFILE_KEY) || ""
        if (savedId && nextProfiles.some((profile) => profile.id === savedId)) {
          setSelectedId(savedId)
        } else if (nextProfiles[0]) {
          setSelectedId(nextProfiles[0].id)
          window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, nextProfiles[0].id)
        }
      } catch (error) {
        console.error("加载申请人档案失败", error)
      }
    }
    void load()
  }, [])

  const handleChange = (value: string) => {
    setSelectedId(value)
    window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, value)
    window.dispatchEvent(new CustomEvent("active-applicant-profile-changed", { detail: value }))
  }

  return (
    <Card className="mb-6 border-gray-200 bg-white/90 p-4 dark:border-gray-800 dark:bg-gray-950/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900 dark:text-white">当前申请人档案</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            选中后，美签和申根自动化都可以优先复用档案资料。
          </div>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Select value={selectedId} onValueChange={handleChange}>
            <SelectTrigger className="w-full md:w-[320px]">
              <SelectValue placeholder="选择申请人档案" />
            </SelectTrigger>
            <SelectContent>
              {profiles.length === 0 ? (
                <SelectItem value="__empty__" disabled>
                  暂无申请人档案
                </SelectItem>
              ) : (
                profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name || profile.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <Link href="/applicants">管理档案</Link>
          </Button>
        </div>
      </div>
      {activeProfile && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
          <span>姓名: {activeProfile.name || activeProfile.label}</span>
          {activeProfile.usVisa?.aaCode && <span>AA 码: {activeProfile.usVisa.aaCode}</span>}
          {activeProfile.usVisa?.surname && <span>姓: {activeProfile.usVisa.surname}</span>}
          {activeProfile.usVisa?.birthYear && <span>出生年份: {activeProfile.usVisa.birthYear}</span>}
          {activeProfile.usVisa?.passportNumber && <span>护照号: {activeProfile.usVisa.passportNumber}</span>}
          {activeProfile.schengen?.country && <span>申根国家: {activeProfile.schengen.country}</span>}
          {activeProfile.schengen?.city && <span>TLS 递签城市: {activeProfile.schengen.city}</span>}
        </div>
      )}
    </Card>
  )
}

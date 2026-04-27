"use client"

import { useEffect, useState } from "react"
import {
  ACTIVE_APPLICANT_PROFILE_KEY,
  readStoredApplicantCaseId,
  writeStoredApplicantCaseId,
} from "@/lib/applicant-selection-storage"
import {
  APPLICANT_DETAIL_CACHE_TTL_MS,
  getApplicantDetailCacheKey,
  readClientCache,
  writeClientCache,
} from "@/lib/applicant-client-cache"

export interface ActiveApplicantCase {
  id: string
  caseType: string
  visaType?: string | null
  applyRegion?: string | null
  tlsCity?: string | null
  bookingWindow?: string | null
  acceptVip?: string | null
  slotTime?: string | null
  mainStatus: string
  subStatus?: string | null
  exceptionCode?: string | null
  priority: string
  travelDate?: string | null
  submissionDate?: string | null
  assignedToUserId?: string | null
  assignedRole?: string | null
  isActive: boolean
  updatedAt: string
  createdAt: string
}

export interface ActiveApplicantProfile {
  id: string
  label: string
  name?: string
  phone?: string
  email?: string
  wechat?: string
  passportNumber?: string
  passportLast4?: string
  updatedAt?: string
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
  files?: Record<string, { originalName: string }>
  cases?: ActiveApplicantCase[]
  activeCaseId?: string | null
  activeCase?: ActiveApplicantCase | null

  // Legacy fields preserved for old flows that still read them.
  fullName?: string
  surname?: string
  givenName?: string
  birthYear?: string
  birthDate?: string
}

type ApplicantDetailResponse = {
  profile?: ActiveApplicantProfile | null
  cases?: ActiveApplicantCase[]
  activeCaseId?: string | null
}

function resolveActiveCaseId(cases: ActiveApplicantCase[], preferredCaseId?: string | null, fallbackCaseId?: string | null) {
  if (preferredCaseId && cases.some((item) => item.id === preferredCaseId)) {
    return preferredCaseId
  }
  if (fallbackCaseId && cases.some((item) => item.id === fallbackCaseId)) {
    return fallbackCaseId
  }
  return cases.find((item) => item.isActive)?.id ?? cases[0]?.id ?? null
}

function buildActiveApplicantProfile(id: string, data: ApplicantDetailResponse) {
  const nextProfile = data.profile || null
  if (!nextProfile) return null

  const cases = Array.isArray(data.cases) ? data.cases : []
  const savedCaseId = readStoredApplicantCaseId(id)
  const activeCaseId = resolveActiveCaseId(cases, savedCaseId, data.activeCaseId)
  const activeCase = activeCaseId ? cases.find((item) => item.id === activeCaseId) ?? null : null

  writeStoredApplicantCaseId(id, activeCaseId)

  return {
    ...(nextProfile as ActiveApplicantProfile),
    cases,
    activeCaseId,
    activeCase,
  } satisfies ActiveApplicantProfile
}

export function useActiveApplicantProfile() {
  const [profile, setProfile] = useState<ActiveApplicantProfile | null>(null)

  useEffect(() => {
    const load = async () => {
      const id = window.localStorage.getItem(ACTIVE_APPLICANT_PROFILE_KEY) || ""
      if (!id) {
        setProfile(null)
        return
      }

      const cacheKey = getApplicantDetailCacheKey(id, "active")
      const cached = readClientCache<ApplicantDetailResponse>(cacheKey)
      if (cached) {
        const cachedProfile = buildActiveApplicantProfile(id, cached)
        if (cachedProfile) {
          setProfile(cachedProfile)
        }
      }

      try {
        const res = await fetch(`/api/applicants/${id}?view=active`, { cache: "no-store" })
        if (!res.ok) {
          if (!cached) setProfile(null)
          return
        }

        const data = (await res.json()) as ApplicantDetailResponse
        writeClientCache(cacheKey, data, APPLICANT_DETAIL_CACHE_TTL_MS)
        const nextProfile = buildActiveApplicantProfile(id, data)
        if (!nextProfile) {
          if (!cached) setProfile(null)
          return
        }

        setProfile(nextProfile)
      } catch {
        if (!cached) setProfile(null)
      }
    }

    void load()
    const onStorage = () => void load()
    const onCustom = () => void load()
    const intervalId = window.setInterval(() => {
      void load()
    }, 15000)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onStorage)
    window.addEventListener("active-applicant-profile-changed", onCustom as EventListener)
    window.addEventListener("active-applicant-profile-refresh", onCustom as EventListener)
    window.addEventListener("active-applicant-case-changed", onCustom as EventListener)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onStorage)
      window.removeEventListener("active-applicant-profile-changed", onCustom as EventListener)
      window.removeEventListener("active-applicant-profile-refresh", onCustom as EventListener)
      window.removeEventListener("active-applicant-case-changed", onCustom as EventListener)
    }
  }, [])

  return profile
}

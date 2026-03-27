"use client"

import { useEffect, useState } from "react"
import { ACTIVE_APPLICANT_PROFILE_KEY } from "@/components/applicant-profile-selector"

export interface ActiveApplicantProfile {
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
  files?: Record<string, { originalName: string }>

  // Legacy fields preserved for old flows that still read them.
  fullName?: string
  surname?: string
  givenName?: string
  email?: string
  passportNumber?: string
  birthYear?: string
  birthDate?: string
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
      try {
        const res = await fetch(`/api/applicants/${id}`, { cache: "no-store" })
        if (!res.ok) {
          setProfile(null)
          return
        }
        const data = await res.json()
        setProfile((data.profile || null) as ActiveApplicantProfile | null)
      } catch {
        setProfile(null)
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
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onStorage)
      window.removeEventListener("active-applicant-profile-changed", onCustom as EventListener)
      window.removeEventListener("active-applicant-profile-refresh", onCustom as EventListener)
    }
  }, [])

  return profile
}

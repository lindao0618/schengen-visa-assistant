"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"

import {
  APPLICANT_DETAIL_CACHE_TTL_MS,
  getApplicantDetailCacheKey,
  prefetchJsonIntoClientCache,
} from "@/lib/applicant-client-cache"

export function usePrefetchApplicantDetail(
  applicantId?: string | null,
  options?: { tab?: string; view?: "full" | "active" },
) {
  const router = useRouter()
  const tab = options?.tab || "materials"
  const view = options?.view || "full"

  const prefetchApplicantDetail = useCallback(
    (targetApplicantId?: string | null) => {
      const id = (targetApplicantId || applicantId || "").trim()
      if (!id) return

      const href = `/applicants/${id}?tab=${encodeURIComponent(tab)}`
      router.prefetch(href)
      const apiUrl = view === "active" ? `/api/applicants/${id}?view=active` : `/api/applicants/${id}`
      void prefetchJsonIntoClientCache(getApplicantDetailCacheKey(id, view), apiUrl, {
        ttlMs: APPLICANT_DETAIL_CACHE_TTL_MS,
      }).catch(() => {
        // Ignore background prefetch failures.
      })
    },
    [applicantId, router, tab, view],
  )

  useEffect(() => {
    prefetchApplicantDetail(applicantId)
  }, [applicantId, prefetchApplicantDetail])

  return prefetchApplicantDetail
}

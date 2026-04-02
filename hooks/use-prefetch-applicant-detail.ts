"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"

import {
  APPLICANT_DETAIL_CACHE_TTL_MS,
  getApplicantDetailCacheKey,
  prefetchJsonIntoClientCache,
} from "@/lib/applicant-client-cache"

export function usePrefetchApplicantDetail(applicantId?: string | null, options?: { tab?: string }) {
  const router = useRouter()
  const tab = options?.tab || "materials"

  const prefetchApplicantDetail = useCallback(
    (targetApplicantId?: string | null) => {
      const id = (targetApplicantId || applicantId || "").trim()
      if (!id) return

      const href = `/applicants/${id}?tab=${encodeURIComponent(tab)}`
      router.prefetch(href)
      void prefetchJsonIntoClientCache(getApplicantDetailCacheKey(id), `/api/applicants/${id}`, {
        ttlMs: APPLICANT_DETAIL_CACHE_TTL_MS,
      }).catch(() => {
        // Ignore background prefetch failures.
      })
    },
    [applicantId, router, tab],
  )

  useEffect(() => {
    prefetchApplicantDetail(applicantId)
  }, [applicantId, prefetchApplicantDetail])

  return prefetchApplicantDetail
}

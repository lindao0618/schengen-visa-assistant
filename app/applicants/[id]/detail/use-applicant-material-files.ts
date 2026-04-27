"use client"

import type { Dispatch, SetStateAction } from "react"
import { useEffect, useState } from "react"

import { shouldFetchApplicantMaterialFiles } from "@/lib/applicant-material-files"

import { readJsonSafely } from "./json-response"
import type { ApplicantDetailResponse, ApplicantDetailTab, ApplicantMaterialFiles } from "./types"

type UseApplicantMaterialFilesOptions = {
  applicantId: string
  activeTab: ApplicantDetailTab
  detailProfileId: string
  setDetail: Dispatch<SetStateAction<ApplicantDetailResponse | null>>
}

export function useApplicantMaterialFiles({
  applicantId,
  activeTab,
  detailProfileId,
  setDetail,
}: UseApplicantMaterialFilesOptions) {
  const [materialFiles, setMaterialFiles] = useState<ApplicantMaterialFiles>({})
  const [materialFilesLoaded, setMaterialFilesLoaded] = useState(false)
  const [materialFilesLoading, setMaterialFilesLoading] = useState(false)
  const [materialFilesError, setMaterialFilesError] = useState("")

  useEffect(() => {
    setMaterialFiles({})
    setMaterialFilesLoaded(false)
    setMaterialFilesError("")
  }, [detailProfileId])

  useEffect(() => {
    if (!detailProfileId) return
    if (
      !shouldFetchApplicantMaterialFiles({
        activeTab,
        hasFilesLoaded: materialFilesLoaded,
        loading: materialFilesLoading,
      })
    ) {
      return
    }

    let cancelled = false
    setMaterialFilesLoading(true)
    setMaterialFilesError("")

    fetch(`/api/applicants/${applicantId}/files`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await readJsonSafely<{ files?: ApplicantMaterialFiles; error?: string }>(response)) ?? {}
        if (!response.ok || !data.files) {
          throw new Error(data.error || "加载材料文件失败")
        }
        if (cancelled) return

        const nextFiles = data.files
        setMaterialFiles(nextFiles)
        setMaterialFilesLoaded(true)
        setDetail((prev) =>
          prev?.profile.id === detailProfileId
            ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  files: nextFiles,
                },
              }
            : prev,
        )
      })
      .catch((error) => {
        if (!cancelled) {
          setMaterialFilesError(error instanceof Error ? error.message : "加载材料文件失败")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMaterialFilesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, applicantId, detailProfileId, materialFilesLoaded, materialFilesLoading, setDetail])

  return {
    materialFiles,
    setMaterialFiles,
    materialFilesLoaded,
    setMaterialFilesLoaded,
    materialFilesLoading,
    materialFilesError,
    setMaterialFilesError,
  }
}

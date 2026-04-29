"use client"

import type { Dispatch, SetStateAction } from "react"
import { useEffect, useState } from "react"

import {
  getApplicantMaterialFilesHandoffKey,
  shouldFetchApplicantMaterialFiles,
} from "@/lib/applicant-material-files"

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
    if (!applicantId || !detailProfileId || activeTab !== "materials") return

    const handoffKey = getApplicantMaterialFilesHandoffKey(applicantId)
    let rawFiles = ""
    try {
      rawFiles = window.sessionStorage.getItem(handoffKey) || ""
      if (rawFiles) window.sessionStorage.removeItem(handoffKey)
    } catch {
      return
    }

    if (!rawFiles) return

    let nextFiles: ApplicantMaterialFiles = {}
    try {
      const parsed = JSON.parse(rawFiles)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        nextFiles = parsed as ApplicantMaterialFiles
      }
    } catch {
      return
    }

    if (Object.keys(nextFiles).length === 0) return

    setMaterialFiles(nextFiles)
    setMaterialFilesError("")
    setDetail((prev) =>
      prev?.profile.id === detailProfileId
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              files: {
                ...(prev.profile.files || {}),
                ...nextFiles,
              },
            },
          }
        : prev,
    )
  }, [activeTab, applicantId, detailProfileId, setDetail])

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
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000)
    setMaterialFilesLoading(true)
    setMaterialFilesError("")

    fetch(`/api/applicants/${applicantId}/files`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
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
          setMaterialFilesError(
            error instanceof DOMException && error.name === "AbortError"
              ? "材料列表加载超时，已先显示已有归档材料。"
              : error instanceof Error
                ? error.message
                : "加载材料文件失败",
          )
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (!cancelled) {
          setMaterialFilesLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeoutId)
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

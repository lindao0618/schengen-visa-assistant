"use client"

import { useCallback, useMemo, useState } from "react"

import {
  canAssignCases,
  canTriggerAutomation,
  canWriteApplicants,
  isReadOnlyRole,
  normalizeAppRole,
} from "../../../../lib/access-control"
import {
  APPLICANT_CRM_LIST_CACHE_PREFIX,
  APPLICANT_CRM_SUMMARY_CACHE_PREFIX,
  APPLICANT_DETAIL_CACHE_TTL_MS,
  APPLICANT_SELECTOR_CACHE_KEY,
  FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX,
  clearClientCache,
  clearClientCacheByPrefix,
  getApplicantDetailCacheKey,
  readClientCache,
  writeClientCache,
} from "../../../../lib/applicant-client-cache"

import type {
  ApplicantDetailResponse,
  ApplicantDetailTab,
  AuditDialogState,
  BasicFormState,
  CaseFormState,
  PreviewState,
} from "./types"
import { emptyAuditDialog, emptyBasicForm, emptyCaseForm, emptyPreview } from "./types"
import { buildBasicForm, buildCaseForm } from "./form-state"

const ACTIVE_APPLICANT_PROFILE_KEY = "visa.activeApplicantProfileId"
const ACTIVE_APPLICANT_CASE_KEY = "visa.activeApplicantCaseId"

export function resolveApplicantDetailTab(value: string | null | undefined): ApplicantDetailTab {
  return value === "cases" || value === "materials" || value === "progress" ? value : "basic"
}

export function buildApplicantDetailCapabilities(role: string | null | undefined) {
  const normalizedRole = normalizeAppRole(role)
  return {
    isReadOnly: isReadOnlyRole(normalizedRole),
    canEditApplicant: canWriteApplicants(normalizedRole),
    canAssignCase: canAssignCases(normalizedRole),
    canRunAutomation: canTriggerAutomation(normalizedRole),
  }
}

function getApplicantCaseStorageKey(applicantId: string) {
  return `activeApplicantCaseId:${applicantId}`
}

function persistSelectedApplicantCase(applicantId: string, caseId?: string | null) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, applicantId)

  const normalizedCaseId = caseId || ""
  if (normalizedCaseId) {
    window.localStorage.setItem(ACTIVE_APPLICANT_CASE_KEY, normalizedCaseId)
    window.localStorage.setItem(getApplicantCaseStorageKey(applicantId), normalizedCaseId)
  } else {
    window.localStorage.removeItem(ACTIVE_APPLICANT_CASE_KEY)
    window.localStorage.removeItem(getApplicantCaseStorageKey(applicantId))
  }

  window.dispatchEvent(
    new CustomEvent("active-applicant-profile-changed", {
      detail: { applicantProfileId: applicantId },
    }),
  )
  window.dispatchEvent(
    new CustomEvent("active-applicant-case-changed", {
      detail: { applicantProfileId: applicantId, caseId: normalizedCaseId || undefined },
    }),
  )
}

type UseApplicantDetailControllerOptions = {
  applicantId: string
  viewerRole?: string | null
}

export function useApplicantDetailController({
  applicantId,
  viewerRole,
}: UseApplicantDetailControllerOptions) {
  const normalizedViewerRole = useMemo(() => normalizeAppRole(viewerRole), [viewerRole])
  const capabilities = useMemo(() => buildApplicantDetailCapabilities(viewerRole), [viewerRole])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingCase, setSavingCase] = useState(false)
  const [deletingApplicant, setDeletingApplicant] = useState(false)
  const [creatingCase, setCreatingCase] = useState(false)
  const [detail, setDetail] = useState<ApplicantDetailResponse | null>(null)
  const [basicForm, setBasicForm] = useState<BasicFormState>(emptyBasicForm)
  const [selectedCaseId, setSelectedCaseId] = useState("")
  const [caseForm, setCaseForm] = useState<CaseFormState>(emptyCaseForm)
  const [createCaseOpen, setCreateCaseOpen] = useState(false)
  const [newCaseForm, setNewCaseForm] = useState<CaseFormState>(emptyCaseForm)
  const [preview, setPreview] = useState<PreviewState>(emptyPreview)
  const [auditDialog, setAuditDialog] = useState<AuditDialogState>(emptyAuditDialog)
  const detailCacheKey = useMemo(() => getApplicantDetailCacheKey(applicantId), [applicantId])

  const selectedCase = useMemo(
    () => detail?.cases.find((item) => item.id === selectedCaseId) ?? null,
    [detail?.cases, selectedCaseId],
  )

  const invalidateApplicantCaches = useCallback(() => {
    clearClientCache(detailCacheKey)
    clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
    clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
    clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
    clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
  }, [detailCacheKey])

  const primeApplicantDetailCache = useCallback(
    (data: ApplicantDetailResponse) => {
      writeClientCache(detailCacheKey, data, APPLICANT_DETAIL_CACHE_TTL_MS)
    },
    [detailCacheKey],
  )

  const applyDetailPayload = useCallback((data: ApplicantDetailResponse) => {
    setDetail(data)
    setBasicForm(buildBasicForm(data.profile))
    const nextCaseId = data.activeCaseId || data.cases[0]?.id || ""
    setSelectedCaseId(nextCaseId)
    setCaseForm(buildCaseForm(data.cases.find((item) => item.id === nextCaseId) || null))
    persistSelectedApplicantCase(data.profile.id, nextCaseId)
  }, [])

  return {
    normalizedViewerRole,
    isReadOnlyViewer: capabilities.isReadOnly,
    canEditApplicant: capabilities.canEditApplicant,
    canAssignCase: capabilities.canAssignCase,
    canRunAutomation: capabilities.canRunAutomation,
    loading,
    setLoading,
    message,
    setMessage,
    savingProfile,
    setSavingProfile,
    savingCase,
    setSavingCase,
    deletingApplicant,
    setDeletingApplicant,
    creatingCase,
    setCreatingCase,
    detail,
    setDetail,
    basicForm,
    setBasicForm,
    selectedCaseId,
    setSelectedCaseId,
    caseForm,
    setCaseForm,
    createCaseOpen,
    setCreateCaseOpen,
    newCaseForm,
    setNewCaseForm,
    preview,
    setPreview,
    auditDialog,
    setAuditDialog,
    detailCacheKey,
    selectedCase,
    invalidateApplicantCaches,
    primeApplicantDetailCache,
    applyDetailPayload,
  }
}

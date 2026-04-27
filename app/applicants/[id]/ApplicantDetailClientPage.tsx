"use client"

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"

import {
  ApplicantDetailErrorState,
  ApplicantDetailFrame,
  ApplicantDetailLoadingState,
} from "@/app/applicants/[id]/detail/applicant-detail-frame"
import { resolveSelectedFranceCase, resolveTlsAccountCaseSource } from "@/app/applicants/[id]/detail/cases-tab"
import {
  ACTIVE_APPLICANT_PROFILE_KEY,
  dispatchActiveApplicantCaseChange,
  dispatchActiveApplicantProfileChange,
  writeStoredApplicantCaseId,
} from "@/lib/applicant-selection-storage"
import { buildBasicForm, buildCaseForm, emptyApplicantCaseForm } from "@/app/applicants/[id]/detail/form-state"
import { readJsonSafely } from "@/app/applicants/[id]/detail/json-response"
import { buildApplicantProfileUpdatePayload } from "@/app/applicants/[id]/detail/profile-save"
import { buildTlsAccountInfo, buildTlsAccountTemplateText } from "@/app/applicants/[id]/detail/tls-account"
import { resolveApplicantDetailTab, useApplicantDetailController } from "@/app/applicants/[id]/detail/use-applicant-detail-controller"
import {
  APPLICANT_CRM_LIST_CACHE_PREFIX,
  APPLICANT_CRM_SUMMARY_CACHE_PREFIX,
  APPLICANT_SELECTOR_CACHE_KEY,
  FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX,
  clearClientCache,
  clearClientCacheByPrefix,
  readClientCache,
} from "@/lib/applicant-client-cache"
import {
  type ApplicantDetailResponse,
  type ApplicantDetailTab,
  type ApplicantProfileDetail,
  type VisaCaseRecord,
} from "@/app/applicants/[id]/detail/types"

const CreateCaseDialog = dynamic(
  () => import("@/app/applicants/[id]/detail/create-case-dialog").then((mod) => mod.CreateCaseDialog),
  { ssr: false },
)

const BasicTabContent = dynamic(
  () => import("@/app/applicants/[id]/detail/basic-tab-content").then((mod) => mod.BasicTabContent),
  { ssr: false },
)

const CasesTabContent = dynamic(
  () => import("@/app/applicants/[id]/detail/cases-tab-content").then((mod) => mod.CasesTabContent),
  { ssr: false },
)

const ApplicantMaterialsSection = dynamic(
  () =>
    import("@/app/applicants/[id]/detail/applicant-materials-section").then(
      (mod) => mod.ApplicantMaterialsSection,
    ),
  { ssr: false },
)

const ProgressTab = dynamic(
  () => import("@/app/applicants/[id]/detail/progress-tab").then((mod) => mod.ProgressTab),
  { ssr: false },
)

function persistSelectedApplicantCase(applicantId: string, caseId?: string | null) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, applicantId)
  const normalizedCaseId = caseId || ""
  writeStoredApplicantCaseId(applicantId, normalizedCaseId)
  dispatchActiveApplicantProfileChange(applicantId)
  dispatchActiveApplicantCaseChange(applicantId, normalizedCaseId || undefined)
}

export default function ApplicantDetailClientPage({
  applicantId,
  viewerRole,
}: {
  applicantId: string
  viewerRole?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    normalizedViewerRole,
    isReadOnlyViewer,
    canEditApplicant,
    canAssignCase,
    canRunAutomation,
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
  } = useApplicantDetailController({
    applicantId,
    viewerRole,
  })
  const defaultTab = useMemo(() => {
    return resolveApplicantDetailTab(searchParams.get("tab"))
  }, [searchParams])
  const [activeTab, setActiveTab] = useState<ApplicantDetailTab>(defaultTab)
  const selectedFranceCase = useMemo(
    () => resolveSelectedFranceCase(detail?.cases || [], selectedCase),
    [detail?.cases, selectedCase],
  )
  const tlsAccountCaseSource = useMemo(
    () => resolveTlsAccountCaseSource(selectedCase, selectedFranceCase, caseForm),
    [caseForm, selectedCase, selectedFranceCase],
  )
  const tlsAccountInfo = useMemo(
    () => buildTlsAccountInfo(detail?.profile, tlsAccountCaseSource, basicForm.schengenVisaCity),
    [basicForm.schengenVisaCity, detail?.profile, tlsAccountCaseSource],
  )
  const tlsAccountTemplateText = useMemo(() => buildTlsAccountTemplateText(tlsAccountInfo), [tlsAccountInfo])

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  const loadDetail = useCallback(async () => {
    const cached = readClientCache<ApplicantDetailResponse>(detailCacheKey)
    if (cached) {
      applyDetailPayload(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    try {
      const response = await fetch(`/api/applicants/${applicantId}`, { cache: "no-store" })
      const data = (await readJsonSafely<ApplicantDetailResponse & { error?: string }>(response)) ?? null
      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "加载申请人详情失败")
      }

      primeApplicantDetailCache(data)
      applyDetailPayload(data)
    } catch (error) {
      if (!cached) {
        setMessage(error instanceof Error ? error.message : "加载申请人详情失败")
      }
    } finally {
      setLoading(false)
    }
  }, [applicantId, applyDetailPayload, detailCacheKey, primeApplicantDetailCache, setLoading, setMessage])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    setCaseForm(buildCaseForm(selectedCase, emptyApplicantCaseForm))
  }, [selectedCase, setCaseForm])

  useEffect(() => {
    if (caseForm.caseType !== "france-schengen") return
    if (caseForm.tlsCity) return
    if (!basicForm.schengenVisaCity) return
    setCaseForm((prev) => {
      if (prev.caseType !== "france-schengen" || prev.tlsCity) return prev
      return { ...prev, tlsCity: basicForm.schengenVisaCity }
    })
  }, [basicForm.schengenVisaCity, caseForm.caseType, caseForm.tlsCity, setCaseForm])

  useEffect(() => {
    if (!detail?.profile.id) return
    persistSelectedApplicantCase(detail.profile.id, selectedCaseId)
  }, [detail?.profile.id, selectedCaseId])

  const saveProfile = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能修改申请人信息")
      return
    }
    setSavingProfile(true)
    setMessage("")

    try {
      const response = await fetch(`/api/applicants/${applicantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildApplicantProfileUpdatePayload(basicForm)),
      })

      const data = await readJsonSafely<{ profile?: ApplicantProfileDetail; error?: string }>(response)
      if (!response.ok || !data?.profile) {
        throw new Error(data?.error || "保存申请人失败")
      }

      const nextDetail = detail ? { ...detail, profile: data.profile } : null
      if (nextDetail) {
        setDetail(nextDetail)
        primeApplicantDetailCache(nextDetail)
      }
      clearClientCache(APPLICANT_SELECTOR_CACHE_KEY)
      clearClientCacheByPrefix(APPLICANT_CRM_LIST_CACHE_PREFIX)
      clearClientCacheByPrefix(APPLICANT_CRM_SUMMARY_CACHE_PREFIX)
      clearClientCacheByPrefix(FRANCE_AUTOMATION_PROFILES_CACHE_PREFIX)
      setBasicForm(buildBasicForm(data.profile))
      setMessage("申请人信息已更新")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存申请人失败")
    } finally {
      setSavingProfile(false)
    }
  }

  const copyTlsAccountTemplate = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("当前浏览器不支持自动复制")
      }
      await navigator.clipboard.writeText(tlsAccountTemplateText)
      setMessage("TLS 账号信息已复制到剪贴板")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "复制 TLS 账号信息失败")
    }
  }

  const deleteApplicant = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能删除申请人")
      return
    }
    if (!window.confirm("删除申请人后，对应材料和案件会一起删除，确定继续吗？")) return

    setDeletingApplicant(true)
    setMessage("")
    try {
      const response = await fetch(`/api/applicants/${applicantId}`, { method: "DELETE" })
      const data = await readJsonSafely<{ success?: boolean; error?: string }>(response)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "删除申请人失败")
      }
      invalidateApplicantCaches()
      router.push("/applicants")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除申请人失败")
    } finally {
      setDeletingApplicant(false)
    }
  }

  const saveCase = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能修改 Case")
      return
    }
    if (!selectedCaseId) {
      setMessage("请先选择一个 Case")
      return
    }

    setSavingCase(true)
    setMessage("")
    try {
      const response = await fetch(`/api/cases/${selectedCaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseForm),
      })
      const data = await readJsonSafely<{ case?: VisaCaseRecord; error?: string }>(response)
      if (!response.ok || !data?.case) {
        throw new Error(data?.error || "保存案件失败")
      }

      invalidateApplicantCaches()
      await loadDetail()
      setSelectedCaseId(data.case.id)
      setMessage("案件信息已更新")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存案件失败")
    } finally {
      setSavingCase(false)
    }
  }

  const createCase = async () => {
    if (!canEditApplicant) {
      setMessage("当前角色为只读，不能创建 Case")
      return
    }
    setCreatingCase(true)
    setMessage("")

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantProfileId: applicantId,
          ...newCaseForm,
        }),
      })
      const data = await readJsonSafely<{ case?: VisaCaseRecord; error?: string }>(response)
      if (!response.ok || !data?.case) {
        throw new Error(data?.error || "创建案件失败")
      }

      invalidateApplicantCaches()
      await loadDetail()
      setSelectedCaseId(data.case.id)
      setCreateCaseOpen(false)
      setNewCaseForm(emptyApplicantCaseForm)
      setMessage("新案件已创建")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建案件失败")
    } finally {
      setCreatingCase(false)
    }
  }

  if (loading) {
    return <ApplicantDetailLoadingState />
  }

  if (!detail?.profile) {
    return <ApplicantDetailErrorState message={message} />
  }

  const materialCount = Object.keys(detail.profile.files || {}).length
  const selectedCaseSummary = selectedCase
    ? [selectedCase.visaType || selectedCase.caseType || "签证", selectedCase.mainStatus, selectedCase.subStatus]
        .filter(Boolean)
        .join(" · ")
    : "暂无选中 Case"

  return (
    <>
      <ApplicantDetailFrame
        activeTab={activeTab}
        defaultTab={defaultTab}
        applicantTitle={detail.profile.name || detail.profile.label}
        viewerRole={normalizedViewerRole}
        isReadOnlyViewer={isReadOnlyViewer}
        caseCount={detail.cases.length}
        materialCount={materialCount}
        selectedCaseSummary={selectedCaseSummary}
        message={message}
        deletingApplicant={deletingApplicant}
        canEditApplicant={canEditApplicant}
        onTabChange={(value) => setActiveTab(resolveApplicantDetailTab(value))}
        onRefresh={loadDetail}
        onDeleteApplicant={deleteApplicant}
      >
          {activeTab === "basic" ? (
            <BasicTabContent
              applicantId={detail.profile.id}
              profile={detail.profile}
              basicForm={basicForm}
              setBasicForm={setBasicForm}
              tlsAccountTemplateText={tlsAccountTemplateText}
              isReadOnlyViewer={isReadOnlyViewer}
              savingProfile={savingProfile}
              canEditApplicant={canEditApplicant}
              onCopyTlsAccountTemplate={copyTlsAccountTemplate}
              onSaveProfile={saveProfile}
            />
          ) : null}

          {activeTab === "cases" ? (
            <CasesTabContent
              cases={detail.cases}
              selectedCaseId={selectedCaseId}
              onSelectCaseId={setSelectedCaseId}
              selectedCase={selectedCase}
              caseForm={caseForm}
              setCaseForm={setCaseForm}
              availableAssignees={detail.availableAssignees}
              isReadOnlyViewer={isReadOnlyViewer}
              canAssignCase={canAssignCase}
              canEditApplicant={canEditApplicant}
              savingCase={savingCase}
              onOpenCreateCase={() => setCreateCaseOpen(true)}
              onSaveCase={saveCase}
            />
          ) : null}

          {activeTab === "materials" || preview.open || auditDialog.open ? (
            <ApplicantMaterialsSection
              applicantId={applicantId}
              activeTab={activeTab}
              detail={detail}
              selectedCaseId={selectedCase?.id}
              canEditApplicant={canEditApplicant}
              canRunAutomation={canRunAutomation}
              preview={preview}
              setPreview={setPreview}
              auditDialog={auditDialog}
              setAuditDialog={setAuditDialog}
              setBasicForm={setBasicForm}
              setDetail={setDetail}
              setMessage={setMessage}
              invalidateApplicantCaches={invalidateApplicantCaches}
              primeApplicantDetailCache={primeApplicantDetailCache}
              loadDetail={loadDetail}
            />
          ) : null}

          {activeTab === "progress" ? (
            <ProgressTab
              applicantProfileId={detail.profile.id}
              applicantName={detail.profile.name || detail.profile.label}
              selectedCase={selectedCase}
            />
          ) : null}
      </ApplicantDetailFrame>

      {createCaseOpen ? (
        <CreateCaseDialog
          open={createCaseOpen}
          onOpenChange={setCreateCaseOpen}
          detail={detail}
          newCaseForm={newCaseForm}
          setNewCaseForm={setNewCaseForm}
          isReadOnlyViewer={isReadOnlyViewer}
          canAssignCase={canAssignCase}
          canEditApplicant={canEditApplicant}
          creatingCase={creatingCase}
          onCreateCase={createCase}
        />
      ) : null}

    </>
  )
}

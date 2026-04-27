"use client"

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { ApplicantIntakeSnapshot } from "@/app/applicants/[id]/detail/types"
import { shouldFetchApplicantIntake } from "@/lib/applicant-intake-loading"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/app/applicants/[id]/detail/detail-ui"

function buildApplicantFileUrl(applicantId: string, slot: string) {
  return `/api/applicants/${encodeURIComponent(applicantId)}/files/${encodeURIComponent(slot)}`
}

type IntakeScope = "usVisa" | "schengen"

type IntakeFileMeta = {
  slot: string
  originalName: string
  uploadedAt: string
}

type ParsedIntakeState = {
  loaded: boolean
  loading: boolean
  error: string
  intake: ApplicantIntakeSnapshot | null
  sourceFile: IntakeFileMeta | null
  photo: IntakeFileMeta | null
}

export function ParsedIntakeAccordion({
  applicantId,
  scope,
  title,
  subtitle,
  tone,
  intake,
  photoSlot,
  photoLabel,
  emptyMessage,
}: {
  applicantId: string
  scope: IntakeScope
  title: string
  subtitle: string
  tone: "sky" | "emerald"
  intake?: ApplicantIntakeSnapshot
  photoSlot?: string
  photoLabel?: string
  emptyMessage: string
}) {
  const itemValue = `${scope}-parsed-intake`
  const [accordionValue, setAccordionValue] = useState("")
  const [state, setState] = useState<ParsedIntakeState>({
    loaded: Boolean(intake),
    loading: false,
    error: "",
    intake: intake || null,
    sourceFile: null,
    photo: null,
  })
  const isOpen = accordionValue === itemValue
  const activeIntake = state.intake
  const activePhotoSlot = state.photo?.slot || photoSlot

  useEffect(() => {
    setState({
      loaded: Boolean(intake),
      loading: false,
      error: "",
      intake: intake || null,
      sourceFile: null,
      photo: null,
    })
    setAccordionValue("")
  }, [applicantId, intake, scope])

  useEffect(() => {
    if (
      !shouldFetchApplicantIntake({
        open: isOpen,
        hasIntakeLoaded: state.loaded,
        loading: state.loading,
      })
    ) {
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: "" }))

    fetch(`/api/applicants/${encodeURIComponent(applicantId)}/intake?scope=${encodeURIComponent(scope)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          intake?: ApplicantIntakeSnapshot | null
          sourceFile?: IntakeFileMeta | null
          photo?: IntakeFileMeta | null
          error?: string
        }
        if (!response.ok) {
          throw new Error(data.error || "加载 intake 失败")
        }
        if (!cancelled) {
          setState({
            loaded: true,
            loading: false,
            error: "",
            intake: data.intake || null,
            sourceFile: data.sourceFile || null,
            photo: data.photo || null,
          })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loaded: true,
            loading: false,
            error: error instanceof Error ? error.message : "加载 intake 失败",
          }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [applicantId, isOpen, scope, state.loaded, state.loading])

  const toneMap = {
    sky: {
      wrapper: "border-sky-200/80 bg-white/85",
      trigger: "text-sky-950",
      meta: "text-sky-700/80",
      code: "border-sky-200 bg-slate-950",
      empty: "border-dashed border-sky-200 bg-white/70 text-sky-800/80",
      accent: "bg-sky-50 text-sky-700 border-sky-200",
      photo: "border-sky-200 bg-sky-50/60",
    },
    emerald: {
      wrapper: "border-emerald-200/80 bg-white/85",
      trigger: "text-emerald-950",
      meta: "text-emerald-700/80",
      code: "border-emerald-200 bg-slate-950",
      empty: "border-dashed border-emerald-200 bg-white/70 text-emerald-800/80",
      accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
      photo: "border-emerald-200 bg-emerald-50/60",
    },
  } as const

  const styles = toneMap[tone]
  const jsonText = activeIntake ? JSON.stringify(activeIntake, null, 2) : ""
  const auditErrorCount = activeIntake?.audit?.errors?.length || 0
  const visibleItems = activeIntake?.items.filter((item) => item.value?.trim()) || []
  const photoUrl = activePhotoSlot ? buildApplicantFileUrl(applicantId, activePhotoSlot) : ""

  return (
    <div className={cn("rounded-2xl border shadow-sm", styles.wrapper)}>
      <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue} className="px-4">
        <AccordionItem value={itemValue} className="border-none">
          <AccordionTrigger className={cn("py-4 text-left hover:no-underline", styles.trigger)}>
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-base font-semibold">{title}</div>
                <div className={cn("text-sm", styles.meta)}>{subtitle}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeIntake ? (
                  <>
                    <Badge variant="outline">{activeIntake.sourceSlot}</Badge>
                    <Badge variant="outline">{activeIntake.fieldCount} 个字段</Badge>
                    <Badge variant={auditErrorCount > 0 ? "warning" : "success"}>
                      {auditErrorCount > 0 ? `${auditErrorCount} 个问题` : "已通过"}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline">{state.loading ? "加载中" : "展开后加载"}</Badge>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            {state.loading ? (
              <div className={cn("rounded-2xl border px-4 py-4 text-sm", styles.empty)}>正在加载完整 intake...</div>
            ) : state.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                {state.error}
              </div>
            ) : !activeIntake ? (
              <div className={cn("rounded-2xl border px-4 py-4 text-sm", styles.empty)}>{emptyMessage}</div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Source File</div>
                      <div className="mt-2 text-sm font-semibold text-gray-900">
                        {activeIntake.sourceOriginalName || activeIntake.sourceSlot}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">Slot: {activeIntake.sourceSlot}</div>
                    </div>
                    <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Parsed At</div>
                      <div className="mt-2 text-sm font-semibold text-gray-900">
                        {formatDateTime(activeIntake.extractedAt)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        OpenClaw 建议直接读取这一层，不要先下载原始 Excel。
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/60 bg-white/90 p-4 sm:col-span-2 xl:col-span-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Quick Stats</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <div>
                          <div className="text-[11px] text-gray-500">字段总数</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{activeIntake.fieldCount}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500">已提取值</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{visibleItems.length}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500">Audit</div>
                          <div
                            className={cn(
                              "mt-1 text-sm font-semibold",
                              auditErrorCount > 0 ? "text-amber-700" : "text-emerald-700",
                            )}
                          >
                            {auditErrorCount > 0 ? `${auditErrorCount} 个问题` : "已通过"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {activePhotoSlot ? (
                    <div className={cn("overflow-hidden rounded-2xl border", styles.photo)}>
                      <div className="border-b border-black/5 px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">{photoLabel || "照片"}</div>
                        <div className="mt-1 text-xs text-gray-500">{activePhotoSlot}</div>
                      </div>
                      <div className="p-3">
                        <img
                          src={photoUrl}
                          alt={photoLabel || "照片"}
                          className="h-56 w-full rounded-xl bg-white object-contain"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900">完整个人信息</div>
                      <div className="text-xs text-gray-500">按字段平铺，更适合人工快速浏览。</div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {visibleItems.length > 0 ? (
                        visibleItems.map((item) => (
                          <div
                            key={`${activeIntake.sourceSlot}-${item.key}`}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                          >
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              {item.label}
                            </div>
                            <div className="mt-2 break-words text-sm font-semibold text-slate-900">
                              {item.value}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">{item.key}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 md:col-span-2 2xl:col-span-3">
                          当前没有可直接展示的字段，但完整 JSON 仍然可用。
                        </div>
                      )}
                    </div>
                  </div>

                  {auditErrorCount > 0 ? (
                    <div className={cn("rounded-2xl border px-4 py-4", styles.accent)}>
                      <div className="text-sm font-semibold">Audit 提醒</div>
                      <div className="mt-3 space-y-2 text-sm">
                        {activeIntake.audit.errors.map((issue, index) => (
                          <div
                            key={`${issue.field}-${index}`}
                            className="rounded-xl border border-current/20 bg-white/70 px-3 py-2"
                          >
                            <div className="font-medium">{issue.field}</div>
                            <div className="mt-1">{issue.message}</div>
                            {issue.value ? <div className="mt-1 text-xs opacity-80">当前值：{issue.value}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <details className="rounded-2xl border border-white/60 bg-white/90 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">查看原始 JSON</summary>
                    <div className={cn("mt-3 max-h-[420px] overflow-auto rounded-xl border p-4", styles.code)}>
                      <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-slate-100">{jsonText}</pre>
                    </div>
                  </details>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

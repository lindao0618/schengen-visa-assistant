"use client"

import { memo } from "react"
import { Inbox, SearchX, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApplicantCrmBatchToolbar } from "@/app/applicants/applicant-crm-batch-toolbar"
import { ApplicantCrmRowsTable } from "@/app/applicants/applicant-crm-rows-table"
import type { ApplicantCrmRow } from "@/app/applicants/applicant-crm-types"

type ApplicantCrmListPanelProps = {
  rows: ApplicantCrmRow[]
  selectedApplicantIds: string[]
  allVisibleSelected: boolean
  canEditApplicants: boolean
  loading: boolean
  loadingMore: boolean
  hasMoreVisibleRows: boolean
  totalDisplayRows: number
  hasFilters: boolean
  batchActionLoading: boolean
  onToggleAllVisible: (checked: boolean) => void
  onToggleApplicant: (applicantId: string, checked: boolean) => void
  onOpenApplicant: (applicantId: string) => void
  onPrefetchApplicant: (applicantId: string) => void
  onSetGroup: () => void
  onClearGroup: () => void | Promise<void>
  onDelete: () => void
  onClearSelection: () => void
  onLoadMore: () => void
  onClearFilters: () => void
  onCreateApplicant: () => void
}

function ApplicantCrmEmptyState({
  hasFilters,
  canEditApplicants,
  onClearFilters,
  onCreateApplicant,
}: {
  hasFilters: boolean
  canEditApplicants: boolean
  onClearFilters: () => void
  onCreateApplicant: () => void
}) {
  const Icon = hasFilters ? SearchX : Inbox

  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 text-base font-semibold text-slate-900">
        {hasFilters ? "当前筛选没有匹配的申请人" : "还没有申请人档案"}
      </div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasFilters
          ? "可以先清空筛选，再按申请人姓名、分组或签证状态重新定位。"
          : "建议先新建申请人，再进入详情页补齐资料、案件和自动化任务。"}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasFilters ? (
          <Button type="button" variant="outline" onClick={onClearFilters}>
            清空筛选
          </Button>
        ) : null}
        {!hasFilters && canEditApplicants ? (
          <Button type="button" onClick={onCreateApplicant}>
            <UserPlus className="mr-2 h-4 w-4" />
            先新建申请人
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export const ApplicantCrmListPanel = memo(function ApplicantCrmListPanel({
  rows,
  selectedApplicantIds,
  allVisibleSelected,
  canEditApplicants,
  loading,
  loadingMore,
  hasMoreVisibleRows,
  totalDisplayRows,
  hasFilters,
  batchActionLoading,
  onToggleAllVisible,
  onToggleApplicant,
  onOpenApplicant,
  onPrefetchApplicant,
  onSetGroup,
  onClearGroup,
  onDelete,
  onClearSelection,
  onLoadMore,
  onClearFilters,
  onCreateApplicant,
}: ApplicantCrmListPanelProps) {
  const hasRows = rows.length > 0

  return (
    <Card className="border-gray-200 bg-white/90">
      <CardHeader>
        <CardTitle>申请人列表</CardTitle>
        <CardDescription>
          点击行或“查看详情”进入申请人工作台。
          {!loading && totalDisplayRows > 0 ? (
            <span className="ml-2 text-gray-400">
              当前显示 {rows.length} / {totalDisplayRows} 位
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canEditApplicants ? (
          <ApplicantCrmBatchToolbar
            selectedCount={selectedApplicantIds.length}
            batchActionLoading={batchActionLoading}
            onSetGroup={onSetGroup}
            onClearGroup={onClearGroup}
            onDelete={onDelete}
            onClearSelection={onClearSelection}
          />
        ) : null}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
          </div>
        ) : hasRows ? (
          <ApplicantCrmRowsTable
            rows={rows}
            selectedApplicantIds={selectedApplicantIds}
            allVisibleSelected={allVisibleSelected}
            onToggleAllVisible={onToggleAllVisible}
            onToggleApplicant={onToggleApplicant}
            onOpenApplicant={onOpenApplicant}
            onPrefetchApplicant={onPrefetchApplicant}
          />
        ) : (
          <ApplicantCrmEmptyState
            hasFilters={hasFilters}
            canEditApplicants={canEditApplicants}
            onClearFilters={onClearFilters}
            onCreateApplicant={onCreateApplicant}
          />
        )}
        {!loading && hasRows && hasMoreVisibleRows ? (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center">
            <div className="text-sm text-gray-500">
              当前显示 {rows.length} / {totalDisplayRows} 位申请人
            </div>
            <Button type="button" variant="outline" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "加载中..." : "加载更多申请人"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
})

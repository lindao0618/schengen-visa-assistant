"use client"

import { memo } from "react"
import { FolderPlus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"

type ApplicantCrmBatchToolbarProps = {
  selectedCount: number
  batchActionLoading: boolean
  onSetGroup: () => void
  onClearGroup: () => void | Promise<void>
  onDelete: () => void
  onClearSelection: () => void
}

export const ApplicantCrmBatchToolbar = memo(function ApplicantCrmBatchToolbar({
  selectedCount,
  batchActionLoading,
  onSetGroup,
  onClearGroup,
  onDelete,
  onClearSelection,
}: ApplicantCrmBatchToolbarProps) {
  if (selectedCount <= 0) {
    return null
  }

  return (
    <div className="sticky top-3 z-20 mb-4 rounded-2xl border border-white/5 bg-black/80 p-4 text-white backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="font-mono text-sm font-semibold text-white">已选中 {selectedCount} 位申请人</div>
          <div className="text-xs text-white/45">可直接设置分组、清空分组或批量删除；工具条会停留在列表顶部。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.06]" onClick={onSetGroup} disabled={batchActionLoading}>
            <FolderPlus className="mr-2 h-4 w-4" />
            设置分组
          </Button>
          <Button type="button" variant="outline" className="rounded-full border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/[0.06]" onClick={onClearGroup} disabled={batchActionLoading}>
            清空分组
          </Button>
          <Button type="button" variant="ghost" className="rounded-full text-white/55 hover:bg-white/[0.04] hover:text-white" onClick={onClearSelection} disabled={batchActionLoading}>
            <X className="mr-2 h-4 w-4" />
            取消选择
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete} disabled={batchActionLoading}>
            <Trash2 className="mr-2 h-4 w-4" />
            批量删除
          </Button>
        </div>
      </div>
    </div>
  )
})

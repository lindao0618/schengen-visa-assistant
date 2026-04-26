"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import type { AuditDialogState } from "./types"

type AuditDialogProps = {
  auditDialog: AuditDialogState
  auditProgressSteps: string[]
  auditPhaseIndex: number
  canRunAutomation: boolean
  onClose: () => void
  onAutoFix: () => void | Promise<void>
}

export function AuditDialog({
  auditDialog,
  auditProgressSteps,
  auditPhaseIndex,
  canRunAutomation,
  onClose,
  onAutoFix,
}: AuditDialogProps) {
  const description =
    auditDialog.status === "running"
      ? "正在读取 Excel、识别字段并校验规则，请稍候。"
      : auditDialog.status === "success"
        ? "审核已通过，可以继续后续流程。"
        : "审核发现问题，请根据提示修正后再继续。"

  return (
    <Dialog open={auditDialog.open} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className={auditDialog.status === "error" ? "text-red-600" : auditDialog.status === "success" ? "text-emerald-600" : ""}>
            {auditDialog.title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {auditDialog.helperText ? <div className="text-sm text-slate-500">{auditDialog.helperText}</div> : null}
        </DialogHeader>

        {auditDialog.status === "running" ? (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{auditProgressSteps[auditPhaseIndex]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {auditProgressSteps.map((step, index) => {
                const isDone = index < auditPhaseIndex
                const isActive = index === auditPhaseIndex

                return (
                  <div
                    key={step}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs transition-colors",
                      isDone
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : isActive
                          ? "border-blue-300 bg-white text-blue-700 shadow-sm"
                          : "border-blue-100 bg-blue-50/60 text-blue-400",
                    )}
                  >
                    <div className="font-semibold">阶段 {index + 1}</div>
                    <div className="mt-1">{step}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {auditDialog.status === "error" && auditDialog.issues.length > 0 ? (
          <div className="max-h-[360px] space-y-2 overflow-auto rounded-lg border border-red-200 bg-red-50/50 p-3">
            {auditDialog.issues.map((issue, index) => (
              <div key={`${issue.field}-${index}`} className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm">
                <div className="font-medium text-red-700">
                  {index + 1}. {issue.field}
                </div>
                <div className="mt-1 text-gray-700">{issue.message}</div>
                {issue.value ? <div className="mt-1 text-xs text-gray-500">当前值：{issue.value}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          {auditDialog.status === "error" && auditDialog.scope === "usVisa" ? (
            <Button variant="outline" onClick={() => void onAutoFix()} disabled={auditDialog.autoFixing || !canRunAutomation}>
              {auditDialog.autoFixing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在自动修复...
                </>
              ) : (
                "自动修复可修正项"
              )}
            </Button>
          ) : null}
          <Button onClick={onClose} disabled={auditDialog.autoFixing}>
            {auditDialog.status === "error" ? "我知道了，去修正" : "确定"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

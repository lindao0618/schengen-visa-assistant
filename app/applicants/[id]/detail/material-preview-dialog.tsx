"use client"

/* eslint-disable @next/next/no-img-element */

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import type { PreviewState } from "./types"

type MaterialPreviewDialogProps = {
  preview: PreviewState
  canEditApplicant: boolean
  onClose: () => void
  onSelectExcelPreviewMode: (mode: "form" | "table") => void
  onEnableExcelEdit: () => void
  onSaveExcelFromPreview: () => void | Promise<void>
  onCancelExcelEdit: () => void
  onSelectExcelSheet: (sheetName: string) => void
  onSetExcelCell: (rowIndex: number, colIndex: number, value: string) => void
  excelColumnMinWidthClass: (cellIndex: number) => string
}

export function MaterialPreviewDialog({
  preview,
  canEditApplicant,
  onClose,
  onSelectExcelPreviewMode,
  onEnableExcelEdit,
  onSaveExcelFromPreview,
  onCancelExcelEdit,
  onSelectExcelSheet,
  onSetExcelCell,
  excelColumnMinWidthClass,
}: MaterialPreviewDialogProps) {
  return (
    <Dialog
      open={preview.open}
      onOpenChange={(open) => {
        if (open) return
        if (preview.kind === "excel" && preview.excelEditMode && preview.excelDirty) {
          if (!window.confirm("有未保存的修改，确定关闭吗？")) return
        }
        onClose()
      }}
    >
      <DialogContent
        className={cn(
          "!flex max-h-[92vh] max-w-none flex-col gap-4 overflow-hidden p-6",
          preview.kind === "excel" && preview.excelEditMode
            ? "w-[min(99.5vw,1920px)]"
            : preview.kind === "excel"
              ? "w-[min(98vw,1680px)]"
              : "w-[min(96vw,72rem)]",
        )}
      >
        <DialogHeader>
          <DialogTitle>{preview.title || "文件预览"}</DialogTitle>
          {preview.kind === "excel" ? (
            <DialogDescription>
              预览申根/美签 Excel。点击“在线编辑”可直接改单元格并保存回档案，保存后将统一写回为 `.xlsx`。
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 p-3">
          {preview.loading && <div className="p-6 text-sm text-gray-500">正在加载预览...</div>}
          {!preview.loading && preview.error && <div className="p-6 text-sm text-amber-700">{preview.error}</div>}
          {!preview.loading && !preview.error && preview.kind === "pdf" && preview.objectUrl && (
            <iframe src={preview.objectUrl} className="h-[70vh] w-full rounded-xl" />
          )}
          {!preview.loading && !preview.error && preview.kind === "image" && preview.objectUrl && (
            <img src={preview.objectUrl} alt={preview.title} className="mx-auto max-h-[70vh] max-w-full object-contain" />
          )}
          {!preview.loading && !preview.error && preview.kind === "excel" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {preview.excelUsVisaSections.length > 0 && !preview.excelEditMode ? (
                  <>
                    <Button
                      size="sm"
                      variant={preview.excelPreviewMode === "form" ? "default" : "outline"}
                      onClick={() => onSelectExcelPreviewMode("form")}
                    >
                      表单视图
                    </Button>
                    <Button
                      size="sm"
                      variant={preview.excelPreviewMode === "table" ? "default" : "outline"}
                      onClick={() => onSelectExcelPreviewMode("table")}
                    >
                      原始 Sheet1
                    </Button>
                  </>
                ) : null}
                {preview.excelEditMode ? (
                  <>
                    <Button size="sm" onClick={() => void onSaveExcelFromPreview()} disabled={preview.excelSaving || !canEditApplicant}>
                      {preview.excelSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {preview.excelSaving ? "保存中..." : "保存到档案"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCancelExcelEdit} disabled={preview.excelSaving}>
                      放弃修改
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" disabled={!canEditApplicant} onClick={onEnableExcelEdit}>
                    在线编辑
                  </Button>
                )}
                {preview.excelDirty ? <span className="text-xs text-amber-700">有未保存修改</span> : null}
              </div>
              {preview.excelUsVisaSections.length > 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  当前仅预览 `Sheet1`。表单视图读取 A-C 主数据列，原始视图只展示 `Sheet1` 的表格内容。
                </div>
              ) : null}
              {preview.excelSheets.length > 1 && (
                <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                  {preview.excelSheets.map((sheet) => (
                    <Button
                      key={sheet.name}
                      variant={sheet.name === preview.activeExcelSheet ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectExcelSheet(sheet.name)}
                      disabled={preview.excelSaving}
                    >
                      {sheet.name}
                    </Button>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500">
                {preview.activeExcelSheet ? `Sheet：${preview.activeExcelSheet}` : "Sheet：-"}
                {" / "}
                {preview.tableRows.length} 行
              </div>
              {preview.excelSaving ? (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{preview.excelSavingStatus || "正在保存到档案..."}</span>
                </div>
              ) : null}
              {preview.excelUsVisaSections.length > 0 && preview.excelPreviewMode === "form" && !preview.excelEditMode ? (
                <div className="space-y-4">
                  {preview.excelUsVisaSections.map((section) => {
                    const sectionContent = (
                      <div className="grid gap-3 md:grid-cols-2">
                        {section.items.map((item) => (
                          <div
                            key={`${section.title}-${item.rowIndex}-${item.field}-${item.label}`}
                            className={cn(
                              "rounded-xl border p-4 shadow-sm",
                              item.value ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50/70",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-slate-900">{item.label || item.field || `第 ${item.rowIndex} 行`}</div>
                                {item.field ? <div className="text-[11px] text-slate-500">{item.field}</div> : null}
                              </div>
                              <div className="text-[11px] text-slate-400">第 {item.rowIndex} 行</div>
                            </div>
                            <div className={cn("mt-3 whitespace-pre-wrap break-words text-sm", item.value ? "text-slate-800" : "text-rose-600")}>
                              {item.value || "未填写"}
                            </div>
                            {item.note ? <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{item.note}</div> : null}
                          </div>
                        ))}
                      </div>
                    )

                    return section.title.includes("空着就行") ? (
                      <details key={section.title} className="rounded-xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900">{section.title}</summary>
                        <div className="mt-4">{sectionContent}</div>
                      </details>
                    ) : (
                      <section key={section.title} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900">{section.title}</div>
                        {sectionContent}
                      </section>
                    )
                  })}
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border border-gray-200">
                  <table className="w-max min-w-full border-collapse text-xs">
                    <tbody>
                      {(() => {
                        const maxCols =
                          preview.tableRows.length === 0
                            ? 0
                            : Math.max(...preview.tableRows.map((row) => row.length))
                        const visibleCols =
                          preview.excelUsVisaSections.length > 0 && maxCols > 0 ? Math.min(3, maxCols) : maxCols
                        return preview.tableRows.map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`} className={rowIndex === 0 ? "bg-gray-50" : ""}>
                            <td className="sticky left-0 z-[1] w-11 min-w-[2.75rem] border bg-white px-1.5 py-1 text-right text-[11px] text-gray-400">
                              {rowIndex + 1}
                            </td>
                            {Array.from({ length: visibleCols }, (_, cellIndex) => {
                              const cell = row[cellIndex] ?? ""
                              const colClass = excelColumnMinWidthClass(cellIndex)
                              return (
                                <td key={`cell-${rowIndex}-${cellIndex}`} className={cn("border p-0 align-top", colClass)}>
                                  {preview.excelEditMode ? (
                                    <Input
                                      className={cn(
                                        "h-auto min-h-8 w-full rounded-none border-0 py-1.5 text-xs shadow-none focus-visible:ring-1",
                                        colClass,
                                      )}
                                      value={cell}
                                      onChange={(event) => onSetExcelCell(rowIndex, cellIndex, event.target.value)}
                                      disabled={preview.excelSaving}
                                    />
                                  ) : (
                                    <div className={cn("whitespace-pre-wrap break-words px-2 py-1.5", colClass)}>{cell || ""}</div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                  {preview.tableRows.length === 0 && <div className="p-4 text-sm text-gray-500">Excel 内容为空。</div>}
                </div>
              )}
            </div>
          )}
          {!preview.loading && !preview.error && preview.kind === "word" && (
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: preview.htmlContent || "<p>暂无可预览内容</p>" }} />
          )}
          {!preview.loading && !preview.error && preview.kind === "text" && (
            <pre className="whitespace-pre-wrap break-words p-3 text-xs">{preview.textContent || "暂无可预览内容"}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

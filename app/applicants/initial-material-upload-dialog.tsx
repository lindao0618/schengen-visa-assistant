"use client"

import type { ChangeEvent } from "react"
import { useMemo, useState } from "react"
import { CheckCircle2, FileUp, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getInitialMaterialUploadSlots } from "@/lib/applicant-initial-material-upload"

type InitialMaterialUploadDialogProps = {
  open: boolean
  applicantId: string
  applicantName: string
  visaTypes: string[]
  onFinish: () => void
}

export function InitialMaterialUploadDialog({
  open,
  applicantId,
  applicantName,
  visaTypes,
  onFinish,
}: InitialMaterialUploadDialogProps) {
  const slots = useMemo(() => getInitialMaterialUploadSlots(visaTypes), [visaTypes])
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({})
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const selectedCount = Object.values(selectedFiles).filter(Boolean).length

  const updateFile = (slotKey: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setSelectedFiles((prev) => ({
      ...prev,
      [slotKey]: file,
    }))
    setMessage("")
  }

  const uploadSelectedFiles = async () => {
    const formData = new FormData()
    Object.entries(selectedFiles).forEach(([slot, file]) => {
      if (file) formData.append(slot, file)
    })

    if (selectedCount === 0) {
      setMessage("请先选择至少一个文件，或者点击跳过直接进入详情。")
      return
    }

    setUploading(true)
    setMessage("")
    try {
      const response = await fetch(`/api/applicants/${applicantId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "上传材料失败")
      }
      onFinish()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传材料失败")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !uploading) onFinish()
      }}
    >
      <DialogContent className="max-w-2xl border-slate-200 bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-950">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <FileUp className="h-4 w-4" />
            </span>
            创建完成，先上传关键材料
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {applicantName} 已建档。根据刚才选择的签证类型，先把最常用材料放进去，进入详情后自动化流程就可以直接使用。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {slots.map((slot) => {
            const file = selectedFiles[slot.key]
            return (
              <div key={slot.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-semibold text-slate-950">{slot.label}</Label>
                    <div className="text-sm text-slate-500">{slot.helperText}</div>
                    {file ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        已选择：{file.name}
                      </div>
                    ) : null}
                  </div>
                  <Input
                    type="file"
                    accept={slot.accept}
                    onChange={(event) => updateFile(slot.key, event)}
                    className="max-w-sm bg-white"
                    disabled={uploading}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div> : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={onFinish} disabled={uploading}>
            跳过，进入详情
          </Button>
          <Button
            type="button"
            onClick={() => void uploadSelectedFiles()}
            disabled={uploading || selectedCount === 0}
            className="bg-slate-950 text-white hover:bg-slate-800"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            {uploading ? "上传中..." : "上传并进入详情"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ExternalLink, FolderTree, Link2, Loader2, RefreshCw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type WecomDriveRoot = {
  id: string
  label: string
  spaceId: string
  fatherId: string
}

type WecomDriveStatus = {
  configured: boolean
  missing: string[]
  roots: WecomDriveRoot[]
}

type WecomDriveItem = {
  fileId: string
  fileName: string
  spaceId: string
  fatherId: string
  fileSize: string
  createdAt: string
  updatedAt: string
  fileType: string
  fileStatus: string
  url?: string
  isFolder: boolean
}

type ApplicantWecomFileBinding = {
  id: string
  fileId: string
  fileName: string
  spaceId: string
  fatherId: string
  fileSize: string
  fileType: string
  rootId: string
  rootLabel: string
  url?: string
  linkedAt: string
  linkedByUserId: string
  createdAt: string
  updatedAt: string
}

type FolderCrumb = {
  fatherId: string
  label: string
}

function formatDateTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}

function formatBytes(value: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return "-"
  if (numeric < 1024) return `${numeric} B`
  if (numeric < 1024 ** 2) return `${(numeric / 1024).toFixed(1)} KB`
  if (numeric < 1024 ** 3) return `${(numeric / 1024 ** 2).toFixed(1)} MB`
  return `${(numeric / 1024 ** 3).toFixed(1)} GB`
}

export function WecomDriveBindingsCard({ applicantId }: { applicantId: string }) {
  const [status, setStatus] = useState<WecomDriveStatus | null>(null)
  const [bindings, setBindings] = useState<ApplicantWecomFileBinding[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingBindings, setLoadingBindings] = useState(true)
  const [message, setMessage] = useState("")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedRootId, setSelectedRootId] = useState("")
  const [crumbs, setCrumbs] = useState<FolderCrumb[]>([])
  const [items, setItems] = useState<WecomDriveItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [submittingFileId, setSubmittingFileId] = useState("")
  const [removingBindingId, setRemovingBindingId] = useState("")

  const activeRoot = useMemo(
    () => status?.roots.find((item) => item.id === selectedRootId) || null,
    [selectedRootId, status?.roots],
  )

  const activeFatherId = crumbs[crumbs.length - 1]?.fatherId || activeRoot?.fatherId || ""

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const response = await fetch("/api/wecom/drive/status", { cache: "no-store" })
      const data = (await response.json()) as WecomDriveStatus & { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load WeCom drive status")
      }
      setStatus(data)
      if (!selectedRootId && data.roots[0]) {
        setSelectedRootId(data.roots[0].id)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load WeCom drive status")
    } finally {
      setLoadingStatus(false)
    }
  }, [selectedRootId])

  const loadBindings = useCallback(async () => {
    setLoadingBindings(true)
    try {
      const response = await fetch(`/api/applicants/${applicantId}/wecom-files`, { cache: "no-store" })
      const data = (await response.json()) as { items?: ApplicantWecomFileBinding[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load linked WeCom files")
      }
      setBindings(data.items || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load linked WeCom files")
    } finally {
      setLoadingBindings(false)
    }
  }, [applicantId])

  const loadFolder = useCallback(
    async (rootId: string, fatherId?: string) => {
      if (!rootId) return
      setLoadingItems(true)
      try {
        const params = new URLSearchParams({ rootId })
        if (fatherId) {
          params.set("fatherId", fatherId)
        }
        const response = await fetch(`/api/wecom/drive/files?${params.toString()}`, { cache: "no-store" })
        const data = (await response.json()) as { items?: WecomDriveItem[]; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Failed to load WeCom drive files")
        }
        setItems(data.items || [])
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load WeCom drive files")
      } finally {
        setLoadingItems(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadStatus()
    void loadBindings()
  }, [loadBindings, loadStatus])

  useEffect(() => {
    if (!pickerOpen || !activeRoot) return
    void loadFolder(activeRoot.id, activeFatherId)
  }, [activeFatherId, activeRoot, loadFolder, pickerOpen])

  const openPicker = () => {
    if (!status?.configured || !status.roots.length) return
    const nextRootId = selectedRootId || status.roots[0].id
    setSelectedRootId(nextRootId)
    setCrumbs([])
    setItems([])
    setPickerOpen(true)
  }

  const handleRootChange = (nextRootId: string) => {
    setSelectedRootId(nextRootId)
    setCrumbs([])
    setItems([])
  }

  const handleOpenFolder = async (item: WecomDriveItem) => {
    if (!item.isFolder) return
    const nextCrumbs = [...crumbs, { fatherId: item.fileId, label: item.fileName }]
    setCrumbs(nextCrumbs)
    await loadFolder(selectedRootId, item.fileId)
  }

  const handleJumpToCrumb = async (index: number) => {
    if (!activeRoot) return
    const nextCrumbs = index < 0 ? [] : crumbs.slice(0, index + 1)
    setCrumbs(nextCrumbs)
    const nextFatherId = nextCrumbs[nextCrumbs.length - 1]?.fatherId || activeRoot.fatherId
    await loadFolder(activeRoot.id, nextFatherId)
  }

  const handleBindFile = async (item: WecomDriveItem) => {
    setSubmittingFileId(item.fileId)
    setMessage("")
    try {
      const response = await fetch(`/api/applicants/${applicantId}/wecom-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootId: selectedRootId,
          fileId: item.fileId,
        }),
      })
      const data = (await response.json()) as { items?: ApplicantWecomFileBinding[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to link WeCom file")
      }
      setBindings(data.items || [])
      setMessage(`已关联微盘文件：${item.fileName}`)
      setPickerOpen(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to link WeCom file")
    } finally {
      setSubmittingFileId("")
    }
  }

  const handleRemoveBinding = async (bindingId: string) => {
    setRemovingBindingId(bindingId)
    setMessage("")
    try {
      const response = await fetch(`/api/applicants/${applicantId}/wecom-files/${bindingId}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as { items?: ApplicantWecomFileBinding[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove linked WeCom file")
      }
      setBindings(data.items || [])
      setMessage("已移除微盘文件关联")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove linked WeCom file")
    } finally {
      setRemovingBindingId("")
    }
  }

  return (
    <>
      <Card className="border-violet-200 bg-[linear-gradient(180deg,_#ffffff,_#f8f7ff)] shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg text-violet-950">
                <FolderTree className="h-5 w-5 text-violet-700" />
                企业微信微盘文件
              </CardTitle>
              <CardDescription className="text-violet-900/70">
                从企业微信微盘选择文件并关联到当前客户档案，不替代现有本地上传。
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadBindings()} disabled={loadingBindings}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingBindings ? "animate-spin" : ""}`} />
                刷新
              </Button>
              <Button
                size="sm"
                onClick={openPicker}
                disabled={loadingStatus || !status?.configured || !status?.roots.length}
                className="bg-violet-700 text-white hover:bg-violet-800"
              >
                <Link2 className="mr-2 h-4 w-4" />
                关联微盘文件
              </Button>
            </div>
          </div>
          {message ? <div className="text-sm text-violet-900/80">{message}</div> : null}
          {!loadingStatus && status && !status.configured ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              企业微信微盘尚未配置。缺少：{status.missing.join(", ")}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {loadingBindings ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在读取已关联文件...
            </div>
          ) : bindings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-violet-300 bg-white/70 px-4 py-6 text-sm text-violet-900/60">
              当前客户还没有关联企业微信微盘文件。
            </div>
          ) : (
            <div className="space-y-3">
              {bindings.map((binding) => (
                <div
                  key={binding.id}
                  className="rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{binding.fileName}</div>
                        <Badge variant="outline">{binding.rootLabel}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>大小：{formatBytes(binding.fileSize)}</span>
                        <span>关联时间：{formatDateTime(binding.linkedAt)}</span>
                        <span>文件 ID：{binding.fileId}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {binding.url ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={binding.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            打开
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRemoveBinding(binding.id)}
                        disabled={removingBindingId === binding.id}
                      >
                        {removingBindingId === binding.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        移除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>选择企业微信微盘文件</DialogTitle>
            <DialogDescription>从预先配置的微盘目录中选择文件，并绑定到当前客户档案。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>浏览起点</Label>
              <Select value={selectedRootId} onValueChange={handleRootChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择微盘根目录" />
                </SelectTrigger>
                <SelectContent>
                  {(status?.roots || []).map((root) => (
                    <SelectItem key={root.id} value={root.id}>
                      {root.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void handleJumpToCrumb(-1)} disabled={!activeRoot}>
                  根目录
                </Button>
                {crumbs.map((crumb, index) => (
                  <Button
                    key={`${crumb.fatherId}-${index}`}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => void handleJumpToCrumb(index)}
                  >
                    {crumb.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_160px_150px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                <div>名称</div>
                <div>大小</div>
                <div>更新时间</div>
                <div>操作</div>
              </div>
              <ScrollArea className="h-[420px]">
                {loadingItems ? (
                  <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在读取微盘内容...
                  </div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">当前目录暂无可显示文件。</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {items.map((item) => (
                      <div
                        key={item.fileId}
                        className="grid grid-cols-[minmax(0,1fr)_120px_160px_150px] items-center gap-3 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{item.fileName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.isFolder ? "文件夹" : item.fileType || "文件"}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{item.isFolder ? "-" : formatBytes(item.fileSize)}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(item.updatedAt)}</div>
                        <div className="flex items-center gap-2">
                          {item.isFolder ? (
                            <Button variant="outline" size="sm" onClick={() => void handleOpenFolder(item)}>
                              进入
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => void handleBindFile(item)}
                              disabled={submittingFileId === item.fileId}
                            >
                              {submittingFileId === item.fileId ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Link2 className="mr-2 h-4 w-4" />
                              )}
                              关联
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

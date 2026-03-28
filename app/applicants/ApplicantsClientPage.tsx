"use client"

/* eslint-disable @next/next/no-img-element */

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react"
import { ApplicantProfileSelector, ACTIVE_APPLICANT_PROFILE_KEY, ApplicantProfileSummary } from "@/components/applicant-profile-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FRANCE_TLS_CITY_OPTIONS, getFranceTlsCityLabel } from "@/lib/france-tls-city"
import { read, utils } from "xlsx"

type ApplicantProfileDetail = ApplicantProfileSummary & {
  usVisa?: {
    aaCode?: string
    surname?: string
    birthYear?: string
    passportNumber?: string
  }
  schengen?: {
    country?: string
    city?: string
  }
  files?: Record<string, { originalName: string; uploadedAt: string }>
}

type EditableApplicant = {
  name: string
  usVisaSurname: string
  usVisaBirthYear: string
  usVisaPassportNumber: string
  schengenCountry: string
  schengenVisaCity: string
}

type PreviewKind = "pdf" | "image" | "excel" | "word" | "text" | "unknown"

type PreviewState = {
  open: boolean
  loading: boolean
  title: string
  kind: PreviewKind
  objectUrl: string
  textContent: string
  htmlContent: string
  tableRows: string[][]
  error: string
}

const emptyForm: EditableApplicant = {
  name: "",
  usVisaSurname: "",
  usVisaBirthYear: "",
  usVisaPassportNumber: "",
  schengenCountry: "france",
  schengenVisaCity: "",
}

const emptyPreview: PreviewState = {
  open: false,
  loading: false,
  title: "",
  kind: "unknown",
  objectUrl: "",
  textContent: "",
  htmlContent: "",
  tableRows: [],
  error: "",
}

async function readJsonSafely<T>(response: Response) {
  const text = await response.text()
  if (!text) return null as T | null

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error("服务端返回了无法解析的响应，请刷新页面后重试")
  }
}

const usVisaUploadedSlots = [
  { key: "usVisaPhoto", label: "美签照片", accept: "image/*" },
  { key: "usVisaDs160Excel", label: "DS-160 / AIS Excel", accept: ".xlsx,.xls" },
] as const

const usVisaSubmissionSlots = [
  { key: "usVisaDs160ConfirmationPdf", label: "DS-160 确认页 PDF", accept: ".pdf,application/pdf" },
] as const

const schengenUploadedSlots = [
  { key: "schengenPhoto", label: "申根照片", accept: "image/*" },
  { key: "schengenExcel", label: "申根 Excel", accept: ".xlsx,.xls" },
  { key: "passportScan", label: "护照扫描件", accept: "image/*,.pdf,application/pdf" },
] as const

const schengenSubmissionSlots = [
  { key: "franceTlsAccountsJson", label: "TLS 注册 accounts JSON", accept: ".json,application/json" },
  { key: "franceApplicationJson", label: "法国新申请 JSON", accept: ".json,application/json" },
  { key: "franceReceiptPdf", label: "法国回执单 PDF", accept: ".pdf,application/pdf" },
  { key: "franceFinalSubmissionPdf", label: "法国最终表 PDF", accept: ".pdf,application/pdf" },
] as const

const schengenMaterialDocumentSlots = [
  { key: "schengenItineraryPdf", label: "行程单 PDF", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterCnPdf", label: "解释信 PDF（中文）", accept: ".pdf,application/pdf" },
  { key: "schengenExplanationLetterEnPdf", label: "解释信 PDF（英文）", accept: ".pdf,application/pdf" },
  { key: "schengenHotelReservation", label: "酒店预订单材料", accept: ".pdf,.doc,.docx,image/*" },
  { key: "schengenFlightReservation", label: "机票/车票预订单材料", accept: ".pdf,.doc,.docx,image/*" },
] as const

export default function ApplicantsClientPage() {
  const [profiles, setProfiles] = useState<ApplicantProfileDetail[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [form, setForm] = useState<EditableApplicant>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [materialCategory, setMaterialCategory] = useState<"usVisa" | "schengen">("usVisa")
  const [preview, setPreview] = useState<PreviewState>(emptyPreview)

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId]
  )

  const loadProfiles = async () => {
    const res = await fetch("/api/applicants", { cache: "no-store" })
    const data = await readJsonSafely<{ profiles?: ApplicantProfileDetail[]; error?: string }>(res)
    if (!res.ok) {
      setMessage(data?.error || "加载申请人档案失败")
      return
    }

    const nextProfiles = (data?.profiles || []) as ApplicantProfileDetail[]
    setProfiles(nextProfiles)

    const savedId = window.localStorage.getItem(ACTIVE_APPLICANT_PROFILE_KEY) || ""
    const fallbackId =
      savedId && nextProfiles.some((profile) => profile.id === savedId)
        ? savedId
        : nextProfiles[0]?.id || ""
    setSelectedId(fallbackId)
  }

  useEffect(() => {
    void loadProfiles()
  }, [])

  useEffect(() => {
    if (!selectedProfile) {
      setForm(emptyForm)
      return
    }

    setForm({
      name: selectedProfile.name || selectedProfile.label || "",
      usVisaSurname: selectedProfile.usVisa?.surname || "",
      usVisaBirthYear: selectedProfile.usVisa?.birthYear || "",
      usVisaPassportNumber: selectedProfile.usVisa?.passportNumber || "",
      schengenCountry: selectedProfile.schengen?.country || "france",
      schengenVisaCity: selectedProfile.schengen?.city || "",
    })
  }, [selectedProfile])

  const saveProfile = async () => {
    setSaving(true)
    setMessage("")

    try {
      const payload = {
        name: form.name.trim(),
        usVisa: {
          surname: form.usVisaSurname.trim(),
          birthYear: form.usVisaBirthYear.trim(),
          passportNumber: form.usVisaPassportNumber.trim(),
        },
        schengen: {
          country: form.schengenCountry,
          city: form.schengenVisaCity.trim(),
        },
      }

      if (!payload.name) {
        throw new Error("请先填写申请人姓名")
      }

      if (!selectedId) {
        const res = await fetch("/api/applicants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await readJsonSafely<{ profile?: ApplicantProfileDetail; error?: string }>(res)
        if (!res.ok) throw new Error(data?.error || "创建失败")
        if (!data?.profile?.id) throw new Error("创建后未返回申请人档案 ID")

        await loadProfiles()
        window.localStorage.setItem(ACTIVE_APPLICANT_PROFILE_KEY, data.profile.id)
        setSelectedId(data.profile.id)
        setMessage("申请人档案已创建")
        return
      }

      const res = await fetch(`/api/applicants/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await readJsonSafely<{ profile?: ApplicantProfileDetail; error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || "保存失败")

      await loadProfiles()
      setMessage("申请人档案已更新")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const createNew = () => {
    setSelectedId("")
    setForm(emptyForm)
    setMessage("")
  }

  const removeCurrent = async () => {
    if (!selectedId) return

    setSaving(true)
    setMessage("")
    try {
      const res = await fetch(`/api/applicants/${selectedId}`, { method: "DELETE" })
      const data = await readJsonSafely<{ success?: boolean; error?: string }>(res)
      if (!res.ok) throw new Error(data?.error || "删除失败")

      await loadProfiles()
      setSelectedId("")
      setForm(emptyForm)
      setMessage("申请人档案已删除")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败")
    } finally {
      setSaving(false)
    }
  }

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>, slot: string) => {
    const file = event.target.files?.[0]
    if (!file || !selectedId) return

    setSaving(true)
    setMessage("")
    try {
      const formData = new FormData()
      formData.append(slot, file)

      const res = await fetch(`/api/applicants/${selectedId}/files`, {
        method: "POST",
        body: formData,
      })
      const data = await readJsonSafely<{
        profile?: ApplicantProfileDetail
        parsedUsVisaDetails?: {
          surname?: string
          birthYear?: string
          passportNumber?: string
        }
        parsedSchengenDetails?: {
          city?: string
        }
        error?: string
      }>(res)
      if (!res.ok) throw new Error(data?.error || "上传失败")

      await loadProfiles()

      const parsed = data?.parsedUsVisaDetails as
        | {
            surname?: string
            birthYear?: string
            passportNumber?: string
          }
        | undefined
      const parsedSchengen = data?.parsedSchengenDetails as
        | {
            city?: string
          }
        | undefined

      const parsedFields = [
        parsed?.surname ? "姓" : "",
        parsed?.birthYear ? "出生年份" : "",
        parsed?.passportNumber ? "护照号" : "",
        parsedSchengen?.city ? `TLS 递签城市（${getFranceTlsCityLabel(parsedSchengen.city) || parsedSchengen.city}）` : "",
      ].filter(Boolean)

      setMessage(parsedFields.length > 0 ? `资料已上传，并自动识别${parsedFields.join("、")}` : "资料已上传")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败")
    } finally {
      setSaving(false)
      event.target.value = ""
    }
  }

  const closePreview = () => {
    setPreview((prev) => {
      if (prev.objectUrl) URL.revokeObjectURL(prev.objectUrl)
      return emptyPreview
    })
  }

  const openPreview = async (slot: string, meta: { originalName: string; uploadedAt: string }) => {
    if (!selectedId) return
    setPreview({
      ...emptyPreview,
      open: true,
      loading: true,
      title: meta.originalName || slot,
    })
    try {
      const res = await fetch(`/api/applicants/${selectedId}/files/${slot}`, { credentials: "include" })
      if (!res.ok) throw new Error("文件读取失败")
      const blob = await res.blob()
      const filename = (meta.originalName || slot).toLowerCase()
      const mime = (blob.type || "").toLowerCase()
      const objectUrl = URL.createObjectURL(blob)

      if (mime.includes("pdf") || filename.endsWith(".pdf")) {
        setPreview((prev) => ({ ...prev, loading: false, kind: "pdf", objectUrl }))
        return
      }
      if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filename)) {
        setPreview((prev) => ({ ...prev, loading: false, kind: "image", objectUrl }))
        return
      }
      if (/\.(xlsx|xls)$/.test(filename) || mime.includes("spreadsheet") || mime.includes("excel")) {
        const ab = await blob.arrayBuffer()
        const wb = read(ab, { type: "array" })
        const sheetName = wb.SheetNames[0]
        const sheet = sheetName ? wb.Sheets[sheetName] : undefined
        const rows = sheet
          ? (utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][])
              .slice(0, 80)
              .map((row) => (row as unknown[]).slice(0, 20).map((cell) => String(cell ?? "")))
          : []
        URL.revokeObjectURL(objectUrl)
        setPreview((prev) => ({ ...prev, loading: false, kind: "excel", tableRows: rows }))
        return
      }
      if (/\.(docx?|rtf)$/.test(filename) || mime.includes("word") || mime.includes("officedocument.wordprocessingml")) {
        const ab = await blob.arrayBuffer()
        try {
          const mammoth = (await import("mammoth")) as unknown as {
            convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
            extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
          }
          const html = await mammoth.convertToHtml({ arrayBuffer: ab })
          URL.revokeObjectURL(objectUrl)
          setPreview((prev) => ({ ...prev, loading: false, kind: "word", htmlContent: html.value || "" }))
          return
        } catch {
          const mammoth = (await import("mammoth")) as unknown as {
            extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
          }
          const text = await mammoth.extractRawText({ arrayBuffer: ab })
          URL.revokeObjectURL(objectUrl)
          setPreview((prev) => ({ ...prev, loading: false, kind: "text", textContent: text.value || "" }))
          return
        }
      }

      if (mime.includes("json") || mime.startsWith("text/") || /\.(json|txt|csv|md)$/i.test(filename)) {
        const text = await blob.text()
        URL.revokeObjectURL(objectUrl)
        setPreview((prev) => ({ ...prev, loading: false, kind: "text", textContent: text }))
        return
      }

      setPreview((prev) => ({
        ...prev,
        loading: false,
        kind: "unknown",
        objectUrl,
        error: "该格式暂不支持内嵌预览，可点击下载查看。",
      }))
    } catch (error) {
      setPreview((prev) => ({
        ...prev,
        loading: false,
        kind: "unknown",
        error: error instanceof Error ? error.message : "预览失败",
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-8 dark:from-gray-950 dark:to-black">
      <div className="mx-auto max-w-6xl space-y-6">
        <ApplicantProfileSelector />

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle>申请人档案</CardTitle>
              <CardDescription>一个客户一份档案，登录后按你的账号单独管理。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedId || "__new__"} onValueChange={(value) => (value === "__new__" ? createNew() : setSelectedId(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择申请人档案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">新建申请人档案</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name || profile.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" className="w-full" onClick={createNew}>
                新建档案
              </Button>

              {selectedProfile && (
                <Button variant="outline" className="w-full text-red-600" onClick={removeCurrent} disabled={saving}>
                  删除当前档案
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle>{selectedId ? "编辑申请人档案" : "新建申请人档案"}</CardTitle>
              <CardDescription>我先把档案拆成信息内容、上传材料、递签材料三层，后面你告诉我归类规则，我就继续顺着加。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <SectionCard title="基础信息" description="当前先保留最核心的申请人姓名。">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="申请人姓名" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
                </div>
              </SectionCard>

              <SectionCard title="材料分类" description="通过下拉快速切换查看和维护美签/申根档案。">
                <div className="max-w-sm space-y-2">
                  <Label>分类</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={materialCategory === "usVisa" ? "default" : "outline"}
                      onClick={() => setMaterialCategory("usVisa")}
                      className="w-full"
                    >
                      美签
                    </Button>
                    <Button
                      type="button"
                      variant={materialCategory === "schengen" ? "default" : "outline"}
                      onClick={() => setMaterialCategory("schengen")}
                      className="w-full"
                    >
                      申根
                    </Button>
                  </div>
                </div>
              </SectionCard>

              {materialCategory === "usVisa" && (
              <SectionCard title="美签" description="美签档案现在明确区分信息内容、上传材料、递签材料。">
                <Subsection
                  title="信息内容"
                  description="AA 码只会在 DS-160 填表成功后自动回写。姓、出生年份、护照号可以由上传的 Excel 自动识别。"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <ReadOnlyField
                      label="Application ID（AA 码）"
                      value={selectedProfile?.usVisa?.aaCode || ""}
                      placeholder="仅在 DS-160 填表成功后自动回写"
                    />
                    <Field
                      label="姓"
                      value={form.usVisaSurname}
                      onChange={(value) => setForm((prev) => ({ ...prev, usVisaSurname: value }))}
                      placeholder="拼音姓氏"
                    />
                    <Field
                      label="出生年份"
                      value={form.usVisaBirthYear}
                      onChange={(value) => setForm((prev) => ({ ...prev, usVisaBirthYear: value }))}
                      placeholder="例如 1990"
                    />
                    <Field
                      label="护照号"
                      value={form.usVisaPassportNumber}
                      onChange={(value) => setForm((prev) => ({ ...prev, usVisaPassportNumber: value }))}
                      placeholder="护照号码"
                    />
                  </div>
                </Subsection>

                <Subsection
                  title="上传材料"
                  description="这类是你主动上传给系统使用的原始资料，比如照片和 Excel。"
                >
                  <UploadGrid
                    selectedId={selectedId}
                    selectedProfile={selectedProfile}
                    slots={usVisaUploadedSlots}
                    onUpload={uploadFiles}
                    onPreview={openPreview}
                  />
                </Subsection>

                <Subsection
                  title="递签材料"
                  description="这类是流程跑完后生成、可用于递签或留档的成品材料。DS-160 确认页 PDF 现在归到这里。"
                >
                  <UploadGrid
                    selectedId={selectedId}
                    selectedProfile={selectedProfile}
                    slots={usVisaSubmissionSlots}
                    onUpload={uploadFiles}
                    onPreview={openPreview}
                    emptyMessage="当前还没有递签材料。DS-160 提交成功后会自动归档到这里。"
                  />
                </Subsection>
              </SectionCard>
              )}

              {materialCategory === "schengen" && (
              <SectionCard title="申根" description="申根也先按同样的结构搭好，后面你告诉我哪些属于递签材料，我继续往这里归类。">
                <Subsection title="信息内容" description="当前保留申根国家和 TLS 递签城市。上传申根 Excel 后会自动识别递签城市，也可以在这里手动修正。">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>申根国家</Label>
                      <Select
                        value={form.schengenCountry}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, schengenCountry: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择国家" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="france">法国</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>TLS 递签城市</Label>
                      <Select
                        value={form.schengenVisaCity || "__unset__"}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            schengenVisaCity: value === "__unset__" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="上传申根 Excel 后会自动识别" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unset__">未设置</SelectItem>
                          {FRANCE_TLS_CITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.value} - {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Subsection>

                <Subsection title="上传材料" description="这类先放原始资料，比如照片、Excel、护照扫描件。">
                  <UploadGrid
                    selectedId={selectedId}
                    selectedProfile={selectedProfile}
                    slots={schengenUploadedSlots}
                    onUpload={uploadFiles}
                    onPreview={openPreview}
                  />
                </Subsection>

                <Subsection
                  title="递签材料"
                  description="这块先留出来，后面你告诉我哪些法签产物属于递签材料，我就直接归到这里。"
                >
                  <UploadGrid
                    selectedId={selectedId}
                    selectedProfile={selectedProfile}
                    slots={schengenSubmissionSlots}
                    onUpload={uploadFiles}
                    onPreview={openPreview}
                    emptyMessage="当前还没有申根递签材料，后面可以继续往这里加。"
                  />
                </Subsection>

                <Subsection
                  title="材料文档"
                  description="行程单、解释信以及后续的酒店、机票材料都会集中放在这里。行程单和解释信生成成功后会自动归档到当前申请人。"
                >
                  <UploadGrid
                    selectedId={selectedId}
                    selectedProfile={selectedProfile}
                    slots={schengenMaterialDocumentSlots}
                    onUpload={uploadFiles}
                    onPreview={openPreview}
                    emptyMessage="行程单、解释信、酒店、机票等材料文档会在这里集中管理。"
                  />
                </Subsection>
              </SectionCard>
              )}

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Button onClick={saveProfile} disabled={saving}>
                  {saving ? "保存中..." : "保存档案"}
                </Button>
                {message && <div className="text-sm text-gray-600 dark:text-gray-300">{message}</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={preview.open} onOpenChange={(open) => (!open ? closePreview() : null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>文件预览 · {preview.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-auto rounded-md border p-2">
            {preview.loading && <div className="p-4 text-sm text-gray-500">正在加载预览...</div>}
            {!preview.loading && preview.error && (
              <div className="p-4 text-sm text-amber-700">
                {preview.error}
                {preview.objectUrl && (
                  <a className="ml-2 text-blue-600 hover:underline" href={preview.objectUrl} target="_blank" rel="noreferrer">
                    下载文件
                  </a>
                )}
              </div>
            )}
            {!preview.loading && !preview.error && preview.kind === "pdf" && preview.objectUrl && (
              <iframe src={preview.objectUrl} className="h-[70vh] w-full" />
            )}
            {!preview.loading && !preview.error && preview.kind === "image" && preview.objectUrl && (
              <img src={preview.objectUrl} alt={preview.title} className="mx-auto max-h-[70vh] max-w-full object-contain" />
            )}
            {!preview.loading && !preview.error && preview.kind === "excel" && (
              <div className="overflow-auto">
                <table className="min-w-full border-collapse text-xs">
                  <tbody>
                    {preview.tableRows.map((row, rIdx) => (
                      <tr key={`r-${rIdx}`}>
                        {row.map((cell, cIdx) => (
                          <td key={`c-${rIdx}-${cIdx}`} className="border px-2 py-1 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.tableRows.length === 0 && <div className="p-4 text-sm text-gray-500">Excel 内容为空。</div>}
              </div>
            )}
            {!preview.loading && !preview.error && preview.kind === "word" && (
              <div className="prose max-w-none p-3" dangerouslySetInnerHTML={{ __html: preview.htmlContent || "<p>暂无可预览内容</p>" }} />
            )}
            {!preview.loading && !preview.error && preview.kind === "text" && (
              <pre className="whitespace-pre-wrap break-words p-3 text-xs">{preview.textContent || "暂无可预览内容"}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
      <div className="mb-4 space-y-1">
        <div className="text-base font-semibold text-gray-900 dark:text-white">{title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function Subsection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      {children}
    </div>
  )
}

function UploadGrid({
  selectedId,
  selectedProfile,
  slots,
  onUpload,
  onPreview,
  emptyMessage = "当前还没有材料。",
}: {
  selectedId: string
  selectedProfile: ApplicantProfileDetail | null
  slots: readonly { key: string; label: string; accept: string }[]
  onUpload: (event: ChangeEvent<HTMLInputElement>, slot: string) => Promise<void>
  onPreview: (slot: string, meta: { originalName: string; uploadedAt: string }) => Promise<void>
  emptyMessage?: string
}) {
  if (!selectedId) {
    return <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">先保存申请人档案，再上传这一块的材料。</div>
  }

  if (slots.length === 0) {
    return <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">{emptyMessage}</div>
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((slot) => {
        const meta = selectedProfile?.files?.[slot.key]
        return (
          <div key={slot.key} className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium">{slot.label}</div>
            <Input type="file" accept={slot.accept} onChange={(event) => void onUpload(event, slot.key)} />
            {meta && (
              <div className="mt-2 space-y-1 text-xs text-gray-500">
                <div>{meta.originalName}</div>
                <div className="flex items-center gap-3">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => void onPreview(slot.key, meta)}>
                    预览
                  </button>
                  <a
                    className="text-blue-600 hover:underline"
                    href={`/api/applicants/${selectedId}/files/${slot.key}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    下载
                  </a>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
  placeholder,
}: {
  label: string
  value: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} readOnly placeholder={placeholder} className="bg-gray-50 dark:bg-gray-900" />
    </div>
  )
}

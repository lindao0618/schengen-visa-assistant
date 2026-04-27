"use client"

import { type Dispatch, type SetStateAction } from "react"
import dynamic from "next/dynamic"
import { Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { ApplicantProfileDetail, BasicFormState } from "@/app/applicants/[id]/detail/types"
import { FRANCE_TLS_CITY_OPTIONS } from "@/lib/france-tls-city"
import { Section, Field, ReadOnlyField } from "@/app/applicants/[id]/detail/detail-ui"

const ParsedIntakeAccordion = dynamic(
  () => import("@/app/applicants/[id]/detail/parsed-intake-accordion").then((mod) => mod.ParsedIntakeAccordion),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-4 py-4 text-sm text-gray-500">
        完整 intake 模块加载中...
      </div>
    ),
  },
)

export function BasicTabContent({
  applicantId,
  profile,
  basicForm,
  setBasicForm,
  tlsAccountTemplateText,
  isReadOnlyViewer,
  savingProfile,
  canEditApplicant,
  onCopyTlsAccountTemplate,
  onSaveProfile,
}: {
  applicantId: string
  profile: ApplicantProfileDetail
  basicForm: BasicFormState
  setBasicForm: Dispatch<SetStateAction<BasicFormState>>
  tlsAccountTemplateText: string
  isReadOnlyViewer: boolean
  savingProfile: boolean
  canEditApplicant: boolean
  onCopyTlsAccountTemplate: () => void | Promise<void>
  onSaveProfile: () => Promise<void>
}) {
  const files = profile.files || {}
  const usVisaIntakePhotoSlot = files.usVisaPhoto ? "usVisaPhoto" : files.photo ? "photo" : undefined

  return (
    <TabsContent value="basic" className="space-y-6">
      <Section title="CRM 基本信息" description="申请人主实体信息，后续搜索和 CRM 列表会优先使用这里的字段。" tone="slate">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="申请人姓名" value={basicForm.name} onChange={(value) => setBasicForm((prev) => ({ ...prev, name: value }))} disabled={isReadOnlyViewer} />
          <Field label="手机号" value={basicForm.phone} onChange={(value) => setBasicForm((prev) => ({ ...prev, phone: value }))} disabled={isReadOnlyViewer} />
          <Field label="邮箱" value={basicForm.email} onChange={(value) => setBasicForm((prev) => ({ ...prev, email: value }))} disabled={isReadOnlyViewer} />
          <Field label="微信" value={basicForm.wechat} onChange={(value) => setBasicForm((prev) => ({ ...prev, wechat: value }))} disabled={isReadOnlyViewer} />
          <Field
            label="通用护照号"
            value={basicForm.passportNumber}
            onChange={(value) => setBasicForm((prev) => ({ ...prev, passportNumber: value }))}
            disabled={isReadOnlyViewer}
          />
          <ReadOnlyField label="护照尾号" value={profile.passportLast4 || "-"} />
        </div>

        <div className="space-y-2">
          <Label>备注</Label>
          <Textarea
            rows={4}
            value={basicForm.note}
            onChange={(event) => setBasicForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="记录客户沟通、特殊说明或内部备注"
            disabled={isReadOnlyViewer}
          />
        </div>
      </Section>

      <Section title="美签基础信息" description="这块会继续为 DS-160、AIS 注册和提交 DS-160 提供复用信息。" tone="sky">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="AA 码" value={profile.usVisa?.aaCode || "仅 DS-160 成功后自动回写"} />
          <Field label="姓" value={basicForm.usVisaSurname} onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaSurname: value }))} disabled={isReadOnlyViewer} />
          <Field
            label="出生年份"
            value={basicForm.usVisaBirthYear}
            onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaBirthYear: value }))}
            disabled={isReadOnlyViewer}
          />
          <Field
            label="美签护照号"
            value={basicForm.usVisaPassportNumber}
            onChange={(value) => setBasicForm((prev) => ({ ...prev, usVisaPassportNumber: value }))}
            disabled={isReadOnlyViewer}
          />
        </div>
        <ParsedIntakeAccordion
          applicantId={applicantId}
          scope="usVisa"
          title="完整美签 intake"
          subtitle="展开后直接查看 Excel 已提取的完整个人信息、审计结果和照片。"
          tone="sky"
          intake={profile.usVisa?.fullIntake}
          photoSlot={usVisaIntakePhotoSlot}
          photoLabel="美签照片"
          emptyMessage="还没有可用的美签 intake。先上传 DS-160 / AIS Excel，系统会自动解析并在这里沉淀完整结构化信息。"
        />
      </Section>

      <Section title="申根基础信息" description="申根国家和 TLS 递签城市会同时影响法签自动化和解释信默认值。" tone="emerald">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>申根国家</Label>
            <Select disabled={isReadOnlyViewer} value={basicForm.schengenCountry || "france"} onValueChange={(value) => setBasicForm((prev) => ({ ...prev, schengenCountry: value }))}>
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
              disabled={isReadOnlyViewer}
              value={basicForm.schengenVisaCity || "__unset__"}
              onValueChange={(value) => setBasicForm((prev) => ({ ...prev, schengenVisaCity: value === "__unset__" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="上传申根 Excel 后可自动匹配" />
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
          <ReadOnlyField label="FRA Number" value={profile.schengen?.fraNumber || "-"} />
        </div>

        <div className="space-y-4 rounded-2xl border border-emerald-200/80 bg-white/80 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-base font-semibold text-emerald-950">TLS 账号信息</div>
              <div className="text-sm text-emerald-700/80">按申根法签内容生成，直接复制给客户即可。</div>
            </div>
            <Button type="button" variant="outline" className="rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50" onClick={() => void onCopyTlsAccountTemplate()}>
              一键复制
            </Button>
          </div>
          <Textarea value={tlsAccountTemplateText} readOnly rows={12} className="min-h-[320px] whitespace-pre-wrap border-emerald-200 bg-emerald-50/40 font-mono text-sm leading-7 text-emerald-950" />
        </div>

        <ParsedIntakeAccordion
          applicantId={applicantId}
          scope="schengen"
          title="完整申根 intake"
          subtitle="展开后直接查看申根 Excel 的完整结构化结果和审计提示，不再需要手动翻原表。"
          tone="emerald"
          intake={profile.schengen?.fullIntake}
          emptyMessage="还没有可用的申根 intake。上传申根 Excel 后，这里会自动出现完整结构化信息。"
        />
      </Section>

      <div className="flex justify-end">
        <Button onClick={() => void onSaveProfile()} disabled={savingProfile || !canEditApplicant} className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
          <Save className="mr-2 h-4 w-4" />
          {savingProfile ? "保存中..." : "保存申请人"}
        </Button>
      </div>
    </TabsContent>
  )
}

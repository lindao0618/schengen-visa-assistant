'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { ArrowLeft as ArrowBackIcon, CalendarIcon, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { MaterialTaskList } from '@/components/MaterialTaskList'
import { ApplicantProfileSelector } from '@/components/applicant-profile-selector'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useActiveApplicantProfile } from '@/hooks/use-active-applicant-profile'
import { usePrefetchApplicantDetail } from '@/hooks/use-prefetch-applicant-detail'
import { cn } from '@/lib/utils'

const explanationFormSchema = z.object({
  name_en: z.string().min(1, { message: '英文姓名不能为空' }),
  organization: z.string().min(1, { message: '学校/工作单位不能为空' }),
  passport_number: z.string().min(1, { message: '护照号码不能为空' }),
  submission_country: z.string().min(1, { message: '递签国家不能为空' }),
  target_country: z.string().min(1, { message: '申请国家不能为空' }),
  departure_date: z.date({ required_error: '出发时间不能为空' }),
  issue_type: z.string().min(1, { message: '解释问题类型不能为空' }),
  issue_details: z.string().min(10, { message: '问题详情至少 10 个字符' }),
  additional_info: z.string().optional(),
  applicant_type: z.string().min(1, { message: '申请人类型不能为空' }),
  visa_type: z.string().min(1, { message: '签证类型不能为空' }),
})

type ExplanationFormValues = z.infer<typeof explanationFormSchema>

type ExplanationExcelSummary = {
  englishName?: string
  organization?: string
  passportNumber?: string
  schengenCountry?: string
  submissionCity?: string
  email?: string
  birthDate?: string
}

type Option = { value: string; label: string }

const issueTypes: Option[] = [
  { value: 'bank_balance', label: '流水不足三个月' },
  { value: 'large_transfer', label: '大额转账说明' },
  { value: 'temporary_deposit', label: '临时存款说明' },
  { value: 'employment_gap', label: '工作空档期说明' },
  { value: 'income_source', label: '收入来源说明' },
  { value: 'property_proof', label: '房产证明说明' },
  { value: 'travel_purpose', label: '旅行目的说明' },
  { value: 'relationship_proof', label: '关系证明说明' },
  { value: 'study_plan', label: '学习计划说明' },
  { value: 'financial_sponsor', label: '资助人说明' },
  { value: 'previous_refusal', label: '拒签记录说明' },
  { value: 'other', label: '其他问题' },
]

const submissionCountries: Option[] = [
  { value: 'uk', label: '英国' },
  { value: 'china', label: '中国' },
  { value: 'usa', label: '美国' },
  { value: 'australia', label: '澳大利亚' },
  { value: 'canada', label: '加拿大' },
  { value: 'japan', label: '日本' },
  { value: 'other', label: '其他国家' },
]

const targetCountries: Option[] = [
  { value: 'france', label: '法国' },
  { value: 'germany', label: '德国' },
  { value: 'italy', label: '意大利' },
  { value: 'spain', label: '西班牙' },
  { value: 'netherlands', label: '荷兰' },
  { value: 'belgium', label: '比利时' },
  { value: 'austria', label: '奥地利' },
  { value: 'switzerland', label: '瑞士' },
  { value: 'greece', label: '希腊' },
  { value: 'portugal', label: '葡萄牙' },
  { value: 'sweden', label: '瑞典' },
  { value: 'norway', label: '挪威' },
  { value: 'denmark', label: '丹麦' },
  { value: 'finland', label: '芬兰' },
  { value: 'iceland', label: '冰岛' },
  { value: 'luxembourg', label: '卢森堡' },
  { value: 'malta', label: '马耳他' },
  { value: 'cyprus', label: '塞浦路斯' },
  { value: 'estonia', label: '爱沙尼亚' },
  { value: 'latvia', label: '拉脱维亚' },
  { value: 'lithuania', label: '立陶宛' },
  { value: 'slovenia', label: '斯洛文尼亚' },
  { value: 'slovakia', label: '斯洛伐克' },
  { value: 'hungary', label: '匈牙利' },
  { value: 'poland', label: '波兰' },
  { value: 'czech', label: '捷克' },
  { value: 'other', label: '其他国家' },
]

const applicantTypes: Option[] = [
  { value: 'student', label: '学生' },
  { value: 'employee', label: '在职人员' },
  { value: 'freelancer', label: '自由职业者' },
  { value: 'business_owner', label: '企业主' },
  { value: 'retiree', label: '退休人员' },
  { value: 'unemployed', label: '无业人员' },
  { value: 'housewife', label: '家庭主妇' },
  { value: 'other', label: '其他' },
]

const visaTypes: Option[] = [
  { value: 'tourist', label: '旅游签证' },
  { value: 'business', label: '商务签证' },
  { value: 'student', label: '学生签证' },
  { value: 'work', label: '工作签证' },
  { value: 'family', label: '探亲签证' },
  { value: 'transit', label: '过境签证' },
  { value: 'other', label: '其他类型' },
]

const ISSUE_TEMPLATES: Record<string, string> = {
  bank_balance:
    '因为我在____银行办理银行卡，开户时间是：____。因此到目前为止，该银行卡流水不足三个月，所以我补充提交了开户证明作为辅助材料。',
  large_transfer: '我有一笔____的大额流水，发生在____，该笔资金用于____。',
}

const LETTER_TASK_IDS_KEY = 'material-explanation-letter-task-ids'

function loadStoredLetterTaskIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LETTER_TASK_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function storeLetterTaskIds(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LETTER_TASK_IDS_KEY, JSON.stringify(ids.slice(-50)))
  } catch {
    /* ignore */
  }
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/[\s\-_/]+/g, '')
}

function createOptionResolver(options: Option[]) {
  const aliasMap = new Map<string, string>()

  for (const option of options) {
    aliasMap.set(normalizeLookup(option.value), option.value)
    aliasMap.set(normalizeLookup(option.label), option.value)
  }

  aliasMap.set(normalizeLookup('英国'), 'uk')
  aliasMap.set(normalizeLookup('英國'), 'uk')
  aliasMap.set(normalizeLookup('unitedkingdom'), 'uk')
  aliasMap.set(normalizeLookup('greatbritain'), 'uk')

  return (raw?: string) => {
    if (!raw) return ''
    return aliasMap.get(normalizeLookup(raw)) || ''
  }
}

const resolveTargetCountryValue = createOptionResolver(targetCountries)

const labelByValue = (options: Option[], value: string) => options.find((item) => item.value === value)?.label || value

export default function ExplanationLetterWriterPage() {
  const router = useRouter()
  const activeApplicant = useActiveApplicantProfile()
  usePrefetchApplicantDetail(activeApplicant?.id)
  const [isLoading, setIsLoading] = useState(false)
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [excelSummary, setExcelSummary] = useState<ExplanationExcelSummary | null>(null)
  const [excelSourceName, setExcelSourceName] = useState('')
  const autofillRef = useRef<Partial<Record<keyof ExplanationFormValues, string>>>({})
  const issueTemplateRef = useRef('')

  const form = useForm<ExplanationFormValues>({
    resolver: zodResolver(explanationFormSchema),
    defaultValues: {
      name_en: '',
      organization: '',
      passport_number: '',
      submission_country: 'uk',
      target_country: '',
      issue_type: '',
      issue_details: '',
      additional_info: '',
      applicant_type: 'student',
      visa_type: 'tourist',
    },
  })

  const watchedIssueType = form.watch('issue_type')

  useEffect(() => {
    setTaskIds(loadStoredLetterTaskIds())
  }, [])

  useEffect(() => {
    storeLetterTaskIds(taskIds)
  }, [taskIds])

  useEffect(() => {
    const applyAutofill = (field: keyof ExplanationFormValues, nextValue?: string) => {
      if (!nextValue) return
      const currentValue = form.getValues(field)
      const previousAutoValue = autofillRef.current[field]
      if (!currentValue || currentValue === previousAutoValue) {
        form.setValue(field, nextValue as never, { shouldDirty: false, shouldValidate: true })
      }
      autofillRef.current[field] = nextValue
    }

    applyAutofill('submission_country', 'uk')
    applyAutofill('applicant_type', 'student')
    applyAutofill('visa_type', 'tourist')
  }, [form])

  useEffect(() => {
    const template = ISSUE_TEMPLATES[watchedIssueType] || ''
    if (!template) {
      issueTemplateRef.current = ''
      return
    }

    const current = form.getValues('issue_details')
    if (!current || current === issueTemplateRef.current) {
      form.setValue('issue_details', template, { shouldDirty: false, shouldValidate: true })
      issueTemplateRef.current = template
    }
  }, [form, watchedIssueType])

  useEffect(() => {
    const applicantCountry = activeApplicant?.schengen?.country
    const resolvedCountry = resolveTargetCountryValue(applicantCountry || '')
    if (!resolvedCountry) return

    const current = form.getValues('target_country')
    const previousAutoValue = autofillRef.current.target_country
    if (!current || current === previousAutoValue) {
      form.setValue('target_country', resolvedCountry, { shouldDirty: false, shouldValidate: true })
    }
    autofillRef.current.target_country = resolvedCountry
  }, [activeApplicant?.schengen?.country, form])

  useEffect(() => {
    const applicantId = activeApplicant?.id
    if (!applicantId) {
      setExcelSummary(null)
      setExcelSourceName('')
      return
    }

    let disposed = false

    const applyAutofill = (field: keyof ExplanationFormValues, nextValue?: string) => {
      if (!nextValue) return
      const currentValue = form.getValues(field)
      const previousAutoValue = autofillRef.current[field]
      if (!currentValue || currentValue === previousAutoValue) {
        form.setValue(field, nextValue as never, { shouldDirty: false, shouldValidate: true })
      }
      autofillRef.current[field] = nextValue
    }

    const loadSummary = async () => {
      try {
        const response = await fetch(`/api/applicants/${applicantId}/schengen-excel-summary`, { cache: 'no-store' })
        if (!response.ok) {
          if (!disposed) {
            setExcelSummary(null)
            setExcelSourceName('')
          }
          return
        }

        const data = await response.json()
        if (disposed) return

        const summary = (data.summary || null) as ExplanationExcelSummary | null
        setExcelSummary(summary)
        setExcelSourceName(data.source?.originalName || '')

        if (!summary) return

        applyAutofill('name_en', summary.englishName)
        applyAutofill('organization', summary.organization)
        applyAutofill('passport_number', summary.passportNumber)

        const resolvedCountry = resolveTargetCountryValue(activeApplicant?.schengen?.country || summary.schengenCountry || '')
        applyAutofill('target_country', resolvedCountry)
      } catch {
        if (!disposed) {
          setExcelSummary(null)
          setExcelSourceName('')
        }
      }
    }

    void loadSummary()

    return () => {
      disposed = true
    }
  }, [activeApplicant?.id, activeApplicant?.schengen?.country, form])

  const currentApplicantLabel = useMemo(() => {
    if (!activeApplicant) return ''
    return activeApplicant.name || activeApplicant.label
  }, [activeApplicant])

  const handleBackToMaterials = () => {
    router.push('/material-customization')
  }

  async function onSubmit(data: ExplanationFormValues) {
    setIsLoading(true)
    toast.info('正在创建任务，请在下方的任务列表里查看进度。')

    try {
      const response = await fetch('/api/explanation-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chinese_name: currentApplicantLabel || data.name_en,
          english_name: data.name_en,
          organization: data.organization,
          passport_number: data.passport_number,
          submission_country: labelByValue(submissionCountries, data.submission_country),
          visa_country: labelByValue(targetCountries, data.target_country),
          visa_type: labelByValue(visaTypes, data.visa_type),
          applicant_type: labelByValue(applicantTypes, data.applicant_type),
          departure_date: format(data.departure_date, 'yyyy-MM-dd'),
          problem_type: data.issue_type,
          detailed_explanation: data.issue_details,
          additional_info: data.additional_info || '',
          applicantProfileId: activeApplicant?.id,
          caseId: activeApplicant?.activeCaseId,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || '网络请求失败')
      }

      if (result.success && result.task_id) {
        setTaskIds((previous) => [...previous, result.task_id])
        toast.success('任务已创建，请在下方任务列表查看进度和下载结果。')
      } else {
        throw new Error(result.error || '生成失败')
      }
    } catch (error) {
      console.error('生成解释信失败', error)
      toast.error(error instanceof Error ? error.message : '生成解释信失败，请稍后重试。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 px-4 py-10 dark:from-neutral-950 dark:to-neutral-800">
      <div className="mb-6">
        <Button onClick={handleBackToMaterials} variant="outline">
          <ArrowBackIcon className="mr-2 h-4 w-4" />
          返回材料定制
        </Button>
      </div>

      <ApplicantProfileSelector scope="france-schengen" />

      <div className="mx-auto mb-6 max-w-4xl rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        {activeApplicant?.id
          ? `当前申请人：${currentApplicantLabel}。解释信生成成功后会自动归档到该申请人的材料文档里。`
          : '如果你已选中申请人档案，解释信生成成功后会自动归档到对应申请人的材料文档里。'}
      </div>

      {excelSummary && (
        <div className="mx-auto mb-6 max-w-4xl rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          已从申根 Excel 自动带入基础信息：
          {excelSummary.englishName ? ' 英文姓名' : ''}
          {excelSummary.organization ? '、学校/工作单位' : ''}
          {excelSummary.passportNumber ? '、护照号' : ''}
          {excelSourceName ? `。来源：${excelSourceName}` : '。'}
        </div>
      )}

      <div className="mb-8 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-blue-600" />
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">签证解释信生成器</h1>
        <p className="mt-4 text-xl text-neutral-700 dark:text-neutral-300">
          自动带入申请人档案信息，快速生成正式、专业的解释信。
        </p>
      </div>

      <Card className="mx-auto max-w-4xl bg-white/80 shadow-xl backdrop-blur-md dark:bg-neutral-900/80">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">填写解释信信息</CardTitle>
          <CardDescription className="text-neutral-600 dark:text-neutral-400">
            基础信息可从档案里的申根 Excel 自动带出。签证类型默认旅游签证，申请人类型默认学生，递签国家默认英国。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name_en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>英文姓名</FormLabel>
                      <FormControl>
                        <Input placeholder="YANG AO" {...field} />
                      </FormControl>
                      <FormDescription>优先从申根 Excel 里的姓氏和名字自动组合。</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passport_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>护照号码</FormLabel>
                      <FormControl>
                        <Input placeholder="E12345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>学校 / 工作单位</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：Goldsmiths, University of London" {...field} />
                    </FormControl>
                    <FormDescription>默认会优先读取申根 Excel 里的大学名称或工作单位。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <FormField
                  control={form.control}
                  name="submission_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>递签国家</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择递签国家" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {submissionCountries.map((country) => (
                            <SelectItem key={country.value} value={country.value}>
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>申请国家</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择申请国家" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {targetCountries.map((country) => (
                            <SelectItem key={country.value} value={country.value}>
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>默认跟随申请人档案里的申根国家。</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visa_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>签证类型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择签证类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {visaTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applicant_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>申请人类型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择申请人类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {applicantTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="departure_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>出发时间</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn('w-[240px] pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            {field.value ? format(field.value, 'yyyy-MM-dd') : <span>选择日期</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issue_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>解释问题类型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择需要解释的问题类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {issueTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      选择“流水不足三个月”或“大额转账说明”后，下方会自动带出可编辑模板。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issue_details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>问题详细说明</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请详细描述需要解释的具体情况，包括时间、金额、原因、用途等关键信息。"
                        className="min-h-[140px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>模板带出后可以直接改，尽量把时间、金额、用途写具体。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additional_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>补充信息（可选）</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="如有其他需要补充说明的材料或背景，请填写在这里。"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>例如补充开户证明、奖学金证明、资助人说明等。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-center">
                <Button type="submit" disabled={isLoading} className="bg-blue-600 px-8 py-2 hover:bg-blue-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      生成解释信
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>

          <div className="mt-6">
            <MaterialTaskList
              taskIds={taskIds}
              filterTaskTypes={['explanation-letter']}
              title="解释信任务"
              pollInterval={2000}
              autoRefresh
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import {
  ArrowRight,
  CalendarIcon,
  ChevronLeft,
  FileText,
  Hotel,
  Loader2,
  MapPinned,
  ShieldCheck,
  Ticket,
} from "lucide-react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"

import { ApplicantProfileSelector } from "@/components/applicant-profile-selector"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActiveApplicantProfile } from "@/hooks/use-active-applicant-profile"
import { toItineraryEnglishCity, toItineraryEnglishCountry } from "@/lib/itinerary-location"
import { cn } from "@/lib/utils"

const MaterialTaskList = dynamic(
  () => import("@/components/MaterialTaskList").then((mod) => mod.MaterialTaskList),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
        正在加载任务列表...
      </div>
    ),
  },
)

interface MaterialService {
  id: string
  title: string
  description: string
  icon: React.ElementType
  actionType: "navigate" | "form"
  link?: string
}

const services: MaterialService[] = [
  {
    id: "itinerary",
    title: "行程单生成",
    description: "根据你的旅行计划自动生成详细行程单，并可回收到申请人档案。",
    icon: MapPinned,
    actionType: "form",
  },
  {
    id: "hotel",
    title: "酒店预订单",
    description: "获取符合签证要求的模拟酒店预订单。",
    icon: Hotel,
    actionType: "navigate",
    link: "/hotel-booking",
  },
  {
    id: "tickets",
    title: "机票/车票预订单",
    description: "生成机票或火车票预订证明。",
    icon: Ticket,
    actionType: "navigate",
    link: "/services/ticket-booking",
  },
  {
    id: "explanation-letter",
    title: "解释信",
    description: "辅助撰写签证解释信、说明信，并自动归档到申请人档案。",
    icon: FileText,
    actionType: "navigate",
    link: "/services/explanation-letter-writer",
  },
  {
    id: "insurance",
    title: "保险",
    description: "查找和比较符合申根签证要求的旅行保险。",
    icon: ShieldCheck,
    actionType: "navigate",
    link: "/services/insurance-comparison",
  },
]

const itineraryFormSchema = z
  .object({
    country: z.string().min(1, { message: "国家不能为空" }),
    departure_city: z.string().min(1, { message: "出发城市不能为空" }),
    arrival_city: z.string().min(1, { message: "到达城市不能为空" }),
    duration_mode: z.enum(["preset7", "customDays"]),
    trip_days: z.coerce.number().int().min(1, { message: "天数至少 1 天" }).max(30, { message: "天数最多 30 天" }),
    start_date: z.date({ required_error: "开始日期不能为空" }),
    end_date: z.date({ required_error: "结束日期不能为空" }),
    hotel_name: z.string().min(1, { message: "酒店名称不能为空" }),
    hotel_address: z.string().min(1, { message: "酒店地址不能为空" }),
    hotel_phone: z.string().min(1, { message: "酒店电话不能为空" }),
  })
  .superRefine((data, ctx) => {
    if (data.duration_mode === "customDays" && (!data.trip_days || data.trip_days < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trip_days"],
        message: "请填写自定义天数",
      })
    }

    if (data.end_date < data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "结束日期不能早于开始日期",
      })
    }
  })

type ItineraryFormValues = z.infer<typeof itineraryFormSchema>

const ITINERARY_TASK_IDS_KEY = "material-itinerary-task-ids"

const HOTEL_PRESETS = [
  {
    id: "hotel-le-richemont",
    label: "Hotel Le Richemont",
    name: "Hotel Le Richemont",
    address: "17 Rue Jean Colly, 75013 Paris, France",
    phone: "33 1 45 82 84 84",
    postalCode: "75013",
    city: "Paris",
    email: "info@hotel-richemont.com",
  },
] as const

function computeEndDate(startDate?: Date, days = 7) {
  if (!startDate || !Number.isFinite(days) || days < 1) return undefined
  const next = new Date(startDate)
  next.setDate(next.getDate() + days - 1)
  return next
}

function loadStoredTaskIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(ITINERARY_TASK_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function storeTaskIds(ids: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ITINERARY_TASK_IDS_KEY, JSON.stringify(ids.slice(-50)))
  } catch {
    /* ignore */
  }
}

function ItineraryForm({
  onBack,
  activeApplicantId,
  activeApplicantCaseId,
  activeApplicantName,
}: {
  onBack: () => void
  activeApplicantId?: string
  activeApplicantCaseId?: string
  activeApplicantName?: string
}) {
  const [taskIds, setTaskIds] = useState<string[]>(loadStoredTaskIds)
  const [isLoading, setIsLoading] = useState(false)
  const [hotelPresetId, setHotelPresetId] = useState<string>("custom")
  /** 与档案中 Excel 解析结果一致时不再覆盖；Excel 更新后 ISO 变化会再次同步 */
  const syncedExcelEntryIsoRef = useRef<string | null>(null)

  const form = useForm<ItineraryFormValues>({
    resolver: zodResolver(itineraryFormSchema),
    defaultValues: {
      country: "法国",
      departure_city: "伦敦",
      arrival_city: "巴黎",
      duration_mode: "preset7",
      trip_days: 7,
      hotel_name: "",
      hotel_address: "",
      hotel_phone: "",
    },
  })

  const durationMode = form.watch("duration_mode")
  const startDate = form.watch("start_date")
  const tripDays = form.watch("trip_days")
  const effectiveTripDays = durationMode === "preset7" ? 7 : tripDays || 1
  const computedEndDate = useMemo(
    () => computeEndDate(startDate, effectiveTripDays),
    [startDate, effectiveTripDays]
  )

  useEffect(() => {
    storeTaskIds(taskIds)
  }, [taskIds])

  const applyEntryDateIso = useCallback(
    (iso: string) => {
      const parts = iso.split("-").map((p) => Number.parseInt(p, 10))
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return
      const [y, m, d] = parts
      const start = new Date(y, m - 1, d)
      form.setValue("start_date", start, { shouldValidate: true, shouldDirty: false })
    },
    [form],
  )

  const fetchAndSyncEntryDate = useCallback(async () => {
    if (!activeApplicantId) return
    try {
      const response = await fetch(`/api/applicants/${activeApplicantId}/schengen-entry-date`, {
        cache: "no-store",
        credentials: "include",
      })
      const data = (await response.json()) as { entryDate?: string | null; error?: string }
      if (!response.ok || data.error) return
      const iso = data.entryDate
      if (!iso) return
      if (iso === syncedExcelEntryIsoRef.current) return
      syncedExcelEntryIsoRef.current = iso
      applyEntryDateIso(iso)
    } catch {
      /* ignore */
    }
  }, [activeApplicantId, applyEntryDateIso])

  useEffect(() => {
    syncedExcelEntryIsoRef.current = null
    void fetchAndSyncEntryDate()
  }, [activeApplicantId, fetchAndSyncEntryDate])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchAndSyncEntryDate()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [fetchAndSyncEntryDate])

  useEffect(() => {
    if (!computedEndDate) return
    const currentEndDate = form.getValues("end_date")
    if (!currentEndDate || currentEndDate.getTime() !== computedEndDate.getTime()) {
      form.setValue("end_date", computedEndDate, { shouldValidate: true, shouldDirty: true })
    }
  }, [computedEndDate, form])

  const selectedHotelPreset = HOTEL_PRESETS.find((item) => item.id === hotelPresetId)

  const applyHotelPreset = (presetId: string) => {
    setHotelPresetId(presetId)
    if (presetId === "custom") return

    const preset = HOTEL_PRESETS.find((item) => item.id === presetId)
    if (!preset) return

    form.setValue("hotel_name", preset.name, { shouldDirty: true, shouldValidate: true })
    form.setValue("hotel_address", preset.address, { shouldDirty: true, shouldValidate: true })
    form.setValue("hotel_phone", preset.phone, { shouldDirty: true, shouldValidate: true })
  }

  async function onSubmit(data: ItineraryFormValues) {
    setIsLoading(true)
    toast.info("正在创建任务，请在下方任务列表查看进度。")

    const payload = {
      ...data,
      country: toItineraryEnglishCountry(data.country),
      departure_city: toItineraryEnglishCity(data.departure_city),
      arrival_city: toItineraryEnglishCity(data.arrival_city),
      trip_days: effectiveTripDays,
      start_date: format(data.start_date, "yyyy-MM-dd"),
      end_date: format(data.end_date, "yyyy-MM-dd"),
      applicantProfileId: activeApplicantId,
      caseId: activeApplicantCaseId,
    }

    try {
      const response = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || result.message || "生成失败，请稍后重试。")
      }

      if (result.task_id) {
        setTaskIds((prev) => [...prev, result.task_id])
        toast.success(
          activeApplicantId
            ? "任务已创建，生成完成后会自动归档到当前申请人档案。"
            : "任务已创建，请在下方任务列表查看进度与下载链接。"
        )
      } else {
        throw new Error("API 响应异常")
      }
    } catch (error) {
      console.error("Error generating itinerary:", error)
      toast.error(error instanceof Error ? error.message : "生成行程单失败，请稍后重试。")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mx-auto my-8 w-full max-w-3xl bg-white/80 shadow-xl backdrop-blur-md dark:bg-neutral-900/80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">
            定制行程单
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
        </div>
        <CardDescription className="text-neutral-600 dark:text-neutral-400">
          支持酒店预设、7 天模板和自定义天数；选中申请人后会自动归档到档案。行程开始日期默认与档案内申根 Excel「入境申根国的日期」一致，更新 Excel 后回到本页或切换回窗口会自动同步。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <ApplicantProfileSelector scope="france-schengen" />
          <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            {activeApplicantId
              ? `当前申请人：${activeApplicantName || "未命名申请人"}。行程单生成成功后会自动归档到该申请人的材料文档里。`
              : "如果你已登录并选中了申请人档案，行程单生成成功后会自动归档到对应申请人的材料文档里。"}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>国家</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：法国" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departure_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>出发城市</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：伦敦" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="arrival_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>到达城市</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：巴黎" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-xl border border-dashed border-neutral-200 p-4 dark:border-neutral-800">
              <div className="mb-4 space-y-1">
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">行程时长</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  常用 7 天模板会自动根据开始日期推算结束日期；自定义天数也会自动计算。
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="duration_mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>时长模式</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择模式" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="preset7">7 天模板</SelectItem>
                          <SelectItem value="customDays">自定义天数</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trip_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>行程天数</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          disabled={durationMode === "preset7"}
                          value={durationMode === "preset7" ? 7 : field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>自动计算结果</FormLabel>
                  <div className="rounded-md border bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
                    {computedEndDate
                      ? `${effectiveTripDays} 天 / 结束日期 ${format(computedEndDate, "yyyy-MM-dd")}`
                      : "先选择开始日期"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>行程开始日期</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "yyyy-MM-dd") : <span>选择日期</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {activeApplicantId
                        ? "默认同步档案内申根 Excel 的入境申根国日期；在其他页面更新 Excel 后返回此处或切回浏览器标签即可刷新。"
                        : "选中申请人并上传申根 Excel 后，将自动带入入境日期作为行程开始日。"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>结束日期</FormLabel>
                    <FormControl>
                      <Input
                        readOnly
                        value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                        placeholder="会根据开始日期和天数自动计算"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-xl border border-dashed border-neutral-200 p-4 dark:border-neutral-800">
              <div className="mb-4 space-y-1">
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">酒店信息</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  你可以直接选预设酒店，系统会自动填充名称、地址和电话；也支持手动改。
                </div>
              </div>

              <div className="mb-6 space-y-2">
                <FormLabel>酒店预设</FormLabel>
                <Select value={hotelPresetId} onValueChange={applyHotelPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择酒店预设" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">自定义填写</SelectItem>
                    {HOTEL_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedHotelPreset && (
                <div className="mb-6 grid gap-3 rounded-lg border bg-neutral-50 p-4 text-sm dark:bg-neutral-900 md:grid-cols-2">
                  <div>酒店名称：{selectedHotelPreset.name}</div>
                  <div>酒店城市：{selectedHotelPreset.city}</div>
                  <div>酒店地址：{selectedHotelPreset.address}</div>
                  <div>酒店邮编：{selectedHotelPreset.postalCode}</div>
                  <div>酒店电话：{selectedHotelPreset.phone}</div>
                  <div>酒店邮箱：{selectedHotelPreset.email}</div>
                </div>
              )}

              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="hotel_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>酒店名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：Hotel Le Richemont" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hotel_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>酒店地址</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：17 Rue Jean Colly, 75013 Paris, France" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hotel_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>酒店电话</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：33 1 45 82 84 84" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "提交中..." : "生成行程单"}
            </Button>
          </form>
        </Form>

        <div className="mt-6">
          <MaterialTaskList
            taskIds={taskIds}
            filterTaskTypes={["itinerary"]}
            title="行程单任务"
            pollInterval={2000}
            autoRefresh
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default function MaterialCustomizationClientPage() {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const activeApplicant = useActiveApplicantProfile()

  const handleServiceSelect = (service: MaterialService) => {
    if (service.actionType === "form" && service.id === "itinerary") {
      setSelectedServiceId(service.id)
      return
    }

    if (service.actionType === "navigate" && service.link) {
      window.location.href = service.link
      return
    }

    window.alert(`服务 ${service.title} 即将开放，敬请期待。`)
  }

  if (selectedServiceId === "itinerary") {
    return (
      <ItineraryForm
        onBack={() => setSelectedServiceId(null)}
        activeApplicantId={activeApplicant?.id}
        activeApplicantCaseId={activeApplicant?.activeCaseId || undefined}
        activeApplicantName={activeApplicant?.name || activeApplicant?.label}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 px-4 py-10 dark:from-neutral-950 dark:to-neutral-800">
      <div className="container mx-auto">
        <ApplicantProfileSelector scope="france-schengen" />

        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white sm:text-5xl">
            签证材料定制服务
          </h1>
          <p className="mt-4 text-xl text-neutral-700 dark:text-neutral-300">
            一站式解决你的签证材料准备需求，生成后的关键文档也能回收到申请人档案。
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className="flex flex-col overflow-hidden rounded-xl border border-gray-200/70 bg-white/60 shadow-lg backdrop-blur-lg transition-all hover:shadow-2xl dark:border-neutral-700/70 dark:bg-neutral-800/60"
            >
              <CardHeader className="flex flex-row items-center space-x-4 border-b border-gray-200/50 bg-black/5 p-6 dark:border-neutral-700/50 dark:bg-white/5">
                <service.icon className="h-10 w-10 text-neutral-700 dark:text-neutral-300" />
                <div>
                  <CardTitle className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                    {service.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-grow flex-col p-6">
                <CardDescription className="mb-4 min-h-[60px] text-neutral-600 dark:text-neutral-400">
                  {service.description}
                </CardDescription>
                <Button
                  variant="outline"
                  className="group mt-auto w-full border-neutral-400 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 focus-visible:ring-neutral-500 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-100 dark:hover:text-neutral-900 dark:focus-visible:ring-neutral-400"
                  onClick={() => handleServiceSelect(service)}
                >
                  立即使用
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <footer className="mt-16 pb-10 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            所有材料模板都会尽量贴近签证中心常见要求，后续也可以继续往申请人档案里扩展更多材料槽位。
          </p>
        </footer>
      </div>
    </div>
  )
}

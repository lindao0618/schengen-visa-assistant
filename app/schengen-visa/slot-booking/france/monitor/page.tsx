"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Calendar, Check, Clock, Flag, Loader2, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const schengenCountries = [
  { value: "france", label: "法国" },
  { value: "germany", label: "德国" },
  { value: "italy", label: "意大利" },
  { value: "spain", label: "西班牙" },
  { value: "switzerland", label: "瑞士" },
  { value: "netherlands", label: "荷兰" },
  { value: "belgium", label: "比利时" },
  { value: "austria", label: "奥地利" },
  { value: "portugal", label: "葡萄牙" },
  { value: "greece", label: "希腊" },
]

const regions = {
  china: [
    { value: "BJS", label: "北京" },
    { value: "SHA", label: "上海" },
    { value: "CAN", label: "广州" },
    { value: "CTU", label: "成都" },
    { value: "WUH", label: "武汉" },
    { value: "SZX", label: "深圳" },
    { value: "HGH", label: "杭州" },
  ],
  uk: [
    { value: "LON", label: "伦敦" },
    { value: "MNC", label: "曼彻斯特" },
    { value: "EDI", label: "爱丁堡" },
  ],
  us: [
    { value: "NYC", label: "纽约" },
    { value: "LAX", label: "洛杉矶" },
    { value: "CHI", label: "芝加哥" },
    { value: "HOU", label: "休斯顿" },
    { value: "BOS", label: "波士顿" },
  ],
}

const phoneCodes = [
  { value: "86", label: "+86 中国" },
  { value: "44", label: "+44 英国" },
  { value: "1", label: "+1 美国/加拿大" },
  { value: "33", label: "+33 法国" },
  { value: "49", label: "+49 德国" },
  { value: "61", label: "+61 澳大利亚" },
]

const slotTypes = [
  { value: "normal", label: "Normal", description: "标准预约" },
  { value: "prime_time", label: "Prime Time", description: "黄金时段预约" },
  { value: "premium", label: "Premium", description: "高级预约" },
]

interface DateTimeRange {
  id: number
  startDate: string
  endDate: string
  startTime: string
  endTime: string
}

function createDefaultRange(id: number): DateTimeRange {
  const now = new Date()
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  return {
    id,
    startDate: now.toISOString().substring(0, 10),
    endDate: nextMonth.toISOString().substring(0, 10),
    startTime: "08:30",
    endTime: "16:30",
  }
}

export default function MonitorSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [monitorStatus, setMonitorStatus] = useState<"checking" | "running" | "stopped" | "unavailable">("checking")

  const [country, setCountry] = useState("france")
  const [region, setRegion] = useState("china")
  const [city, setCity] = useState("")

  const [dateTimeRanges, setDateTimeRanges] = useState<DateTimeRange[]>([createDefaultRange(1)])

  const [emailNotify, setEmailNotify] = useState(false)
  const [phoneNotify, setPhoneNotify] = useState(false)
  const [phoneCode, setPhoneCode] = useState("86")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [email, setEmail] = useState("")

  const [selectedSlotTypes, setSelectedSlotTypes] = useState<string[]>(["normal"])

  const toggleSlotType = (slotType: string) => {
    setSelectedSlotTypes((prev) => {
      if (prev.includes(slotType)) {
        return prev.length > 1 ? prev.filter((type) => type !== slotType) : prev
      }

      return [...prev, slotType]
    })
  }

  const addDateTimeRange = () => {
    if (dateTimeRanges.length >= 3) {
      return
    }

    const nextId = Math.max(0, ...dateTimeRanges.map((range) => range.id)) + 1
    setDateTimeRanges((prev) => [...prev, createDefaultRange(nextId)])
  }

  const removeDateTimeRange = (id: number) => {
    if (dateTimeRanges.length <= 1) {
      return
    }

    setDateTimeRanges((prev) => prev.filter((range) => range.id !== id))
  }

  const updateDateTimeRange = (
    id: number,
    field: "startDate" | "endDate" | "startTime" | "endTime",
    value: string
  ) => {
    setDateTimeRanges((prev) =>
      prev.map((range) => (range.id === id ? { ...range, [field]: value } : range))
    )
  }

  const checkMonitorStatus = async () => {
    try {
      const response = await fetch("/api/schengen/france/monitor/status")
      const data = await response.json()
      setMonitorStatus(data.success ? "running" : "stopped")
    } catch {
      setMonitorStatus("unavailable")
    }
  }

  useEffect(() => {
    checkMonitorStatus()
  }, [])

  const handleSubmit = async () => {
    if (!city) {
      alert("请先选择申请城市")
      return
    }

    if (selectedSlotTypes.length === 0) {
      alert("请至少选择一个 Slot 类型")
      return
    }

    setLoading(true)

    try {
      const monitorConfig = {
        application_country: region,
        application_city: city,
        visa_type: "short_stay",
        travel_purpose: "tourism_private_visit",
        slot_types: selectedSlotTypes,
        date_ranges: dateTimeRanges.map((range) => ({
          start_date: range.startDate,
          end_date: range.endDate,
          start_time: range.startTime,
          end_time: range.endTime,
        })),
        notifications: {
          email: emailNotify ? email : null,
          phone: phoneNotify ? `${phoneCode}${phoneNumber}` : null,
        },
      }

      const response = await fetch("/api/schengen/france/monitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(monitorConfig),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `监控启动失败: ${response.status}`)
      }

      localStorage.setItem("lastMonitorConfig", JSON.stringify(monitorConfig))
      router.push(`/schengen-visa/slot-booking/${country}/monitor/success`)
    } catch (error) {
      alert(error instanceof Error ? error.message : "启动监控失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-gray-900">
            <Clock className="h-8 w-8 text-blue-600" strokeWidth={2} />
            法国签证预约监控设置
          </h1>
          <p className="text-gray-600">
            设置您的法国签证预约监控条件，当有符合要求的预约名额出现时，系统会第一时间通知您。
          </p>
        </div>

        <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                monitorStatus === "running"
                  ? "bg-green-500"
                  : monitorStatus === "checking"
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-900">
              {monitorStatus === "running"
                ? "监控服务运行正常"
                : monitorStatus === "checking"
                  ? "正在检查监控服务状态..."
                  : monitorStatus === "stopped"
                    ? "监控服务未运行"
                    : "监控服务不可用"}
            </span>
          </div>
          {monitorStatus !== "running" ? (
            <p className="mt-1 text-xs text-gray-600">
              请先确认 TLS 监控服务已启动，否则无法正常开始监控。
            </p>
          ) : null}
        </div>

        <main className="space-y-8">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-blue-600" />
                基本参数
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="country">申请国家</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="country">
                      <SelectValue placeholder="选择申根国家" />
                    </SelectTrigger>
                    <SelectContent>
                      {schengenCountries.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">申请地区</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger id="region">
                      <SelectValue placeholder="选择申请地区" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="china">中国</SelectItem>
                      <SelectItem value="uk">英国</SelectItem>
                      <SelectItem value="us">美国</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">申请城市</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger id="city">
                      <SelectValue placeholder="选择申请城市" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions[region as keyof typeof regions]?.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Slot 类型（可多选）
              </CardTitle>
              <CardDescription>请至少选择一个 Slot 类型进行监控。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {slotTypes.map((slotType) => {
                  const isSelected = selectedSlotTypes.includes(slotType.value)
                  const isDisabled = isSelected && selectedSlotTypes.length === 1

                  return (
                    <div
                      key={slotType.value}
                      onClick={() => toggleSlotType(slotType.value)}
                      className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all duration-200 ${
                        isSelected
                          ? isDisabled
                            ? "cursor-not-allowed border-blue-500 bg-blue-50 opacity-80"
                            : "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {isSelected ? (
                        <div className="absolute right-2 top-2">
                          <Check className="h-5 w-5 text-blue-600" />
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{slotType.label}</h3>
                          {slotType.value === "prime_time" ? (
                            <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-600">
                              Prime Time
                            </span>
                          ) : null}
                          {slotType.value === "premium" ? (
                            <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-600">
                              Premium
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-gray-600">{slotType.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                时间范围设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>监控日期时间范围</Label>
                  {dateTimeRanges.length < 3 ? (
                    <Button variant="outline" size="sm" onClick={addDateTimeRange} className="h-8">
                      <Plus className="mr-1 h-4 w-4" /> 添加范围
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {dateTimeRanges.map((range, index) => (
                    <div key={range.id} className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">范围 {index + 1}</div>
                        {dateTimeRanges.length > 1 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDateTimeRange(range.id)}
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor={`startdate-${range.id}`} className="text-xs">
                            开始日期
                          </Label>
                          <Input
                            id={`startdate-${range.id}`}
                            type="date"
                            value={range.startDate}
                            onChange={(event) =>
                              updateDateTimeRange(range.id, "startDate", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`enddate-${range.id}`} className="text-xs">
                            结束日期
                          </Label>
                          <Input
                            id={`enddate-${range.id}`}
                            type="date"
                            value={range.endDate}
                            onChange={(event) =>
                              updateDateTimeRange(range.id, "endDate", event.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor={`starttime-${range.id}`} className="text-xs">
                            开始时间
                          </Label>
                          <Input
                            id={`starttime-${range.id}`}
                            type="time"
                            value={range.startTime}
                            onChange={(event) =>
                              updateDateTimeRange(range.id, "startTime", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`endtime-${range.id}`} className="text-xs">
                            结束时间
                          </Label>
                          <Input
                            id={`endtime-${range.id}`}
                            type="time"
                            value={range.endTime}
                            onChange={(event) =>
                              updateDateTimeRange(range.id, "endTime", event.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded border border-gray-200 bg-white p-3 text-sm">
                        <div className="mb-2 flex items-center gap-3">
                          <Calendar className="h-4 w-4 flex-shrink-0 text-gray-500" />
                          <div className="text-gray-700">
                            <span className="font-medium">日期：</span>
                            {range.startDate.replace(/-/g, "/")} - {range.endDate.replace(/-/g, "/")}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 flex-shrink-0 text-gray-500" />
                          <div className="text-gray-700">
                            <span className="font-medium">时间：</span>
                            {range.startTime} - {range.endTime}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                通知方式设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>通知选项</Label>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300">
                    <Checkbox
                      id="email-notify"
                      checked={emailNotify}
                      onCheckedChange={(checked) => setEmailNotify(Boolean(checked))}
                    />
                    <Label htmlFor="email-notify" className="flex flex-1 cursor-pointer items-center">
                      <Mail className="mr-3 h-5 w-5 text-blue-600" />
                      <span className="font-medium">邮箱通知</span>
                    </Label>
                  </div>

                  {emailNotify ? (
                    <div className="ml-6 mt-2">
                      <Label htmlFor="email-input">邮箱地址</Label>
                      <Input
                        id="email-input"
                        type="email"
                        placeholder="example@mail.com"
                        className="mt-1"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                  ) : null}

                  <div className="flex items-center space-x-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-yellow-300">
                    <Checkbox
                      id="phone-notify"
                      checked={phoneNotify}
                      onCheckedChange={(checked) => setPhoneNotify(Boolean(checked))}
                    />
                    <Label htmlFor="phone-notify" className="flex flex-1 cursor-pointer items-center">
                      <Phone className="mr-3 h-5 w-5 text-yellow-600" />
                      <span className="font-medium">手机通知</span>
                    </Label>
                  </div>

                  {phoneNotify ? (
                    <div className="ml-6 mt-2 space-y-3">
                      <div>
                        <Label htmlFor="phone-code">手机国家代码</Label>
                        <Select value={phoneCode} onValueChange={setPhoneCode}>
                          <SelectTrigger id="phone-code" className="mt-1">
                            <SelectValue placeholder="选择国家代码" />
                          </SelectTrigger>
                          <SelectContent>
                            {phoneCodes.map((code) => (
                              <SelectItem key={code.value} value={code.value}>
                                {code.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="phone-number">手机号码</Label>
                        <Input
                          id="phone-number"
                          type="tel"
                          placeholder="手机号码"
                          className="mt-1"
                          value={phoneNumber}
                          onChange={(event) => setPhoneNumber(event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                <div className="text-center md:text-left">
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">开始监控法国签证预约</h3>
                  <p className="max-w-lg text-gray-600">
                    系统会按照你设定的国家、城市、时间段与 Slot 类型持续监控，一旦发现可预约名额会立即通知你。
                  </p>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading || !city}
                  className="h-12 min-w-[180px] bg-blue-600 text-white hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-5 w-5" strokeWidth={3} />
                      启动监控
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

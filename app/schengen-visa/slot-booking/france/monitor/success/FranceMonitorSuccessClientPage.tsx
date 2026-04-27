"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Clock, Mail, Phone, ArrowLeft, MapPin, Calendar, Bell } from "lucide-react"

interface MonitorConfig {
  application_country: string
  application_city: string
  visa_type: string
  travel_purpose: string
  slot_types: string[]
  date_ranges: Array<{
    start_date: string
    end_date: string
    start_time: string
    end_time: string
  }>
  notifications: {
    email?: string
    phone?: string
  }
}

export default function FranceMonitorSuccessClientPage() {
  const router = useRouter()
  const [monitorConfig, setMonitorConfig] = useState<MonitorConfig | null>(null)
  const [appointmentFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getMonitorConfig = () => {
      try {
        const savedConfig = localStorage.getItem("lastMonitorConfig")
        if (savedConfig) {
          const config = JSON.parse(savedConfig)
          setMonitorConfig(config)
        }
      } catch (error) {
        console.error("获取监控配置失败:", error)
      } finally {
        setLoading(false)
      }
    }

    getMonitorConfig()

    const checkStatus = setInterval(() => {
      // 后续可接入 WebSocket 或轮询接口更新监控状态。
    }, 5000)

    return () => clearInterval(checkStatus)
  }, [])

  const formatCountryName = (code: string) => {
    const countryMap: { [key: string]: string } = {
      cn: "中国",
      us: "美国",
      uk: "英国",
      fr: "法国",
      de: "德国",
    }
    return countryMap[code] || code.toUpperCase()
  }

  const formatCityName = (code: string) => {
    const cityMap: { [key: string]: string } = {
      SHA: "上海",
      BJS: "北京",
      CAN: "广州",
      MNC: "曼彻斯特",
      LHR: "伦敦",
      CDG: "巴黎",
      BER: "柏林",
    }
    return cityMap[code] || code
  }

  const formatSlotType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      normal: "普通预约",
      premium: "高级预约",
      prime: "黄金时段",
    }
    return typeMap[type] || type
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-gray-900">
            <Check className="h-8 w-8 text-green-600" strokeWidth={2} />
            监控启动成功
          </h1>
          <p className="text-gray-600">您的签证预约监控已成功启动，我们将持续为您监控符合条件的预约名额。</p>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {appointmentFound ? <Check className="h-6 w-6 text-green-600" /> : <Clock className="h-6 w-6 text-blue-600" />}
                监控状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {appointmentFound ? (
                  <>
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="font-medium text-green-600">已找到预约名额</span>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
                    <span className="font-medium text-blue-600">正在监控中</span>
                  </>
                )}
              </div>

              {appointmentFound ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-700">已找到符合条件的预约名额。请检查您的邮箱和手机短信获取详细信息。</p>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">监控系统正在持续扫描可用预约名额。一旦发现符合您条件的名额，我们会立即通知您。</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-orange-600" />
                通知方式
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {monitorConfig?.notifications.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-500">邮箱通知</p>
                    <p className="font-medium text-blue-600">{monitorConfig.notifications.email}</p>
                  </div>
                </div>
              )}

              {monitorConfig?.notifications.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-500">短信通知</p>
                    <p className="font-medium text-green-600">{monitorConfig.notifications.phone}</p>
                  </div>
                </div>
              )}

              {!monitorConfig?.notifications.email && !monitorConfig?.notifications.phone && (
                <p className="text-sm text-gray-500">未配置通知方式</p>
              )}
            </CardContent>
          </Card>
        </div>

        {monitorConfig && (
          <Card className="mb-8 border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900">您的监控配置</CardTitle>
              <CardDescription className="text-gray-600">当前监控的预约条件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-500">申请地点</p>
                      <p className="font-medium text-gray-900">
                        {formatCountryName(monitorConfig.application_country)} - {formatCityName(monitorConfig.application_city)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-500">预约类型</p>
                      <div className="flex flex-wrap gap-1">
                        {monitorConfig.slot_types.map((type, index) => (
                          <span key={index} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                            {formatSlotType(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm text-gray-500">监控时间段</p>
                    <div className="space-y-2">
                      {monitorConfig.date_ranges.map((range, index) => (
                        <div key={index} className="rounded border border-gray-200 bg-gray-50 p-3">
                          <p className="text-sm font-medium text-gray-900">
                            {range.start_date} 至 {range.end_date}
                          </p>
                          <p className="text-xs text-gray-500">
                            {range.start_time} - {range.end_time}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card className="mb-8 border border-gray-200">
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                <span className="ml-2 text-gray-600">加载监控配置中...</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex gap-4">
          <Button
            onClick={() => router.push("/schengen-visa/slot-booking/france/monitor")}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            重新配置监控
          </Button>
          <Button onClick={() => router.push("/dashboard")} className="bg-blue-600 text-white hover:bg-blue-700">
            返回个人中心
          </Button>
        </div>
      </div>
    </div>
  )
}

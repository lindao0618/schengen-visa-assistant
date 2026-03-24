"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
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

export default function MonitorSuccessPage() {
  const router = useRouter()
  const [monitorConfig, setMonitorConfig] = useState<MonitorConfig | null>(null)
  const [monitorStatus, setMonitorStatus] = useState<'active' | 'completed' | 'failed'>('active')
  const [appointmentFound, setAppointmentFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 从localStorage获取最近提交的监控配置
    const getMonitorConfig = () => {
      try {
        const savedConfig = localStorage.getItem('lastMonitorConfig')
        if (savedConfig) {
          const config = JSON.parse(savedConfig)
          setMonitorConfig(config)
        }
      } catch (error) {
        console.error('获取监控配置失败:', error)
      } finally {
        setLoading(false)
      }
    }

    getMonitorConfig()
    
    // 模拟监控状态检查（实际项目中可以通过WebSocket或定时轮询获取）
    const checkStatus = setInterval(() => {
      // 这里可以调用API检查当前用户的监控任务状态
      // 暂时使用模拟数据
    }, 5000)

    return () => clearInterval(checkStatus)
  }, [])

  const formatCountryName = (code: string) => {
    const countryMap: { [key: string]: string } = {
      'cn': '中国',
      'us': '美国',
      'uk': '英国',
      'fr': '法国',
      'de': '德国'
    }
    return countryMap[code] || code.toUpperCase()
  }

  const formatCityName = (code: string) => {
    const cityMap: { [key: string]: string } = {
      'SHA': '上海',
      'BJS': '北京',
      'CAN': '广州',
      'MNC': '曼彻斯特',
      'LHR': '伦敦',
      'CDG': '巴黎',
      'BER': '柏林'
    }
    return cityMap[code] || code
  }

  const formatSlotType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'normal': '普通预约',
      'premium': '高级预约',
      'prime': '黄金时段'
    }
    return typeMap[type] || type
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Check className="h-8 w-8 text-green-600" strokeWidth={2} />
            监控启动成功
          </h1>
          <p className="text-gray-600">
            您的签证预约监控已成功启动，我们将持续为您监控符合条件的预约名额。
          </p>
        </div>

        {/* 监控状态卡片 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {appointmentFound ? (
                  <Check className="h-6 w-6 text-green-600" />
                ) : (
                  <Clock className="h-6 w-6 text-blue-600" />
                )}
                监控状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {appointmentFound ? (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-green-600 font-medium">已找到预约名额</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-blue-600 font-medium">正在监控中</span>
                  </>
                )}
              </div>
              
              {appointmentFound ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700 text-sm">
                    🎉 太好了！我们为您找到了符合条件的预约名额。请检查您的邮箱和手机短信获取详细信息。
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-700 text-sm">
                    ⏳ 监控系统正在为您持续扫描可用的预约名额。一旦发现符合您条件的名额，我们会立即通知您。
                  </p>
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
                <p className="text-gray-500 text-sm">未配置通知方式</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 监控配置详情 */}
        {monitorConfig && (
          <Card className="border border-gray-200 mb-8">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900">您的监控配置</CardTitle>
              <CardDescription className="text-gray-600">当前监控的预约条件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
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
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            {formatSlotType(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">监控时间段</p>
                    <div className="space-y-2">
                      {monitorConfig.date_ranges.map((range, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded border border-gray-200">
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
          <Card className="border border-gray-200 mb-8">
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">加载监控配置中...</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 mt-8">
          <Button 
            onClick={() => router.push('/schengen-visa/slot-booking/france/monitor')}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            重新配置监控
          </Button>
          <Button 
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            返回个人中心
          </Button>
        </div>
      </div>
    </div>
  )
}
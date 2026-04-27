"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { CheckCircle, Clock, Mail, Phone, Calendar, ArrowLeft, Home } from "lucide-react"

export default function FranceBookingSuccessClientPage() {
  const router = useRouter()
  const [bookingData, setBookingData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 从localStorage获取预约数据
    const savedData = localStorage.getItem('bookingData')
    if (savedData) {
      try {
        setBookingData(JSON.parse(savedData))
      } catch (error) {
        console.error('解析预约数据失败:', error)
      }
    }
    setLoading(false)
  }, [])

  const handleBackToHome = () => {
    router.push('/')
  }

  const handleViewBookings = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-white text-gray-900">
        <main className="flex-grow container mx-auto px-4 py-8 pt-20">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <main className="flex-grow container mx-auto px-4 py-8 pt-20">
        <AnimatedSection>
          <PageHeader 
            title="预约成功" 
            description="您的法国签证预约已成功提交，我们将为您处理后续流程。" 
            icon={<CheckCircle className="h-8 w-8 text-green-600" strokeWidth={2} />}
          />
        </AnimatedSection>
        
        <AnimatedSection>
          <div className="max-w-4xl mx-auto space-y-8">
            {/* 成功状态卡片 */}
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-green-800">预约提交成功！</CardTitle>
                <CardDescription className="text-green-700">
                  您的法国签证预约请求已成功提交，我们的系统将为您处理后续流程
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 预约详情 */}
            {bookingData && (
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    预约详情
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">TLS账号</label>
                      <p className="text-gray-900">{bookingData.tlsAccount?.username || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">递签国家</label>
                      <p className="text-gray-900">{bookingData.tlsAccount?.country || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">递签城市</label>
                      <p className="text-gray-900">{bookingData.tlsAccount?.city || 'N/A'}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">预约人数</label>
                      <p className="text-gray-900">{bookingData.payment?.peopleCount || 1} 人</p>
                    </div>
                  </div>
                  
                  {bookingData.bookingParams?.dateTimeRanges && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">预约时间范围</label>
                      <div className="space-y-2">
                        {bookingData.bookingParams.dateTimeRanges.map((range: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-md">
                            <p className="text-sm text-gray-600">
                              {range.startDate} 至 {range.endDate}
                            </p>
                            <p className="text-sm text-gray-600">
                              {range.startTime} - {range.endTime}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {bookingData.bookingParams?.slotTypes && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Slot类型</label>
                      <div className="flex gap-2">
                        {bookingData.bookingParams.slotTypes.map((type: string) => (
                          <span key={type} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            {type === 'normal' ? '标准' : type === 'prime' ? '黄金时段' : '高级'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 后续流程 */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Clock className="h-5 w-5" />
                  后续流程
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-blue-800">系统处理</p>
                      <p className="text-sm text-blue-700">我们的系统将使用您提供的TLS账号信息进行预约操作</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-blue-800">邮件通知</p>
                      <p className="text-sm text-blue-700">预约结果将通过邮件发送到您的邮箱</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-blue-800">预约确认</p>
                      <p className="text-sm text-blue-700">成功预约后，您将收到详细的预约确认信息</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 联系信息 */}
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  联系我们
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">邮箱支持</p>
                      <p className="text-sm text-gray-600">support@visa-assistant.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">客服热线</p>
                      <p className="text-sm text-gray-600">400-123-4567</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  如有任何问题，请随时联系我们。我们的客服团队将为您提供专业的帮助。
                </p>
              </CardContent>
            </Card>

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={handleBackToHome}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                返回首页
              </Button>
              
              <Button 
                onClick={handleViewBookings}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Calendar className="h-4 w-4" />
                查看我的预约
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </main>
    </div>
  )
}





























"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Check, Clock, Mail, Phone, ArrowLeft, ExternalLink } from "lucide-react"

// 国家名称映射
const countryNames: { [key: string]: string } = {
  france: "法国",
  germany: "德国", 
  italy: "意大利",
  spain: "西班牙",
  switzerland: "瑞士",
  netherlands: "荷兰",
  belgium: "比利时",
  austria: "奥地利",
  portugal: "葡萄牙",
  greece: "希腊"
}

export default function MonitorSuccessPage() {
  const router = useRouter()
  const params = useParams()
  const country = params.country as string
  const [monitorStatus, setMonitorStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const countryName = countryNames[country] || country

  useEffect(() => {
    // 获取监控状态
    const fetchMonitorStatus = async () => {
      try {
        const response = await fetch('/api/schengen/france/monitor?action=slots')
        if (response.ok) {
          const data = await response.json()
          setMonitorStatus(data)
        }
      } catch (error) {
        console.error('获取监控状态失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMonitorStatus()
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <main className="flex-grow container mx-auto px-4 py-8 pt-20">
        <AnimatedSection>
          <PageHeader 
            title={`${countryName}签证预约监控启动成功`}
            description="您的签证预约监控已成功启动，我们将持续监控符合条件的预约名额。" 
            icon={<Check className="h-8 w-8 text-green-400" strokeWidth={2} />}
          />
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <AnimatedSection>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Check className="h-6 w-6 text-green-400" />
                  <CardTitle className="text-lg">监控状态</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-medium">监控运行中</span>
                </div>
                <p className="text-gray-300 text-sm">
                  系统正在持续监控TLS预约系统，一旦发现符合条件的预约名额，将立即通过邮件通知您。
                </p>
              </CardContent>
            </Card>
          </AnimatedSection>

          <AnimatedSection>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Clock className="h-6 w-6 text-blue-400" />
                  <CardTitle className="text-lg">实时监控</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-300 text-sm">
                  您可以访问实时监控面板查看详细的监控状态和接收到的数据。
                </p>
                <Button 
                  onClick={() => window.open('/api/schengen/france/monitor/dashboard', '_blank')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  打开监控面板
                </Button>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>

        <AnimatedSection>
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">监控统计</CardTitle>
              <CardDescription>当前监控系统的运行状态</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <span className="ml-2 text-gray-300">加载中...</span>
                </div>
              ) : monitorStatus ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{monitorStatus.total_slots || 0}</div>
                    <div className="text-sm text-gray-400">总接收数据</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{monitorStatus.cache_size || 0}</div>
                    <div className="text-sm text-gray-400">缓存数据</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">{monitorStatus.matched_slots || 0}</div>
                    <div className="text-sm text-gray-400">匹配数据</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{monitorStatus.email_sent || 0}</div>
                    <div className="text-sm text-gray-400">发送通知</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  无法获取监控状态
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection>
          <div className="flex gap-4 mt-8">
            <Button 
              onClick={() => router.back()}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回上一页
            </Button>
            <Button 
              onClick={() => router.push(`/schengen-visa/slot-booking/${country}/monitor`)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              重新配置监控
            </Button>
          </div>
        </AnimatedSection>
      </main>
    </div>
  )
} 
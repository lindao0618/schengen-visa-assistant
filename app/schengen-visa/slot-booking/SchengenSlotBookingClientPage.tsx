"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Calendar, Clock, Flag } from "lucide-react"

// 申根国家签证中心列表
const schengenCenters = [
  { 
    id: "france", 
    name: "法国", 
    description: "法国签证申请中心提供巴黎、马赛、里昂等城市的预约服务，由法国签证申请中心(TLScontact)运营。",
    flag: "https://flagcdn.com/w160/fr.png",
    centers: ["英国伦敦", "英国曼彻斯特", "美国纽约", "意大利罗马", "西班牙马德里"],
    provider: "TLScontact",
    waitTime: "较长"
  },
  { 
    id: "germany", 
    name: "德国", 
    description: "德国签证申请中心由德国签证申请中心(VFS Global)运营，预约名额通常在每周一早上8点发放。",
    flag: "https://flagcdn.com/w160/de.png",
    centers: ["英国伦敦", "英国曼彻斯特", "美国纽约", "瑞士日内瓦", "丹麦哥本哈根"],
    provider: "VFS Global",
    waitTime: "中等"
  }
]

export default function SchengenSlotBookingClientPage() {
  const router = useRouter()
  
  const handleCountrySelect = (countryId: string) => {
    router.push(`/schengen-visa/slot-booking/${countryId}`)
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900 relative">
      {/* 背景装饰元素 - 极简白色风格 */}
      <div className="absolute top-0 left-0 h-full w-full opacity-5 pointer-events-none">
        <div className="absolute top-20 right-20 h-32 w-32 rounded-full bg-blue-100 blur-3xl"></div>
        <div className="absolute bottom-20 left-20 h-24 w-24 rounded-full bg-gray-100 blur-2xl"></div>
        <div className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-50 blur-3xl"></div>
      </div>
      <main className="flex-grow container mx-auto px-6 py-12 pt-24 relative z-10 max-w-7xl">
        <AnimatedSection>
          <PageHeader 
            title="申根Slot预约监控" 
            description="选择您的目标国家，开启智能监控服务，自动获取签证预约名额" 
            icon={<Calendar className="h-8 w-8 text-blue-600" strokeWidth={2} />}
          />
        </AnimatedSection>
        
        <AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {schengenCenters.map((country) => (
              <Card 
                key={country.id} 
                className="bg-white border-0 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full group cursor-pointer overflow-hidden transform-gpu"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.1)' }}
              >
                <CardHeader className="pb-6 pt-8">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-16 overflow-hidden rounded-lg shadow-sm border border-gray-100">
                        <Image
                          src={country.flag}
                          alt={`${country.name}国旗`}
                          width={64}
                          height={48}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-gray-900 mb-1">{country.name}</CardTitle>
                        <div className="text-sm text-gray-500">{country.provider}</div>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      等待: {country.waitTime}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <CardDescription className="text-gray-600 mb-6 leading-relaxed">{country.description}</CardDescription>
                  <div className="mb-6">
                    <div className="text-gray-500 text-sm mb-3 font-medium">签证中心</div>
                    <div className="flex flex-wrap gap-2">
                      {country.centers.map((center) => (
                        <span key={center} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium">
                          {center}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="px-8 pb-8 pt-0">
                  <div className="flex flex-col space-y-3 w-full">
                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 flex items-center justify-center gap-3 rounded-xl font-medium transition-all duration-200 group-hover:scale-[1.02]"
                      onClick={() => router.push(`/schengen-visa/slot-booking/${country.id}/monitor`)}
                    >
                      <Clock className="h-4 w-4" />
                      🕒 监控 {country.name} Slot
                    </Button>
                    <Button 
                      className="w-full h-12 bg-gray-900 hover:bg-black text-white flex items-center justify-center gap-3 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]"
                      onClick={() => router.push(`/schengen-visa/slot-booking/${country.id}/book`)}
                    >
                      <Calendar className="h-4 w-4" />
                      📅 立即预约
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </AnimatedSection>
        
        {/* 其他正在开发中的提示 */}
        <AnimatedSection>
          <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-0 rounded-2xl shadow-sm" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent className="px-8 py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-orange-100 rounded-full">
                  <Flag className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">更多申根国家正在开发中</h3>
                <p className="text-gray-600 max-w-md leading-relaxed">
                  我们正在努力开发意大利、西班牙、瑞士、荷兰等更多申根国家的预约服务，敬请期待！
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium">
                    意大利 🇮🇹
                  </span>
                  <span className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium">
                    西班牙 🇪🇸
                  </span>
                  <span className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium">
                    瑞士 🇨🇭
                  </span>
                  <span className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium">
                    荷兰 🇳🇱
                  </span>
                  <span className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium">
                    更多...
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
        
        <AnimatedSection>
          <Card className="bg-white border-0 rounded-2xl shadow-sm" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardHeader className="pt-8 pb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">Slot 预约监控说明</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <ul className="space-y-4 text-gray-700">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-relaxed">我们会实时监控您选择的签证中心预约系统，一旦有新名额会立即通知您</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-relaxed">您可以设置多个时间段，以便在您期望的时间范围内获取预约</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-relaxed">部分国家（如德国、瑞士）每周固定时间放名额，我们会提前通知您准备</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-relaxed">监控服务24小时运行，确保您不会错过任何预约机会</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="leading-relaxed">一旦检测到可用名额，系统会通过邮件、短信等方式第一时间通知您</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </AnimatedSection>
      </main>
    </div>
  )
}

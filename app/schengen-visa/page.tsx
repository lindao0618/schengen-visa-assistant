"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Calendar, FileText, GraduationCap, Plane } from "lucide-react"

// 申根功能模块
const schengenModules = [
  { 
    id: "slot-booking", 
    title: "申根Slot预约", 
    description: "自动监控签证中心的预约名额，帮助您获取理想的面试时间段",
    icon: <Calendar className="h-10 w-10 text-green-500" />,
    link: "/schengen-visa/slot-booking"
  },
  { 
    id: "materials", 
    title: "申根材料准备", 
    description: "根据目标国家要求自动生成材料清单，并提供准备指南",
    icon: <GraduationCap className="h-10 w-10 text-orange-500" />,
    link: "/schengen-visa/materials"
  },
  { 
    id: "automation", 
    title: "自动化填表", 
    description: "按签证类型自动填写官网表格，支持法签等",
    icon: <FileText className="h-10 w-10 text-blue-500" />,
    link: "/schengen-visa/automation"
  },
]

// 热门申根国家
const popularCountries = [
  { value: "france", label: "法国", flag: "https://flagcdn.com/w80/fr.png" },
  { value: "germany", label: "德国", flag: "https://flagcdn.com/w80/de.png" },
  { value: "italy", label: "意大利", flag: "https://flagcdn.com/w80/it.png" },
  { value: "spain", label: "西班牙", flag: "https://flagcdn.com/w80/es.png" },
  { value: "switzerland", label: "瑞士", flag: "https://flagcdn.com/w80/ch.png" },
]

export default function ApplyPage() {
  const router = useRouter()
  
  const handleModuleSelect = (path: string) => {
    router.push(path)
  }
  
  const handleCountrySelect = (country: string) => {
    router.push(`/schengen-visa/${country}`)
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 text-gray-900 relative">
      {/* 背景装饰元素 - 白色背景配黑色阴影 */}
      <div className="absolute top-0 left-0 h-full w-full opacity-15 pointer-events-none">
        <div className="absolute top-10 right-10 h-20 w-20 rounded-full bg-white shadow-lg blur-3xl"></div>
        <div className="absolute bottom-10 left-10 h-20 w-20 rounded-full bg-white shadow-md blur-3xl"></div>
        <div className="absolute top-1/2 left-1/3 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-xl blur-3xl"></div>
      </div>
      <main className="flex-grow container mx-auto px-4 py-8 pt-20 relative z-10">
        <AnimatedSection>
          <PageHeader 
            title="申根签证助手" 
            description="全方位帮助您准备申根签证申请，从材料准备到预约监控" 
            icon={<Plane className="h-8 w-8 text-blue-600" strokeWidth={2} />}
          />
        </AnimatedSection>
        
        <AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {schengenModules.map((module) => (
              <Card key={module.id} className="bg-white border-gray-200 hover:border-gray-300 shadow-lg hover:shadow-xl transition-all duration-200 h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {module.icon}
                    <CardTitle className="text-gray-800">{module.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base mb-4 text-gray-600">{module.description}</CardDescription>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => handleModuleSelect(module.link)} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  >
                    进入 {module.title}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </AnimatedSection>
        
        <AnimatedSection>
          <Card className="bg-white border-gray-200 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Plane className="h-8 w-8 text-blue-600" />
                <CardTitle className="text-gray-800">热门申根国家</CardTitle>
              </div>
              <CardDescription className="text-gray-600">直接访问热门申根国家的签证申请指南</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {popularCountries.map((country) => (
                  <div
                    key={country.value}
                    className="flex flex-col items-center p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 bg-white"
                    onClick={() => handleCountrySelect(country.value)}
                  >
                    <div className="relative w-16 h-16 mb-3 overflow-hidden rounded-md shadow-sm">
                      <Image
                        src={country.flag}
                        alt={`${country.label}国旗`}
                        width={64}
                        height={64}
                        unoptimized
                        className="object-cover rounded-md"
                      />
                    </div>
                    <span className="text-base font-medium text-center text-gray-800">{country.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </main>
    </div>
  )
}

"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Flag, Plane } from "lucide-react"

// 申根国家列表
const schengenCountries = [
  { 
    id: "france", 
    name: "法国", 
    description: "法国是申根区创始成员国之一，拥有丰富的文化遗产和美食。",
    flag: "https://flagcdn.com/w160/fr.png",
    popularity: "高",
    processingTime: "15-30天",
    visaFee: "80欧元"
  },
  { 
    id: "germany", 
    name: "德国", 
    description: "德国是欧洲最大的经济体，拥有高效的签证处理系统和明确的申请流程。",
    flag: "https://flagcdn.com/w160/de.png",
    popularity: "高",
    processingTime: "10-25天",
    visaFee: "80欧元"
  },
  { 
    id: "italy", 
    name: "意大利", 
    description: "意大利拥有丰富的历史文化和艺术遗产，是旅游和商务访问的热门目的地。",
    flag: "https://flagcdn.com/w160/it.png",
    popularity: "中高",
    processingTime: "15-30天",
    visaFee: "80欧元"
  },
  { 
    id: "spain", 
    name: "西班牙", 
    description: "西班牙气候宜人，文化多元，是休闲旅游和商务访问的理想选择。",
    flag: "https://flagcdn.com/w160/es.png",
    popularity: "中高",
    processingTime: "15-30天",
    visaFee: "80欧元"
  },
  { 
    id: "switzerland", 
    name: "瑞士", 
    description: "瑞士虽不是欧盟成员国，但属于申根区，以其美丽的自然风光和高效率著称。",
    flag: "https://flagcdn.com/w160/ch.png",
    popularity: "中",
    processingTime: "10-20天",
    visaFee: "80欧元"
  },
  { 
    id: "netherlands", 
    name: "荷兰", 
    description: "荷兰以其开放的商业环境和便捷的交通连接著称，是商务访问的理想选择。",
    flag: "https://flagcdn.com/w160/nl.png",
    popularity: "中",
    processingTime: "15-25天",
    visaFee: "80欧元"
  },
  { 
    id: "belgium", 
    name: "比利时", 
    description: "比利时是欧盟总部所在地，签证处理相对高效，适合商务和旅游访问。",
    flag: "https://flagcdn.com/w160/be.png",
    popularity: "中低",
    processingTime: "15-30天",
    visaFee: "80欧元"
  },
  { 
    id: "austria", 
    name: "奥地利", 
    description: "奥地利以其音乐艺术和自然风光闻名，签证申请流程清晰规范。",
    flag: "https://flagcdn.com/w160/at.png",
    popularity: "中低",
    processingTime: "15-25天",
    visaFee: "80欧元"
  },
  { 
    id: "portugal", 
    name: "葡萄牙", 
    description: "葡萄牙气候宜人，生活成本较低，是旅游和长期居留的理想选择。",
    flag: "https://flagcdn.com/w160/pt.png",
    popularity: "中低",
    processingTime: "15-30天",
    visaFee: "80欧元"
  },
  { 
    id: "greece", 
    name: "希腊", 
    description: "希腊拥有丰富的历史文化和美丽的海岛风光，是旅游爱好者的理想目的地。",
    flag: "https://flagcdn.com/w160/gr.png",
    popularity: "中",
    processingTime: "20-35天",
    visaFee: "80欧元"
  },
]

export default function CountrySelectionPage() {
  const router = useRouter()
  
  const handleCountrySelect = (countryId: string) => {
    router.push(`/schengen-visa/${countryId}`)
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
            title="选择申根国家" 
            description="请选择您计划访问的主要申根国家，我们将为您提供该国家的签证申请指南和材料清单。" 
            icon={<Flag className="h-8 w-8 text-blue-600" strokeWidth={2} />}
          />
        </AnimatedSection>
        
        <AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {schengenCountries.map((country) => (
              <Card 
                key={country.id} 
                className="hover:border-gray-300 hover:shadow-xl transition-all duration-200 h-full bg-white border-gray-200 shadow-lg cursor-pointer"
                onClick={() => handleCountrySelect(country.id)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 overflow-hidden rounded border border-gray-300 shadow-sm">
                        <Image
                          src={country.flag}
                          alt={`${country.name}国旗`}
                          width={64}
                          height={48}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <CardTitle className="text-xl text-gray-800">{country.name}</CardTitle>
                    </div>
                    <div className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                      热度：{country.popularity}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 mb-4">{country.description}</CardDescription>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <div className="flex flex-col">
                      <span className="text-gray-500">处理时间</span>
                      <span className="font-medium">{country.processingTime}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500">签证费</span>
                      <span className="font-medium">{country.visaFee}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    className="w-full border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 shadow-sm"
                  >
                    选择{country.name}
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
                <Plane className="h-6 w-6 text-blue-600" />
                <CardTitle className="text-lg text-gray-800">申根签证小贴士</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-700 list-disc list-inside">
                <li>选择您停留时间最长的申根国家作为主申请国</li>
                <li>如果在多个国家停留时间相同，选择您第一个入境的申根国家</li>
                <li>确保您的护照有效期超过计划离开申根区日期后至少6个月</li>
                <li>准备足够的资金证明和旅行计划，以证明您有意在签证到期后返回</li>
                <li>提前预约签证申请，特别是在旅游旺季（4-8月）</li>
              </ul>
            </CardContent>
          </Card>
        </AnimatedSection>
      </main>
    </div>
  )
}

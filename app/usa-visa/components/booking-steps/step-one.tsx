"use client"

import { useState, useEffect } from "react"
import { 
  Card, 
  CardContent
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { MapPin, Globe, Building2, Info } from "lucide-react"
import type { BookingFormData, VisaSystemType } from "../../appointment-booking/types"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface StepOneProps {
  formData: BookingFormData
  updateFormData: (data: Partial<BookingFormData>) => void
  onNext: () => void
}

// 签证中心系统
interface VisaLocation {
  name: string
  systemType: VisaSystemType
}

// 签证系统匹配
const visaSystemMap: Record<string, VisaSystemType> = {
  "中国": "CGI",
  "香港": "CGI",
  "台湾": "CGI",
  "日本": "CGI",
  "韩国": "CGI",
  "新加坡": "CGI",
  "马来西亚": "CGI",
  "英国": "AIS",
  "法国": "AIS",
  "德国": "AIS",
  "意大利": "AIS",
  "西班牙": "AIS",
  "加拿大": "AIS",
  "墨西哥": "AIS",
  "澳大利亚": "AVITS",
  "新西兰": "AVITS",
}

// 地区数据
const regions = {
  asia: {
    name: "亚洲",
    countries: [
      "中国",
      "香港",
      "台湾",
      "日本",
      "韩国",
      "新加坡",
      "马来西亚"
    ]
  },
  europe: {
    name: "欧洲",
    countries: [
      "英国",
      "法国", 
      "德国", 
      "意大利", 
      "西班牙"
    ]
  },
  americas: {
    name: "美洲",
    countries: [
      "加拿大",
      "墨西哥"
    ]
  },
  oceania: {
    name: "大洋洲",
    countries: [
      "澳大利亚",
      "新西兰"
    ]
  }
}

// 签证地点
const visaLocations: Record<string, VisaLocation[]> = {
  "中国": [
    { name: "北京", systemType: "CGI" },
    { name: "上海", systemType: "CGI" },
    { name: "广州", systemType: "CGI" },
    { name: "成都", systemType: "CGI" },
    { name: "沈阳", systemType: "CGI" }
  ],
  "香港": [
    { name: "香港", systemType: "CGI" }
  ],
  "台湾": [
    { name: "台北", systemType: "CGI" }
  ],
  "日本": [
    { name: "东京", systemType: "CGI" },
    { name: "大阪", systemType: "CGI" }
  ],
  "韩国": [
    { name: "首尔", systemType: "CGI" }
  ],
  "新加坡": [
    { name: "新加坡", systemType: "CGI" }
  ],
  "英国": [
    { name: "伦敦", systemType: "AIS" },
    { name: "曼彻斯特", systemType: "AIS" }
  ],
  "法国": [
    { name: "巴黎", systemType: "AIS" }
  ],
  "德国": [
    { name: "柏林", systemType: "AIS" },
    { name: "慕尼黑", systemType: "AIS" },
    { name: "法兰克福", systemType: "AIS" }
  ],
  "澳大利亚": [
    { name: "悉尼", systemType: "AVITS" },
    { name: "墨尔本", systemType: "AVITS" }
  ]
}

export function StepOne({ formData, updateFormData, onNext }: StepOneProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>("asia")
  const [availableLocations, setAvailableLocations] = useState<VisaLocation[]>([])
  const [systemInfo, setSystemInfo] = useState<string>("")

  // 当国家改变时更新可用的面试地点
  useEffect(() => {
    if (formData.country && visaLocations[formData.country]) {
      setAvailableLocations(visaLocations[formData.country])
      
      // 重置地点选择
      if (formData.location && !visaLocations[formData.country].some(loc => loc.name === formData.location)) {
        updateFormData({ location: "" })
      }
    } else {
      setAvailableLocations([])
      updateFormData({ location: "" })
    }
  }, [formData.country, formData.location, updateFormData])

  // 更新系统信息说明
  useEffect(() => {
    if (!formData.systemType || formData.systemType === "Unknown") {
      setSystemInfo("")
      return
    }

    switch(formData.systemType) {
      case "CGI":
        setSystemInfo("CGI系统需要您准备DS-160确认页、护照信息和申请费支付收据")
        break
      case "AIS":
        setSystemInfo("AIS系统需要填写额外的安全问题，并需要准备申请ID")
        break
      case "AVITS":
        setSystemInfo("AVITS系统需要您提前完成在线表格并获取参考号码")
        break
      default:
        setSystemInfo("")
    }
  }, [formData.systemType])

  // 选择国家
  const handleCountrySelect = (country: string) => {
    const systemType = visaSystemMap[country] || "Unknown"
    updateFormData({ 
      country, 
      systemType,
      location: "" // 重置地点
    })
  }

  // 选择地点
  const handleLocationSelect = (location: string) => {
    const selectedLocation = availableLocations.find(loc => loc.name === location)
    if (selectedLocation) {
      updateFormData({ 
        location,
        systemType: selectedLocation.systemType 
      })
    }
  }

  // 判断是否可以进入下一步
  const canProceed = formData.country && formData.location && formData.systemType !== "Unknown"

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-blue-500" />
              第1步：选择国家/地区和面试地点
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              请选择您希望预约面签的国家/地区和具体面试地点，系统将自动判断对应的签证系统类型。
            </p>
          </div>

          {/* 地区和国家选择 */}
          <div className="space-y-6">
            <Tabs 
              value={selectedRegion} 
              onValueChange={setSelectedRegion}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="asia">亚洲</TabsTrigger>
                <TabsTrigger value="europe">欧洲</TabsTrigger>
                <TabsTrigger value="americas">美洲</TabsTrigger>
                <TabsTrigger value="oceania">大洋洲</TabsTrigger>
              </TabsList>

              {Object.entries(regions).map(([key, region]) => (
                <TabsContent key={key} value={key} className="mt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          选择国家/地区
                        </label>
                        <Select 
                          value={formData.country}
                          onValueChange={handleCountrySelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="请选择国家/地区" />
                          </SelectTrigger>
                          <SelectContent>
                            {region.countries.map((country) => (
                              <SelectItem key={country} value={country}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{country}</span>
                                  <Badge 
                                    variant={
                                      visaSystemMap[country] === "CGI" ? "default" : 
                                      visaSystemMap[country] === "AIS" ? "secondary" : 
                                      "outline"
                                    }
                                    className="ml-2"
                                  >
                                    {visaSystemMap[country] || "Unknown"}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.country && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            选择面试地点
                          </label>
                          <Select
                            value={formData.location}
                            onValueChange={handleLocationSelect}
                            disabled={!formData.country || availableLocations.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="请选择面试地点" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableLocations.map((location) => (
                                <SelectItem key={location.name} value={location.name}>
                                  <div className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                                    {location.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* 系统信息显示 */}
            {formData.systemType !== "Unknown" && formData.country && formData.location && (
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800 mb-1">
                      您选择的国家/地区使用 {formData.systemType} 签证系统
                    </h4>
                    <p className="text-sm text-blue-600">{systemInfo}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 导航按钮 */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={onNext}
              disabled={!canProceed}
            >
              下一步
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

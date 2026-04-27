"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Check, Clock, CreditCard, DollarSign, Flag, KeyRound, Loader2, Lock, Mail, Phone, Plus, User, Wand2, X } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimeSlot {
  date: string
  time: string
  available: number
  type: "normal" | "prime" | "premium"
  price: number
}

interface DateTimeRange {
  id: number
  startDate: string
  endDate: string
  startTime: string
  endTime: string
}

// 可用的签证预约时段
const availableSlots: DateTimeSlot[] = [
  { date: "2025-05-28", time: "09:30", available: 3, type: "normal", price: 350 },
  { date: "2025-05-28", time: "14:00", available: 2, type: "normal", price: 350 },
  { date: "2025-05-29", time: "10:45", available: 1, type: "prime", price: 450 },
  { date: "2025-05-30", time: "15:30", available: 5, type: "normal", price: 350 },
  { date: "2025-06-01", time: "08:15", available: 2, type: "premium", price: 550 },
  { date: "2025-06-01", time: "11:00", available: 3, type: "prime", price: 450 },
  { date: "2025-06-02", time: "09:00", available: 1, type: "premium", price: 550 },
  { date: "2025-06-03", time: "13:45", available: 4, type: "normal", price: 350 },
]

// 不同类型slot签证预约的描述
const slotTypeDescription = {
  normal: "标准预约，等待时间正常，基础服务。",
  prime: "黄金时段预约，优先处理，等待时间缩短。",
  premium: "高级预约，专属通道，最短等待时间，优先处理。",
}

export default function FranceSlotBookingClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("account")
  
  // TLS账号信息
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [selectedCity, setSelectedCity] = useState<string>("")
  
  // 递签国家和城市数据
  const countriesData = {
    uk: {
      label: "英国",
      cities: [
        { value: "london", label: "伦敦" },
        { value: "manchester", label: "曼彻斯特" },
        { value: "edinburgh", label: "爱丁堡" }
      ]
    },
    china: {
      label: "中国",
      cities: [
        { value: "beijing", label: "北京" },
        { value: "shanghai", label: "上海" },
        { value: "guangzhou", label: "广州" },
        { value: "chengdu", label: "成都" }
      ]
    },
    france: {
      label: "法国",
      cities: [
        { value: "paris", label: "巴黎" },
        { value: "lyon", label: "里昂" },
        { value: "marseille", label: "马赛" }
      ]
    }
  }
  
  // 预约信息
  const [selectedSlot, setSelectedSlot] = useState<DateTimeSlot | null>({
    date: new Date().toISOString().substring(0, 10),
    time: "09:00",
    available: 0,
    type: "normal",
    price: 350
  })
  const [selectedSlotTypes, setSelectedSlotTypes] = useState<string[]>(["normal"])
  
  // 日期时间范围
  const [dateTimeRanges, setDateTimeRanges] = useState<DateTimeRange[]>([{
    id: 1,
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().substring(0, 10),
    startTime: "08:30",
    endTime: "16:30"
  }])
  
  // 费用信息
  const [peopleCount, setPeopleCount] = useState(1)
  const [isUrgent, setIsUrgent] = useState(false)
  
  // 支付信息
  const [paymentMethod, setPaymentMethod] = useState("wechat")
  const [paymentStatus, setPaymentStatus] = useState("pending")
  
  // 费用计算
  const calculateFees = () => {
    if (!selectedSlot) return { basePrice: 0, addOnFee: 0, enhancedFee: 0, urgentFee: 0, perPersonFee: 0, total: 0 }
    
    const basePrice = selectedSlot.price
    const addOnFee = 50 // 申请附加费
    const enhancedFee = selectedSlot.type === "premium" ? 100 : selectedSlot.type === "prime" ? 50 : 0
    const urgentFee = isUrgent ? 200 : 0
    const perPersonFee = basePrice + addOnFee + enhancedFee + urgentFee
    const total = perPersonFee * peopleCount
    
    return { basePrice, addOnFee, enhancedFee, urgentFee, perPersonFee, total }
  }
  
  const fees = calculateFees()
  
  // 筛选可用时段
  const filteredSlots = selectedSlotTypes.length === 0 ? 
    availableSlots : 
    availableSlots.filter(slot => selectedSlotTypes.includes(slot.type))
  
  // 选择时段
  const handleSelectSlot = (slot: DateTimeSlot) => {
    setSelectedSlot(slot)
    setActiveTab("fees")
  }
  
  // 确认支付
  const handleConfirmPayment = async () => {
    setLoading(true)
    setPaymentStatus("processing")
    
    try {
      // 构建预约数据
      const bookingData = {
        id: `booking_${Date.now()}`, // 生成唯一ID
        tlsAccount: {
          username: username,
          password: password,
          country: selectedCountry,
          city: selectedCity
        },
        bookingParams: {
          dateTimeRanges: dateTimeRanges,
          slotTypes: selectedSlotTypes,
          selectedSlot: selectedSlot
        },
        payment: {
          peopleCount: peopleCount,
          isUrgent: isUrgent,
          paymentMethod: paymentMethod,
          totalAmount: fees.total
        },
        status: "submitted", // 初始状态
        submittedAt: new Date().toISOString(),
        result: null
      }
      
      // 保存数据到localStorage
      localStorage.setItem('bookingData', JSON.stringify(bookingData))
      
      // 保存到预约历史
      const existingBookings = JSON.parse(localStorage.getItem('bookingHistory') || '[]')
      existingBookings.unshift(bookingData)
      localStorage.setItem('bookingHistory', JSON.stringify(existingBookings))
      
      // 立即显示成功状态
      setPaymentStatus("success")
      setLoading(false)
      
      // 跳转到成功页面
      router.push(`/schengen-visa/slot-booking/france/book/success`)
      
      // 后台异步处理预约
      fetch('/api/schengen/france/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
      })
      .then(response => response.json())
      .then(result => {
        // 更新预约状态
        const updatedBookings = JSON.parse(localStorage.getItem('bookingHistory') || '[]')
        const bookingIndex = updatedBookings.findIndex((b: any) => b.id === bookingData.id)
        if (bookingIndex !== -1) {
          updatedBookings[bookingIndex].status = result.success ? "processing" : "failed"
          updatedBookings[bookingIndex].result = result
          updatedBookings[bookingIndex].processedAt = new Date().toISOString()
          localStorage.setItem('bookingHistory', JSON.stringify(updatedBookings))
        }
      })
      .catch(error => {
        console.error('后台处理预约时出错:', error)
        // 更新预约状态为失败
        const updatedBookings = JSON.parse(localStorage.getItem('bookingHistory') || '[]')
        const bookingIndex = updatedBookings.findIndex((b: any) => b.id === bookingData.id)
        if (bookingIndex !== -1) {
          updatedBookings[bookingIndex].status = "failed"
          updatedBookings[bookingIndex].result = { error: error.message }
          updatedBookings[bookingIndex].processedAt = new Date().toISOString()
          localStorage.setItem('bookingHistory', JSON.stringify(updatedBookings))
        }
      })
      
    } catch (error) {
      console.error('预约提交时出错:', error)
      setPaymentStatus("failed")
      setLoading(false)
      
      // 显示错误信息
      alert(error instanceof Error ? error.message : '预约提交失败，请稍后重试')
    }
  }
  
  // 获取不同类型时段的标签
  const getSlotTypeTag = (type: "normal" | "prime" | "premium") => {
    if (type === "normal") return <span key="normal" className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded-full">Normal</span>
    if (type === "prime") return <span key="prime" className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-full">Prime Time</span>
    return <span key="premium" className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded-full">Premium</span>
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <main className="flex-grow container mx-auto px-4 py-8 pt-20">
        <AnimatedSection>
          <PageHeader 
            title="法国签证预约" 
            description="预约您的法国签证申请提交时间，完成支付后将确认您的预约。" 
            icon={<Calendar className="h-8 w-8 text-blue-600" strokeWidth={2} />}
          />
        </AnimatedSection>
        
        <AnimatedSection>
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 w-full bg-gray-100">
              <TabsTrigger value="account" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <KeyRound className="h-4 w-4 mr-2" />
                TLS账号
              </TabsTrigger>
              <TabsTrigger value="slots" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Calendar className="h-4 w-4 mr-2" />
                选择时段
              </TabsTrigger>
              <TabsTrigger value="fees" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <DollarSign className="h-4 w-4 mr-2" />
                费用与支付
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="account" className="border-none p-0 mt-6">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <User className="h-6 w-6 text-blue-600" />
                    <CardTitle className="text-lg text-gray-900">TLS账号信息</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600">
                    请输入您的TLS账号登录信息，用于预约签证申请提交时间
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-gray-700">TLS官网用户名</Label>
                      <Input
                        id="username"
                        placeholder="输入您的TLS用户名或邮箱"
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-700">TLS官网密码</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="输入您的TLS密码"
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-gray-700">递签国家</Label>
                      <Select
                        value={selectedCountry}
                        onValueChange={(value) => {
                          setSelectedCountry(value)
                          setSelectedCity("")
                        }}
                      >
                        <SelectTrigger className="bg-white border-gray-300 text-gray-900" id="country">
                          <SelectValue placeholder="选择递签国家" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          {Object.keys(countriesData).map((countryCode) => (
                            <SelectItem key={countryCode} value={countryCode} className="text-gray-900">
                              {countriesData[countryCode as keyof typeof countriesData].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-gray-700">递签城市</Label>
                      <Select
                        value={selectedCity}
                        onValueChange={setSelectedCity}
                        disabled={!selectedCountry}
                      >
                        <SelectTrigger className="bg-white border-gray-300 text-gray-900" id="city">
                          <SelectValue placeholder={selectedCountry ? "选择递签城市" : "请先选择国家"} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          {selectedCountry && 
                            countriesData[selectedCountry as keyof typeof countriesData].cities.map((city) => (
                              <SelectItem key={city.value} value={city.value} className="text-gray-900">
                                {city.label}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200 flex items-start gap-3">
                      <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-700">
                        我们不会储存您的账号密码，仅用于自动登录TLS官网预约系统。请确保您已在TLS官网完成注册并创建了申请档案。
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t border-gray-200 pt-6">
                  <Button 
                    onClick={() => setActiveTab("slots")} 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    下一步：选择时段
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="slots" className="border-none p-0 mt-6">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    <CardTitle className="text-lg text-gray-900">设置抢号参数</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600">
                    设置您希望抢号的日期范围、时间范围和Slot类型，系统将自动为您监控并抢占符合条件的槽位
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {/* 日期时间范围选择 */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base text-gray-700">预约日期时间范围</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (dateTimeRanges.length < 3) {
                              setDateTimeRanges([...dateTimeRanges, {
                                id: Date.now(),
                                startDate: new Date().toISOString().substring(0, 10),
                                endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().substring(0, 10),
                                startTime: "08:30",
                                endTime: "16:30"
                              }])
                            }
                          }}
                          disabled={dateTimeRanges.length >= 3}
                          className="border-gray-300 hover:border-blue-400"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加范围
                        </Button>
                      </div>
                      
                      {dateTimeRanges.map((range, index) => (
                        <div key={range.id} className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium flex items-center gap-2 text-gray-700">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              范围 {index + 1}
                            </h3>
                            {dateTimeRanges.length > 1 && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setDateTimeRanges(dateTimeRanges.filter(r => r.id !== range.id))
                                }}
                                className="h-6 w-6 text-gray-600 hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-600">开始日期</Label>
                              <Input
                                type="date"
                                className="bg-white border-gray-300 text-gray-900"
                                value={range.startDate}
                                onChange={(e) => {
                                  const newRanges = [...dateTimeRanges]
                                  newRanges[index].startDate = e.target.value
                                  setDateTimeRanges(newRanges)
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-600">结束日期</Label>
                              <Input
                                type="date"
                                className="bg-white border-gray-300 text-gray-900"
                                value={range.endDate}
                                onChange={(e) => {
                                  const newRanges = [...dateTimeRanges]
                                  newRanges[index].endDate = e.target.value
                                  setDateTimeRanges(newRanges)
                                }}
                              />
                            </div>
                          </div>
                          
                          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-600">开始时间</Label>
                              <Input
                                type="time"
                                className="bg-white border-gray-300 text-gray-900"
                                value={range.startTime}
                                onChange={(e) => {
                                  const newRanges = [...dateTimeRanges]
                                  newRanges[index].startTime = e.target.value
                                  setDateTimeRanges(newRanges)
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-600">结束时间</Label>
                              <Input
                                type="time"
                                className="bg-white border-gray-300 text-gray-900"
                                value={range.endTime}
                                onChange={(e) => {
                                  const newRanges = [...dateTimeRanges]
                                  newRanges[index].endTime = e.target.value
                                  setDateTimeRanges(newRanges)
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Slot类型选择 */}
                    <div className="space-y-2">
                      <Label className="text-gray-700">Slot类型（可多选）</Label>
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                        <div 
                          className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all duration-200 ${selectedSlotTypes.includes('normal') ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => {
                            const isSelected = selectedSlotTypes.includes('normal')
                            let newTypes = isSelected 
                              ? selectedSlotTypes.filter(t => t !== 'normal') 
                              : [...selectedSlotTypes, 'normal']
                            
                            // 确保至少选择一种类型
                            if (newTypes.length === 0) {
                              newTypes = ['normal']
                            }
                            
                            setSelectedSlotTypes(newTypes)
                            if (selectedSlot) {
                              setSelectedSlot({
                                ...selectedSlot,
                                type: 'normal' as any,
                                price: 350
                              })
                            }
                          }}
                        >
                          <div className="flex gap-3 items-start">
                            <Checkbox 
                              id="normal" 
                              checked={selectedSlotTypes.includes('normal')}
                              className="mt-1 data-[state=checked]:bg-blue-600"
                            />
                            <div>
                              <Label htmlFor="normal" className="cursor-pointer flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Normal</span>
                              </Label>
                              <p className="text-xs text-gray-600 mt-1">{slotTypeDescription.normal}</p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-sm font-medium text-gray-900">¥350</p>
                                {selectedSlotTypes.includes('normal') && <Check className="h-4 w-4 text-blue-500" />}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all duration-200 ${selectedSlotTypes.includes('prime') ? 'bg-yellow-50 border-yellow-300' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => {
                            const isSelected = selectedSlotTypes.includes('prime')
                            let newTypes = isSelected 
                              ? selectedSlotTypes.filter(t => t !== 'prime') 
                              : [...selectedSlotTypes, 'prime']
                            
                            // 确保至少选择一种类型
                            if (newTypes.length === 0) {
                              newTypes = ['normal']
                            }
                            
                            setSelectedSlotTypes(newTypes)
                            if (selectedSlot) {
                              setSelectedSlot({
                                ...selectedSlot,
                                type: 'prime' as any,
                                price: 450
                              })
                            }
                          }}
                        >
                          <div className="flex gap-3 items-start">
                            <Checkbox 
                              id="prime" 
                              checked={selectedSlotTypes.includes('prime')}
                              className="mt-1 data-[state=checked]:bg-yellow-600"
                            />
                            <div>
                              <Label htmlFor="prime" className="cursor-pointer flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">Prime Time</span>
                              </Label>
                              <p className="text-xs text-gray-600 mt-1">{slotTypeDescription.prime}</p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-sm font-medium text-gray-900">¥450</p>
                                {selectedSlotTypes.includes('prime') && <Check className="h-4 w-4 text-yellow-500" />}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all duration-200 ${selectedSlotTypes.includes('premium') ? 'bg-purple-50 border-purple-300' : 'border-gray-200 hover:border-gray-300'}`}
                          onClick={() => {
                            const isSelected = selectedSlotTypes.includes('premium')
                            let newTypes = isSelected 
                              ? selectedSlotTypes.filter(t => t !== 'premium') 
                              : [...selectedSlotTypes, 'premium']
                            
                            // 确保至少选择一种类型
                            if (newTypes.length === 0) {
                              newTypes = ['normal']
                            }
                            
                            setSelectedSlotTypes(newTypes)
                            if (selectedSlot) {
                              setSelectedSlot({
                                ...selectedSlot,
                                type: 'premium' as any,
                                price: 550
                              })
                            }
                          }}
                        >
                          <div className="flex gap-3 items-start">
                            <Checkbox 
                              id="premium" 
                              checked={selectedSlotTypes.includes('premium')}
                              className="mt-1 data-[state=checked]:bg-purple-600"
                            />
                            <div>
                              <Label htmlFor="premium" className="cursor-pointer flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">Premium</span>
                              </Label>
                              <p className="text-xs text-gray-600 mt-1">{slotTypeDescription.premium}</p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-sm font-medium text-gray-900">¥550</p>
                                {selectedSlotTypes.includes('premium') && <Check className="h-4 w-4 text-purple-500" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 抢号设置摘要 */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 mt-4">
                      <h3 className="text-base font-medium mb-3 text-gray-900">抢号设置摘要</h3>
                      
                      <div className="grid gap-2">
                        {dateTimeRanges.map((range, index) => (
                          <div key={range.id} className="p-3 bg-white rounded-lg border border-gray-200 mb-2">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700">范围 {index + 1}</h4>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <div className="text-gray-700">
                                <span className="font-medium">日期范围：</span>
                                {range.startDate.replace(/-/g, '/')} - {range.endDate.replace(/-/g, '/')}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <div className="text-gray-700">
                                <span className="font-medium">时间范围：</span>{range.startTime} - {range.endTime}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2">
                            <Wand2 className="h-4 w-4 text-blue-600" />
                            <span className="text-gray-700">Slot类型</span>
                          </div>
                          <div className="flex gap-1">
                            {selectedSlotTypes.length === 0 ? (
                              <span className="text-gray-700">所有类型</span>
                            ) : (
                              selectedSlotTypes.map(type => getSlotTypeTag(type as any))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-gray-200 pt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("account")}
                    className="border-gray-300 hover:border-blue-400"
                  >
                    返回上一步
                  </Button>
                  
                  <Button 
                    onClick={() => setActiveTab("fees")} 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    下一步：费用与支付
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="fees" className="border-none p-0 mt-6">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                    <CardTitle className="text-lg text-gray-900">费用与支付</CardTitle>
                  </div>
                  <CardDescription className="text-gray-600">
                    设置预约人数和附加服务，并完成支付确认您的预约
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-6">
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <h3 className="text-base font-medium mb-3 text-gray-900">预约设置</h3>
                      
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <Label className="text-gray-700">预约人数</Label>
                          <Select 
                            value={peopleCount.toString()} 
                            onValueChange={(val) => setPeopleCount(parseInt(val))}
                          >
                            <SelectTrigger className="w-[180px] bg-white border-gray-300 text-gray-900">
                              <SelectValue placeholder="选择人数" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              {[1, 2, 3, 4, 5].map(num => (
                                <SelectItem key={num} value={num.toString()} className="text-gray-900">{num} 人</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="urgent" 
                              checked={isUrgent}
                              onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
                            />
                            <Label htmlFor="urgent" className="cursor-pointer text-gray-700">紧急预约（加急处理）</Label>
                          </div>
                          <div className="text-sm text-gray-600">+¥200</div>
                        </div>
                      </div>
                    </div>
                    
                    {selectedSlot && (
                      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <h3 className="text-base font-medium mb-3">费用明细</h3>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">基础服务费</span>
                            <span>¥{fees.basePrice}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">申请程序附加费</span>
                            <span>¥{fees.addOnFee}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">增强预约费用</span>
                            <span>¥{fees.enhancedFee}</span>
                          </div>
                          {isUrgent && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">日期紧急费用</span>
                              <span>¥{fees.urgentFee}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-gray-800">
                            <span className="text-gray-400">每人费用</span>
                            <span>¥{fees.perPersonFee}</span>
                          </div>
                          <div className="flex justify-between font-medium pt-2 border-t border-gray-800">
                            <span>总费用 ({peopleCount}人)</span>
                            <span className="text-lg">¥{fees.total}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <h3 className="text-base font-medium mb-3">支付方式</h3>
                      
                      <RadioGroup 
                        value={paymentMethod} 
                        onValueChange={setPaymentMethod}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between p-3 border border-gray-800 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="wechat" id="wechat" />
                            <Label htmlFor="wechat" className="cursor-pointer flex items-center">
                              <span className="i-wechat text-xl mr-2 text-green-500">微</span>
                              微信支付
                            </Label>
                          </div>
                          <span className="text-sm text-gray-400">默认</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 border border-gray-800 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="alipay" id="alipay" />
                            <Label htmlFor="alipay" className="cursor-pointer flex items-center">
                              <span className="text-xl mr-2 text-blue-500 font-bold">支</span>
                              支付宝
                            </Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <h3 className="text-base font-medium mb-3">支付状态</h3>
                      
                      <div className="flex items-center gap-3">
                        {paymentStatus === "pending" && (
                          <div className="py-2 px-3 bg-yellow-900/20 text-yellow-500 rounded-md text-sm font-medium flex items-center">
                            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 mr-2"></span>
                            待支付
                          </div>
                        )}
                        
                        {paymentStatus === "processing" && (
                          <div className="py-2 px-3 bg-blue-900/20 text-blue-500 rounded-md text-sm font-medium flex items-center">
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            处理中
                          </div>
                        )}
                        
                        {paymentStatus === "success" && (
                          <div className="py-2 px-3 bg-green-900/20 text-green-500 rounded-md text-sm font-medium flex items-center">
                            <Check className="h-3 w-3 mr-2" />
                            成功
                          </div>
                        )}
                        
                        {paymentStatus === "failed" && (
                          <div className="py-2 px-3 bg-red-900/20 text-red-500 rounded-md text-sm font-medium flex items-center">
                            <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-2"></span>
                            失败
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-gray-800 pt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("slots")}
                    className="border-gray-700"
                  >
                    返回上一步
                  </Button>
                  
                  <Button 
                    onClick={handleConfirmPayment} 
                    disabled={loading || paymentStatus === "success"}
                    className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        确认支付
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </AnimatedSection>
      </main>
    </div>
  )
}

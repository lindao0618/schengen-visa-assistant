"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Check, Clock, Flag, Loader2, Mail, Phone, Plus, Trash2, MapPin, Bell } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// 申根国家
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

// 地区列表
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

// 电话国家代码
const phoneCodes = [
  { value: "86", label: "+86 中国" },
  { value: "44", label: "+44 英国" },
  { value: "1", label: "+1 美国/加拿大" },
  { value: "33", label: "+33 法国" },
  { value: "49", label: "+49 德国" },
  { value: "61", label: "+61 澳大利亚" },
]

interface DateTimeRange {
  id: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

export default function MonitorSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [monitorStatus, setMonitorStatus] = useState<'checking' | 'running' | 'stopped' | 'unavailable'>('checking')
  
  // 基本参数
  const [country, setCountry] = useState("france")
  const [region, setRegion] = useState("china")
  const [city, setCity] = useState("")
  
  // 日期时间范围
  const [dateTimeRanges, setDateTimeRanges] = useState<DateTimeRange[]>([
    { 
      id: 1, 
      startDate: new Date().toISOString().substring(0, 10), 
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().substring(0, 10),
      startTime: "08:30", 
      endTime: "16:30" 
    }
  ])
  
  // 通知设置
  const [emailNotify, setEmailNotify] = useState(false)
  const [phoneNotify, setPhoneNotify] = useState(false)
  const [phoneCode, setPhoneCode] = useState("86")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [email, setEmail] = useState("")
  
  // Slot类型选择
  const [selectedSlotTypes, setSelectedSlotTypes] = useState<string[]>(["normal"])
  
  // Slot类型选项
  const slotTypes = [
    { value: "normal", label: "Normal", description: "标准预约" },
    { value: "prime_time", label: "Prime Time", description: "黄金时段预约" },
    { value: "premium", label: "Premium", description: "高级预约" }
  ]
  
  // 切换slot类型选择
  const toggleSlotType = (slotType: string) => {
    setSelectedSlotTypes(prev => {
      if (prev.includes(slotType)) {
        // 如果要取消选择，确保至少保留一个
        if (prev.length > 1) {
          return prev.filter(type => type !== slotType)
        } else {
          // 如果只有一个选择，不允许取消
          return prev
        }
      } else {
        // 添加新选择
        return [...prev, slotType]
      }
    })
  }
  
  // 添加日期时间范围
  const addDateTimeRange = () => {
    if (dateTimeRanges.length < 3) {
      const newId = Math.max(0, ...dateTimeRanges.map(r => r.id)) + 1
      setDateTimeRanges([...dateTimeRanges, { 
        id: newId, 
        startDate: new Date().toISOString().substring(0, 10), 
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().substring(0, 10),
        startTime: "08:30", 
        endTime: "16:30" 
      }])
    }
  }
  
  // 删除日期时间范围
  const removeDateTimeRange = (id: number) => {
    if (dateTimeRanges.length > 1) {
      setDateTimeRanges(dateTimeRanges.filter(range => range.id !== id))
    }
  }
  
  // 更新日期时间范围
  const updateDateTimeRange = (id: number, field: 'startDate' | 'endDate' | 'startTime' | 'endTime', value: string) => {
    setDateTimeRanges(dateTimeRanges.map(range => 
      range.id === id ? { ...range, [field]: value } : range
    ))
  }

  // 检查监控服务状态
  const checkMonitorStatus = async () => {
    try {
      const response = await fetch('/api/schengen/france/monitor/status')
      const data = await response.json()
      setMonitorStatus(data.success ? 'running' : 'stopped')
    } catch (error) {
      setMonitorStatus('unavailable')
    }
  }

  // 页面加载时检查监控状态
  useEffect(() => {
    checkMonitorStatus()
  }, [])
  
  // 提交表单
  const handleSubmit = async () => {
    // 验证至少选择一个slot类型
    if (selectedSlotTypes.length === 0) {
      alert('请至少选择一个Slot类型')
      setLoading(false)
      return
    }
    
    setLoading(true)
    
    try {
      // 构建监控配置
      const monitorConfig = {
        application_country: region,
        application_city: city,
        visa_type: "short_stay",
        travel_purpose: "tourism_private_visit",
        slot_types: selectedSlotTypes,
        date_ranges: dateTimeRanges.map(range => ({
          start_date: range.startDate,
          end_date: range.endDate,
          start_time: range.startTime,
          end_time: range.endTime
        })),
        notifications: {
          email: emailNotify ? email : null,
          phone: phoneNotify ? `${phoneCode}${phoneNumber}` : null
        }
      }
      
      // 调用我们的API路由
      const response = await fetch('/api/schengen/france/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(monitorConfig)
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('监控启动成功:', result)
        
        // 保存监控配置到localStorage，供success页面使用
        localStorage.setItem('lastMonitorConfig', JSON.stringify(monitorConfig))
        
        // 成功后跳转到确认页面
        router.push(`/schengen-visa/slot-booking/${country}/monitor/success`)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || `监控启动失败: ${response.status}`)
      }
    } catch (error) {
      console.error('启动监控时出错:', error)
      alert(error instanceof Error ? error.message : '启动监控失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" strokeWidth={2} />
            法国签证预约监控设置
          </h1>
          <p className="text-gray-600">
            设置您的法国签证预约监控参数，当有符合条件的预约名额时，我们会立即通知您。
          </p>
        </div>
        
        {/* 监控服务状态显示 */}
        <div className="mt-4 p-4 rounded-md border border-gray-200 bg-gray-50 mb-6">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              monitorStatus === 'running' ? 'bg-green-500' :
              monitorStatus === 'checking' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
            <span className="text-sm text-gray-900">
              {monitorStatus === 'running' ? '监控服务运行正常' :
               monitorStatus === 'checking' ? '检查监控服务状态...' :
               monitorStatus === 'stopped' ? '监控服务未运行' :
               '监控服务不可用'}
            </span>
          </div>
          {monitorStatus !== 'running' && (
            <p className="text-xs text-gray-600 mt-1">
              请确保 TLS监控服务正在运行，否则无法启动监控
            </p>
          )}
        </div>

      <main className="space-y-8">
        
          {/* 基本参数 */}
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-blue-600" />
                基本参数
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
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
        
          {/* Slot类型 */}
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Slot类型 (可多选)
              </CardTitle>
              <CardDescription>
                请至少选择一个Slot类型进行监控（可多选）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {slotTypes.map((slotType) => {
                  const isSelected = selectedSlotTypes.includes(slotType.value)
                  const isDisabled = isSelected && selectedSlotTypes.length === 1
                  
                  return (
                    <div
                      key={slotType.value}
                      onClick={() => toggleSlotType(slotType.value)}
                      className={`relative p-4 border-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? isDisabled 
                            ? 'border-blue-500 bg-blue-50 cursor-not-allowed opacity-80'
                            : 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{slotType.label}</h3>
                          {slotType.value === 'prime_time' && (
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded">Prime Time</span>
                          )}
                          {slotType.value === 'premium' && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded">Premium</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{slotType.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        
          {/* 时间范围 */}
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
                  {dateTimeRanges.length < 3 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addDateTimeRange}
                      className="h-8"
                    >
                      <Plus className="h-4 w-4 mr-1" /> 添加范围
                    </Button>
                  )}
                </div>
                
                <div className="space-y-6">
                  {dateTimeRanges.map((range, index) => (
                    <div key={range.id} className="p-4 border border-gray-200 rounded-lg space-y-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">范围 {index + 1}</div>
                        {dateTimeRanges.length > 1 && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeDateTimeRange(range.id)}
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor={`startdate-${range.id}`} className="text-xs">开始日期</Label>
                          <Input 
                            id={`startdate-${range.id}`} 
                            type="date" 
                            value={range.startDate} 
                            onChange={(e) => updateDateTimeRange(range.id, 'startDate', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`enddate-${range.id}`} className="text-xs">结束日期</Label>
                          <Input 
                            id={`enddate-${range.id}`} 
                            type="date" 
                            value={range.endDate} 
                            onChange={(e) => updateDateTimeRange(range.id, 'endDate', e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor={`starttime-${range.id}`} className="text-xs">开始时间</Label>
                          <Input 
                            id={`starttime-${range.id}`} 
                            type="time" 
                            value={range.startTime} 
                            onChange={(e) => updateDateTimeRange(range.id, 'startTime', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`endtime-${range.id}`} className="text-xs">结束时间</Label>
                          <Input 
                            id={`endtime-${range.id}`} 
                            type="time" 
                            value={range.endTime} 
                            onChange={(e) => updateDateTimeRange(range.id, 'endTime', e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded text-sm border border-gray-200">
                        <div className="flex items-center gap-3 mb-2">
                          <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <div className="text-gray-700">
                            <span className="font-medium">日期：</span>{range.startDate.replace(/-/g, '/')} - {range.endDate.replace(/-/g, '/')}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <div className="text-gray-700">
                            <span className="font-medium">时间：</span>{range.startTime} - {range.endTime}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        
          {/* 通知设置 */}
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                通知方式设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>通知选项</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                    <button
                      type="button"
                      onClick={() => setEmailNotify(!emailNotify)}
                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold text-lg transition-all duration-200 ${
                        emailNotify 
                          ? 'bg-green-500 border-green-500 text-white hover:bg-green-600' 
                          : 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      {emailNotify ? '✓' : '×'}
                    </button>
                    <Label className="flex items-center cursor-pointer flex-1" onClick={() => setEmailNotify(!emailNotify)}>
                      <Mail className="h-5 w-5 mr-3 text-blue-600" />
                      <span className="font-medium">邮箱通知</span>
                    </Label>
                  </div>
                  
                  {emailNotify && (
                    <div className="ml-6 mt-2">
                      <Label htmlFor="email-input">邮箱地址</Label>
                      <Input 
                        id="email-input" 
                        type="email" 
                        placeholder="example@mail.com" 
                        className="mt-1"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-yellow-300 transition-colors">
                    <button
                      type="button"
                      onClick={() => setPhoneNotify(!phoneNotify)}
                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold text-lg transition-all duration-200 ${
                        phoneNotify 
                          ? 'bg-green-500 border-green-500 text-white hover:bg-green-600' 
                          : 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      {phoneNotify ? '✓' : '×'}
                    </button>
                    <Label className="flex items-center cursor-pointer flex-1" onClick={() => setPhoneNotify(!phoneNotify)}>
                      <Phone className="h-5 w-5 mr-3 text-yellow-600" />
                      <span className="font-medium">手机通知</span>
                    </Label>
                  </div>
                  
                  {phoneNotify && (
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
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        
          {/* 启动监控 */}
          <Card className="border border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4 md:justify-between items-center">
                <div className="text-center md:text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">开始监控法国签证预约</h3>
                  <p className="text-gray-600 max-w-lg">我们将按照您设定的条件持续监控签证预约系统，一旦发现可用名额将立即通知您。</p>
                </div>
                
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading || !city}
                  className="min-w-[180px] bg-blue-600 hover:bg-blue-700 text-white h-12"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5 mr-2 font-bold" strokeWidth={3} />
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

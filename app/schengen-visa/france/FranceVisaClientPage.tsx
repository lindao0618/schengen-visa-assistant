"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, ExternalLink, Globe, FileText, Calendar, Euro, CreditCard, Map, Building } from "lucide-react"

// 法国签证类型
const visaTypes = [
  { value: "short_stay", label: "短期停留签证", description: "适用于旅游、探亲或商务访问，停留时间不超过90天" },
  { value: "long_stay", label: "长期停留签证", description: "适用于长期居住在法国的申请人，如学生、工作人员等" },
  { value: "transit", label: "过境签证", description: "适用于经法国前往其他目的地的旅客" },
  { value: "student", label: "学生签证", description: "适用于赴法国留学的学生" },
  { value: "work", label: "工作签证", description: "适用于前往法国工作的申请人" },
]

// 法国签证受理中心
const visaCenters = [
  { value: "beijing", label: "北京", address: "北京市朝阳区东大桥路9号侨福芳草地大厦D座3层" },
  { value: "shanghai", label: "上海", address: "上海市静安区南京西路1376号上海商城西峰1707室" },
  { value: "guangzhou", label: "广州", address: "广州市天河区天河路385号太古汇一座3002室" },
  { value: "chengdu", label: "成都", address: "成都市锦江区红星路三段1号IFS国际金融中心2号楼26层2604室" },
  { value: "wuhan", label: "武汉", address: "武汉市江汉区建设大道568号新世界国贸大厦I座1306-1308室" },
  { value: "shenyang", label: "沈阳", address: "沈阳市沈河区青年大街1号市府恒隆广场办公楼1座3605室" },
]

export default function FranceVisaClientPage() {
  const [step, setStep] = useState(1)
  const [visaType, setVisaType] = useState<string>("") 
  const [visaCenter, setVisaCenter] = useState<string>("") 
  const [travelPurpose, setTravelPurpose] = useState<string>("") 
  
  const [personalInfo, setPersonalInfo] = useState({
    lastName: "",
    firstName: "",
    birthDate: "",
    birthPlace: "",
    nationality: "",
    passportNumber: "",
    passportIssueDate: "",
    passportExpiryDate: "",
    email: "",
    phone: "",
  })
  
  const [travelInfo, setTravelInfo] = useState({
    entryDate: "",
    exitDate: "",
    accommodation: "",
    itinerary: "",
    previousVisits: false,
    previousVisitDates: "",
  })
  
  const [supportingDocs, setSupportingDocs] = useState({
    hasPassport: false,
    hasPhotos: false,
    hasFlightReservation: false,
    hasAccommodationProof: false,
    hasInsurance: false,
    hasFinancialProof: false,
    hasEmploymentLetter: false,
  })

  const router = useRouter()

  const handleBackToSelection = () => {
    router.push("/schengen-visa")
  }

  const handleContinue = () => {
    if (step < 5) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else {
      handleBackToSelection()
    }
  }

  const handleCheckboxChange = (field: string, checked: boolean) => {
    setSupportingDocs({ ...supportingDocs, [field]: checked })
  }

  const handleSubmit = () => {
    // 模拟提交申请
    alert("您的法国申根签证申请已提交！我们将尽快处理您的申请。")
    router.push("/dashboard")
  }

  // 根据签证类型推荐停留天数
  const recommendedDays = () => {
    switch (visaType) {
      case "short_stay":
        return "不超过90天"
      case "long_stay":
        return "90天以上"
      case "transit":
        return "不超过5天"
      case "student":
        return "根据学习期限"
      case "work":
        return "根据工作合同期限"
      default:
        return "请先选择签证类型"
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <main className="flex-grow container mx-auto px-4 py-8 pt-20">
        <AnimatedSection>
          <div className="flex items-center gap-2 mb-6">
            <Button variant="ghost" size="icon" onClick={handleBackToSelection}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <PageHeader 
              title="法国申根签证申请" 
              description="请按照步骤完成法国申根签证的申请流程"
            />
          </div>
        </AnimatedSection>

        <AnimatedSection>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Image 
                    src="https://flagcdn.com/w80/fr.png" 
                    alt="法国国旗"
                    width={28} 
                    height={28} 
                    className="rounded"
                  />
                  法国申根签证
                </CardTitle>
                <CardDescription>填写以下信息以申请法国申根签证</CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                步骤 {step}/5
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-400" />
                      签证类型与受理中心选择
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="visa-type">选择签证类型</Label>
                        <Select value={visaType} onValueChange={setVisaType}>
                          <SelectTrigger id="visa-type">
                            <SelectValue placeholder="选择签证类型" />
                          </SelectTrigger>
                          <SelectContent>
                            {visaTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label} - {type.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {visaType && (
                        <div className="p-3 bg-blue-500/10 rounded-md text-sm">
                          推荐停留时间: <span className="font-medium">{recommendedDays()}</span>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="visa-center">选择签证受理中心</Label>
                        <Select value={visaCenter} onValueChange={setVisaCenter}>
                          <SelectTrigger id="visa-center">
                            <SelectValue placeholder="选择签证受理中心" />
                          </SelectTrigger>
                          <SelectContent>
                            {visaCenters.map((center) => (
                              <SelectItem key={center.value} value={center.value}>
                                {center.label}签证中心
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {visaCenter && (
                        <div className="p-3 bg-blue-500/10 rounded-md flex items-start gap-2">
                          <Building className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <div className="font-medium mb-1">{visaCenters.find(c => c.value === visaCenter)?.label}签证中心地址:</div>
                            <div>{visaCenters.find(c => c.value === visaCenter)?.address}</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="travel-purpose">访问目的</Label>
                        <Textarea 
                          id="travel-purpose" 
                          placeholder="请简要描述您前往法国的目的..."
                          value={travelPurpose}
                          onChange={(e) => setTravelPurpose(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回</Button>
                    <Button 
                      onClick={handleContinue} 
                      disabled={!visaType || !visaCenter || !travelPurpose}
                    >
                      继续
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-400" />
                      个人信息
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="last-name">姓（拼音）</Label>
                        <Input 
                          id="last-name" 
                          value={personalInfo.lastName}
                          onChange={(e) => setPersonalInfo({...personalInfo, lastName: e.target.value})}
                          placeholder="与护照一致的拼音姓氏"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="first-name">名（拼音）</Label>
                        <Input 
                          id="first-name" 
                          value={personalInfo.firstName}
                          onChange={(e) => setPersonalInfo({...personalInfo, firstName: e.target.value})}
                          placeholder="与护照一致的拼音名字"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="birth-date">出生日期</Label>
                        <Input 
                          id="birth-date" 
                          type="date"
                          value={personalInfo.birthDate}
                          onChange={(e) => setPersonalInfo({...personalInfo, birthDate: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="birth-place">出生地</Label>
                        <Input 
                          id="birth-place" 
                          value={personalInfo.birthPlace}
                          onChange={(e) => setPersonalInfo({...personalInfo, birthPlace: e.target.value})}
                          placeholder="例如：北京，中国"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="nationality">国籍</Label>
                        <Input 
                          id="nationality" 
                          value={personalInfo.nationality}
                          onChange={(e) => setPersonalInfo({...personalInfo, nationality: e.target.value})}
                          placeholder="例如：中国"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="passport-number">护照号码</Label>
                        <Input 
                          id="passport-number" 
                          value={personalInfo.passportNumber}
                          onChange={(e) => setPersonalInfo({...personalInfo, passportNumber: e.target.value})}
                          placeholder="例如：E12345678"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="passport-issue-date">护照签发日期</Label>
                        <Input 
                          id="passport-issue-date" 
                          type="date"
                          value={personalInfo.passportIssueDate}
                          onChange={(e) => setPersonalInfo({...personalInfo, passportIssueDate: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="passport-expiry-date">护照有效期至</Label>
                        <Input 
                          id="passport-expiry-date" 
                          type="date"
                          value={personalInfo.passportExpiryDate}
                          onChange={(e) => setPersonalInfo({...personalInfo, passportExpiryDate: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">电子邮箱</Label>
                        <Input 
                          id="email" 
                          type="email"
                          value={personalInfo.email}
                          onChange={(e) => setPersonalInfo({...personalInfo, email: e.target.value})}
                          placeholder="your-email@example.com"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">联系电话</Label>
                        <Input 
                          id="phone" 
                          value={personalInfo.phone}
                          onChange={(e) => setPersonalInfo({...personalInfo, phone: e.target.value})}
                          placeholder="+86 1xx xxxx xxxx"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回</Button>
                    <Button 
                      onClick={handleContinue}
                      disabled={!personalInfo.lastName || !personalInfo.firstName || !personalInfo.birthDate || !personalInfo.passportNumber || !personalInfo.passportExpiryDate}
                    >
                      继续
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      行程信息
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="entry-date">计划入境日期</Label>
                        <Input 
                          id="entry-date" 
                          type="date"
                          value={travelInfo.entryDate}
                          onChange={(e) => setTravelInfo({...travelInfo, entryDate: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="exit-date">计划出境日期</Label>
                        <Input 
                          id="exit-date" 
                          type="date"
                          value={travelInfo.exitDate}
                          onChange={(e) => setTravelInfo({...travelInfo, exitDate: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="accommodation">住宿信息</Label>
                        <Input 
                          id="accommodation" 
                          value={travelInfo.accommodation}
                          onChange={(e) => setTravelInfo({...travelInfo, accommodation: e.target.value})}
                          placeholder="酒店名称或地址，如有多个请列出"
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="itinerary">行程安排</Label>
                        <Textarea 
                          id="itinerary" 
                          value={travelInfo.itinerary}
                          onChange={(e) => setTravelInfo({...travelInfo, itinerary: e.target.value})}
                          placeholder="简要描述您在法国及其他申根国家的行程安排..."
                          className="min-h-[100px]"
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="previous-visits" 
                            checked={travelInfo.previousVisits}
                            onCheckedChange={(checked) => setTravelInfo({...travelInfo, previousVisits: checked === true})}
                          />
                          <label
                            htmlFor="previous-visits"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            我曾经访问过申根国家
                          </label>
                        </div>
                        
                        {travelInfo.previousVisits && (
                          <div className="pl-6 space-y-2 mt-2">
                            <Label htmlFor="previous-visit-dates">之前访问的日期和国家</Label>
                            <Textarea
                              id="previous-visit-dates"
                              value={travelInfo.previousVisitDates}
                              onChange={(e) => setTravelInfo({...travelInfo, previousVisitDates: e.target.value})}
                              placeholder="例如：2023年6月-7月访问法国和意大利"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回</Button>
                    <Button 
                      onClick={handleContinue}
                      disabled={!travelInfo.entryDate || !travelInfo.exitDate || !travelInfo.accommodation}
                    >
                      继续
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-400" />
                      申请材料确认
                    </h3>
                    
                    <div className="space-y-4">
                      <p className="text-sm text-gray-400">请确认您已准备好以下申请材料：</p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="has-passport" 
                            checked={supportingDocs.hasPassport}
                            onCheckedChange={(checked) => handleCheckboxChange('hasPassport', checked === true)}
                          />
                          <label htmlFor="has-passport" className="text-sm">
                            有效护照（有效期超过预计离开申根区日期至少3个月）
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="has-photos" 
                            checked={supportingDocs.hasPhotos}
                            onCheckedChange={(checked) => handleCheckboxChange('hasPhotos', checked === true)}
                          />
                          <label htmlFor="has-photos" className="text-sm">
                            两张近期彩色照片（3.5cm x 4.5cm，白色背景）
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="has-flight-reservation" 
                            checked={supportingDocs.hasFlightReservation}
                            onCheckedChange={(checked) => handleCheckboxChange('hasFlightReservation', checked === true)}
                          />
                          <label htmlFor="has-flight-reservation" className="text-sm">
                            往返机票预订单
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="has-accommodation-proof" 
                            checked={supportingDocs.hasAccommodationProof}
                            onCheckedChange={(checked) => handleCheckboxChange('hasAccommodationProof', checked === true)}
                          />
                          <label htmlFor="has-accommodation-proof" className="text-sm">
                            住宿证明（酒店预订确认、邀请函等）
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="has-insurance" 
                            checked={supportingDocs.hasInsurance}
                            onCheckedChange={(checked) => handleCheckboxChange('hasInsurance', checked === true)}
                          />
                          <label htmlFor="has-insurance" className="text-sm">
                            旅行医疗保险（保额至少30,000欧元，覆盖整个申根地区）
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="has-financial-proof" 
                            checked={supportingDocs.hasFinancialProof}
                            onCheckedChange={(checked) => handleCheckboxChange('hasFinancialProof', checked === true)}
                          />
                          <label htmlFor="has-financial-proof" className="text-sm">
                            财力证明（最近3-6个月的银行对账单、存款证明等）
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="has-employment-letter" 
                            checked={supportingDocs.hasEmploymentLetter}
                            onCheckedChange={(checked) => handleCheckboxChange('hasEmploymentLetter', checked === true)}
                          />
                          <label htmlFor="has-employment-letter" className="text-sm">
                            在职证明或学生证明（如适用）
                          </label>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md mt-4">
                        <p className="text-sm">
                          <span className="font-medium">注意：</span> 以上材料清单仅供参考，具体要求可能因个人情况而异。请务必查阅法国驻华使领馆官方网站或TLScontact签证中心网站获取最新的申请要求。
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回</Button>
                    <Button 
                      onClick={handleContinue}
                      disabled={!Object.values(supportingDocs).some(value => value)}
                    >
                      继续
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-blue-400" />
                      申请确认与提交
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-500/10 rounded-md border border-blue-500/20">
                        <h4 className="font-medium mb-3">申请信息摘要</h4>
                        
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="font-medium">签证类型：</div>
                            <div className="col-span-2">{visaTypes.find(t => t.value === visaType)?.label}</div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            <div className="font-medium">申请人：</div>
                            <div className="col-span-2">{personalInfo.lastName} {personalInfo.firstName}</div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            <div className="font-medium">受理中心：</div>
                            <div className="col-span-2">{visaCenters.find(c => c.value === visaCenter)?.label}签证中心</div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            <div className="font-medium">计划行程：</div>
                            <div className="col-span-2">
                              {travelInfo.entryDate} 至 {travelInfo.exitDate}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-yellow-500/10 rounded-md border border-yellow-500/20">
                        <h4 className="font-medium mb-2">重要提示</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>提交申请后，您需要前往选定的签证中心提交生物识别信息（指纹和照片）</li>
                          <li>请携带所有原件和复印件前往签证中心</li>
                          <li>签证申请费用需在签证中心现场支付</li>
                          <li>签证处理时间通常为5-15个工作日，具体取决于个人情况和签证类型</li>
                          <li>提交虚假材料或信息可能导致拒签并影响未来的申请</li>
                        </ul>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox id="agreement" />
                        <label
                          htmlFor="agreement"
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          我确认所提供的信息真实完整，并同意法国签证中心处理我的个人数据
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回</Button>
                    <Button 
                      onClick={handleSubmit}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                    >
                      提交申请
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </main>
    </div>
  )
}

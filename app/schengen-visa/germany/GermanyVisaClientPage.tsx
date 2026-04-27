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
import { ArrowLeft, ExternalLink, Globe, FileText, Calendar, Euro, CreditCard } from "lucide-react"

// 德国签证类型
const visaTypes = [
  { value: "tourist", label: "旅游签证", description: "适用于旅游、探亲或其他短期访问" },
  { value: "business", label: "商务签证", description: "适用于商务会议、洽谈等商业活动" },
  { value: "student", label: "学生签证", description: "适用于赴德留学的学生" },
  { value: "medical", label: "医疗签证", description: "适用于前往德国接受医疗治疗" },
  { value: "culture", label: "文化访问签证", description: "适用于文化交流、学术访问等" },
]

// 德国领事馆城市
const consulateCities = [
  { value: "beijing", label: "北京" },
  { value: "shanghai", label: "上海" },
  { value: "guangzhou", label: "广州" },
  { value: "chengdu", label: "成都" },
]

export default function GermanyVisaClientPage() {
  const [step, setStep] = useState(1)
  const [visaType, setVisaType] = useState<string>("") 
  const [consulateCity, setConsulateCity] = useState<string>("") 
  const [personalInfo, setPersonalInfo] = useState({
    fullName: "",
    birthDate: "",
    passportNumber: "",
    email: "",
    phone: "",
  })
  const [travelInfo, setTravelInfo] = useState({
    entryDate: "",
    exitDate: "",
    accommodation: "",
    purpose: "",
  })
  const [financialInfo, setFinancialInfo] = useState({
    hasFinancialProof: false,
    accountBalance: "",
    bankName: "",
  })

  const router = useRouter()

  const handleBackToSelection = () => {
    router.push("/schengen-visa")
  }

  const handleContinue = () => {
    if (step < 4) {
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

  const handleFinancialCheckChange = (checked: boolean) => {
    setFinancialInfo({ ...financialInfo, hasFinancialProof: checked })
  }

  const handleSubmit = () => {
    // 模拟提交申请
    alert("您的德国签证申请已提交！我们将尽快处理您的申请。")
    router.push("/dashboard")
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
              title="德国申根签证申请" 
              description="请按照步骤完成德国申根签证的申请流程"
            />
          </div>
        </AnimatedSection>

        <AnimatedSection>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Image 
                    src="https://flagcdn.com/w80/de.png" 
                    alt="德国国旗"
                    width={28} 
                    height={28} 
                    className="rounded"
                  />
                  德国申根签证
                </CardTitle>
                <CardDescription>填写以下信息以申请德国申根签证</CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                步骤 {step}/4
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-400" />
                      签证类型与领区选择
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
                      
                      <div className="space-y-2">
                        <Label htmlFor="consulate-city">选择领区</Label>
                        <Select value={consulateCity} onValueChange={setConsulateCity}>
                          <SelectTrigger id="consulate-city">
                            <SelectValue placeholder="选择办理领区" />
                          </SelectTrigger>
                          <SelectContent>
                            {consulateCities.map((city) => (
                              <SelectItem key={city.value} value={city.value}>
                                {city.label}领事馆
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回</Button>
                    <Button 
                      onClick={handleContinue} 
                      disabled={!visaType || !consulateCity}
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
                        <Label htmlFor="full-name">姓名（拼音）</Label>
                        <Input 
                          id="full-name" 
                          value={personalInfo.fullName}
                          onChange={(e) => setPersonalInfo({...personalInfo, fullName: e.target.value})}
                          placeholder="与护照一致的拼音姓名"
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
                        <Label htmlFor="passport-number">护照号码</Label>
                        <Input 
                          id="passport-number" 
                          value={personalInfo.passportNumber}
                          onChange={(e) => setPersonalInfo({...personalInfo, passportNumber: e.target.value})}
                          placeholder="如：E12345678"
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
                      disabled={!personalInfo.fullName || !personalInfo.birthDate || !personalInfo.passportNumber}
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
                      
                      <div className="space-y-2">
                        <Label htmlFor="accommodation">住宿信息</Label>
                        <Input 
                          id="accommodation" 
                          value={travelInfo.accommodation}
                          onChange={(e) => setTravelInfo({...travelInfo, accommodation: e.target.value})}
                          placeholder="酒店名称或地址"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="purpose">访问目的详情</Label>
                        <Input 
                          id="purpose" 
                          value={travelInfo.purpose}
                          onChange={(e) => setTravelInfo({...travelInfo, purpose: e.target.value})}
                          placeholder="简要描述您的访问目的"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回</Button>
                    <Button 
                      onClick={handleContinue}
                      disabled={!travelInfo.entryDate || !travelInfo.exitDate}
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
                      <Euro className="h-5 w-5 text-blue-400" />
                      财务信息与最终确认
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="financial-proof" 
                          checked={financialInfo.hasFinancialProof}
                          onCheckedChange={(checked) => handleFinancialCheckChange(checked === true)}
                        />
                        <label
                          htmlFor="financial-proof"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          我已准备好财力证明（如银行对账单、存款证明等）
                        </label>
                      </div>
                      
                      {financialInfo.hasFinancialProof && (
                        <div className="pl-6 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="bank-name">银行名称</Label>
                            <Input 
                              id="bank-name" 
                              value={financialInfo.bankName}
                              onChange={(e) => setFinancialInfo({...financialInfo, bankName: e.target.value})}
                              placeholder="如：中国银行"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="account-balance">账户余额（欧元）</Label>
                            <Input 
                              id="account-balance" 
                              value={financialInfo.accountBalance}
                              onChange={(e) => setFinancialInfo({...financialInfo, accountBalance: e.target.value})}
                              placeholder="如：10000"
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-6 p-4 bg-blue-500/10 rounded-md border border-blue-500/20">
                        <h4 className="font-medium mb-2">请确认您已准备以下材料：</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>护照（有效期需超过回国日期至少3个月）</li>
                          <li>两张符合规格的证件照（3.5cm x 4.5cm）</li>
                          <li>往返机票预订单</li>
                          <li>酒店预订证明</li>
                          <li>旅行保险（保额不低于30,000欧元）</li>
                          <li>最近6个月的银行对账单</li>
                          <li>在职证明或学生证明（如适用）</li>
                        </ul>
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

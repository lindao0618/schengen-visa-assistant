"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/ui/page-header"
import { AnimatedSection } from "@/components/ui/animated-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ExternalLink } from "lucide-react"

const schengenCountries = [
  { value: "france", label: "法国" },
  { value: "germany", label: "德国" },
  { value: "italy", label: "意大利" },
  { value: "spain", label: "西班牙" },
  { value: "netherlands", label: "荷兰" },
]

const cities = [
  { value: "london", label: "伦敦", link: "https://fr.tlscontact.com/visa/gb/gbLON2fr/home" },
  { value: "manchester", label: "曼彻斯特", link: "https://fr.tlscontact.com/visa/gb/gbMNC2fr/home" },
  { value: "edinburgh", label: "爱丁堡", link: "https://fr.tlscontact.com/visa/gb/gbEDI2fr/home" },
]

export default function ApplyClientPage() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [fraCode, setFraCode] = useState("")
  const [selectedCity, setSelectedCity] = useState("")
  const [needSlotService, setNeedSlotService] = useState<"yes" | "no" | null>(null)
  const [slotServiceInfo, setSlotServiceInfo] = useState({
    account: "",
    password: "",
    city: "",
    appointmentTime: "",
    appointmentType: "",
    slotRange: "",
  })
  const [travelDates, setTravelDates] = useState({ start: "", end: "" })
  const [needItinerary, setNeedItinerary] = useState<"yes" | "no" | null>(null)
  const [itineraryInfo, setItineraryInfo] = useState({
    dates: "",
    hotelName: "",
    transportation: "",
  })

  const router = useRouter()

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country)
    setStep(1)
  }

  const handleContinue = () => {
    if (step < 6) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else {
      setSelectedCountry(null)
    }
  }

  const handleReturnToDashboard = () => {
    router.push("/dashboard")
  }

  if (!selectedCountry) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
        <main className="flex-grow container mx-auto px-4 py-8 pt-20">
          <AnimatedSection>
            <PageHeader title="申根签证申请" description="请选择您要申请签证的申根国家" />
          </AnimatedSection>
          <AnimatedSection>
            <Card>
              <CardHeader>
                <CardTitle>选择申根国家</CardTitle>
                <CardDescription>您的申请将根据所选国家的具体要求进行处理</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  onValueChange={(value) => {
                    if (value === "france") {
                      handleCountrySelect(value)
                    } else {
                      alert("抱歉，该国家的签证申请功能正在开发中。目前仅支持法国签证申请。")
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择申根国家" />
                  </SelectTrigger>
                  <SelectContent>
                    {schengenCountries.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </AnimatedSection>
        </main>
      </div>
    )
  }

  const countryName = schengenCountries.find((c) => c.value === selectedCountry)?.label || selectedCountry

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="flex-grow container mx-auto px-4 py-8 pt-20">
        <AnimatedSection>
          <PageHeader title={`申根签证申请 - ${countryName}`} description={`您正在申请${countryName}的申根签证`} />
        </AnimatedSection>
        <AnimatedSection>
          <Card>
            <CardHeader>
              <CardTitle>申请步骤 {step}</CardTitle>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fra-code">FRA 码</Label>
                    <Input
                      id="fra-code"
                      placeholder="例如：FRA1ED20257007239"
                      value={fraCode}
                      onChange={(e) => setFraCode(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button onClick={handleBack}>返回选择国家</Button>
                    <Button onClick={handleContinue}>继续</Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <CardDescription className="mb-4">请选择您的申请地点：</CardDescription>
                  <Select onValueChange={setSelectedCity} value={selectedCity}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择城市" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.value} value={city.value}>
                          {city.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCity && (
                    <div className="mt-4">
                      <p>请访问以下链接预约：</p>
                      <a
                        href={cities.find((c) => c.value === selectedCity)?.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {cities.find((c) => c.value === selectedCity)?.label} 预约链接
                      </a>
                    </div>
                  )}
                  <div className="mt-4 space-x-2">
                    <Button onClick={handleBack}>返回</Button>
                    <Button onClick={handleContinue}>继续</Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <CardDescription className="mb-4">是否需要代抢 slot 服务？</CardDescription>
                  <RadioGroup
                    onValueChange={(value) => setNeedSlotService(value as "yes" | "no")}
                    value={needSlotService || undefined}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="slot-yes" />
                      <Label htmlFor="slot-yes">是</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="slot-no" />
                      <Label htmlFor="slot-no">否</Label>
                    </div>
                  </RadioGroup>
                  {needSlotService === "yes" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="account">账户</Label>
                        <Input
                          id="account"
                          value={slotServiceInfo.account}
                          onChange={(e) => setSlotServiceInfo({ ...slotServiceInfo, account: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">密码</Label>
                        <Input
                          id="password"
                          type="password"
                          value={slotServiceInfo.password}
                          onChange={(e) => setSlotServiceInfo({ ...slotServiceInfo, password: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">城市</Label>
                        <Input
                          id="city"
                          value={slotServiceInfo.city}
                          onChange={(e) => setSlotServiceInfo({ ...slotServiceInfo, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="appointmentTime">预约时间</Label>
                        <Input
                          id="appointmentTime"
                          value={slotServiceInfo.appointmentTime}
                          onChange={(e) => setSlotServiceInfo({ ...slotServiceInfo, appointmentTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="appointmentType">预约类型</Label>
                        <Input
                          id="appointmentType"
                          value={slotServiceInfo.appointmentType}
                          onChange={(e) => setSlotServiceInfo({ ...slotServiceInfo, appointmentType: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="slotRange">抢号区间</Label>
                        <Input
                          id="slotRange"
                          value={slotServiceInfo.slotRange}
                          onChange={(e) => setSlotServiceInfo({ ...slotServiceInfo, slotRange: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-4 space-x-2">
                    <Button onClick={handleBack}>返回</Button>
                    <Button onClick={handleContinue}>继续</Button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <CardDescription className="mb-4">准备办理法签所需的材料</CardDescription>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="travel-start">行程开始日期</Label>
                      <Input
                        id="travel-start"
                        type="date"
                        value={travelDates.start}
                        onChange={(e) => setTravelDates({ ...travelDates, start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="travel-end">行程结束日期</Label>
                      <Input
                        id="travel-end"
                        type="date"
                        value={travelDates.end}
                        onChange={(e) => setTravelDates({ ...travelDates, end: e.target.value })}
                      />
                    </div>
                    <p className="text-sm text-gray-500">建议选择 7 天的区间</p>
                    <Tabs defaultValue="hotel" className="w-full">
                      <TabsList>
                        <TabsTrigger value="hotel">酒店预订</TabsTrigger>
                        <TabsTrigger value="eurostar">欧洲之星</TabsTrigger>
                        <TabsTrigger value="itinerary">行程单</TabsTrigger>
                        <TabsTrigger value="insurance">保险</TabsTrigger>
                      </TabsList>
                      <TabsContent value="hotel">
                        <div className="space-y-4">
                          <p>
                            请访问{" "}
                            <a
                              href="https://www.booking.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              Booking.com
                            </a>{" "}
                            预订酒店
                          </p>
                          <div>
                            <Label htmlFor="hotel-file">上传酒店订单</Label>
                            <Input id="hotel-file" type="file" />
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="eurostar">
                        <div className="space-y-4">
                          <p>
                            请访问{" "}
                            <a
                              href="https://www.eurostar.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              Eurostar 官网
                            </a>{" "}
                            购买车票
                          </p>
                          <div>
                            <Label htmlFor="eurostar-file">上传欧洲之星订单</Label>
                            <Input id="eurostar-file" type="file" />
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="itinerary">
                        <div className="space-y-4">
                          <CardDescription>是否需要生成行程单？</CardDescription>
                          <RadioGroup
                            onValueChange={(value) => setNeedItinerary(value as "yes" | "no")}
                            value={needItinerary || undefined}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="itinerary-yes" />
                              <Label htmlFor="itinerary-yes">是</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="itinerary-no" />
                              <Label htmlFor="itinerary-no">否</Label>
                            </div>
                          </RadioGroup>
                          {needItinerary === "yes" && (
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="itinerary-dates">行程日期</Label>
                                <Input
                                  id="itinerary-dates"
                                  value={itineraryInfo.dates}
                                  onChange={(e) => setItineraryInfo({ ...itineraryInfo, dates: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="itinerary-hotel">酒店名称</Label>
                                <Input
                                  id="itinerary-hotel"
                                  value={itineraryInfo.hotelName}
                                  onChange={(e) => setItineraryInfo({ ...itineraryInfo, hotelName: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label htmlFor="itinerary-transport">交通方式</Label>
                                <Input
                                  id="itinerary-transport"
                                  value={itineraryInfo.transportation}
                                  onChange={(e) =>
                                    setItineraryInfo({ ...itineraryInfo, transportation: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      <TabsContent value="insurance">
                        <div className="space-y-4">
                          <p>
                            请访问{" "}
                            <a
                              href="https://www.coverwise.co.uk/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline inline-flex items-center"
                            >
                              Coverwise 官网 <ExternalLink className="ml-1 h-4 w-4" />
                            </a>{" "}
                            购买旅行保险
                          </p>
                          <div>
                            <Label htmlFor="insurance-file">上传保险单</Label>
                            <Input id="insurance-file" type="file" />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                    <div className="mt-4 space-x-2">
                      <Button onClick={handleBack}>返回</Button>
                      <Button onClick={handleContinue}>继续</Button>
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <CardDescription className="mb-4">请提供以下其他材料：</CardDescription>
                  <ul className="list-disc list-inside space-y-2">
                    <li>护照（有效期超过预计离开申根区日期6个月以上）</li>
                    <li>近期彩色照片（3.5cm x 4.5cm）</li>
                    <li>资金证明（如银行对账单）</li>
                    <li>在职证明或学生证明</li>
                    <li>户口本复印件</li>
                    <li>旅行医疗保险（最低保额30,000欧元）</li>
                  </ul>
                  <div className="mt-4 space-x-2">
                    <Button onClick={handleBack}>返回</Button>
                    <Button onClick={handleContinue}>继续</Button>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <p>恭喜您！您已成功完成{countryName}申根签证申请的所有步骤。请等待进一步的处理和通知。</p>
                  <Button onClick={() => router.push("/dashboard")}>返回个人中心</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </main>
    </div>
  )
}

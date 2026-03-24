"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FileText } from "lucide-react"

const visaTypes = [
  { value: "standard", label: "标准访问签证" },
  { value: "work", label: "工作签证" },
  { value: "study", label: "学生签证" },
  { value: "family", label: "家庭签证" },
]

const applicationCenters = [
  { value: "beijing", label: "北京" },
  { value: "shanghai", label: "上海" },
  { value: "guangzhou", label: "广州" },
  { value: "chongqing", label: "重庆" },
  { value: "wuhan", label: "武汉" },
]

export default function UKVisaApplicationPage() {
  const [step, setStep] = useState(1)
  const router = useRouter()

  const [formData, setFormData] = useState({
    passportNumber: "",
    name: "",
    visaType: "",
    travelPurpose: "",
    applicationCenter: "",
    appointmentDate: "",
    accommodation: "",
    financialProof: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleContinue = () => {
    if (step < 5) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-12 pt-24">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">英国签证申请</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">按照步骤填写信息，完成英国签证申请</p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center">
              <span className="bg-emerald-500 rounded-full p-2 mr-3">
                <FileText className="h-6 w-6 text-white" />
              </span>
              申请步骤 {step}/5
            </CardTitle>
            <CardDescription className="text-gray-400">请填写以下信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="passportNumber" className="text-white">
                    护照号码
                  </Label>
                  <Input
                    id="passportNumber"
                    name="passportNumber"
                    placeholder="输入护照号码"
                    value={formData.passportNumber}
                    onChange={handleInputChange}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="name" className="text-white">
                    姓名（拼音）
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="输入姓名拼音"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="visaType" className="text-white">
                    签证类型
                  </Label>
                  <Select
                    name="visaType"
                    value={formData.visaType}
                    onValueChange={(value) => handleSelectChange("visaType", value)}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-2">
                      <SelectValue placeholder="选择签证类型" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {visaTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="travelPurpose" className="text-white">
                    旅行目的
                  </Label>
                  <Textarea
                    id="travelPurpose"
                    name="travelPurpose"
                    placeholder="简要描述您的旅行目的"
                    value={formData.travelPurpose}
                    onChange={handleInputChange}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="applicationCenter" className="text-white">
                    签证申请中心
                  </Label>
                  <Select
                    name="applicationCenter"
                    value={formData.applicationCenter}
                    onValueChange={(value) => handleSelectChange("applicationCenter", value)}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-2">
                      <SelectValue placeholder="选择签证申请中心" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {applicationCenters.map((center) => (
                        <SelectItem key={center.value} value={center.value}>
                          {center.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="appointmentDate" className="text-white">
                    预约日期
                  </Label>
                  <Input
                    id="appointmentDate"
                    name="appointmentDate"
                    type="date"
                    value={formData.appointmentDate}
                    onChange={handleInputChange}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="accommodation" className="text-white">
                    住宿信息
                  </Label>
                  <Textarea
                    id="accommodation"
                    name="accommodation"
                    placeholder="输入您在英国的住宿信息"
                    value={formData.accommodation}
                    onChange={handleInputChange}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="financialProof" className="text-white">
                    财务证明
                  </Label>
                  <Textarea
                    id="financialProof"
                    name="financialProof"
                    placeholder="描述您将提供的财务证明类型"
                    value={formData.financialProof}
                    onChange={handleInputChange}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <p className="text-gray-300">请确认您已准备好以下材料：</p>
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  <li>有效护照（有效期至少超过您计划离开英国的日期6个月）</li>
                  <li>签证申请表（在线填写并打印）</li>
                  <li>近期彩色照片（符合英国签证照片要求）</li>
                  <li>预约确认</li>
                  <li>住宿证明</li>
                  <li>财务证明（如银行对账单、存款证明等）</li>
                  <li>旅行计划（行程安排）</li>
                  <li>英语能力证明（如适用，例如雅思成绩单）</li>
                  <li>工作证明或学生身份证明（根据签证类型）</li>
                  <li>结核病检测证明（如果您来自需要进行结核病检测的国家）</li>
                </ul>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                onClick={handleBack}
                disabled={step === 1}
                variant="outline"
                className="border-zinc-700 text-white hover:bg-zinc-800"
              >
                返回
              </Button>
              <Button
                onClick={step === 5 ? () => router.push("/dashboard") : handleContinue}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {step === 5 ? "完成申请" : "继续"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


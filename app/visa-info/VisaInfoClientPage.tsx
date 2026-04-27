"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const countries = [
  { value: "france", label: "法国" },
  { value: "spain", label: "西班牙" },
  { value: "germany", label: "德国" },
  { value: "italy", label: "意大利" },
  { value: "netherlands", label: "荷兰" },
]

const visaInfo = {
  schengen: {
    france: {
      documents: [
        "有效护照（有效期超过预计离开申根区日期6个月以上）",
        "申根签证申请表",
        "近期彩色照片（3.5cm x 4.5cm）",
        "往返机票预订单",
        "旅行计划（行程安排）",
        "住宿证明",
        "旅行医疗保险（最低保额30,000欧元）",
        "资金证明（如银行对账单）",
        "在职证明或学生证明",
        "户口本复印件",
      ],
      processingTime: "15个工作日（建议至少提前3个月申请）",
      fee: "80欧元（约合人民币640元，可能会有变动）",
      website: "https://cn.ambafrance.org/-中文-",
    },
    spain: {
      documents: [
        "有效护照（有效期超过预计离开申根区日期6个月以上）",
        "申根签证申请表",
        "近期彩色照片（3.5cm x 4.5cm）",
        "往返机票预订单",
        "详细的旅行计划",
        "住宿证明",
        "旅行医疗保险（最低保额30,000欧元）",
        "资金证明（如银行对账单，每天至少100欧元）",
        "在职证明或学生证明",
        "户口本原件及复印件",
      ],
      processingTime: "10-15个工作日（建议至少提前3个月申请）",
      fee: "80欧元（约合人民币640元，可能会有变动）",
      website: "http://www.exteriores.gob.es/Consulados/CANTON/zh/Paginas/inicio.aspx",
    },
    germany: {
      documents: [
        "有效护照（有效期超过预计离开申根区日期6个月以上）",
        "申根签证申请表",
        "近期彩色照片",
        "往返机票预订单",
        "旅行计划",
        "住宿证明",
        "旅行医疗保险",
        "资金证明",
        "在职证明或学生证明",
      ],
      processingTime: "约15个工作日",
      fee: "80欧元",
      website: "https://china.diplo.de/cn-zh",
    },
    italy: {
      documents: [
        "有效护照（有效期超过预计离开申根区日期6个月以上）",
        "申根签证申请表",
        "近期彩色照片",
        "往返机票预订单",
        "旅行计划",
        "住宿证明",
        "旅行医疗保险",
        "资金证明",
        "在职证明或学生证明",
      ],
      processingTime: "约15个工作日",
      fee: "80欧元",
      website: "https://ambpechino.esteri.it/zh",
    },
    netherlands: {
      documents: [
        "有效护照（有效期超过预计离开申根区日期6个月以上）",
        "申根签证申请表",
        "近期彩色照片",
        "往返机票预订单",
        "旅行计划",
        "住宿证明",
        "旅行医疗保险",
        "资金证明",
        "在职证明或学生证明",
      ],
      processingTime: "约15个工作日",
      fee: "80欧元",
      website:
        "https://www.netherlandsandyou.nl/travel-and-residence/visas-for-the-netherlands/short-stay-schengen-visa",
    },
  },
  usa: {
    documents: [
      "有效护照（有效期至少6个月以上）",
      "DS-160表格确认页",
      "签证申请费收据",
      "2英寸 x 2英寸的照片",
      "面试预约确认",
      "I-20表格（学生签证）或DS-2019表格（交流访问学者签证）",
      "SEVIS费用收据",
      "财务证明",
      "在读证明或工作证明",
    ],
    processingTime: "3-5个工作日（紧急情况可能更快）",
    fee: "160美元（非移民签证），可能会有变动",
    website: "https://www.ustraveldocs.com/cn_zh/cn-niv-visaapply.asp",
  },
  japan: {
    documents: [
      "有效护照",
      "签证申请表",
      "近期彩色照片（4.5cm x 4.5cm）",
      "行程安排",
      "在职证明或在读证明",
      "财务证明",
      "户口本复印件",
      "邀请函和身元保证书（如适用）",
    ],
    processingTime: "5个工作日（可能会有变动）",
    fee: "不同类型签证费用不同，请查看官网最新信息",
    website: "https://www.cn.emb-japan.go.jp/itpr_zh/visa.html",
  },
}

export default function VisaInfoClientPage() {
  const [selectedCountry, setSelectedCountry] = useState("france")
  const [selectedVisaType, setSelectedVisaType] = useState("schengen")

  const getVisaInfo = () => {
    if (selectedVisaType === "schengen") {
      return visaInfo.schengen[selectedCountry as keyof typeof visaInfo.schengen] || visaInfo.schengen.france
    } else {
      return visaInfo[selectedVisaType as "usa" | "japan"] || visaInfo.schengen.france
    }
  }

  const countryInfo = getVisaInfo()

  return (
    <div className="flex flex-col min-h-screen bg-black pt-20">
      {/* 主要内容 */}
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
            签证信息
          </h1>

          <Tabs 
            value={selectedVisaType} 
            onValueChange={setSelectedVisaType} 
            className="mb-8"
          >
            <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
              <TabsTrigger 
                value="schengen"
                className="data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                申根签证
              </TabsTrigger>
              <TabsTrigger 
                value="usa"
                className="data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                美国签证
              </TabsTrigger>
              <TabsTrigger 
                value="japan"
                className="data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                日本签证
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {selectedVisaType === "schengen" && (
            <div className="mb-8 animate-slide-up">
              <Select onValueChange={setSelectedCountry} defaultValue={selectedCountry}>
                <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-white focus:ring-primary">
                  <SelectValue placeholder="选择申根国家" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {countries.map((country) => (
                    <SelectItem 
                      key={country.value} 
                      value={country.value}
                      className="text-white hover:bg-primary/10 focus:bg-primary/10"
                    >
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover-scale animate-slide-up">
              <CardHeader>
                <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <CardTitle>所需文件</CardTitle>
                <CardDescription>
                  申请
                  {selectedVisaType === "schengen"
                    ? countries.find((c) => c.value === selectedCountry)?.label
                    : selectedVisaType === "usa"
                      ? "美国"
                      : "日本"}
                  签证所需的文件
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  {countryInfo.documents.map((doc, index) => (
                    <li key={index} className="hover:text-primary transition-colors">{doc}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="hover-scale animate-slide-up [animation-delay:200ms]">
              <CardHeader>
                <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <CardTitle>处理时间和费用</CardTitle>
                <CardDescription>签证处理时间和申请费用信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span><strong>处理时间：</strong> {countryInfo.processingTime}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span><strong>申请费用：</strong> {countryInfo.fee}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 hover-scale animate-slide-up [animation-delay:400ms]">
              <CardHeader>
                <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <CardTitle>官方网站</CardTitle>
                <CardDescription>获取更多详细信息，请访问官方网站</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={countryInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors"
                >
                  <span>
                    {selectedVisaType === "schengen"
                      ? `${countries.find((c) => c.value === selectedCountry)?.label}签证官方网站`
                      : selectedVisaType === "usa"
                        ? "美国签证官方网站"
                        : "日本签证官方网站"}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

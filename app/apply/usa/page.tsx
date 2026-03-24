"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText } from "lucide-react"

export default function USAVisaApplicationPage() {
  const [step, setStep] = useState(1)
  const router = useRouter()

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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">美国签证申请</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">按照步骤填写信息，完成美国签证申请</p>
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
                  <Label htmlFor="passport" className="text-white">
                    护照号码
                  </Label>
                  <Input
                    id="passport"
                    placeholder="输入护照号码"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="name" className="text-white">
                    姓名（拼音）
                  </Label>
                  <Input id="name" placeholder="输入姓名拼音" className="bg-zinc-800 border-zinc-700 text-white mt-2" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="visa-type" className="text-white">
                    签证类型
                  </Label>
                  <Input
                    id="visa-type"
                    placeholder="选择签证类型"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="travel-purpose" className="text-white">
                    旅行目的
                  </Label>
                  <Input
                    id="travel-purpose"
                    placeholder="输入旅行目的"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ds-160" className="text-white">
                    DS-160表格号码
                  </Label>
                  <Input
                    id="ds-160"
                    placeholder="输入DS-160表格号码"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="sevis" className="text-white">
                    SEVIS ID（如适用）
                  </Label>
                  <Input
                    id="sevis"
                    placeholder="输入SEVIS ID"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="interview-location" className="text-white">
                    面试地点
                  </Label>
                  <Input
                    id="interview-location"
                    placeholder="选择面试地点"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="interview-date" className="text-white">
                    预约面试日期
                  </Label>
                  <Input id="interview-date" type="date" className="bg-zinc-800 border-zinc-700 text-white mt-2" />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <p className="text-gray-300">请确认您已准备好以下材料：</p>
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  <li>有效护照</li>
                  <li>DS-160确认页</li>
                  <li>签证申请费收据</li>
                  <li>2英寸 x 2英寸的照片</li>
                  <li>面试预约确认</li>
                  <li>支持文件（如适用）</li>
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


"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText } from "lucide-react"

export default function JapanVisaApplicationClientPage() {
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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">日本签证申请</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">按照步骤填写信息，完成日本签证申请</p>
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
                  <Label htmlFor="stay-duration" className="text-white">
                    预计停留时间
                  </Label>
                  <Input
                    id="stay-duration"
                    placeholder="输入预计停留时间"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sponsor" className="text-white">
                    邀请方/担保人信息
                  </Label>
                  <Input
                    id="sponsor"
                    placeholder="输入邀请方或担保人信息"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="itinerary" className="text-white">
                    行程安排
                  </Label>
                  <Input
                    id="itinerary"
                    placeholder="简述行程安排"
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
                  <Input
                    id="accommodation"
                    placeholder="输入住宿信息"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="financial-proof" className="text-white">
                    财务证明
                  </Label>
                  <Input
                    id="financial-proof"
                    placeholder="描述财务证明类型"
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <p className="text-gray-300">请确认您已准备好以下材料：</p>
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  <li>有效护照</li>
                  <li>签证申请表</li>
                  <li>照片（4.5cm x 4.5cm）</li>
                  <li>行程安排</li>
                  <li>住宿证明</li>
                  <li>财务证明</li>
                  <li>在职证明或学生证明</li>
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

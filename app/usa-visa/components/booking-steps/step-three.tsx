"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { BookingFormData } from "../../appointment-booking/types"
import { ArrowLeft, ArrowRight, Mail, Phone, Bell } from "lucide-react"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface StepThreeProps {
  formData: BookingFormData
  updateFormData: (data: Partial<BookingFormData>) => void
  onNext: () => void
  onPrevious: () => void
}

export function StepThree({ formData, updateFormData, onNext, onPrevious }: StepThreeProps) {
  // 更新通知方式
  const handleNotificationMethodChange = (value: "email" | "phone" | "both") => {
    updateFormData({ notificationMethod: value })
  }
  
  // 验证电子邮件
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }
  
  // 验证手机号
  const validatePhone = (phone: string) => {
    // 简单验证手机号（中国手机号格式）
    const re = /^1[3-9]\d{9}$/
    return re.test(phone)
  }
  
  // 检查是否可以进入下一步
  const canProceed = () => {
    if (formData.notificationMethod === "email") {
      return validateEmail(formData.email)
    }
    if (formData.notificationMethod === "phone") {
      return validatePhone(formData.phone)
    }
    if (formData.notificationMethod === "both") {
      return validateEmail(formData.email) && validatePhone(formData.phone)
    }
    return false
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-blue-500" />
              第3步：选择通知方式
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              请选择您希望接收预约成功通知的方式，系统会在找到可用名额后立即通知您。
            </p>
          </div>

          {/* 通知方式选择 */}
          <div className="space-y-6">
            <RadioGroup 
              value={formData.notificationMethod} 
              onValueChange={(value) => handleNotificationMethodChange(value as "email" | "phone" | "both")}
              className="space-y-4"
            >
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="email" id="email-option" />
                <Label htmlFor="email-option" className="flex items-center cursor-pointer">
                  <Mail className="h-5 w-5 mr-3 text-blue-500" />
                  <span>仅通过电子邮件通知</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="phone" id="phone-option" />
                <Label htmlFor="phone-option" className="flex items-center cursor-pointer">
                  <Phone className="h-5 w-5 mr-3 text-green-500" />
                  <span>仅通过手机短信通知</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="both" id="both-option" />
                <Label htmlFor="both-option" className="flex items-center cursor-pointer">
                  <Bell className="h-5 w-5 mr-3 text-purple-500" />
                  <span>同时通过电子邮件和短信通知</span>
                </Label>
              </div>
            </RadioGroup>

            {/* 电子邮件输入框 */}
            {(formData.notificationMethod === "email" || formData.notificationMethod === "both") && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  电子邮件地址
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="请输入您的电子邮件地址"
                    value={formData.email}
                    onChange={(e) => updateFormData({ email: e.target.value })}
                    className={`pl-10 ${!validateEmail(formData.email) && formData.email ? 'border-red-500' : ''}`}
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                {formData.email && !validateEmail(formData.email) && (
                  <p className="text-sm text-red-500 mt-1">请输入有效的电子邮件地址</p>
                )}
                <p className="text-sm text-gray-500">抢号成功后，我们会立即发送邮件通知您。</p>
              </div>
            )}

            {/* 手机号码输入框 */}
            {(formData.notificationMethod === "phone" || formData.notificationMethod === "both") && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  手机号码
                </label>
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="请输入您的手机号码"
                    value={formData.phone}
                    onChange={(e) => updateFormData({ phone: e.target.value })}
                    className={`pl-10 ${!validatePhone(formData.phone) && formData.phone ? 'border-red-500' : ''}`}
                  />
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                {formData.phone && !validatePhone(formData.phone) && (
                  <p className="text-sm text-red-500 mt-1">请输入有效的手机号码</p>
                )}
                <p className="text-sm text-gray-500">抢号成功后，我们会立即发送短信通知您。</p>
              </div>
            )}
          </div>

          {/* 导航按钮 */}
          <div className="flex justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={onPrevious}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              上一步
            </Button>
            <Button 
              onClick={onNext}
              disabled={!canProceed()}
            >
              下一步
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

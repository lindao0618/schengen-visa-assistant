"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2 } from "lucide-react"

// 引入步骤组件
import { StepOne } from "@/app/usa-visa/components/booking-steps/step-one"
import { StepTwo } from "@/app/usa-visa/components/booking-steps/step-two"
import { StepThree } from "@/app/usa-visa/components/booking-steps/step-three"
import { StepFour } from "@/app/usa-visa/components/booking-steps/step-four"
import { StepFive } from "@/app/usa-visa/components/booking-steps/step-five"

// 定义签证系统类型
export type VisaSystemType = "AIS" | "AVITS" | "CGI" | "Unknown"

// 定义预约表单数据接口
export interface BookingFormData {
  // 步骤1：国家和地点
  country: string
  location: string
  systemType: VisaSystemType

  // 步骤2：时间范围
  timeRanges: {
    startDate: Date
    endDate: Date
  }[]

  // 步骤3：通知方式
  notificationMethod: "email" | "phone" | "both"
  email: string
  phone: string

  // 步骤4：账户信息 (根据系统类型有所不同)
  accountCredentials: {
    username: string
    password: string
    securityAnswers?: Record<string, string>
    applicationId?: string
    passportNumber?: string
    additionalInfo?: Record<string, string>
  }

  // 步骤5：费用信息
  payment: {
    baseFee: number
    extraPersonFee: number
    expediteFee: number
    totalFee: number
    paymentMethod: "wechat" | "alipay" | "creditCard"
  }
  
  // 其他信息
  numberOfApplicants: number
  expediteService: boolean
}

export default function AppointmentBookingPage() {
  // 当前步骤状态
  const [currentStep, setCurrentStep] = useState(1)
  
  // 表单数据
  const [formData, setFormData] = useState<BookingFormData>({
    country: "",
    location: "",
    systemType: "Unknown",
    timeRanges: [{ startDate: new Date(), endDate: new Date() }],
    notificationMethod: "email",
    email: "",
    phone: "",
    accountCredentials: {
      username: "",
      password: ""
    },
    payment: {
      baseFee: 200,
      extraPersonFee: 0,
      expediteFee: 0,
      totalFee: 200,
      paymentMethod: "alipay"
    },
    numberOfApplicants: 1,
    expediteService: false
  })

  // 更新表单数据
  const updateFormData = (data: Partial<BookingFormData>) => {
    setFormData(prev => {
      const updatedData = { ...prev, ...data }
      
      // 自动计算费用
      const baseFee = 200
      const extraPersonFee = (updatedData.numberOfApplicants - 1) * 100
      const expediteFee = updatedData.expediteService ? 300 : 0
      const totalFee = baseFee + extraPersonFee + expediteFee
      
      updatedData.payment = {
        ...updatedData.payment,
        baseFee,
        extraPersonFee,
        expediteFee,
        totalFee
      }
      
      return updatedData
    })
  }

  // 下一步和上一步
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5))
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  // 步骤完成状态
  const isStepComplete = (step: number) => {
    if (step > currentStep) return false
    
    switch(step) {
      case 1:
        return !!formData.country && !!formData.location
      case 2:
        return formData.timeRanges.length > 0
      case 3:
        return (formData.notificationMethod === "email" && !!formData.email) || 
               (formData.notificationMethod === "phone" && !!formData.phone) ||
               (formData.notificationMethod === "both" && !!formData.email && !!formData.phone)
      case 4:
        return !!formData.accountCredentials.username && 
               !!formData.accountCredentials.password
      case 5:
        return true
      default:
        return false
    }
  }

  // 渲染当前步骤组件
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepOne 
          formData={formData} 
          updateFormData={updateFormData} 
          onNext={nextStep}
        />
      case 2:
        return <StepTwo 
          formData={formData} 
          updateFormData={updateFormData} 
          onNext={nextStep} 
          onPrevious={prevStep}
        />
      case 3:
        return <StepThree 
          formData={formData} 
          updateFormData={updateFormData} 
          onNext={nextStep} 
          onPrevious={prevStep}
        />
      case 4:
        return <StepFour 
          formData={formData} 
          updateFormData={updateFormData} 
          onNext={nextStep} 
          onPrevious={prevStep}
        />
      case 5:
        return <StepFive 
          formData={formData} 
          updateFormData={updateFormData} 
          onPrevious={prevStep}
          onSubmit={() => alert("预约已提交！")}
        />
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <h1 className="text-3xl font-bold text-center mb-8">美签名额预约系统</h1>
      
      {/* 步骤指示器 */}
      <div className="mb-10">
        <div className="flex justify-between items-center">
          {[1, 2, 3, 4, 5].map(step => (
            <div 
              key={step} 
              className={`flex flex-col items-center ${currentStep >= step ? "text-primary" : "text-gray-400"}`}
            >
              <div 
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center
                  ${currentStep > step ? "bg-primary border-primary" : ""}
                  ${currentStep === step ? "border-primary" : ""}
                  ${currentStep < step ? "border-gray-300" : ""}
                `}
              >
                {isStepComplete(step) ? (
                  <CheckCircle2 className="w-5 h-5 text-white" />
                ) : (
                  <span className={currentStep === step ? "text-primary" : "text-gray-400"}>{step}</span>
                )}
              </div>
              <span className="text-sm mt-2">
                {step === 1 && "选择国家/地点"}
                {step === 2 && "设置时间范围"}
                {step === 3 && "通知方式"}
                {step === 4 && "账号信息"}
                {step === 5 && "确认付款"}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-2">
          <div className="absolute top-0 h-[2px] bg-gray-300 w-full"></div>
          <div 
            className="absolute top-0 h-[2px] bg-primary transition-all duration-300"
            style={{ width: `${(currentStep - 1) * 25}%` }}
          ></div>
        </div>
      </div>
      
      {/* 步骤内容 */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
      >
        {renderStep()}
      </motion.div>
    </div>
  )
}

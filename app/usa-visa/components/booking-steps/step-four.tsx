"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { BookingFormData } from "../../appointment-booking/types"
import { ArrowLeft, ArrowRight, User, Lock, KeyRound, HelpCircle, FileText, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import {
  Alert,
  AlertDescription
} from "@/components/ui/alert"

interface StepFourProps {
  formData: BookingFormData
  updateFormData: (data: Partial<BookingFormData>) => void
  onNext: () => void
  onPrevious: () => void
}

// 不同系统的安全问题
const securityQuestions: Record<string, string[]> = {
  "AIS": [
    "您的出生城市是什么？",
    "您的第一个宠物的名字是什么？",
    "您的母亲的婚前姓氏是什么？"
  ],
  "CGI": [
    "您的高中名称是什么？",
    "您最喜欢的电影是什么？"
  ],
  "AVITS": [
    "您父亲的出生地是哪里？",
    "您初恋的名字是什么？",
    "您的座右铭是什么？"
  ]
}

export function StepFour({ formData, updateFormData, onNext, onPrevious }: StepFourProps) {
  // 表单状态
  const [showPassword, setShowPassword] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>(
    formData.accountCredentials.securityAnswers || {}
  )

  // 根据系统类型更新字段
  const updateCredentials = (field: string, value: string) => {
    updateFormData({
      accountCredentials: {
        ...formData.accountCredentials,
        [field]: value
      }
    })
  }

  // 更新安全问题答案
  const updateSecurityAnswer = (question: string, answer: string) => {
    const newAnswers = { ...answers, [question]: answer }
    setAnswers(newAnswers)
    updateFormData({
      accountCredentials: {
        ...formData.accountCredentials,
        securityAnswers: newAnswers
      }
    })
  }

  // 检查是否可以进入下一步
  const canProceed = () => {
    if (!formData.accountCredentials.username || !formData.accountCredentials.password) {
      return false
    }
    
    // 根据系统类型检查特定字段
    if (formData.systemType === "AIS" && !formData.accountCredentials.applicationId) {
      return false
    }
    
    if (formData.systemType === "CGI" && !formData.accountCredentials.passportNumber) {
      return false
    }
    
    // 检查安全问题
    if (formData.systemType !== "Unknown" && securityQuestions[formData.systemType]) {
      const requiredQuestions = securityQuestions[formData.systemType]
      for (const question of requiredQuestions) {
        if (!answers[question]) {
          return false
        }
      }
    }
    
    return true
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-blue-500" />
              第4步：填写账号信息及安全问题
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              根据您选择的{formData.country}（{formData.systemType}系统），请填写相应的账号信息和安全问题。
            </p>
            
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                我们不会存储您的密码，仅用于自动登录系统查找可用名额。
              </AlertDescription>
            </Alert>
          </div>

          <div className="space-y-6">
            {/* 基础账号信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 用户名 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  用户名/邮箱
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="请输入账号用户名"
                    value={formData.accountCredentials.username}
                    onChange={(e) => updateCredentials("username", e.target.value)}
                    className="pl-10"
                  />
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">
                  {formData.systemType === "CGI" ? "请输入您在CGI系统中注册的邮箱" : 
                   formData.systemType === "AIS" ? "请输入您在AIS系统中的用户名" : 
                   "请输入您的账号用户名"}
                </p>
              </div>
              
              {/* 密码 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  密码
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="请输入账号密码"
                    value={formData.accountCredentials.password}
                    onChange={(e) => updateCredentials("password", e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "隐藏" : "显示"}
                  </button>
                </div>
              </div>
            </div>

            {/* CGI系统特定字段 */}
            {formData.systemType === "CGI" && (
              <div className="space-y-4 mt-4 p-4 bg-blue-50 rounded-md border border-blue-100">
                <h4 className="font-medium text-blue-800">CGI系统特定信息</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    护照号码
                  </label>
                  <Input
                    placeholder="请输入您的护照号码"
                    value={formData.accountCredentials.passportNumber || ""}
                    onChange={(e) => updateCredentials("passportNumber", e.target.value)}
                  />
                </div>
                
                <p className="text-xs text-blue-700">
                  请确保填写的护照号码与您的CGI账号关联的护照一致。
                </p>
              </div>
            )}
            
            {/* AIS系统特定字段 */}
            {formData.systemType === "AIS" && (
              <div className="space-y-4 mt-4 p-4 bg-green-50 rounded-md border border-green-100">
                <h4 className="font-medium text-green-800">AIS系统特定信息</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    申请ID (Application ID)
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="请输入您的申请ID"
                      value={formData.accountCredentials.applicationId || ""}
                      onChange={(e) => updateCredentials("applicationId", e.target.value)}
                      className="pl-10"
                    />
                    <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                <p className="text-xs text-green-700">
                  申请ID可以在您的AIS账号中找到，通常以&quot;AA&quot;开头，后接数字。
                </p>
              </div>
            )}
            
            {/* AVITS系统特定字段 */}
            {formData.systemType === "AVITS" && (
              <div className="space-y-4 mt-4 p-4 bg-purple-50 rounded-md border border-purple-100">
                <h4 className="font-medium text-purple-800">AVITS系统特定信息</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    参考编号 (Reference Number)
                  </label>
                  <Input
                    placeholder="请输入您的参考编号"
                    value={formData.accountCredentials.additionalInfo?.referenceNumber || ""}
                    onChange={(e) => updateFormData({
                      accountCredentials: {
                        ...formData.accountCredentials,
                        additionalInfo: {
                          ...(formData.accountCredentials.additionalInfo || {}),
                          referenceNumber: e.target.value
                        }
                      }
                    })}
                  />
                </div>
              </div>
            )}

            {/* 安全问题 */}
            {formData.systemType !== "Unknown" && securityQuestions[formData.systemType] && (
              <div className="mt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="security-questions">
                    <AccordionTrigger className="text-sm font-medium">
                      <div className="flex items-center">
                        <KeyRound className="h-4 w-4 mr-2 text-amber-500" />
                        安全问题（{securityQuestions[formData.systemType].length}个问题需回答）
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {securityQuestions[formData.systemType].map((question, index) => (
                          <div key={index} className="space-y-2">
                            <label className="block text-sm text-gray-700 flex items-center">
                              <HelpCircle className="h-3.5 w-3.5 mr-2 text-gray-500" />
                              {question}
                            </label>
                            <Input
                              placeholder="请输入您的答案"
                              value={answers[question] || ""}
                              onChange={(e) => updateSecurityAnswer(question, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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

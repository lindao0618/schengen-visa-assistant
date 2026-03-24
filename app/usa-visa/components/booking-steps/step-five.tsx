"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookingFormData } from "../../appointment-booking/page"
import { ArrowLeft, CreditCard, CheckCircle, AlertCircle, User, Calendar, MapPin, Clock } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import Image from "next/image"

interface StepFiveProps {
  formData: BookingFormData
  updateFormData: (data: Partial<BookingFormData>) => void
  onPrevious: () => void
  onSubmit: () => void
}

// 系统文案
const systemNames: Record<string, string> = {
  "CGI": "美签CGI系统",
  "AIS": "美签AIS系统",
  "AVITS": "美签AVITS系统",
  "Unknown": "未知系统"
}

export function StepFive({ formData, updateFormData, onPrevious, onSubmit }: StepFiveProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreeTOS, setAgreeTOS] = useState(false)

  // 设置付款方式
  const setPaymentMethod = (method: "wechat" | "alipay" | "creditCard") => {
    updateFormData({
      payment: {
        ...formData.payment,
        paymentMethod: method
      }
    })
  }

  // 设置人数
  const handleApplicantNumberChange = (value: number) => {
    updateFormData({
      numberOfApplicants: value
    })
  }

  // 设置加急服务
  const toggleExpediteService = () => {
    updateFormData({
      expediteService: !formData.expediteService
    })
  }

  // 提交表单
  const handleSubmit = () => {
    if (!agreeTOS || !formData.payment.paymentMethod) return
    
    setIsSubmitting(true)
    
    // 模拟提交
    setTimeout(() => {
      onSubmit()
      setIsSubmitting(false)
    }, 1500)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-blue-500" />
              第5步：确认费用并付款
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              请确认您的预约信息，选择申请人数量和加急服务，并完成支付。
            </p>
          </div>

          {/* 预约信息确认 */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">预约信息确认</h4>
            
            <div className="bg-gray-50 p-4 rounded-md space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">账号信息</p>
                  <p className="text-sm text-gray-600">{formData.accountCredentials.username} ({systemNames[formData.systemType]})</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">面试地点</p>
                  <p className="text-sm text-gray-600">{formData.country} - {formData.location}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">预约时间范围</p>
                  <div className="space-y-1">
                    {formData.timeRanges.map((range, index) => (
                      <p key={index} className="text-sm text-gray-600">
                        范围 {index + 1}: {format(range.startDate, "yyyy年MM月dd日", {locale: zhCN})} 至 {format(range.endDate, "yyyy年MM月dd日", {locale: zhCN})}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">通知方式</p>
                  <p className="text-sm text-gray-600">
                    {formData.notificationMethod === "email" && `电子邮件: ${formData.email}`}
                    {formData.notificationMethod === "phone" && `手机短信: ${formData.phone}`}
                    {formData.notificationMethod === "both" && `电子邮件: ${formData.email} 和 手机短信: ${formData.phone}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 申请人数量 */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">申请人数量</h4>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleApplicantNumberChange(Math.max(1, formData.numberOfApplicants - 1))}
                disabled={formData.numberOfApplicants <= 1}
              >
                -
              </Button>
              
              <span className="text-lg font-medium">{formData.numberOfApplicants}</span>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleApplicantNumberChange(Math.min(10, formData.numberOfApplicants + 1))}
                disabled={formData.numberOfApplicants >= 10}
              >
                +
              </Button>
              
              <span className="text-sm text-gray-500 ml-2">
                {formData.numberOfApplicants > 1 ? `（每增加一人加收100元）` : ""}
              </span>
            </div>
          </div>

          {/* 加急服务 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-md font-medium">加急服务</h4>
              <p className="text-sm text-gray-500">加急服务可提高名额抢号优先级，增加300元</p>
            </div>
            <Switch
              checked={formData.expediteService}
              onCheckedChange={toggleExpediteService}
            />
          </div>

          {/* 费用计算 */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">费用明细</h4>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>基础服务费</TableCell>
                  <TableCell className="text-right">¥{formData.payment.baseFee}</TableCell>
                </TableRow>
                {formData.numberOfApplicants > 1 && (
                  <TableRow>
                    <TableCell>多人预约费 ({formData.numberOfApplicants - 1}人 × ¥100)</TableCell>
                    <TableCell className="text-right">¥{formData.payment.extraPersonFee}</TableCell>
                  </TableRow>
                )}
                {formData.expediteService && (
                  <TableRow>
                    <TableCell>加急服务费</TableCell>
                    <TableCell className="text-right">¥{formData.payment.expediteFee}</TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>总计</TableCell>
                  <TableCell className="text-right">¥{formData.payment.totalFee}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* 付款方式 */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">选择付款方式</h4>
            
            <RadioGroup 
              value={formData.payment.paymentMethod} 
              onValueChange={(value) => setPaymentMethod(value as "wechat" | "alipay" | "creditCard")}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="wechat" id="wechat" />
                <Label htmlFor="wechat" className="flex items-center cursor-pointer">
                  <div className="w-6 h-6 mr-2 relative">
                    <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-xs">微</span>
                    </div>
                  </div>
                  <span>微信支付</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="alipay" id="alipay" />
                <Label htmlFor="alipay" className="flex items-center cursor-pointer">
                  <div className="w-6 h-6 mr-2 relative">
                    <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-xs">支</span>
                    </div>
                  </div>
                  <span>支付宝</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 border rounded-md p-4 hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="creditCard" id="creditCard" />
                <Label htmlFor="creditCard" className="flex items-center cursor-pointer">
                  <CreditCard className="h-5 w-5 mr-2 text-gray-600" />
                  <span>银行卡</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 协议同意 */}
          <div className="flex items-start space-x-3">
            <Switch
              id="tos"
              checked={agreeTOS}
              onCheckedChange={setAgreeTOS}
            />
            <Label 
              htmlFor="tos" 
              className="text-sm cursor-pointer"
            >
              我已阅读并同意《服务协议》和《隐私政策》，理解抢号服务不保证100%成功，但会尽最大努力为您抢到合适的签证名额。
            </Label>
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
              onClick={handleSubmit}
              disabled={isSubmitting || !agreeTOS || !formData.payment.paymentMethod}
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  处理中...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  确认付款并提交预约
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

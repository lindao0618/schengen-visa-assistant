"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { BookingFormData } from "../../appointment-booking/page"
import { Calendar as CalendarIcon, Clock, Plus, Trash2, ArrowLeft, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { zhCN } from 'date-fns/locale'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface StepTwoProps {
  formData: BookingFormData
  updateFormData: (data: Partial<BookingFormData>) => void
  onNext: () => void
  onPrevious: () => void
}

export function StepTwo({ formData, updateFormData, onNext, onPrevious }: StepTwoProps) {
  // 添加新的时间范围
  const addTimeRange = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    
    updateFormData({
      timeRanges: [
        ...formData.timeRanges,
        { startDate: tomorrow, endDate: nextWeek }
      ]
    })
  }

  // 更新特定时间范围
  const updateTimeRange = (index: number, field: 'startDate' | 'endDate', date: Date) => {
    const newTimeRanges = [...formData.timeRanges]
    newTimeRanges[index] = {
      ...newTimeRanges[index],
      [field]: date
    }
    
    // 确保开始日期不晚于结束日期
    if (field === 'startDate' && date > newTimeRanges[index].endDate) {
      newTimeRanges[index].endDate = date
    }
    
    // 确保结束日期不早于开始日期
    if (field === 'endDate' && date < newTimeRanges[index].startDate) {
      newTimeRanges[index].startDate = date
    }
    
    updateFormData({ timeRanges: newTimeRanges })
  }

  // 删除时间范围
  const deleteTimeRange = (index: number) => {
    const newTimeRanges = formData.timeRanges.filter((_, i) => i !== index)
    updateFormData({ timeRanges: newTimeRanges.length ? newTimeRanges : [{ startDate: new Date(), endDate: new Date() }] })
  }

  // 禁用过去的日期
  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  // 检查是否可以进入下一步
  const canProceed = formData.timeRanges.length > 0 && formData.timeRanges.every(
    range => range.startDate && range.endDate && range.startDate <= range.endDate
  )

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
              <CalendarIcon className="h-5 w-5 text-blue-500" />
              第2步：设置预约时间范围
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              请设置您希望预约的时间范围，可以添加多个时间段，系统将优先在这些时间段内为您抢号。
            </p>
          </div>

          {/* 时间范围设置 */}
          <div className="space-y-6">
            {formData.timeRanges.map((range, index) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">时间范围 {index + 1}</h4>
                  {formData.timeRanges.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => deleteTimeRange(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 开始日期选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      开始日期
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !range.startDate && "text-gray-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {range.startDate ? (
                            format(range.startDate, "y年MM月dd日", {locale: zhCN})
                          ) : (
                            <span>选择日期</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={range.startDate}
                          onSelect={(date) => date && updateTimeRange(index, 'startDate', date)}
                          disabled={isPastDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* 结束日期选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      结束日期
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !range.endDate && "text-gray-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {range.endDate ? (
                            format(range.endDate, "y年MM月dd日", {locale: zhCN})
                          ) : (
                            <span>选择日期</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={range.endDate}
                          onSelect={(date) => date && updateTimeRange(index, 'endDate', date)}
                          disabled={(date) => isPastDate(date) || date < range.startDate}
                          fromDate={range.startDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {/* 显示时间范围 */}
                <div className="flex items-center justify-center mt-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {format(range.startDate, "y.MM.dd")} 
                      <ArrowRight className="inline h-3 w-3 mx-1" /> 
                      {format(range.endDate, "y.MM.dd")}
                    </span>
                  </Badge>
                </div>
              </div>
            ))}
            
            {/* 添加时间范围按钮 */}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={addTimeRange}
            >
              <Plus className="h-4 w-4 mr-2" />
              添加更多时间范围
            </Button>
            
            {/* 用户提示 */}
            <div className="text-sm text-gray-500 italic">
              提示：添加多个时间范围可以增加预约成功的几率，系统会优先查找您设定的时间范围内的可用名额。
            </div>
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
              disabled={!canProceed}
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

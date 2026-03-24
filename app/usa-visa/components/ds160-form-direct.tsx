"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FileCheck, CalendarIcon, Save, ArrowRight, Info, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

// 定义基本信息表单的验证模式
const basicInfoSchema = z.object({
  lastName: z.string().min(1, { message: "姓氏不能为空" }),
  firstName: z.string().min(1, { message: "名字不能为空" }),
  chineseName: z.string().optional(),
  hasFormerName: z.enum(["yes", "no"]),
  gender: z.enum(["male", "female"]),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed", "separated"]),
  birthDate: z.date({
    required_error: "请选择出生日期",
  }),
  birthProvince: z.string().min(1, { message: "出生省份不能为空" }),
  birthCity: z.string().min(1, { message: "出生城市不能为空" }),
  birthCountry: z.string().min(1, { message: "出生国家不能为空" }),
  nationality: z.string().min(1, { message: "国籍不能为空" }),
  idNumber: z.string().min(1, { message: "身份证号不能为空" }),
})

type BasicInfoFormValues = z.infer<typeof basicInfoSchema>

export function DS160DirectForm() {
  const [formStep, setFormStep] = useState(0)
  const [formSubmitted, setFormSubmitted] = useState(false)

  // 初始化表单
  const form = useForm<BasicInfoFormValues>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      chineseName: "",
      hasFormerName: "no",
      gender: "male",
      maritalStatus: "single",
      birthProvince: "",
      birthCity: "",
      birthCountry: "中国",
      nationality: "中国",
      idNumber: "",
    },
  })

  // 处理表单提交
  function onSubmit(data: BasicInfoFormValues) {
    console.log("表单数据:", data)
    // 这里可以处理下一步或直接提交到API
    setFormSubmitted(true)
  }

  return (
    <div className="space-y-8 w-full mx-auto">
      <Card className="border-[#e5e5ea] shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-white border-b border-[#e5e5ea] pb-8">
          <CardTitle className="text-3xl font-bold flex items-center gap-3 text-[#1c1c1e]">
            <FileCheck className="h-7 w-7 text-[#1c1c1e]" />
            DS-160表格在线填写
          </CardTitle>
          <CardDescription className="text-base mt-3 text-[#8e8e93]">
            请填写以下基本信息，所有标有星号(*)的字段为必填项
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-200">
                <span className="font-medium">第 1 步</span>
              </Badge>
              <h2 className="text-xl font-semibold text-[#1c1c1e]">基本个人信息</h2>
            </div>
            <div className="h-1 w-full bg-gray-100 rounded-full">
              <div className="h-1 bg-blue-600 rounded-full" style={{ width: '20%' }}></div>
            </div>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">姓氏 (拼音) <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的姓氏拼音" {...field} className="py-6" />
                      </FormControl>
                      <FormDescription>
                        与护照上的拼写一致，例如：ZHANG
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">名字 (拼音) <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的名字拼音" {...field} className="py-6" />
                      </FormControl>
                      <FormDescription>
                        与护照上的拼写一致，例如：WEI
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="chineseName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">中文姓名</FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的中文姓名" {...field} className="py-6" />
                      </FormControl>
                      <FormDescription>
                        例如：张伟
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="hasFormerName"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-base font-medium">是否有曾用名 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="flex flex-col space-y-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="yes-option"
                              checked={field.value === "yes"}
                              onCheckedChange={() => field.onChange("yes")}
                              className="h-5 w-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                              htmlFor="yes-option"
                              className="font-normal text-base cursor-pointer"
                            >
                              是
                            </label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="no-option"
                              checked={field.value === "no"}
                              onCheckedChange={() => field.onChange("no")}
                              className="h-5 w-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                              htmlFor="no-option"
                              className="font-normal text-base cursor-pointer"
                            >
                              否
                            </label>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-base font-medium">性别 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <div className="flex flex-col space-y-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="male-option"
                              checked={field.value === "male"}
                              onCheckedChange={() => field.onChange("male")}
                              className="h-5 w-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                              htmlFor="male-option"
                              className="font-normal text-base cursor-pointer"
                            >
                              男
                            </label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="female-option"
                              checked={field.value === "female"}
                              onCheckedChange={() => field.onChange("female")}
                              className="h-5 w-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                              htmlFor="female-option"
                              className="font-normal text-base cursor-pointer"
                            >
                              女
                            </label>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="maritalStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">婚姻状况 <span className="text-red-500">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="py-6">
                            <SelectValue placeholder="选择婚姻状况" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">未婚</SelectItem>
                          <SelectItem value="married">已婚</SelectItem>
                          <SelectItem value="divorced">离异</SelectItem>
                          <SelectItem value="widowed">丧偶</SelectItem>
                          <SelectItem value="separated">分居</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base font-medium">出生日期 <span className="text-red-500">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "py-6 px-4 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "yyyy年MM月dd日", { locale: zhCN })
                              ) : (
                                <span>选择日期</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        选择您的出生日期
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="birthProvince"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">出生省份 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的出生省份" {...field} className="py-6" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="birthCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">出生城市 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的出生城市" {...field} className="py-6" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="birthCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">出生国家 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的出生国家" {...field} className="py-6" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">国籍 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的国籍" {...field} className="py-6" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="idNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">身份证号 <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="输入您的身份证号" {...field} className="py-6" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex justify-between items-center pt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="lg"
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  保存草稿
                </Button>
                
                <Button 
                  type="submit" 
                  size="lg"
                  className="gap-2 bg-gradient-to-b from-[#1c1c1e] to-black hover:from-black hover:to-[#3a3a3c] text-white shadow-lg border border-[#3a3a3c] transition-all duration-300"
                >
                  下一步
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex justify-center px-6 py-8 bg-white border-t border-[#e5e5ea]">
          <div className="flex flex-wrap justify-center gap-3">
            <Badge variant="outline" className="bg-white text-[#1c1c1e] border-[#d1d1d6] py-2 px-4 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              所有数据安全加密
            </Badge>
            <Badge variant="outline" className="bg-white text-[#1c1c1e] border-[#d1d1d6] py-2 px-4 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              自动校验表单
            </Badge>
            <Badge variant="outline" className="bg-white text-[#1c1c1e] border-[#d1d1d6] py-2 px-4 text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              支持保存草稿
            </Badge>
          </div>
        </CardFooter>
      </Card>
      
      {formSubmitted && (
        <Card className="border-0 mt-6">
          <CardContent className="p-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <div className="rounded-full bg-green-100 p-1">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-green-800">基本信息已保存</h3>
                <p className="text-sm text-green-700 mt-1">您可以继续填写下一部分信息或保存退出</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

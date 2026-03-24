"use client"

import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarIcon, Save, ArrowRight, ArrowLeft, FileCheck, CheckCircle2, Send, Info } from "lucide-react";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";

// 日期选择器组件，支持年份和月份的快速选择
interface DatePickerWithMonthYearProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}

const DatePickerWithMonthYear: React.FC<DatePickerWithMonthYearProps> = ({
  selectedDate,
  onDateChange,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    selectedDate || new Date()
  );

  const updateMonth = (year: number, month: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    newDate.setMonth(month);
    setCurrentMonth(newDate);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(e.target.value);
    updateMonth(year, currentMonth.getMonth());
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const month = parseInt(e.target.value);
    updateMonth(currentMonth.getFullYear(), month);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date);
    }
  };

  return (
    <>
      <div className="flex gap-2 mb-2">
        <div className="grid gap-1 flex-1">
          <p className="text-sm font-medium">年份</p>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={currentMonth.getFullYear()}
            onChange={handleYearChange}
          >
            {Array.from({length: 124}, (_, i) => new Date().getFullYear() - i).map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1 flex-1">
          <p className="text-sm font-medium">月份</p>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={currentMonth.getMonth()}
            onChange={handleMonthChange}
          >
            {
              ["一月", "二月", "三月", "四月", "五月", "六月",
              "七月", "八月", "九月", "十月", "十一月", "十二月"
            ].map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </select>
        </div>
      </div>
      <Calendar
        mode="single"
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        selected={selectedDate}
        onSelect={handleDateSelect}
        disabled={(date) =>
          date > new Date() || date < new Date("1900-01-01")
        }
        initialFocus
      />
    </>
  );
};

// 定义DS-160表单的验证模式
const ds160FormSchema = z.object({
  // 第一页：基本个人信息
  lastName: z.string().min(1, { message: "姓氏不能为空" }),
  firstName: z.string().min(1, { message: "名字不能为空" }),
  chineseName: z.string().optional(),
  hasFormerName: z.enum(["yes", "no"]),
  formerName: z.string().optional(),
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
  
  // 第二页：联系方式信息
  homeAddress: z.string().min(1, { message: "家庭地址不能为空" }).optional(),
  homeCity: z.string().min(1, { message: "家庭城市不能为空" }).optional(),
  homeProvince: z.string().min(1, { message: "家庭省/州不能为空" }).optional(),
  homeCountry: z.string().min(1, { message: "家庭所在国不能为空" }).optional(),
  homePostalCode: z.string().min(1, { message: "家庭邮编不能为空" }).optional(),
  primaryPhone: z.string().min(1, { message: "主要电话不能为空" }).optional(),
  previousPhone: z.string().optional(),
  email: z.string().email({ message: "请输入有效的电子邮箱地址" }).optional(),
  previousEmail: z.string().email({ message: "请输入有效的电子邮箱地址" }).optional(),
  
  // 第三页：护照信息
  passportNumber: z.string().min(1, { message: "护照号码不能为空" }).optional(),
  passportIssueDate: z.date({
    required_error: "请选择护照签发日期",
  }).optional(),
})

type DS160FormValues = z.infer<typeof ds160FormSchema>

export function DS160DirectForm() {
  const [formStep, setFormStep] = useState(0)
  const { toast } = useToast()
  const [formSubmitted, setFormSubmitted] = useState(false)

  // 初始化表单
  const form = useForm<DS160FormValues>({
    resolver: zodResolver(ds160FormSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      chineseName: "",
      hasFormerName: "no",
      formerName: "",
      gender: "male",
      maritalStatus: "single",
      birthProvince: "",
      birthCity: "",
      birthCountry: "CHINA",
      nationality: "CHINA",
      idNumber: "",
      homeAddress: "Piccadilly Residence",
      homeCity: "York",
      homeProvince: "North Yorkshire",
      homeCountry: "UNITED KINGDOM",
      homePostalCode: "YO19SZ",
      primaryPhone: "447879943840",
      previousPhone: "15906330197",
      email: "dingxiaoyu2001@163.com",
      previousEmail: "dxyxy7@163.com",
      passportNumber: "",
    },
  })

  // 表单提交处理函数
  function onSubmit(values: z.infer<typeof ds160FormSchema>) {
    // 根据当前步骤处理表单提交
    if (formStep === 0) {
      // 第一步完成，保存数据并前进到第二步
      localStorage.setItem("ds160-form-step1", JSON.stringify(values))
      setFormStep(1)
      toast({
        title: "第一步完成",
        description: "基本信息已保存，请继续填写联系方式信息",
      })
    } else if (formStep === 1) {
      // 第二步完成，保存数据并前进到第三步
      localStorage.setItem("ds160-form-step2", JSON.stringify(values))
      setFormStep(2)
      toast({
        title: "第二步完成",
        description: "联系方式信息已保存，请继续填写护照信息",
      })
    } else if (formStep === 2) {
      // 最后一步，保存所有数据并提交表单
      localStorage.setItem("ds160-form-complete", JSON.stringify(values))
      setFormSubmitted(true)
      toast({
        title: "表单提交成功",
        description: "您的DS-160表单已成功提交，请等待处理",
      })
      
      // 这里可以添加实际的表单提交逻辑，例如发送到后端API
      // 示例：
      // const formData = new FormData();
      // formData.append('excel', excelFile);
      // formData.append('photo', photoFile);
      // formData.append('email', values.email || '');
      // 
      // fetch('http://43.165.7.132:8000/submit_form/', {
      //   method: 'POST',
      //   body: formData,
      // })
      // .then(response => response.json())
      // .then(data => {
      //   if (data.status === 'success') {
      //     toast({
      //       title: "提交成功",
      //       description: data.message,
      //     })
      //   } else {
      //     toast({
      //       title: "提交失败",
      //       description: data.message,
      //       variant: "destructive",
      //     })
      //   }
      // })
      // .catch(error => {
      //   toast({
      //     title: "提交错误",
      //     description: "提交表单时发生错误，请稍后重试",
      //     variant: "destructive",
      //   })
      // });
    }
  }

  // 返回上一步的处理函数
  const handlePrevStep = () => {
    if (formStep > 0) {
      setFormStep(formStep - 1)
    }
  }

  return (
    <div className="space-y-8 w-full mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>DS-160非移民签证申请表</CardTitle>
          <CardDescription>
            请填写以下信息以完成您的DS-160申请。所有带*的字段为必填项。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {formStep === 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">第一步：基本个人信息</h2>
                    <Badge variant="outline" className="text-sm">
                      步骤 1/3
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>姓氏 (拼音) *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="例如：ZHANG" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase())
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            请使用护照上的拼音姓氏，全部大写
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
                          <FormLabel>名字 (拼音) *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="例如：SAN" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase())
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            请使用护照上的拼音名字，全部大写
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
                          <FormLabel>中文姓名</FormLabel>
                          <FormControl>
                            <Input placeholder="例如：张三" {...field} />
                          </FormControl>
                          <FormDescription>
                            如果有中文姓名，请填写
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
                          <FormLabel>您是否曾使用其他姓名？ *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-row space-x-4"
                            >
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="yes" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  是
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="no" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  否
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("hasFormerName") === "yes" && (
                      <FormField
                        control={form.control}
                        name="formerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>曾用名</FormLabel>
                            <FormControl>
                              <Input placeholder="请输入曾用名" {...field} />
                            </FormControl>
                            <FormDescription>
                              请输入您曾经使用的姓名
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>性别 *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="请选择性别" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">男</SelectItem>
                              <SelectItem value="female">女</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maritalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>婚姻状况 *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="请选择婚姻状况" />
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
                          <FormLabel>出生日期 *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "yyyy年MM月dd日", {
                                      locale: zhCN,
                                    })
                                  ) : (
                                    <span>请选择出生日期</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <DatePickerWithMonthYear
                                selectedDate={field.value}
                                onDateChange={field.onChange}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            请选择您的出生日期
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="birthCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>出生国家 *</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value.toUpperCase())}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="请选择出生国家" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CHINA">中国 (CHINA)</SelectItem>
                              <SelectItem value="UNITED STATES">美国 (UNITED STATES)</SelectItem>
                              <SelectItem value="UNITED KINGDOM">英国 (UNITED KINGDOM)</SelectItem>
                              <SelectItem value="CANADA">加拿大 (CANADA)</SelectItem>
                              <SelectItem value="AUSTRALIA">澳大利亚 (AUSTRALIA)</SelectItem>
                              <SelectItem value="JAPAN">日本 (JAPAN)</SelectItem>
                              <SelectItem value="KOREA">韩国 (KOREA)</SelectItem>
                              <SelectItem value="GERMANY">德国 (GERMANY)</SelectItem>
                              <SelectItem value="FRANCE">法国 (FRANCE)</SelectItem>
                              <SelectItem value="ITALY">意大利 (ITALY)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            请选择您的出生国家
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
                          <FormLabel>出生省份 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="例如：SHANDONG" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase())
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            请输入您的出生省份，全部大写
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="birthCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>出生城市 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="例如：JINAN" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase())
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            请输入您的出生城市，全部大写
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>国籍 *</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value.toUpperCase())}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="请选择国籍" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CHINA">中国 (CHINA)</SelectItem>
                              <SelectItem value="UNITED STATES">美国 (UNITED STATES)</SelectItem>
                              <SelectItem value="UNITED KINGDOM">英国 (UNITED KINGDOM)</SelectItem>
                              <SelectItem value="CANADA">加拿大 (CANADA)</SelectItem>
                              <SelectItem value="AUSTRALIA">澳大利亚 (AUSTRALIA)</SelectItem>
                              <SelectItem value="JAPAN">日本 (JAPAN)</SelectItem>
                              <SelectItem value="KOREA">韩国 (KOREA)</SelectItem>
                              <SelectItem value="GERMANY">德国 (GERMANY)</SelectItem>
                              <SelectItem value="FRANCE">法国 (FRANCE)</SelectItem>
                              <SelectItem value="ITALY">意大利 (ITALY)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            请选择您的国籍
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>身份证号码 *</FormLabel>
                          <FormControl>
                            <Input placeholder="例如：370102199001011234" {...field} />
                          </FormControl>
                          <FormDescription>
                            请输入您的18位身份证号码
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit">
                      下一步 <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
              
              {formStep === 1 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">第二步：文件上传</h2>
                    <Badge variant="outline" className="text-sm">
                      步骤 2/3
                    </Badge>
                  </div>
                  
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCheck className="h-5 w-5 text-primary" />
                      <h3 className="font-medium">上传DS-160所需文件</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none" htmlFor="excel-upload">
                          Excel表格文件 (.xlsx) *
                        </label>
                        <div className="flex items-center gap-2">
                          <Input 
                            id="excel-upload" 
                            type="file" 
                            accept=".xlsx" 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium" 
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          请上传包含申请信息的Excel文件
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none" htmlFor="photo-upload">
                          白底证件照 (.jpg) *
                        </label>
                        <div className="flex items-center gap-2">
                          <Input 
                            id="photo-upload" 
                            type="file" 
                            accept=".jpg,.jpeg" 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium" 
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          请上传白底证件照片，格式为JPG
                        </p>
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>电子邮箱 *</FormLabel>
                            <FormControl>
                              <Input placeholder="例如：example@mail.com" {...field} />
                            </FormControl>
                            <FormDescription>
                              用于接收申请结果通知
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handlePrevStep}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> 上一步
                    </Button>
                    <Button type="submit">
                      下一步 <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
              
              {formStep === 2 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">第三步：护照信息</h2>
                    <Badge variant="outline" className="text-sm">
                      步骤 3/3
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="passportNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>护照号码 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="例如：E12345678" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase())
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            请输入您的护照号码
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="passportIssueDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>护照签发日期 *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "yyyy年MM月dd日", {
                                      locale: zhCN,
                                    })
                                  ) : (
                                    <span>请选择护照签发日期</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <DatePickerWithMonthYear
                                selectedDate={field.value}
                                onDateChange={field.onChange}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            请选择您的护照签发日期
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handlePrevStep}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> 上一步
                    </Button>
                    <Button type="submit">
                      提交 <Send className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          </Form>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <Badge variant="outline" className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span>所有信息将被安全加密</span>
            </Badge>
            {formStep === 2 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>最后一步</span>
              </Badge>
            )}
          </div>
        </CardFooter>
      </Card>

      {formSubmitted && (
        <Card className="border-green-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-500" />
              <CardTitle>表单提交成功</CardTitle>
            </div>
            <CardDescription>
              您的DS-160表单已成功提交，我们将尽快处理您的申请。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              请保存您的申请编号以便后续查询。您也将收到一封确认邮件，其中包含您的申请详情。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

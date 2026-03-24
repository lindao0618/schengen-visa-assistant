'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from "react-hook-form";
import { MaterialTaskList } from "@/components/MaterialTaskList";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, ArrowLeft as ArrowBackIcon, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const explanationFormSchema = z.object({
  name_en: z.string().min(1, { message: "英文姓名不能为空" }),
  organization: z.string().min(1, { message: "学校/工作单位不能为空" }),
  passport_number: z.string().min(1, { message: "护照号码不能为空" }),
  submission_country: z.string().min(1, { message: "递签国家不能为空" }),
  target_country: z.string().min(1, { message: "申请国家不能为空" }),
  departure_date: z.date({ required_error: "出发时间不能为空" }),
  issue_type: z.string().min(1, { message: "解释问题类型不能为空" }),
  issue_details: z.string().min(10, { message: "问题详情至少10个字符" }),
  additional_info: z.string().optional(),
  applicant_type: z.string().min(1, { message: "申请人类型不能为空" }),
  visa_type: z.string().min(1, { message: "签证类型不能为空" }),
});

type ExplanationFormValues = z.infer<typeof explanationFormSchema>;

const issueTypes = [
  { value: "bank_balance", label: "银行流水不足三个月" },
  { value: "large_transfer", label: "大额转账说明" },
  { value: "temporary_deposit", label: "临时存款说明" },
  { value: "employment_gap", label: "工作空档期说明" },
  { value: "income_source", label: "收入来源说明" },
  { value: "property_proof", label: "房产证明说明" },
  { value: "travel_purpose", label: "旅行目的说明" },
  { value: "relationship_proof", label: "关系证明说明" },
  { value: "study_plan", label: "学习计划说明" },
  { value: "financial_sponsor", label: "资助人说明" },
  { value: "previous_refusal", label: "拒签记录说明" },
  { value: "other", label: "其他问题" }
];

// 递签国家（主流留学生国家）
const submissionCountries = [
  { value: "uk", label: "英国" },
  { value: "china", label: "中国" },
  { value: "usa", label: "美国" },
  { value: "australia", label: "澳大利亚" },
  { value: "new_zealand", label: "新西兰" },
  { value: "south_korea", label: "韩国" },
  { value: "canada", label: "加拿大" },
  { value: "japan", label: "日本" },
  { value: "singapore", label: "新加坡" },
  { value: "germany", label: "德国" },
  { value: "france", label: "法国" },
  { value: "netherlands", label: "荷兰" },
  { value: "other", label: "其他国家" }
];

// 申请国家（签证目标国家）
const targetCountries = [
  { value: "france", label: "法国" },
  { value: "germany", label: "德国" },
  { value: "italy", label: "意大利" },
  { value: "spain", label: "西班牙" },
  { value: "netherlands", label: "荷兰" },
  { value: "belgium", label: "比利时" },
  { value: "austria", label: "奥地利" },
  { value: "switzerland", label: "瑞士" },
  { value: "greece", label: "希腊" },
  { value: "portugal", label: "葡萄牙" },
  { value: "sweden", label: "瑞典" },
  { value: "norway", label: "挪威" },
  { value: "denmark", label: "丹麦" },
  { value: "finland", label: "芬兰" },
  { value: "iceland", label: "冰岛" },
  { value: "luxembourg", label: "卢森堡" },
  { value: "malta", label: "马耳他" },
  { value: "cyprus", label: "塞浦路斯" },
  { value: "estonia", label: "爱沙尼亚" },
  { value: "latvia", label: "拉脱维亚" },
  { value: "lithuania", label: "立陶宛" },
  { value: "slovenia", label: "斯洛文尼亚" },
  { value: "slovakia", label: "斯洛伐克" },
  { value: "hungary", label: "匈牙利" },
  { value: "poland", label: "波兰" },
  { value: "czech", label: "捷克" },
  { value: "uk", label: "英国" },
  { value: "usa", label: "美国" },
  { value: "canada", label: "加拿大" },
  { value: "australia", label: "澳大利亚" },
  { value: "other", label: "其他国家" }
];

const applicantTypes = [
  { value: "student", label: "学生" },
  { value: "employee", label: "在职人员" },
  { value: "freelancer", label: "自由职业者" },
  { value: "business_owner", label: "企业主" },
  { value: "retiree", label: "退休人员" },
  { value: "unemployed", label: "无业人员" },
  { value: "housewife", label: "家庭主妇" },
  { value: "other", label: "其他" }
];

const LETTER_TASK_IDS_KEY = "material-explanation-letter-task-ids";

function loadStoredLetterTaskIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(LETTER_TASK_IDS_KEY);
    if (!s) return [];
    const arr = JSON.parse(s) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function storeLetterTaskIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LETTER_TASK_IDS_KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    /* ignore */
  }
}

const visaTypes = [
  { value: "tourist", label: "旅游签证" },
  { value: "business", label: "商务签证" },
  { value: "student", label: "学生签证" },
  { value: "work", label: "工作签证" },
  { value: "family", label: "探亲签证" },
  { value: "transit", label: "过境签证" },
  { value: "other", label: "其他类型" }
];

export default function ExplanationLetterWriterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [taskIds, setTaskIds] = useState<string[]>(loadStoredLetterTaskIds);

  useEffect(() => {
    storeLetterTaskIds(taskIds);
  }, [taskIds]);

  const form = useForm<ExplanationFormValues>({
    resolver: zodResolver(explanationFormSchema),
    defaultValues: {
      name_en: "",
      organization: "",
      passport_number: "",
      target_country: "",
      issue_type: "",
      issue_details: "",
      additional_info: "",
      applicant_type: "",
      visa_type: "",
    },
  });

  const handleBackToMaterials = () => {
    router.push('/material-customization');
  };

  async function onSubmit(data: ExplanationFormValues) {
    setIsLoading(true);
    toast.info("正在创建任务，请在下方的任务列表中查看进度...");

    try {
      const response = await fetch('/api/explanation-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chinese_name: data.name_en,
          english_name: data.name_en,
          organization: data.organization,
          passport_number: data.passport_number,
          submission_country: data.submission_country,
          visa_country: data.target_country,
          visa_type: data.visa_type,
          applicant_type: data.applicant_type,
          departure_date: format(data.departure_date, 'yyyy-MM-dd'),
          problem_type: data.issue_type,
          detailed_explanation: data.issue_details,
          additional_info: data.additional_info || ""
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '网络请求失败');
      }

      if (result.success && result.task_id) {
        setTaskIds((prev) => [...prev, result.task_id]);
        toast.success("任务已创建，请在下方的任务列表中查看进度与下载链接。");
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      console.error('生成解释信失败:', error);
      toast.error("生成解释信失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 dark:from-neutral-950 dark:to-neutral-800">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Button
          onClick={handleBackToMaterials}
          variant="outline"
        >
          <ArrowBackIcon className="mr-2 h-4 w-4" />
          返回定制材料
        </Button>
      </div>

      {/* 页面标题 */}
      <div className="text-center mb-8">
        <FileText className="mx-auto h-12 w-12 text-blue-600 mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
          签证解释信生成器
        </h1>
        <p className="mt-4 text-xl text-neutral-700 dark:text-neutral-300">
          专业生成各类签证解释信，解决签证申请中的疑难问题
        </p>
      </div>

      <Card className="max-w-4xl mx-auto bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">
            填写解释信信息
          </CardTitle>
          <CardDescription className="text-neutral-600 dark:text-neutral-400">
            请准确填写以下信息，我们将为您生成专业的签证解释信
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name_en"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>英文姓名 *</FormLabel>
                      <FormControl>
                        <Input placeholder="ZHANG San" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="organization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>学校/工作单位 *</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：北京大学 / ABC公司" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passport_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>护照号码 *</FormLabel>
                      <FormControl>
                        <Input placeholder="E12345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 签证信息 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="submission_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>递签国家 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择递签国家" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {submissionCountries.map((country) => (
                            <SelectItem key={country.value} value={country.value}>
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>申请国家 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择申请国家" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {targetCountries.map((country) => (
                            <SelectItem key={country.value} value={country.value}>
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visa_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>签证类型 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择签证类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {visaTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applicant_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>申请人类型 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择身份" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {applicantTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="departure_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>出发时间 *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "yyyy-MM-dd")
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
                            date < new Date()
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 问题说明 */}
              <FormField
                control={form.control}
                name="issue_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>解释问题类型 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择需要解释的问题类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {issueTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issue_details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>问题详细说明 *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="请详细描述需要解释的具体情况，包括时间、金额、原因等关键信息..."
                        className="min-h-[120px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      请提供尽可能详细的信息，这将有助于生成更专业的解释信
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additional_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>补充信息（可选）</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="如有其他需要补充说明的信息，请在此填写..."
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      可包括相关证明材料、联系方式等补充信息
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-center">
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      生成解释信
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
          <div className="mt-6">
            <MaterialTaskList
              taskIds={taskIds}
              filterTaskTypes={["explanation-letter"]}
              title="解释信任务"
              pollInterval={2000}
              autoRefresh
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
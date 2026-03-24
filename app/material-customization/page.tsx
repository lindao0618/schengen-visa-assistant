"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPinned,
  Hotel,
  Ticket,
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
  CalendarIcon,
  Loader2,
  FileText
} from "lucide-react";
import { MaterialTaskList } from "@/components/MaterialTaskList";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface MaterialService {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  actionType: 'navigate' | 'form';
  link?: string; // For navigation
}

const services: MaterialService[] = [
  {
    id: "itinerary",
    title: "行程单生成",
    description: "根据您的旅行计划自动生成详细的行程单。",
    icon: MapPinned,
    actionType: 'form',
  },
  {
    id: "hotel",
    title: "酒店预订单",
    description: "获取符合签证要求的模拟酒店预订单。",
    icon: Hotel,
    actionType: 'navigate',
    link: "/services/hotel-booking",
  },
  {
    id: "tickets",
    title: "机票/车票订单",
    description: "生成机票或火车票预订证明。",
    icon: Ticket,
    actionType: 'navigate',
    link: "/services/ticket-booking",
  },
  {
    id: "explanation-letter",
    title: "解释信",
    description: "辅助撰写各类签证解释信、说明信。",
    icon: FileText,
    actionType: 'navigate',
    link: "/services/explanation-letter-writer",
  },
  {
    id: "insurance",
    title: "保险",
    description: "查找并比较符合申根签证要求的旅游保险。",
    icon: ShieldCheck,
    actionType: 'navigate',
    link: "/services/insurance-comparison",
  },
];

const itineraryFormSchema = z.object({
  country: z.string().min(1, { message: "国家不能为空" }),
  departure_city: z.string().min(1, { message: "出发城市不能为空" }),
  arrival_city: z.string().min(1, { message: "到达城市不能为空" }),
  start_date: z.date({ required_error: "开始日期不能为空" }),
  end_date: z.date({ required_error: "结束日期不能为空" }),
  hotel_name: z.string().min(1, { message: "酒店名称不能为空" }),
  hotel_address: z.string().min(1, { message: "酒店地址不能为空" }),
  hotel_phone: z.string().min(1, { message: "酒店电话不能为空" }),
}).refine(data => data.end_date >= data.start_date, {
  message: "结束日期不能早于开始日期",
  path: ["end_date"],
});

type ItineraryFormValues = z.infer<typeof itineraryFormSchema>;

const ITINERARY_TASK_IDS_KEY = "material-itinerary-task-ids";

function loadStoredTaskIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(ITINERARY_TASK_IDS_KEY);
    if (!s) return [];
    const arr = JSON.parse(s) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function storeTaskIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ITINERARY_TASK_IDS_KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    /* ignore */
  }
}

function ItineraryForm({ onBack }: { onBack: () => void }) {
  const [taskIds, setTaskIds] = useState<string[]>(loadStoredTaskIds);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    storeTaskIds(taskIds);
  }, [taskIds]);
  const form = useForm<ItineraryFormValues>({
    resolver: zodResolver(itineraryFormSchema),
    defaultValues: {
      country: "",
      departure_city: "",
      arrival_city: "",
      hotel_name: "",
      hotel_address: "",
      hotel_phone: "",
    },
  });

  async function onSubmit(data: ItineraryFormValues) {
    setIsLoading(true);
    toast.info("正在创建任务，请在下方的任务列表中查看进度...");

    const payload = {
      ...data,
      start_date: format(data.start_date, "yyyy-MM-dd"),
      end_date: format(data.end_date, "yyyy-MM-dd"),
    };

    try {
      const response = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || "生成失败，请稍后重试。");
      }

      if (responseData.task_id) {
        setTaskIds((prev) => [...prev, responseData.task_id]);
        toast.success("任务已创建，请在下方的任务列表中查看进度与下载链接。");
      } else {
        throw new Error("API 响应异常");
      }
    } catch (error) {
      console.error("Error generating itinerary:", error);
      toast.error(error instanceof Error ? error.message : "生成行程单失败，请检查您的输入或稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto my-8 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">定制行程单</CardTitle>
          <Button variant="ghost" size="sm" onClick={onBack} className="text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700">
            <ChevronLeft className="mr-1 h-4 w-4" /> 返回
          </Button>
        </div>
        <CardDescription className="text-neutral-600 dark:text-neutral-400">请填写以下信息以生成您的专属行程单。</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>国家</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：法国" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="departure_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>出发城市</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：伦敦" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="arrival_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>到达城市</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：巴黎" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>开始日期</FormLabel>
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
                            date < new Date(new Date().setHours(0,0,0,0)) // Disable past dates
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>结束日期</FormLabel>
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
                            date < (form.getValues("start_date") || new Date(new Date().setHours(0,0,0,0)))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="hotel_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>酒店名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：巴黎艾菲尔铁塔美居酒店" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hotel_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>酒店地址</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：20 Rue Jean Rey, 75015 Paris, France" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hotel_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>酒店电话</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：+33 1 45 78 90 12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
              {isLoading ? "提交中..." : "生成行程单"}
            </Button>
          </form>
        </Form>
        <div className="mt-6">
          <MaterialTaskList
          taskIds={taskIds}
          filterTaskTypes={["itinerary"]}
          title="行程单任务"
          pollInterval={2000}
          autoRefresh
        />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MaterialCustomizationPage() {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const handleServiceSelect = (service: MaterialService) => {
    if (service.actionType === 'form' && service.id === 'itinerary') {
      setSelectedServiceId(service.id);
    } else if (service.actionType === 'navigate' && service.link) {
      // 直接跳转到对应的服务页面
      window.location.href = service.link;
    } else {
      alert(`服务 ${service.title} 即将开放，敬请期待！`);
    }
  };

  if (selectedServiceId === 'itinerary') {
    return <ItineraryForm onBack={() => setSelectedServiceId(null)} />;
  }

  return (
    <div className="container mx-auto py-10 px-4 bg-gradient-to-br from-gray-100 to-gray-300 dark:from-neutral-950 dark:to-neutral-800 min-h-screen">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white sm:text-5xl">
          签证材料定制服务
        </h1>
        <p className="mt-4 text-xl text-neutral-700 dark:text-neutral-300">
          一站式解决您的签证材料准备需求，省时省力。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id} className="flex flex-col overflow-hidden rounded-xl shadow-lg transition-all hover:shadow-2xl bg-white/60 dark:bg-neutral-800/60 backdrop-blur-lg border border-gray-200/70 dark:border-neutral-700/70">
            <CardHeader className="flex flex-row items-center space-x-4 p-6 bg-black/5 dark:bg-white/5 border-b border-gray-200/50 dark:border-neutral-700/50">
              <service.icon className="h-10 w-10 text-neutral-700 dark:text-neutral-300" />
              <div>
                <CardTitle className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">{service.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-grow p-6 flex flex-col">
              <CardDescription className="text-neutral-600 dark:text-neutral-400 mb-4 min-h-[60px]">
                {service.description}
              </CardDescription>
              <Button 
                variant="outline"
                className="w-full group mt-auto border-neutral-400 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-100 dark:hover:text-neutral-900 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-400"
                onClick={() => handleServiceSelect(service)}
              >
                立即定制
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <footer className="mt-16 pb-10 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          所有材料模板均符合使馆要求，助您顺利出签。
        </p>
      </footer>
    </div>
  );
}


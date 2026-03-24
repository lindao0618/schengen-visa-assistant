"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Plane, 
  Globe, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  ArrowRight, 
  Calendar, 
  RefreshCw,
  FileText,
  ExternalLink
} from "lucide-react";
import { TaskList } from "@/app/usa-visa/components/task-list";
import { FranceTaskList } from "@/app/schengen-visa/france/automation/FranceTaskList";
import { MaterialTaskList } from "@/components/MaterialTaskList";

const MATERIAL_REVIEW_TASK_IDS_KEY = "material-review-task-ids";
const MATERIAL_ITINERARY_TASK_IDS_KEY = "material-itinerary-task-ids";
const MATERIAL_EXPLANATION_TASK_IDS_KEY = "material-explanation-letter-task-ids";

const loadStoredTaskIds = (key: string) => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch (error) {
    console.error("读取任务ID失败:", error);
    return [];
  }
};


type DS160Status =
  | "not_started"
  | "in_progress"
  | "completed"
  | "submitted"
  | "error"
  | "failed";

// 申根签证预约状态类型
type SchengenAppointmentStatus = 
  | "not_booked" 
  | "pending" 
  | "confirmed" 
  | "cancelled" 
  | "completed"
  | "submitted"
  | "processing"
  | "success"
  | "appointment_success"
  | "failed"
  | "error";

// 美签自动填表数据
interface DS160Application {
  id: string;
  name: string;
  applicationId: string;
  status: DS160Status;
  progress: number;
  lastUpdated: string;
  errorMessage?: string;
}

// 申根签证预约数据
interface SchengenAppointment {
  id: string;
  country: string;
  city: string;
  appointmentDate: string;
  status: SchengenAppointmentStatus;
  visaType: string;
  reference?: string;
  tlsAccount?: {
    username: string;
    country: string;
    city: string;
  };
  bookingParams?: {
    dateTimeRanges: any[];
    slotTypes: string[];
  };
  submittedAt?: string;
  processedAt?: string;
  result?: any;
  errorMessage?: string;
}

// 模拟数据 - 美签自动填表
const mockDS160Applications: DS160Application[] = [
  {
    id: "ds160-1",
    name: "张三 - B1/B2访问签证",
    applicationId: "DS160-2023-78945",
    status: "completed",
    progress: 100,
    lastUpdated: "2023-08-15T14:30:00Z",
  },
  {
    id: "ds160-2",
    name: "李四 - F1学生签证",
    applicationId: "DS160-2023-79012",
    status: "in_progress",
    progress: 65,
    lastUpdated: "2023-08-20T09:45:00Z",
  },
  {
    id: "ds160-3",
    name: "王五 - J1交流访问学者",
    applicationId: "DS160-2023-79125",
    status: "error",
    progress: 45,
    lastUpdated: "2023-08-18T16:20:00Z",
    errorMessage: "个人信息部分存在错误，请检查护照号码格式",
  }
];

// 获取预约历史数据
const getBookingHistory = (): SchengenAppointment[] => {
  if (typeof window === 'undefined') return []
  try {
    const history = localStorage.getItem('bookingHistory')
    return history ? JSON.parse(history) : []
  } catch (error) {
    console.error('获取预约历史失败:', error)
    return []
  }
}

// 模拟数据 - 申根签证预约
const mockSchengenAppointments: SchengenAppointment[] = [
  {
    id: "schengen-1",
    country: "法国",
    city: "上海",
    appointmentDate: "2023-09-15T10:30:00Z",
    status: "confirmed",
    visaType: "短期旅游签证",
    reference: "FR-SH-2023-12345",
  },
  {
    id: "schengen-2",
    country: "德国",
    city: "北京",
    appointmentDate: "2023-09-20T14:00:00Z",
    status: "pending",
    visaType: "商务签证",
    reference: "DE-BJ-2023-67890",
  },
  {
    id: "schengen-3",
    country: "意大利",
    city: "广州",
    appointmentDate: "2023-08-10T09:15:00Z",
    status: "completed",
    visaType: "学生签证",
    reference: "IT-GZ-2023-54321",
  }
];

// 获取状态标签样式
const getStatusBadgeStyle = (status: DS160Status | SchengenAppointmentStatus) => {
  switch (status) {
    case "completed":
    case "submitted":
    case "confirmed":
      return "bg-green-100 text-green-800 border-green-200";
    case "in_progress":
    case "pending":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "error":
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

// 获取状态图标
const getStatusIcon = (status: DS160Status | SchengenAppointmentStatus) => {
  switch (status) {
    case "completed":
    case "submitted":
    case "confirmed":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "in_progress":
    case "pending":
      return <Clock className="h-5 w-5 text-blue-600" />;
    case "error":
    case "cancelled":
      return <XCircle className="h-5 w-5 text-red-600" />;
    default:
      return <AlertCircle className="h-5 w-5 text-gray-600" />;
  }
};

// 获取状态文本
const getStatusText = (status: DS160Status | SchengenAppointmentStatus) => {
  switch (status) {
    case "not_started":
      return "未开始";
    case "in_progress":
      return "进行中";
    case "completed":
      return "已完成";
    case "submitted":
      return "已提交";
    case "error":
      return "出错";
    case "not_booked":
      return "未预约";
    case "pending":
      return "待确认";
    case "confirmed":
      return "已确认";
    case "cancelled":
      return "已取消";
    default:
      return "未知状态";
  }
};

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 美签自动填表卡片组件
const DS160Card = ({ application }: { application: DS160Application }) => {
  return (
    <Card className="w-full border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold">{application.name}</CardTitle>
            <CardDescription className="text-sm text-gray-600 mt-0.5">
              申请ID: {application.applicationId}
            </CardDescription>
          </div>
          <Badge className={`${getStatusBadgeStyle(application.status)} border px-2 py-0.5 text-xs font-medium`}>
            {getStatusText(application.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">完成进度</span>
              <span className="font-medium">{application.progress}%</span>
            </div>
            <Progress value={application.progress} className="h-2" />
          </div>
          
          {application.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-sm text-red-700">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                <span>{application.errorMessage}</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-1.5" />
            <span>最后更新: {formatDate(application.lastUpdated)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex justify-between">
        <Button variant="outline" size="sm" className="text-gray-700">
          <FileText className="h-4 w-4 mr-1.5" />
          查看详情
        </Button>
        {application.status === "in_progress" && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            继续填写
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        )}
        {application.status === "completed" && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700">
            下载表格
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        )}
        {application.status === "error" && (
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
            修正错误
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

// 申根签证预约卡片组件
const SchengenAppointmentCard = ({ appointment, onCheckStatus }: { 
  appointment: SchengenAppointment;
  onCheckStatus?: (bookingId: string) => void;
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "processing":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "confirmed":
      case "success":
        return "bg-green-100 text-green-800 border-green-200"
      case "appointment_success":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "failed":
      case "error":
        return "bg-red-100 text-red-800 border-red-200"
      case "cancelled":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "submitted":
        return "已提交"
      case "processing":
        return "抢号中"
      case "confirmed":
        return "已确认"
      case "failed":
        return "处理失败"
      case "cancelled":
        return "已取消"
      case "success":
        return "提交成功"
      case "appointment_success":
        return "抢号成功"
      case "error":
        return "提交失败"
      default:
        return "未知状态"
    }
  }

  return (
    <Card className="w-full border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold">
              {appointment.tlsAccount?.country || appointment.country} - 签证预约
            </CardTitle>
            <CardDescription className="text-sm text-gray-600 mt-0.5">
              {appointment.tlsAccount?.city || appointment.city} 签证中心
              {appointment.tlsAccount?.username && ` | ${appointment.tlsAccount.username}`}
            </CardDescription>
          </div>
          <Badge className={`${getStatusColor(appointment.status)} border px-2 py-0.5 text-xs font-medium`}>
            {getStatusText(appointment.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {appointment.submittedAt && (
            <div className="flex items-center text-sm">
              <Clock className="h-4 w-4 mr-2 text-gray-600" />
              <span className="text-gray-600">提交时间: {formatDate(appointment.submittedAt)}</span>
            </div>
          )}
          
          {appointment.processedAt && (
            <div className="flex items-center text-sm">
              <CheckCircle2 className="h-4 w-4 mr-2 text-gray-600" />
              <span className="text-gray-600">处理时间: {formatDate(appointment.processedAt)}</span>
            </div>
          )}
          
          {appointment.bookingParams?.dateTimeRanges && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">预约时间范围:</div>
              {appointment.bookingParams.dateTimeRanges.map((range: any, index: number) => (
                <div key={index} className="text-sm text-gray-600 ml-4">
                  {range.startDate} 至 {range.endDate} ({range.startTime}-{range.endTime})
                </div>
              ))}
            </div>
          )}
          
          {appointment.bookingParams?.slotTypes && (
            <div className="flex items-center text-sm">
              <Calendar className="h-4 w-4 mr-2 text-gray-600" />
              <span className="text-gray-600">Slot类型: </span>
              <div className="flex gap-1 ml-1">
                {appointment.bookingParams.slotTypes.map((type: string) => (
                  <span key={type} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                    {type === 'normal' ? '标准' : type === 'prime' ? '黄金时段' : '高级'}
                  </span>
                ))}
              </div>
            </div>
          )}
          
                     {appointment.result && appointment.result.success && appointment.status === "appointment_success" && (
             <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2.5 text-sm text-emerald-700">
               <div className="flex items-start">
                 <CheckCircle2 className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                 <div>
                   <div className="font-medium">抢号成功</div>
                   <div className="text-xs mt-1">{appointment.result.message}</div>
                   {appointment.result.data && (
                     <div className="text-xs mt-1 text-emerald-600">
                       预约时间: {appointment.result.data.appointmentTime || '待确认'}
                     </div>
                   )}
                 </div>
               </div>
             </div>
           )}
           
           {appointment.result && appointment.result.success && appointment.status === "success" && (
             <div className="bg-green-50 border border-green-200 rounded-md p-2.5 text-sm text-green-700">
               <div className="flex items-start">
                 <CheckCircle2 className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                 <div>
                   <div className="font-medium">提交成功</div>
                   <div className="text-xs mt-1">{appointment.result.message}</div>
                   {appointment.result.data && (
                     <div className="text-xs mt-1 text-green-600">
                       状态: {appointment.result.data.status || '已激活'}
                     </div>
                   )}
                 </div>
               </div>
             </div>
           )}
           
           {appointment.result && !appointment.result.success && (
             <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-sm text-red-700">
               <div className="flex items-start">
                 <AlertCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                 <div>
                   <div className="font-medium">抢号失败</div>
                   <div className="text-xs mt-1">{appointment.result.message || appointment.result.error}</div>
                   {appointment.result.details && (
                     <div className="text-xs mt-1 text-red-600">
                       错误详情: {appointment.result.details}
                     </div>
                   )}
                 </div>
               </div>
             </div>
           )}
           
           {appointment.status === "processing" && (
             <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2.5 text-sm text-yellow-700">
               <div className="flex items-start">
                 <RefreshCw className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0 animate-spin" />
                 <div>
                   <div className="font-medium">正在抢号中...</div>
                   <div className="text-xs mt-1">系统正在为您自动抢号，请耐心等待</div>
                 </div>
               </div>
             </div>
           )}
          
          {appointment.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5 text-sm text-red-700">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                <span>{appointment.errorMessage}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
             <CardFooter className="pt-0 flex justify-between">
         <Button variant="outline" size="sm" className="text-gray-700">
           <FileText className="h-4 w-4 mr-1.5" />
           查看详情
         </Button>
         
         {(appointment.status === "processing" || appointment.status === "submitted") && (
           <Button 
             size="sm" 
             className="bg-blue-600 hover:bg-blue-700"
             onClick={() => onCheckStatus?.(appointment.id)}
           >
             <RefreshCw className="h-4 w-4 mr-1.5" />
             检查状态
           </Button>
         )}
         
         {(appointment.status === "confirmed" || appointment.status === "success") && (
           <Button size="sm" className="bg-green-600 hover:bg-green-700">
             <ExternalLink className="h-4 w-4 mr-1.5" />
             查看预约
           </Button>
         )}
         
         {(appointment.status === "failed" || appointment.status === "error") && (
           <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
             重新提交
             <ArrowRight className="h-4 w-4 ml-1.5" />
           </Button>
         )}
       </CardFooter>
    </Card>
  );
};

// 主签证服务组件
export function VisaServicesModule() {
  const [activeTab, setActiveTab] = useState("us-visa");
  const [bookingHistory, setBookingHistory] = useState<SchengenAppointment[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [materialReviewTaskIds, setMaterialReviewTaskIds] = useState<string[]>([]);
  const [materialItineraryTaskIds, setMaterialItineraryTaskIds] = useState<string[]>([]);
  const [materialLetterTaskIds, setMaterialLetterTaskIds] = useState<string[]>([]);

  const materialCustomizationTaskIds = useMemo(() => {
    const ids = new Set<string>();
    materialItineraryTaskIds.forEach((id) => ids.add(id));
    materialLetterTaskIds.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [materialItineraryTaskIds, materialLetterTaskIds]);

  // 获取预约历史
  const loadBookingHistory = useCallback(() => {
    const history = getBookingHistory();
    setBookingHistory(history);
  }, []);

  // 刷新数据
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    loadBookingHistory();
  };

  // 检查特定预约的状态
  const checkBookingStatus = useCallback(async (bookingId: string) => {
    try {
      // 获取当前的预约历史数据
      const currentBookings = getBookingHistory();
      
      // 调用后端API检查实际状态，传递localStorage数据
      const response = await fetch(`/api/schengen/france/book/status/${bookingId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-localstorage-data': JSON.stringify(currentBookings)
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // 只有当状态确实发生变化时才更新
        const currentBooking = currentBookings.find(b => b.id === bookingId);
        if (currentBooking && currentBooking.status !== result.status) {
          // 更新本地状态
          setBookingHistory((prev) => {
            const updatedBookings = prev.map((booking) => {
              if (booking.id === bookingId) {
                return {
                  ...booking,
                  status: result.status,
                  result: result.result,
                  processedAt: result.processedAt || booking.processedAt
                };
              }
              return booking;
            });
            localStorage.setItem('bookingHistory', JSON.stringify(updatedBookings));
            return updatedBookings;
          });
        }
      }
    } catch (error) {
      console.error('检查预约状态失败:', error);
    }
  }, []);

  // 自动刷新处理中的预约
  useEffect(() => {
    const processingBookings = bookingHistory.filter(booking => 
      booking.status === "processing" || booking.status === "submitted"
    );
    
    if (processingBookings.length > 0) {
      const interval = setInterval(() => {
        processingBookings.forEach(booking => {
          checkBookingStatus(booking.id);
        });
      }, 10000); // 每10秒检查一次
      
      return () => clearInterval(interval);
    }
  }, [bookingHistory, checkBookingStatus]);

  // 显示实时状态更新提示
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  
  useEffect(() => {
    const processingCount = bookingHistory.filter(booking => 
      booking.status === "processing" || booking.status === "submitted"
    ).length;
    
    if (processingCount > 0) {
      setShowStatusUpdate(true);
    } else {
      setShowStatusUpdate(false);
    }
  }, [bookingHistory]);

  // 清除预约历史
  const handleClearHistory = () => {
    if (typeof window !== 'undefined' && confirm('确定要清除所有预约历史吗？')) {
      localStorage.removeItem('bookingHistory');
      setBookingHistory([]);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadBookingHistory();
  }, [loadBookingHistory, refreshKey]);

  useEffect(() => {
    const load = () => {
      setMaterialReviewTaskIds(loadStoredTaskIds(MATERIAL_REVIEW_TASK_IDS_KEY));
      setMaterialItineraryTaskIds(loadStoredTaskIds(MATERIAL_ITINERARY_TASK_IDS_KEY));
      setMaterialLetterTaskIds(loadStoredTaskIds(MATERIAL_EXPLANATION_TASK_IDS_KEY));
    };
    load();
    const handleStorage = () => load();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <Card className="w-full bg-white/70 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-800">我的签证服务</CardTitle>
        <CardDescription className="text-gray-600">
          管理您的签证申请、自动填表、预约和监控服务
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-8">
          <Tabs defaultValue="us-tasks">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="us-tasks" className="flex items-center gap-2">
                <Plane className="h-4 w-4" />
                美签任务
              </TabsTrigger>
              <TabsTrigger value="schengen-tasks" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                申根任务
              </TabsTrigger>
              <TabsTrigger value="material-review-tasks" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                材料审核
              </TabsTrigger>
              <TabsTrigger value="material-custom-tasks" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                材料定制
              </TabsTrigger>
            </TabsList>
            <TabsContent value="us-tasks" className="space-y-3">
              <TaskList title="美签任务" pollInterval={4000} />
            </TabsContent>
            <TabsContent value="schengen-tasks" className="space-y-3">
              <FranceTaskList title="申根任务" pollInterval={4000} />
            </TabsContent>
            <TabsContent value="material-review-tasks" className="space-y-3">
              <MaterialTaskList
                title="材料审核任务"
                taskIds={materialReviewTaskIds}
                filterTaskTypes={["material-review"]}
                pollInterval={4000}
              />
            </TabsContent>
            <TabsContent value="material-custom-tasks" className="space-y-3">
              <MaterialTaskList
                title="材料定制任务"
                taskIds={materialCustomizationTaskIds}
                pollInterval={4000}
              />
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}



"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  FileText, 
  DollarSign, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"
import { RecentOrders } from "./components/recent-orders"
import { SystemStatus } from "./components/system-status"

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalApplications: 0,
    totalDocuments: 0,
    activeTasks: 0,
    pendingDocuments: 0,
    failedTasks: 0,
    systemHealth: "healthy",
    userGrowth: 0,
    applicationGrowth: 0,
    documentGrowth: 0,
    taskGrowth: 0,
    serviceStatus: null as null | {
      updatedAt?: string
      database: { status: "healthy" | "warning" | "error"; message: string }
      api: { status: "healthy" | "warning" | "error"; message: string }
      monitor: { status: "healthy" | "warning" | "error"; message: string }
      mail: { status: "healthy" | "warning" | "error"; message: string }
    },
  })

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/admin/dashboard")
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("获取仪表板数据失败:", error)
      setStats({
        totalUsers: 0,
        totalApplications: 0,
        totalDocuments: 0,
        activeTasks: 0,
        pendingDocuments: 0,
        failedTasks: 0,
        systemHealth: "warning",
        userGrowth: 0,
        applicationGrowth: 0,
        documentGrowth: 0,
        taskGrowth: 0,
        serviceStatus: null,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) {
      return <ArrowUpRight className="h-4 w-4 text-green-600" />
    } else {
      return <ArrowDownRight className="h-4 w-4 text-red-600" />
    }
  }

  const getGrowthColor = (growth: number) => {
    if (growth > 0) {
      return "text-green-600"
    } else {
      return "text-red-600"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">管理员仪表板</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            系统概览和关键指标 - {new Date().toLocaleDateString('zh-CN')}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchDashboardData}>
            刷新数据
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <div className="flex items-center space-x-2 mt-2">
              {getGrowthIcon(stats.userGrowth)}
              <p className={`text-xs ${getGrowthColor(stats.userGrowth)}`}>
                +{stats.userGrowth}% 本月
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              活跃用户: {Math.floor(stats.totalUsers * 0.7).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总申请数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalApplications.toLocaleString()}</div>
            <div className="flex items-center space-x-2 mt-2">
              {getGrowthIcon(stats.applicationGrowth)}
              <p className={`text-xs ${getGrowthColor(stats.applicationGrowth)}`}>
                +{stats.applicationGrowth}% 本月
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              本月新增: {Math.floor(stats.totalApplications * 0.15).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">材料总数</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments.toLocaleString()}</div>
            <div className="flex items-center space-x-2 mt-2">
              {getGrowthIcon(stats.documentGrowth)}
              <p className={`text-xs ${getGrowthColor(stats.documentGrowth)}`}>
                +{stats.documentGrowth}% 本月
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              本月新增: {Math.floor(stats.totalDocuments * 0.12).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">进行中任务</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTasks}</div>
            <div className="flex items-center space-x-2 mt-2">
              {getGrowthIcon(stats.taskGrowth)}
              <p className={`text-xs ${getGrowthColor(stats.taskGrowth)}`}>
                {stats.taskGrowth > 0 ? '+' : ''}{stats.taskGrowth}% 本月
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              失败任务: {stats.failedTasks}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 系统状态和待处理事项 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 系统状态 */}
        <Card className="lg:col-span-1 hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              系统状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SystemStatus health={stats.systemHealth as "healthy" | "warning" | "error"} services={stats.serviceStatus ?? undefined} />
          </CardContent>
        </Card>

        {/* 待处理事项 */}
        <Card className="lg:col-span-2 hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              待处理事项
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">失败任务</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.failedTasks} 个任务失败
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{stats.failedTasks}</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">待审核文档</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.pendingDocuments} 个文档等待审核
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{stats.pendingDocuments}</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">
                      {stats.systemHealth === "healthy" ? "系统运行正常" : "系统存在告警"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.systemHealth === "healthy" ? "未检测到失败任务" : "存在失败任务，请关注"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={stats.systemHealth === "healthy" ? "text-green-600" : "text-yellow-600"}
                >
                  {stats.systemHealth === "healthy" ? "正常" : "告警"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近任务 */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            最近任务
          </CardTitle>
          <CardDescription>
            最近处理的签证相关任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentOrders />
        </CardContent>
      </Card>
    </div>
  )
}

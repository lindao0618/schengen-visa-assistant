"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, 
  Database, 
  Server, 
  Globe, 
  Mail, 
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown
} from "lucide-react"

interface ServiceStatus {
  name: string
  status: "healthy" | "warning" | "error"
  uptime: number
  responseTime: number
  lastCheck: string
  description: string
  icon: any
}

export default function AdminMonitorClientPage() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    fetchSystemStatus()
  }, [])

  const fetchSystemStatus = async () => {
    try {
      // 模拟数据，实际应该从API获取
      const mockServices: ServiceStatus[] = [
        {
          name: "数据库服务",
          status: "healthy",
          uptime: 99.9,
          responseTime: 45,
          lastCheck: new Date().toISOString(),
          description: "PostgreSQL数据库连接正常",
          icon: Database
        },
        {
          name: "API服务",
          status: "healthy",
          uptime: 99.8,
          responseTime: 120,
          lastCheck: new Date().toISOString(),
          description: "REST API服务运行正常",
          icon: Server
        },
        {
          name: "Web服务",
          status: "healthy",
          uptime: 99.9,
          responseTime: 85,
          lastCheck: new Date().toISOString(),
          description: "Next.js应用服务正常",
          icon: Globe
        },
        {
          name: "邮件服务",
          status: "warning",
          uptime: 98.5,
          responseTime: 250,
          lastCheck: new Date().toISOString(),
          description: "邮件发送延迟较高",
          icon: Mail
        },
        {
          name: "监控服务",
          status: "healthy",
          uptime: 99.7,
          responseTime: 60,
          lastCheck: new Date().toISOString(),
          description: "系统监控服务正常",
          icon: Activity
        },
        {
          name: "安全服务",
          status: "healthy",
          uptime: 100,
          responseTime: 30,
          lastCheck: new Date().toISOString(),
          description: "安全防护系统正常",
          icon: Shield
        }
      ]
      
      setServices(mockServices)
      setLastUpdate(new Date())
    } catch (error) {
      console.error("获取系统状态失败:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge variant="outline" className="text-green-600 border-green-600">正常</Badge>
      case "warning":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">警告</Badge>
      case "error":
        return <Badge variant="outline" className="text-red-600 border-red-600">错误</Badge>
      default:
        return <Badge variant="secondary">未知</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99.9) return "text-green-600"
    if (uptime >= 99.0) return "text-yellow-600"
    return "text-red-600"
  }

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime <= 100) return "text-green-600"
    if (responseTime <= 300) return "text-yellow-600"
    return "text-red-600"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const healthyServices = services.filter(s => s.status === "healthy").length
  const totalServices = services.length
  const overallHealth = (healthyServices / totalServices) * 100

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">系统监控</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            实时监控系统各项服务状态
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            最后更新: {formatDate(lastUpdate.toISOString())}
          </div>
          <Button onClick={fetchSystemStatus} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新状态
          </Button>
        </div>
      </div>

      {/* 整体状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">整体健康度</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallHealth.toFixed(1)}%</div>
            <Progress value={overallHealth} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {healthyServices}/{totalServices} 个服务正常
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(services.reduce((sum, s) => sum + s.responseTime, 0) / services.length)}ms
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <p className="text-xs text-green-600">-5% 较昨日</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均可用性</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {services.reduce((sum, s) => sum + s.uptime, 0) / services.length}%
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-xs text-green-600">+0.1% 较昨日</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">异常服务</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {services.filter(s => s.status !== "healthy").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              需要关注的服务
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 服务状态详情 */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            服务状态详情
          </CardTitle>
          <CardDescription>
            各服务的详细运行状态和性能指标
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => {
              const Icon = service.icon
              return (
                <div
                  key={service.name}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <h3 className="font-medium">{service.name}</h3>
                    </div>
                    {getStatusIcon(service.status)}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">状态:</span>
                      {getStatusBadge(service.status)}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">可用性:</span>
                      <span className={`text-sm font-medium ${getUptimeColor(service.uptime)}`}>
                        {service.uptime}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">响应时间:</span>
                      <span className={`text-sm font-medium ${getResponseTimeColor(service.responseTime)}`}>
                        {service.responseTime}ms
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2">
                      {service.description}
                    </div>
                    
                    <div className="text-xs text-gray-400 mt-1">
                      最后检查: {formatDate(service.lastCheck)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 系统日志 */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            最近系统日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { time: "2024-01-16 14:30:25", level: "info", message: "数据库连接池已优化，响应时间提升15%" },
              { time: "2024-01-16 14:28:10", level: "warning", message: "邮件服务响应时间超过阈值，当前250ms" },
              { time: "2024-01-16 14:25:45", level: "info", message: "系统自动备份完成，备份大小: 2.3GB" },
              { time: "2024-01-16 14:22:30", level: "info", message: "API服务重启完成，服务恢复正常" },
              { time: "2024-01-16 14:20:15", level: "error", message: "检测到异常登录尝试，已自动阻止" }
            ].map((log, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  log.level === 'error' ? 'bg-red-500' :
                  log.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{log.message}</span>
                    <span className="text-xs text-gray-500">{log.time}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    级别: {log.level.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}











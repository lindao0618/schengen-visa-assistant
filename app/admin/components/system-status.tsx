import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react"

type ServiceLevel = "healthy" | "warning" | "error"

interface ServiceStatusItem {
  status: ServiceLevel
  message: string
}

interface SystemStatusProps {
  health: ServiceLevel
  services?: {
    database: ServiceStatusItem
    api: ServiceStatusItem
    monitor: ServiceStatusItem
    mail: ServiceStatusItem
    updatedAt?: string
  }
}

export function SystemStatus({ health, services }: SystemStatusProps) {
  const getStatusInfo = (health: string) => {
    switch (health) {
      case "healthy":
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          text: "系统正常",
          description: "所有服务运行正常"
        }
      case "warning":
        return {
          icon: AlertTriangle,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
          text: "系统警告",
          description: "部分服务出现异常"
        }
      case "error":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-50 dark:bg-red-900/20",
          text: "系统错误",
          description: "关键服务不可用"
        }
      default:
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          text: "系统正常",
          description: "所有服务运行正常"
        }
    }
  }

  const statusInfo = getStatusInfo(health)
  const Icon = statusInfo.icon

  const statusBadge = (item?: ServiceStatusItem) => {
    if (!item) return <Badge variant="secondary">未检测</Badge>
    if (item.status === "healthy") return <Badge variant="outline" className="text-green-600">正常</Badge>
    if (item.status === "warning") return <Badge variant="secondary">告警</Badge>
    return <Badge variant="destructive">异常</Badge>
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-3 p-3 rounded-lg ${statusInfo.bgColor}`}>
        <Icon className={`h-5 w-5 ${statusInfo.color}`} />
        <div>
          <p className="font-medium">{statusInfo.text}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {statusInfo.description}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">数据库</span>
          {statusBadge(services?.database)}
        </div>
        {services?.database?.message && (
          <p className="text-xs text-muted-foreground">{services.database.message}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">API服务</span>
          {statusBadge(services?.api)}
        </div>
        {services?.api?.message && (
          <p className="text-xs text-muted-foreground">{services.api.message}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">监控服务</span>
          {statusBadge(services?.monitor)}
        </div>
        {services?.monitor?.message && (
          <p className="text-xs text-muted-foreground">{services.monitor.message}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">邮件服务</span>
          {statusBadge(services?.mail)}
        </div>
        {services?.mail?.message && (
          <p className="text-xs text-muted-foreground">{services.mail.message}</p>
        )}
      </div>

      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          最后更新: {services?.updatedAt ? new Date(services.updatedAt).toLocaleString("zh-CN") : new Date().toLocaleString("zh-CN")}
        </p>
      </div>
    </div>
  )
}











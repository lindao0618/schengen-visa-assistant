import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getAdminSession, adminForbiddenResponse } from "@/lib/admin-auth"
import { listAllMaterialTasks } from "@/lib/material-tasks"
import { isPublicUiPreviewEnabled } from "@/lib/public-ui-preview"
import { getPublicUiPreviewAdminData } from "@/lib/public-ui-preview-admin-data"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    if (isPublicUiPreviewEnabled()) {
      return NextResponse.json(getPublicUiPreviewAdminData("dashboard"))
    }

    // 验证管理员权限
    const session = await getAdminSession()
    if (!session) return adminForbiddenResponse()

    const now = new Date()
    const currentStart = new Date(now)
    currentStart.setDate(now.getDate() - 30)
    const prevStart = new Date(now)
    prevStart.setDate(now.getDate() - 60)

    const [
      totalUsers,
      totalApplications,
      totalDocuments,
      usersCurrent,
      usersPrev,
      appsCurrent,
      appsPrev,
      docsCurrent,
      docsPrev,
      pendingDocuments,
      activeUsTasks,
      activeFrTasks,
      failedUsTasks,
      failedFrTasks,
      usTasksCurrent,
      usTasksPrev,
      frTasksCurrent,
      frTasksPrev,
      dbOk,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.application.count(),
      prisma.document.count(),
      prisma.user.count({ where: { createdAt: { gte: currentStart } } }),
      prisma.user.count({ where: { createdAt: { gte: prevStart, lt: currentStart } } }),
      prisma.application.count({ where: { createdAt: { gte: currentStart } } }),
      prisma.application.count({ where: { createdAt: { gte: prevStart, lt: currentStart } } }),
      prisma.document.count({ where: { createdAt: { gte: currentStart } } }),
      prisma.document.count({ where: { createdAt: { gte: prevStart, lt: currentStart } } }),
      prisma.document.count({ where: { status: { in: ["pending", "processing"] } } }),
      prisma.usVisaTask.count({ where: { status: { in: ["pending", "running"] } } }),
      prisma.frenchVisaTask.count({ where: { status: { in: ["pending", "running"] } } }),
      prisma.usVisaTask.count({ where: { status: "failed" } }),
      prisma.frenchVisaTask.count({ where: { status: "failed" } }),
      prisma.usVisaTask.count({ where: { createdAt: { gte: currentStart } } }),
      prisma.usVisaTask.count({ where: { createdAt: { gte: prevStart, lt: currentStart } } }),
      prisma.frenchVisaTask.count({ where: { createdAt: { gte: currentStart } } }),
      prisma.frenchVisaTask.count({ where: { createdAt: { gte: prevStart, lt: currentStart } } }),
      prisma.$queryRaw`SELECT 1`,
    ])

    const materialTasks = await listAllMaterialTasks()
    const activeMaterialTasks = materialTasks.filter((t) =>
      t.status === "pending" || t.status === "running"
    ).length
    const failedMaterialTasks = materialTasks.filter((t) => t.status === "failed").length
    const materialTasksCurrent = materialTasks.filter(
      (t) => t.created_at >= currentStart.getTime()
    ).length
    const materialTasksPrev = materialTasks.filter(
      (t) => t.created_at >= prevStart.getTime() && t.created_at < currentStart.getTime()
    ).length

    const totalTasks = activeUsTasks + activeFrTasks + activeMaterialTasks
    const failedTasks = failedUsTasks + failedFrTasks + failedMaterialTasks

    const calcGrowth = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0
      return Number((((current - prev) / prev) * 100).toFixed(1))
    }

    const monitorStatus =
      activeUsTasks + activeFrTasks + activeMaterialTasks > 0 ? "healthy" : "warning"
    const mailConfigured = !!(
      process.env.SMTP_HOST ||
      process.env.EMAIL_HOST ||
      process.env.MAIL_HOST ||
      process.env.SENDGRID_API_KEY ||
      process.env.RESEND_API_KEY
    )

    const stats = {
      totalUsers,
      totalApplications,
      totalDocuments,
      activeTasks: totalTasks,
      pendingDocuments,
      failedTasks,
      systemHealth: failedTasks > 0 ? "warning" : "healthy",
      userGrowth: calcGrowth(usersCurrent, usersPrev),
      applicationGrowth: calcGrowth(appsCurrent, appsPrev),
      documentGrowth: calcGrowth(docsCurrent, docsPrev),
      taskGrowth: calcGrowth(
        usTasksCurrent + frTasksCurrent + materialTasksCurrent,
        usTasksPrev + frTasksPrev + materialTasksPrev
      ),
      serviceStatus: {
        updatedAt: now.toISOString(),
        database: {
          status: dbOk ? "healthy" : "error",
          message: dbOk ? "连接正常" : "连接失败",
        },
        api: {
          status: "healthy",
          message: "接口可用",
        },
        monitor: {
          status: monitorStatus,
          message: monitorStatus === "healthy" ? "监控运行中" : "暂无运行任务",
        },
        mail: {
          status: mailConfigured ? "healthy" : "warning",
          message: mailConfigured ? "已配置" : "未配置邮件服务",
        },
      },
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error("获取仪表板数据失败:", error)

    return NextResponse.json({
      success: false,
      message: "获取数据失败",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}









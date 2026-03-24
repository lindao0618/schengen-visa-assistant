import { NextRequest, NextResponse } from "next/server"

// TLS监控器API配置
const TLS_MONITOR_CONFIG = {
  baseUrl: process.env.TLS_MONITOR_URL || "http://localhost:8004",
  timeout: 5000
}

export async function GET(request: NextRequest) {
  try {
    // 检查TLS监控服务状态
    const response = await fetch(`${TLS_MONITOR_CONFIG.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(TLS_MONITOR_CONFIG.timeout)
    })
    
    if (response.ok) {
      const status = await response.json()
      return NextResponse.json({
        success: true,
        status: "running",
        message: "TLS监控服务运行正常",
        details: status
      })
    } else {
      return NextResponse.json({
        success: false,
        status: "stopped",
        message: "TLS监控服务未运行",
        error: `HTTP ${response.status}`
      })
    }
    
  } catch (error) {
    console.error("检查监控状态失败:", error)
    
    // 检查是否是网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json({
        success: false,
        status: "unavailable",
        message: "无法连接到TLS监控服务",
        error: "Network error"
      })
    }
    
    return NextResponse.json({
      success: false,
      status: "error",
      message: "检查监控状态时出错",
      error: error instanceof Error ? error.message : "Unknown error"
    })
  }
} 
import { NextRequest, NextResponse } from "next/server"

// TLS监控器API配置
const TLS_MONITOR_CONFIG = {
  baseUrl: process.env.TLS_MONITOR_URL || "http://localhost:8004",
  timeout: 5000
}

export async function GET(request: NextRequest) {
  try {
    // 获取TLS监控stats数据
    const response = await fetch(`${TLS_MONITOR_CONFIG.baseUrl}/stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(TLS_MONITOR_CONFIG.timeout)
    })
    
    if (response.ok) {
      const statsData = await response.json()
      return NextResponse.json({
        title: "TLS Slot Monitor Dashboard",
        status: "running",
        stats: statsData,
        config: {
          monitored_countries: ["fr"],
          websocket_url: "wss://tls.vis.lol/api/slots",
          api_port: 8004
        },
        timestamp: new Date().toISOString()
      })
    } else {
      return NextResponse.json({
        error: "Failed to fetch dashboard data",
        message: "无法获取监控面板数据"
      }, { status: response.status })
    }
    
  } catch (error) {
    console.error("获取监控面板数据失败:", error)
    
    return NextResponse.json({
      error: "Service unavailable",
      message: "监控服务不可用"
    }, { status: 503 })
  }
}

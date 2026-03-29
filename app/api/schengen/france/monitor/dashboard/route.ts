import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const TLS_MONITOR_CONFIG = {
  baseUrl: process.env.TLS_MONITOR_URL || "http://localhost:8004",
  timeout: 5000,
}

export async function GET() {
  try {
    const response = await fetch(`${TLS_MONITOR_CONFIG.baseUrl}/stats`, {
      method: "GET",
      signal: AbortSignal.timeout(TLS_MONITOR_CONFIG.timeout),
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch dashboard data",
          message: "无法获取监控面板数据",
        },
        { status: response.status }
      )
    }

    const statsData = await response.json()
    return NextResponse.json({
      title: "TLS Slot Monitor Dashboard",
      status: "running",
      stats: statsData,
      config: {
        monitored_countries: ["fr"],
        websocket_url: "wss://tls.vis.lol/api/slots",
        api_port: 8004,
      },
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      {
        error: "Service unavailable",
        message: "监控服务暂不可用，请先启动 TLS 监控服务后再查看面板。",
      },
      { status: 503 }
    )
  }
}

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const TLS_MONITOR_CONFIG = {
  baseUrl: process.env.TLS_MONITOR_URL || "http://localhost:8004",
  timeout: 5000,
}

export async function GET() {
  try {
    const response = await fetch(`${TLS_MONITOR_CONFIG.baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(TLS_MONITOR_CONFIG.timeout),
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        status: "stopped",
        message: "TLS 监控服务未运行",
        error: `HTTP ${response.status}`,
      })
    }

    const status = await response.json()
    return NextResponse.json({
      success: true,
      status: "running",
      message: "TLS 监控服务运行正常",
      details: status,
    })
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json({
        success: false,
        status: "unavailable",
        message: "无法连接到 TLS 监控服务",
        error: "Network error",
      })
    }

    return NextResponse.json({
      success: false,
      status: "error",
      message: "检查 TLS 监控状态时出错",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

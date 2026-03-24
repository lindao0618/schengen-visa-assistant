import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "法国签证API测试成功",
    timestamp: new Date().toISOString(),
    endpoints: {
      application: "/api/schengen/france/application",
      monitor: "/api/schengen/france/monitor",
      checklist: "/api/schengen/france/checklist"
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return NextResponse.json({
      success: true,
      message: "测试数据接收成功",
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Invalid JSON data",
      message: "接收到的数据格式错误"
    }, { status: 400 })
  }
} 
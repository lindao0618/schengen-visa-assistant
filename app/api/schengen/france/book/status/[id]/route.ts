import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id
    
    // 从请求头中获取localStorage数据（前端会传递）
    const localStorageData = request.headers.get('x-localstorage-data')
    
    if (localStorageData) {
      try {
        const bookings = JSON.parse(localStorageData)
        const booking = bookings.find((b: any) => b.id === bookingId)
        
        if (booking) {
          // 返回实际的预约状态
          return NextResponse.json({
            success: true,
            bookingId,
            status: booking.status,
            result: booking.result,
            processedAt: booking.processedAt
          })
        }
      } catch (e) {
        console.error('解析localStorage数据失败:', e)
      }
    }
    
    // 如果没有找到预约或解析失败，返回默认状态
    return NextResponse.json({
      success: true,
      bookingId,
      status: "submitted",
      result: {
        success: true,
        message: "提交成功，正在处理中..."
      }
    })
    
  } catch (error) {
    console.error('检查预约状态失败:', error)
    return NextResponse.json({
      success: false,
      message: "检查预约状态失败",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

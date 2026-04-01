import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listHotelBookingTasks } from "@/lib/hotel-booking-tasks"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10))
    const status = searchParams.get("status") || undefined

    const tasks = await listHotelBookingTasks(session.user.id, limit, status)
    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    )
  }
}

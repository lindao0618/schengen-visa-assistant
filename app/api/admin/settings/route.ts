import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getAdminSession, adminForbiddenResponse } from "@/lib/admin-auth"

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (key) {
      const setting = await prisma.adminSetting.findUnique({ where: { key } })
      return NextResponse.json({ success: true, setting })
    }

    const settings = await prisma.adminSetting.findMany({ orderBy: { updatedAt: "desc" } })
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("获取设置失败:", error)
    return NextResponse.json({ success: false, message: "获取设置失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const body = await request.json()
    const key = body?.key as string | undefined
    const valueJson = body?.valueJson

    if (!key) {
      return NextResponse.json({ success: false, message: "缺少 key" }, { status: 400 })
    }

    const setting = await prisma.adminSetting.upsert({
      where: { key },
      create: { key, valueJson },
      update: { valueJson },
    })

    return NextResponse.json({ success: true, setting })
  } catch (error) {
    console.error("更新设置失败:", error)
    return NextResponse.json({ success: false, message: "更新设置失败" }, { status: 500 })
  }
}

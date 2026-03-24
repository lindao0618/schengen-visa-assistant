import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getAdminSession, adminForbiddenResponse } from "@/lib/admin-auth"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const blocks = await prisma.contentBlock.findMany({ orderBy: { updatedAt: "desc" } })
    return NextResponse.json({ success: true, blocks })
  } catch (error) {
    console.error("获取内容失败:", error)
    return NextResponse.json({ success: false, message: "获取内容失败" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const body = await request.json()
    const key = body?.key as string | undefined
    const title = body?.title as string | undefined
    const content = body?.content as string | undefined

    if (!key || !title || !content) {
      return NextResponse.json({ success: false, message: "缺少必要字段" }, { status: 400 })
    }

    const block = await prisma.contentBlock.upsert({
      where: { key },
      create: { key, title, content },
      update: { title, content },
    })

    return NextResponse.json({ success: true, block })
  } catch (error) {
    console.error("更新内容失败:", error)
    return NextResponse.json({ success: false, message: "更新内容失败" }, { status: 500 })
  }
}

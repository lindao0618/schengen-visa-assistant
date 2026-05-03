import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getAdminSession, adminForbiddenResponse } from "@/lib/admin-auth"
import { isPublicUiPreviewEnabled } from "@/lib/public-ui-preview"
import { getPublicUiPreviewAdminData } from "@/lib/public-ui-preview-admin-data"

export async function GET(request: NextRequest) {
  if (isPublicUiPreviewEnabled()) {
    return NextResponse.json(getPublicUiPreviewAdminData("documents"))
  }

  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim() || ""
    const status = searchParams.get("status") || "all"
    const type = searchParams.get("type") || "all"
    const userId = searchParams.get("userId") || ""
    const page = Number(searchParams.get("page") || "1")
    const pageSize = Math.min(Number(searchParams.get("pageSize") || "50"), 200)

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: "insensitive" } },
        { type: { contains: search, mode: "insensitive" } },
      ]
    }
    if (status !== "all") where.status = status
    if (type !== "all") where.type = type
    if (userId) where.userId = userId

    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          filename: true,
          fileUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, name: true } },
          application: { select: { id: true, visaType: true, country: true, status: true } },
          _count: { select: { reviews: true } },
        },
      }),
    ])

    return NextResponse.json({ success: true, total, documents })
  } catch (error) {
    console.error("获取材料列表失败:", error)
    return NextResponse.json(
      { success: false, message: "获取材料列表失败" },
      { status: 500 }
    )
  }
}

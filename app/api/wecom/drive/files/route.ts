import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { getWecomDriveRootById, getWecomDriveStatus, listWecomDriveFiles } from "@/lib/wecom-drive"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = getWecomDriveStatus()
  if (!status.configured) {
    return NextResponse.json(
      {
        error: `Missing WeCom drive config: ${status.missing.join(", ")}`,
        configured: false,
        missing: status.missing,
      },
      { status: 503 },
    )
  }

  const rootId = request.nextUrl.searchParams.get("rootId")?.trim() || ""
  if (!rootId) {
    return NextResponse.json({ error: "rootId is required" }, { status: 400 })
  }

  const root = getWecomDriveRootById(rootId)
  if (!root) {
    return NextResponse.json({ error: "Unknown WeCom drive root" }, { status: 404 })
  }

  const fatherId = request.nextUrl.searchParams.get("fatherId")?.trim() || root.fatherId
  const start = Number(request.nextUrl.searchParams.get("start") || "0")
  const limit = Number(request.nextUrl.searchParams.get("limit") || "100")

  try {
    const result = await listWecomDriveFiles({
      spaceId: root.spaceId,
      fatherId,
      start: Number.isFinite(start) ? start : 0,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 100,
    })

    return NextResponse.json({
      configured: true,
      root,
      fatherId,
      items: result.items,
      hasMore: result.hasMore,
      nextStart: result.nextStart,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list WeCom drive files",
      },
      { status: 500 },
    )
  }
}

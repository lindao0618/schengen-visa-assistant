import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { canAccessMaterialReviewResult } from "@/lib/task-route-access"

const MATERIAL_REVIEW_URL =
  process.env.MATERIAL_REVIEW_URL || "http://localhost:8004"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "璇峰厛鐧诲綍" }, { status: 401 })
    }

    const { filename } = await params
    if (!filename) {
      return NextResponse.json({ error: "缂哄皯鏂囦欢鍚?" }, { status: 400 })
    }

    const canAccess = await canAccessMaterialReviewResult(session.user.id, filename)
    if (!canAccess) {
      return NextResponse.json({ error: "鏂囦欢涓嶅瓨鍦ㄦ垨鏃犳潈璁块棶" }, { status: 404 })
    }

    const res = await fetch(
      `${MATERIAL_REVIEW_URL}/download-ocr-result/${encodeURIComponent(filename)}`
    )
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 404 ? "鏂囦欢涓嶅瓨鍦ㄦ垨宸茶繃鏈?" : "涓嬭浇澶辫触" },
        { status: res.status }
      )
    }

    const blob = await res.blob()
    const contentType =
      res.headers.get("content-type") ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Material review download error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    const isConn = msg.includes("ECONNREFUSED") || msg.includes("fetch failed")
    return NextResponse.json(
      {
        error: isConn ? "鏉愭枡瀹℃牳鏈嶅姟鏈惎鍔?" : "涓嬭浇澶辫触",
      },
      { status: 500 }
    )
  }
}

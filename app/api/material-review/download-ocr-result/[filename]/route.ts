import { NextRequest, NextResponse } from "next/server"

const MATERIAL_REVIEW_URL =
  process.env.MATERIAL_REVIEW_URL || "http://localhost:8004"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    if (!filename) {
      return NextResponse.json({ error: "缺少文件名" }, { status: 400 })
    }
    const res = await fetch(
      `${MATERIAL_REVIEW_URL}/download-ocr-result/${encodeURIComponent(filename)}`
    )
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 404 ? "文件不存在或已过期" : "下载失败" },
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
        error: isConn ? "材料审核服务未启动" : "下载失败",
      },
      { status: 500 }
    )
  }
}

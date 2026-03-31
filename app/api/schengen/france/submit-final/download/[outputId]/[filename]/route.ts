import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { canAccessFrenchVisaTaskOutput, sanitizeDownloadFilename } from "@/lib/task-route-access"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ outputId: string; filename: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const { outputId, filename } = await params
    if (!outputId || !filename) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    const canAccess = await canAccessFrenchVisaTaskOutput(session.user.id, outputId, "fv-submit-")
    if (!canAccess) {
      return NextResponse.json({ error: "文件不存在或无权访问" }, { status: 404 })
    }

    const safeName = sanitizeDownloadFilename(filename)
    const filePath = path.join(process.cwd(), "temp", "french-visa-submit-final", outputId, safeName)
    await fs.access(filePath)
    const buf = await fs.readFile(filePath)
    const isPdf = safeName.toLowerCase().endsWith(".pdf")
    const contentType = isPdf ? "application/pdf" : "application/octet-stream"
    const encodedName = encodeURIComponent(safeName)

    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
      },
    })
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    console.error("法签提交最终表下载失败:", e)
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

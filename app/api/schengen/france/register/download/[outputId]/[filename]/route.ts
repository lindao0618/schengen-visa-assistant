import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { canAccessFrenchVisaTaskOutput, sanitizeDownloadFilename } from "@/lib/task-route-access"

function contentDisposition(safeName: string): string {
  const asciiSafe = /^[\x20-\x7E]*$/.test(safeName)
  if (asciiSafe) {
    return `attachment; filename="${safeName}"`
  }
  const encoded = encodeURIComponent(safeName)
  const fallback = "download" + path.extname(safeName)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ outputId: string; filename: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const { outputId, filename: rawFilename } = await params
    if (!outputId || !rawFilename) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    const canAccess = await canAccessFrenchVisaTaskOutput(session.user.id, outputId, "fv-register-")
    if (!canAccess) {
      return NextResponse.json({ error: "文件不存在或无权访问" }, { status: 404 })
    }

    const safeName = sanitizeDownloadFilename(rawFilename)
    const filePath = path.join(process.cwd(), "temp", "french-visa-register", outputId, safeName)
    await fs.access(filePath)
    const buf = await fs.readFile(filePath)
    const contentType = safeName.endsWith(".log")
      ? "text/plain; charset=utf-8"
      : "application/octet-stream"

    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition(safeName),
      },
    })
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    console.error("法签注册日志下载失败:", e)
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

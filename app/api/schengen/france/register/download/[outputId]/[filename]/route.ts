import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import path from "path"
import fs from "fs/promises"

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
  { params }: { params: Promise<{ outputId: string; filename: string }> }
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
    let filename: string
    try {
      filename = decodeURIComponent(rawFilename)
    } catch {
      filename = rawFilename
    }
    const safeName = path.basename(filename).replace(/\.\./g, "")
    const filePath = path.join(
      process.cwd(),
      "temp",
      "french-visa-register",
      outputId,
      safeName
    )
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

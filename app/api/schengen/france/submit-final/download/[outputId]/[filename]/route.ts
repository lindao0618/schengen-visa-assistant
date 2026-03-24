import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import path from "path"
import fs from "fs/promises"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ outputId: string; filename: string }> }
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
    const decodedName = (() => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    })()
    const safeName = path.basename(decodedName)
    const filePath = path.join(process.cwd(), "temp", "french-visa-submit-final", outputId, safeName)
    await fs.access(filePath)
    const buf = await fs.readFile(filePath)
    const contentType = safeName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream"
    // HTTP 头必须为 Latin-1，中文需用 RFC 5987 的 filename*=UTF-8''...
    const rfc5987 = encodeURIComponent(safeName)
    const contentDisp = `attachment; filename="download.pdf"; filename*=UTF-8''${rfc5987}`
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisp,
      },
    })
  } catch (e) {
    console.error("[submit-final-download] 错误:", e)
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

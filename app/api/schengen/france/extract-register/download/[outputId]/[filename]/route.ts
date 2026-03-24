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

function getContentType(safeName: string) {
  if (safeName.endsWith(".json")) return "application/json"
  if (safeName.endsWith(".log")) return "text/plain; charset=utf-8"
  if (safeName.endsWith(".xlsx") || safeName.endsWith(".xls")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
  return "application/octet-stream"
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
    const filePath = path.join(process.cwd(), "temp", "french-visa-extract-register", outputId, safeName)
    await fs.access(filePath)
    const buf = await fs.readFile(filePath)
    return new NextResponse(buf, {
      headers: {
        "Content-Type": getContentType(safeName),
        "Content-Disposition": contentDisposition(safeName),
      },
    })
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    console.error("法签提取并注册下载失败:", e)
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

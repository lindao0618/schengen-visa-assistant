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
    let decoded = filename
    try {
      decoded = decodeURIComponent(filename)
    } catch {
      // 非标准编码时使用原值
    }
    const safeName = path.basename(decoded).replace(/\.\./g, "")
    const dirPath = path.join(process.cwd(), "temp", "french-visa-fill-receipt", outputId)
    let filePath = path.join(dirPath, safeName)

    try {
      await fs.access(filePath)
    } catch {
      // 按文件名找不到时（如 receipt.pdf 或中文名编码问题），在目录内查找任意 .pdf 作为回退
      const files = await fs.readdir(dirPath).catch(() => [])
      const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"))
      if (pdfFile) {
        filePath = path.join(dirPath, pdfFile)
      } else {
        throw new Error("ENOENT")
      }
    }

    const buf = await fs.readFile(filePath)
    const finalName = path.basename(filePath)
    const contentType = finalName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"
    const rfc5987 = encodeURIComponent(finalName)
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="receipt.pdf"; filename*=UTF-8''${rfc5987}`,
      },
    })
  } catch (e) {
    if ((e as Error)?.message === "ENOENT" || (e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    console.error("[fill-receipt download]", e)
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

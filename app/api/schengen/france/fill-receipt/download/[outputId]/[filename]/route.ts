import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { canAccessFrenchVisaTaskOutput, sanitizeDownloadFilename } from "@/lib/task-route-access"

function getContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === ".pdf") return "application/pdf"
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".html") return "text/html; charset=utf-8"
  if (ext === ".json") return "application/json; charset=utf-8"
  if (ext === ".log" || ext === ".txt") return "text/plain; charset=utf-8"
  return "application/octet-stream"
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

    const { outputId, filename } = await params
    if (!outputId || !filename) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    const canAccess = await canAccessFrenchVisaTaskOutput(session.user.id, outputId, "fv-receipt-")
    if (!canAccess) {
      return NextResponse.json({ error: "文件不存在或无权访问" }, { status: 404 })
    }

    const safeName = sanitizeDownloadFilename(filename)
    const dirPath = path.join(process.cwd(), "temp", "french-visa-fill-receipt", outputId)
    let filePath = path.join(dirPath, safeName)

    try {
      await fs.access(filePath)
    } catch {
      if (safeName.toLowerCase().endsWith(".pdf")) {
        const files = await fs.readdir(dirPath).catch(() => [])
        const pdfFile = files.find((file) => file.toLowerCase().endsWith(".pdf"))
        if (pdfFile) {
          filePath = path.join(dirPath, pdfFile)
        } else {
          throw new Error("ENOENT")
        }
      } else {
        throw new Error("ENOENT")
      }
    }

    const buffer = await fs.readFile(filePath)
    const finalName = path.basename(filePath)
    const contentType = getContentType(finalName)
    const rfc5987 = encodeURIComponent(finalName)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${finalName}"; filename*=UTF-8''${rfc5987}`,
      },
    })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err?.message === "ENOENT" || err?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    console.error("[fill-receipt download]", error)
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

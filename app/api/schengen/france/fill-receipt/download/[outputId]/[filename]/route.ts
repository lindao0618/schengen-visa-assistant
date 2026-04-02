import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { canAccessFrenchVisaTaskOutput, sanitizeDownloadFilename } from "@/lib/task-route-access"

function contentDisposition(safeName: string): string {
  const asciiSafe = /^[\x20-\x7E]*$/.test(safeName)
  if (asciiSafe) return `attachment; filename="${safeName}"`
  const encoded = encodeURIComponent(safeName)
  const fallback = "download" + path.extname(safeName)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

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

async function resolveFilePath(outputId: string, safeName: string) {
  const baseDir = path.join(process.cwd(), "temp", "french-visa-fill-receipt", outputId)
  const rootFile = path.join(baseDir, safeName)
  try {
    await fs.access(rootFile)
    return rootFile
  } catch {
    const artifactFile = path.join(baseDir, "artifacts", safeName)
    await fs.access(artifactFile)
    return artifactFile
  }
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
    let filePath: string
    try {
      filePath = await resolveFilePath(outputId, safeName)
    } catch {
      if (!safeName.toLowerCase().endsWith(".pdf")) {
        throw new Error("ENOENT")
      }
      const files = await fs.readdir(dirPath).catch(() => [])
      const pdfFile = files.find((file) => file.toLowerCase().endsWith(".pdf"))
      if (!pdfFile) {
        throw new Error("ENOENT")
      }
      filePath = path.join(dirPath, pdfFile)
    }

    const buffer = await fs.readFile(filePath)
    const finalName = path.basename(filePath)
    const contentType = getContentType(finalName)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition(finalName),
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

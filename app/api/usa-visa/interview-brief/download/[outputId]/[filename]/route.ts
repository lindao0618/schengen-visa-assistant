import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { canAccessOutputDirectoryByMetadata, sanitizeDownloadFilename } from "@/lib/task-route-access"

function getContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (ext === ".pdf") return "application/pdf"
  if (ext === ".json") return "application/json; charset=utf-8"
  return "application/octet-stream"
}

function contentDisposition(filename: string, mode: "attachment" | "inline" = "attachment") {
  const asciiSafe = /^[\x20-\x7E]+$/.test(filename)
  if (asciiSafe) {
    return `${mode}; filename="${filename.replace(/"/g, "")}"`
  }

  const ext = path.extname(filename)
  const fallbackBase = path.basename(filename, ext).replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "")
  const fallback = `${fallbackBase || "download"}${ext}`
  const encoded = encodeURIComponent(filename)
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ outputId: string; filename: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "璇峰厛鐧诲綍" }, { status: 401 })
    }

    const { outputId, filename } = await params
    if (!outputId || !filename || outputId.includes("..")) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }

    const outputDir = path.join(process.cwd(), "temp", "us-visa-interview-brief", outputId)
    const canAccess = await canAccessOutputDirectoryByMetadata(session.user.id, outputDir)
    if (!canAccess) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const safeName = sanitizeDownloadFilename(filename)
    const filePath = path.join(outputDir, safeName)
    const buffer = await fs.readFile(filePath)
    const disposition = request.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getContentType(safeName),
        "Content-Disposition": contentDisposition(safeName, disposition),
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    console.error("Interview brief download error:", error)
    return NextResponse.json({ error: "Download failed" }, { status: 500 })
  }
}

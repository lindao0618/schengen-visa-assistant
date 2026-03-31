import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import fs from "fs/promises"
import path from "path"

import { authOptions } from "@/lib/auth"
import { canAccessHotelBookingTaskOutput } from "@/lib/task-route-access"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: { outputId: string; filename: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const outputId = params.outputId
    const filename = decodeURIComponent(params.filename)
    const canAccess = await canAccessHotelBookingTaskOutput(session.user.id, outputId)
    if (!canAccess) {
      return new NextResponse("File not found", { status: 404 })
    }

    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return new NextResponse("Invalid filename", { status: 400 })
    }

    const outputBase = path.join(process.cwd(), "temp", "hotel-booking")
    const outputDir = path.join(outputBase, outputId)

    let filePath = path.join(outputDir, filename)
    try {
      await fs.access(filePath)
    } catch {
      filePath = path.join(outputDir, "artifacts", filename)
      await fs.access(filePath)
    }

    const data = await fs.readFile(filePath)
    const ext = path.extname(filename).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".html": "text/html; charset=utf-8",
      ".log": "text/plain; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".pdf": "application/pdf",
    }
    const contentType = contentTypeMap[ext] || "application/octet-stream"

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition":
          ext === ".pdf" || ext === ".html"
            ? `attachment; filename="${encodeURIComponent(filename)}"`
            : "inline",
        "Cache-Control": "no-cache",
      },
    })
  } catch {
    return new NextResponse("File not found", { status: 404 })
  }
}

import fs from "fs/promises"
import path from "path"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { getMaterialTaskOutputDir } from "@/lib/material-tasks"
import { getAuthorizedMaterialTask } from "@/lib/task-route-access"

function contentDisposition(safeName: string, inline = false): string {
  const dispositionType = inline ? "inline" : "attachment"
  const asciiSafe = /^[\x20-\x7E]*$/.test(safeName)
  if (asciiSafe) {
    return `${dispositionType}; filename="${safeName}"`
  }
  const encoded = encodeURIComponent(safeName)
  const fallback = "download" + path.extname(safeName)
  return `${dispositionType}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; filename: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    const { taskId, filename: rawFilename } = await params
    if (!taskId || !rawFilename) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    const task = await getAuthorizedMaterialTask(taskId, session?.user?.id)
    if (!task) {
      return NextResponse.json({ error: "文件不存在或无权访问" }, { status: 404 })
    }

    let filename: string
    try {
      filename = decodeURIComponent(rawFilename)
    } catch {
      filename = rawFilename
    }

    const safeName = path.basename(filename).replace(/\.\./g, "")
    const outputDir = getMaterialTaskOutputDir(taskId)
    const filePath = path.join(outputDir, safeName)
    await fs.access(filePath)
    const buf = await fs.readFile(filePath)
    const ext = path.extname(safeName).slice(1).toLowerCase()
    const contentType = MIME[ext] || "application/octet-stream"
    const inline = request.nextUrl.searchParams.get("inline") === "1"

    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition(safeName, inline),
      },
    })
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    console.error("材料任务下载失败:", e)
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

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
      "french-visa-create-application",
      outputId,
      safeName
    )
    // #region agent log
    fetch("http://127.0.0.1:7657/ingest/921ae087-a611-4872-822e-58b23ada05b2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f5d383" },
      body: JSON.stringify({
        sessionId: "f5d383",
        hypothesisId: "A",
        location: "download:before_access",
        message: "download attempt",
        data: { rawFilename, filename, safeName, filePath },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    await fs.access(filePath)
    const buf = await fs.readFile(filePath)
    const contentType = safeName.endsWith(".json")
      ? "application/json"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    const contentDisp = /^[\x20-\x7E]*$/.test(safeName)
      ? `attachment; filename="${safeName}"`
      : `attachment; filename="download${path.extname(safeName)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisp,
      },
    })
  } catch (e) {
    // #region agent log
    fetch("http://127.0.0.1:7657/ingest/921ae087-a611-4872-822e-58b23ada05b2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f5d383" },
      body: JSON.stringify({
        sessionId: "f5d383",
        hypothesisId: "B",
        location: "download:catch",
        message: "download error",
        data: {
          code: (e as NodeJS.ErrnoException)?.code,
          message: e instanceof Error ? e.message : String(e),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在或已过期" }, { status: 404 })
    }
    return NextResponse.json({ error: "下载失败" }, { status: 500 })
  }
}

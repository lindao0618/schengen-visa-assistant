import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getAdminSession, adminForbiddenResponse } from "@/lib/admin-auth"
import { listAllMaterialTasks } from "@/lib/material-tasks"
import * as fs from "fs/promises"
import * as path from "path"

async function readLogFile(filePath: string, lines = 200) {
  const content = await fs.readFile(filePath, "utf-8")
  const allLines = content.split(/\r?\n/)
  return allLines.slice(-lines).join("\n")
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const { searchParams } = new URL(request.url)
    const file = searchParams.get("file")
    const lineCount = Math.min(Number(searchParams.get("lines") || "200"), 2000)

    const logSetting = await prisma.adminSetting.findUnique({ where: { key: "LOG_DIR" } })
    const logDir =
      (logSetting?.valueJson as { path?: string } | null)?.path ||
      (logSetting?.valueJson as string | null) ||
      null

    let files: string[] = []
    let fileContent: string | null = null
    if (logDir) {
      try {
        files = (await fs.readdir(logDir)).filter((f) => f.endsWith(".log") || f.endsWith(".txt"))
        if (file) {
          const target = path.join(logDir, file)
          const normalized = path.normalize(target)
          if (!normalized.startsWith(path.normalize(logDir))) {
            return NextResponse.json({ success: false, message: "非法路径" }, { status: 400 })
          }
          fileContent = await readLogFile(normalized, lineCount)
        }
      } catch (e) {
        console.error("读取日志目录失败:", e)
      }
    }

    const [usFailed, frFailed, materialTasks] = await Promise.all([
      prisma.usVisaTask.findMany({
        where: { OR: [{ status: "failed" }, { error: { not: null } }] },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      prisma.frenchVisaTask.findMany({
        where: { OR: [{ status: "failed" }, { error: { not: null } }] },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      listAllMaterialTasks(),
    ])

    const materialFailed = materialTasks.filter(
      (t) => t.status === "failed" || (t.error && t.error.length > 0)
    )

    return NextResponse.json({
      success: true,
      logDir,
      files,
      fileContent,
      dbErrors: {
        usVisa: usFailed,
        frenchVisa: frFailed,
        material: materialFailed,
      },
    })
  } catch (error) {
    console.error("获取日志失败:", error)
    return NextResponse.json({ success: false, message: "获取日志失败" }, { status: 500 })
  }
}

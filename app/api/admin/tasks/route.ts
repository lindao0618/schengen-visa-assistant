import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/db"
import { getAdminSession, adminForbiddenResponse } from "@/lib/admin-auth"
import { deleteMaterialTasks, listAllMaterialTasks } from "@/lib/material-tasks"
import { isPublicUiPreviewEnabled } from "@/lib/public-ui-preview"
import { getPublicUiPreviewAdminData } from "@/lib/public-ui-preview-admin-data"

type TaskSource = "us-visa" | "french-visa" | "material"

export async function GET(request: NextRequest) {
  if (isPublicUiPreviewEnabled()) {
    return NextResponse.json(getPublicUiPreviewAdminData("tasks"))
  }

  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const { searchParams } = new URL(request.url)
    const source = (searchParams.get("source") || "all") as TaskSource | "all"
    const status = searchParams.get("status") || "all"
    const type = searchParams.get("type") || "all"
    const userId = searchParams.get("userId") || ""
    const search = searchParams.get("search")?.trim() || ""
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 500)

    const tasks: Array<Record<string, unknown>> = []

    if (source === "all" || source === "us-visa") {
      const where: Record<string, unknown> = {}
      if (status !== "all") where.status = status
      if (type !== "all") where.type = type
      if (userId) where.userId = userId
      if (search) {
        where.OR = [
          { taskId: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
        ]
      }
      const usTasks = await prisma.usVisaTask.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      })
      usTasks.forEach((t) => {
        tasks.push({
          taskId: t.taskId,
          source: "us-visa",
          type: t.type,
          status: t.status,
          progress: t.progress,
          message: t.message,
          error: t.error,
          result: t.result,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          user: t.user,
        })
      })
    }

    if (source === "all" || source === "french-visa") {
      const where: Record<string, unknown> = {}
      if (status !== "all") where.status = status
      if (type !== "all") where.type = type
      if (userId) where.userId = userId
      if (search) {
        where.OR = [
          { taskId: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
        ]
      }
      const frTasks = await prisma.frenchVisaTask.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      })
      frTasks.forEach((t) => {
        tasks.push({
          taskId: t.taskId,
          source: "french-visa",
          type: t.type,
          status: t.status,
          progress: t.progress,
          message: t.message,
          error: t.error,
          result: t.result,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          user: t.user,
        })
      })
    }

    if (source === "all" || source === "material") {
      const materialTasks = await listAllMaterialTasks()
      materialTasks.forEach((t) => {
        tasks.push({
          taskId: t.task_id,
          source: "material",
          type: t.type,
          status: t.status,
          progress: t.progress,
          message: t.message,
          error: t.error,
          result: t.result,
          createdAt: new Date(t.created_at),
          updatedAt: t.updated_at ? new Date(t.updated_at) : undefined,
          user: null,
        })
      })
    }

    let filtered = tasks
    if (search && (source === "all" || source === "material")) {
      const kw = search.toLowerCase()
      filtered = filtered.filter((t) => {
        const msg = String(t.message || "").toLowerCase()
        const tid = String(t.taskId || "").toLowerCase()
        return msg.includes(kw) || tid.includes(kw)
      })
    }
    if (type !== "all" && source === "material") {
      filtered = filtered.filter((t) => t.type === type)
    }
    if (status !== "all" && source === "material") {
      filtered = filtered.filter((t) => t.status === status)
    }

    filtered.sort((a, b) => {
      const timeA = (a.updatedAt as Date | undefined) || (a.createdAt as Date)
      const timeB = (b.updatedAt as Date | undefined) || (b.createdAt as Date)
      return timeB.getTime() - timeA.getTime()
    })

    return NextResponse.json({ success: true, tasks: filtered.slice(0, limit) })
  } catch (error) {
    console.error("获取任务列表失败:", error)
    return NextResponse.json(
      { success: false, message: "获取任务列表失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return adminForbiddenResponse()

  try {
    const body = await request.json()
    const items = Array.isArray(body?.items) ? body.items : []

    if (!items.length) {
      return NextResponse.json(
        { success: false, message: "未提供要删除的任务" },
        { status: 400 }
      )
    }

    const bySource: Record<TaskSource, string[]> = {
      "us-visa": [],
      "french-visa": [],
      material: [],
    }

    for (const item of items) {
      const source = item?.source as TaskSource | undefined
      const taskId = item?.taskId as string | undefined
      if (!source || !taskId) continue
      if (bySource[source]) bySource[source].push(taskId)
    }

    const [usResult, frResult, materialDeleted] = await Promise.all([
      bySource["us-visa"].length
        ? prisma.usVisaTask.deleteMany({ where: { taskId: { in: bySource["us-visa"] } } })
        : Promise.resolve({ count: 0 }),
      bySource["french-visa"].length
        ? prisma.frenchVisaTask.deleteMany({ where: { taskId: { in: bySource["french-visa"] } } })
        : Promise.resolve({ count: 0 }),
      deleteMaterialTasks(bySource.material),
    ])

    return NextResponse.json({
      success: true,
      deleted: {
        "us-visa": usResult.count,
        "french-visa": frResult.count,
        material: materialDeleted,
      },
    })
  } catch (error) {
    console.error("删除任务失败:", error)
    return NextResponse.json(
      { success: false, message: "删除任务失败" },
      { status: 500 }
    )
  }
}

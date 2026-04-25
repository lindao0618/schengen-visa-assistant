import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { deleteMaterialTasks, listMaterialTasks } from "@/lib/material-tasks"
import type { MaterialTaskType } from "@/lib/material-tasks"
import prisma from "@/lib/db"
import { formatFallbackVisaCaseLabel, formatVisaCaseLabel } from "@/lib/visa-case-labels"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "璇峰厛鐧诲綍" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const taskIdsParam = searchParams.get("task_ids")
    const typeParam = searchParams.get("type") as MaterialTaskType | null

    const taskIds = taskIdsParam
      ? taskIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : []
    const typeFilter =
      typeParam &&
      ["itinerary", "explanation-letter", "material-review"].includes(typeParam)
        ? (typeParam as import("@/lib/material-tasks").MaterialTaskType)
        : undefined

    const tasks = await listMaterialTasks(taskIds, typeFilter, session.user.id)
    const caseIds = Array.from(new Set(tasks.map((task) => task.caseId).filter((value): value is string => Boolean(value))))

    let labelMap = new Map<string, string>()
    if (caseIds.length > 0) {
      try {
        const cases = await prisma.visaCase.findMany({
          where: { id: { in: caseIds } },
          select: { id: true, caseType: true, visaType: true, applyRegion: true },
        })
        labelMap = new Map(cases.map((item) => [item.id, formatVisaCaseLabel(item)]))
      } catch {
        labelMap = new Map()
      }
    }

    const enrichedTasks = tasks.map((task) =>
      task.caseId
        ? {
            ...task,
            caseLabel: labelMap.get(task.caseId) || formatFallbackVisaCaseLabel(task.caseId),
          }
        : task
    )
    return NextResponse.json({ tasks: enrichedTasks })
  } catch (e) {
    console.error("Material tasks list error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "获取任务列表失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "璇峰厛鐧诲綍" }, { status: 401 })
    }
    const body = (await request.json().catch(() => ({}))) as {
      task_ids?: unknown
    }

    const taskIds = Array.isArray(body.task_ids)
      ? body.task_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : []

    if (taskIds.length === 0) {
      return NextResponse.json({ error: "缺少要删除的任务 ID" }, { status: 400 })
    }

    const removableTasks = await listMaterialTasks(taskIds, undefined, session.user.id)
    const removed = await deleteMaterialTasks(removableTasks.map((task) => task.task_id))
    return NextResponse.json({ success: true, removed })
  } catch (e) {
    console.error("Material tasks delete error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "删除任务失败" },
      { status: 500 }
    )
  }
}

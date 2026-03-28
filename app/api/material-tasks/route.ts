import { NextRequest, NextResponse } from "next/server"
import { deleteMaterialTasks, listMaterialTasks } from "@/lib/material-tasks"
import type { MaterialTaskType } from "@/lib/material-tasks"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
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

    const tasks = await listMaterialTasks(taskIds, typeFilter)
    return NextResponse.json({ tasks })
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
    const body = (await request.json().catch(() => ({}))) as {
      task_ids?: unknown
    }

    const taskIds = Array.isArray(body.task_ids)
      ? body.task_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : []

    if (taskIds.length === 0) {
      return NextResponse.json({ error: "缺少要删除的任务 ID" }, { status: 400 })
    }

    const removed = await deleteMaterialTasks(taskIds)
    return NextResponse.json({ success: true, removed })
  } catch (e) {
    console.error("Material tasks delete error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "删除任务失败" },
      { status: 500 }
    )
  }
}

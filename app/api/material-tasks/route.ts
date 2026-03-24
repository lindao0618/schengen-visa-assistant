import { NextRequest, NextResponse } from "next/server"
import { listMaterialTasks } from "@/lib/material-tasks"
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

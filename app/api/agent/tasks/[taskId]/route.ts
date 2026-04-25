import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { getAgentTask, type AgentTaskSystem } from "@/lib/agent-tasks"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const system = request.nextUrl.searchParams.get("system")
  const task = await getAgentTask(
    actor.userId,
    actor.role,
    params.taskId,
    system === "usa-visa" || system === "france-visa" ? (system as AgentTaskSystem) : undefined,
  )
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 })
  }

  return NextResponse.json({ task })
}

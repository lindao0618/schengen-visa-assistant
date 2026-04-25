import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { listAgentTasks, type AgentTaskSystem } from "@/lib/agent-tasks"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100)
  const system = searchParams.get("system")
  const tasks = await listAgentTasks(actor.userId, actor.role, {
    limit,
    status: searchParams.get("status") || undefined,
    applicantProfileId: searchParams.get("applicantProfileId") || undefined,
    caseId: searchParams.get("caseId") || undefined,
    system:
      system === "usa-visa" || system === "france-visa"
        ? (system as AgentTaskSystem)
        : undefined,
  })

  return NextResponse.json({ tasks })
}

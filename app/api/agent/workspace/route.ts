import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { buildAgentWorkspace, resolveApplicantProfileIdFromCase } from "@/lib/agent-tasks"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const applicantProfileId = request.nextUrl.searchParams.get("applicantProfileId")?.trim() || ""
  const caseId = request.nextUrl.searchParams.get("caseId")?.trim() || ""
  const taskLimit = Math.min(parseInt(request.nextUrl.searchParams.get("taskLimit") || "20", 10), 100)

  let resolvedApplicantProfileId = applicantProfileId
  if (!resolvedApplicantProfileId && caseId) {
    resolvedApplicantProfileId = (await resolveApplicantProfileIdFromCase(caseId)) || ""
  }

  if (!resolvedApplicantProfileId) {
    return NextResponse.json({ error: "缺少 applicantProfileId 或 caseId" }, { status: 400 })
  }

  const workspace = await buildAgentWorkspace(actor.userId, actor.role, resolvedApplicantProfileId, taskLimit)
  if (!workspace) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }

  return NextResponse.json(workspace)
}

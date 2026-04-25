import { NextRequest, NextResponse } from "next/server"

import { canWriteApplicants } from "@/lib/access-control"
import { caseWriteForbiddenResponse } from "@/lib/access-control-response"
import { requireAgentActor } from "@/lib/agent-auth"
import { updateVisaCaseStatusById } from "@/lib/applicant-crm"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }
  if (!canWriteApplicants(actor.role)) {
    return caseWriteForbiddenResponse()
  }

  const body = await request.json().catch(() => ({}))
  const visaCase = await updateVisaCaseStatusById(actor.userId, actor.role, params.id, {
    mainStatus: typeof body?.mainStatus === "string" ? body.mainStatus.trim() : "",
    subStatus: typeof body?.subStatus === "string" ? body.subStatus : body?.subStatus === null ? null : undefined,
    exceptionCode:
      typeof body?.exceptionCode === "string"
        ? body.exceptionCode
        : body?.exceptionCode === null
          ? null
          : undefined,
    clearException: Boolean(body?.clearException),
    reason: typeof body?.reason === "string" ? body.reason : undefined,
    allowRegression: Boolean(body?.allowRegression),
  })

  if (!visaCase) {
    return NextResponse.json({ error: "案件不存在" }, { status: 404 })
  }

  return NextResponse.json({ case: visaCase })
}

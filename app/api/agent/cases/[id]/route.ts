import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { getVisaCaseDetail, updateVisaCaseBasics } from "@/lib/applicant-crm"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const visaCase = await getVisaCaseDetail(actor.userId, actor.role, params.id)
  if (!visaCase) {
    return NextResponse.json({ error: "案件不存在" }, { status: 404 })
  }

  return NextResponse.json({ case: visaCase })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const body = await request.json().catch(() => ({}))
  const visaCase = await updateVisaCaseBasics(actor.userId, actor.role, params.id, {
    visaType: typeof body?.visaType === "string" ? body.visaType : body?.visaType === null ? null : undefined,
    applyRegion:
      typeof body?.applyRegion === "string" ? body.applyRegion : body?.applyRegion === null ? null : undefined,
    tlsCity: typeof body?.tlsCity === "string" ? body.tlsCity : body?.tlsCity === null ? null : undefined,
    bookingWindow:
      typeof body?.bookingWindow === "string"
        ? body.bookingWindow
        : body?.bookingWindow === null
          ? null
          : undefined,
    acceptVip:
      typeof body?.acceptVip === "string"
        ? body.acceptVip
        : body?.acceptVip === null
          ? null
          : undefined,
    slotTime:
      typeof body?.slotTime === "string"
        ? body.slotTime
        : body?.slotTime === null
          ? null
          : undefined,
    priority: typeof body?.priority === "string" ? body.priority : body?.priority === null ? null : undefined,
    travelDate:
      typeof body?.travelDate === "string" ? body.travelDate : body?.travelDate === null ? null : undefined,
    submissionDate:
      typeof body?.submissionDate === "string"
        ? body.submissionDate
        : body?.submissionDate === null
          ? null
          : undefined,
    assignedToUserId:
      typeof body?.assignedToUserId === "string"
        ? body.assignedToUserId
        : body?.assignedToUserId === null
          ? null
          : undefined,
    assignedRole:
      typeof body?.assignedRole === "string" ? body.assignedRole : body?.assignedRole === null ? null : undefined,
    isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
  })

  if (!visaCase) {
    return NextResponse.json({ error: "案件不存在" }, { status: 404 })
  }

  return NextResponse.json({ case: visaCase })
}

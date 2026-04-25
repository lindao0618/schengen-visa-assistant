import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { createVisaCaseForApplicant, listVisaCases } from "@/lib/applicant-crm"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const { searchParams } = new URL(request.url)
  const applicantProfileId = searchParams.get("applicantProfileId")?.trim() || undefined
  const cases = await listVisaCases(actor.userId, actor.role, { applicantProfileId })
  return NextResponse.json({ cases })
}

export async function POST(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const body = await request.json().catch(() => ({}))
  const visaCase = await createVisaCaseForApplicant(actor.userId, actor.role, {
    applicantProfileId: typeof body?.applicantProfileId === "string" ? body.applicantProfileId.trim() : "",
    caseType: typeof body?.caseType === "string" ? body.caseType : undefined,
    visaType: typeof body?.visaType === "string" ? body.visaType : undefined,
    applyRegion: typeof body?.applyRegion === "string" ? body.applyRegion : undefined,
    tlsCity: typeof body?.tlsCity === "string" ? body.tlsCity : undefined,
    bookingWindow: typeof body?.bookingWindow === "string" ? body.bookingWindow : undefined,
    acceptVip: typeof body?.acceptVip === "string" ? body.acceptVip : undefined,
    slotTime: typeof body?.slotTime === "string" ? body.slotTime : undefined,
    priority: typeof body?.priority === "string" ? body.priority : undefined,
    travelDate: typeof body?.travelDate === "string" ? body.travelDate : undefined,
    submissionDate: typeof body?.submissionDate === "string" ? body.submissionDate : undefined,
    assignedToUserId: typeof body?.assignedToUserId === "string" ? body.assignedToUserId : undefined,
    isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
  })

  if (!visaCase) {
    return NextResponse.json({ error: "申请人不存在或无权创建案件" }, { status: 404 })
  }

  return NextResponse.json({ case: visaCase }, { status: 201 })
}

import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { buildApplicantUsVisaIntakeView } from "@/lib/agent-file-parsing"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const intake = await buildApplicantUsVisaIntakeView(actor.userId, params.id, actor.role)
  if (!intake) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 })
  }

  return NextResponse.json(intake)
}

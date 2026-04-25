import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { getParsedApplicantProfileFile } from "@/lib/agent-file-parsing"
import { isApplicantProfileFileSlot } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; slot: string } },
) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  if (!isApplicantProfileFileSlot(params.slot)) {
    return NextResponse.json({ error: "Unsupported applicant file slot" }, { status: 400 })
  }

  const parsed = await getParsedApplicantProfileFile(actor.userId, params.id, params.slot, actor.role)
  if (!parsed) {
    return NextResponse.json({ error: "Applicant file not found" }, { status: 404 })
  }

  return NextResponse.json(parsed)
}

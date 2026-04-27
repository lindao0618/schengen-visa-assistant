import { NextRequest, NextResponse } from "next/server"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { requireAgentActor } from "@/lib/agent-auth"
import { createVisaCaseForApplicant, listApplicantCrmData } from "@/lib/applicant-crm"
import { buildApplicantCrmFiltersFromSearchParams } from "@/lib/applicant-crm-query"
import { deriveApplicantCaseTypeFromVisaType } from "@/lib/applicant-crm-labels"
import { createApplicantProfile } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const { searchParams } = new URL(request.url)
  const data = await listApplicantCrmData(
    actor.userId,
    actor.role,
    buildApplicantCrmFiltersFromSearchParams(searchParams, {
      includeStats: true,
      includeProfiles: true,
      includeProfileFiles: true,
      includeAvailableAssignees: true,
    }),
  )

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }
  if (!canWriteApplicants(actor.role)) {
    return applicantWriteForbiddenResponse()
  }

  const body = await request.json().catch(() => ({}))
  const profile = await createApplicantProfile(actor.userId, body ?? {})
  let visaCase = null
  const visaCases = []
  const requestedVisaTypes = Array.isArray(body?.visaTypes)
    ? body.visaTypes.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : body?.visaType
      ? [String(body.visaType).trim()]
      : []

  if (body?.createFirstCase && requestedVisaTypes.length > 0) {
    for (const [index, visaType] of requestedVisaTypes.entries()) {
      const created = await createVisaCaseForApplicant(actor.userId, actor.role, {
        applicantProfileId: profile.id,
        caseType: deriveApplicantCaseTypeFromVisaType(visaType),
        visaType,
        applyRegion: body?.applyRegion,
        priority: body?.priority,
        travelDate: body?.travelDate,
        assignedToUserId: body?.assignedToUserId,
        isActive: index === 0,
      })
      if (created) {
        visaCases.push(created)
      }
    }
    visaCase = visaCases[0] ?? null
  }

  return NextResponse.json({ profile, case: visaCase, cases: visaCases }, { status: 201 })
}

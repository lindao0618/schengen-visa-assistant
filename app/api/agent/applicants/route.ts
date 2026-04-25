import { NextRequest, NextResponse } from "next/server"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { requireAgentActor } from "@/lib/agent-auth"
import { createVisaCaseForApplicant, listApplicantCrmData } from "@/lib/applicant-crm"
import { deriveApplicantCaseTypeFromVisaType } from "@/lib/applicant-crm-labels"
import { createApplicantProfile } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

function getMultiValues(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean)
}

function getBooleanFlag(searchParams: URLSearchParams, key: string, defaultValue = false) {
  const value = searchParams.get(key)
  if (value === null) return defaultValue
  return ["1", "true", "yes"].includes(value.toLowerCase())
}

export async function GET(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const { searchParams } = new URL(request.url)
  const data = await listApplicantCrmData(actor.userId, actor.role, {
    keyword: searchParams.get("keyword")?.trim() || "",
    visaTypes: getMultiValues(searchParams, "visaTypes"),
    statuses: getMultiValues(searchParams, "statuses"),
    regions: getMultiValues(searchParams, "regions"),
    priorities: getMultiValues(searchParams, "priorities"),
    includeStats: getBooleanFlag(searchParams, "includeStats", true),
    includeSelectorCases: getBooleanFlag(searchParams, "includeSelectorCases"),
    includeProfiles: getBooleanFlag(searchParams, "includeProfiles", true),
    includeProfileFiles: getBooleanFlag(searchParams, "includeProfileFiles", true),
    includeAvailableAssignees: getBooleanFlag(searchParams, "includeAvailableAssignees", true),
  })

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

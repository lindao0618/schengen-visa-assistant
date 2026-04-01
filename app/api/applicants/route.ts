import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { createVisaCaseForApplicant } from "@/lib/applicant-crm"
import { authOptions } from "@/lib/auth"
import { deriveApplicantCaseTypeFromVisaType } from "@/lib/applicant-crm-labels"
import { listApplicantCrmData } from "@/lib/applicant-crm"
import { createApplicantProfile } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

function getMultiValues(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const data = await listApplicantCrmData(session.user.id, session.user.role, {
      keyword: searchParams.get("keyword")?.trim() || "",
      visaTypes: getMultiValues(searchParams, "visaTypes"),
      statuses: getMultiValues(searchParams, "statuses"),
      regions: getMultiValues(searchParams, "regions"),
      priorities: getMultiValues(searchParams, "priorities"),
      includeSelectorCases: ["1", "true", "yes"].includes((searchParams.get("includeSelectorCases") || "").toLowerCase()),
    })

    return NextResponse.json(data)
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const profile = await createApplicantProfile(session.user.id, body ?? {})
    let visaCase = null
    const visaCases = []
    const requestedVisaTypes = Array.isArray(body?.visaTypes)
      ? body.visaTypes.map((item: unknown) => String(item || "").trim()).filter(Boolean)
      : body?.visaType
        ? [String(body.visaType).trim()]
        : []

    if (body?.createFirstCase && requestedVisaTypes.length > 0) {
      for (const [index, visaType] of requestedVisaTypes.entries()) {
        const created = await createVisaCaseForApplicant(session.user.id, session.user.role, {
          applicantProfileId: profile.id,
          caseType: deriveApplicantCaseTypeFromVisaType(visaType),
          visaType,
          applyRegion: body?.applyRegion,
          priority: body?.priority,
          travelDate: body?.travelDate,
          assignedToUserId: body?.assignedToUserId,
          isActive: index === 0,
        })
        visaCases.push(created)
      }
      visaCase = visaCases[0] ?? null
    }

    return NextResponse.json({ profile, case: visaCase, cases: visaCases }, { status: 201 })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

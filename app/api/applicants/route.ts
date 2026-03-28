import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
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
    return NextResponse.json({ profile }, { status: 201 })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { createApplicantProfile, listApplicantProfiles } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const profiles = await listApplicantProfiles(session.user.id)
    return NextResponse.json({ profiles })
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

    const body = await request.json()
    const profile = await createApplicantProfile(session.user.id, body ?? {})
    return NextResponse.json({ profile }, { status: 201 })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

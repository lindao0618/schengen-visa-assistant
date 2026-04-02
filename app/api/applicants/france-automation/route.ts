import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
import { listFranceAutomationApplicantProfiles } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const profiles = await listFranceAutomationApplicantProfiles(session.user.id, session.user.role)
    return NextResponse.json({ profiles })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

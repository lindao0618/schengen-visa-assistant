import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
import { listApplicantCrmAvailableAssignees } from "@/lib/applicant-crm"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const availableAssignees = await listApplicantCrmAvailableAssignees(session.user.id, session.user.role)
    return NextResponse.json({ availableAssignees })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

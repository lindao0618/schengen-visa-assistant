import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { listApplicantSchedule } from "@/lib/applicant-schedule"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const data = await listApplicantSchedule(
      session.user.id,
      session.user.role,
      new URL(request.url).searchParams,
    )
    return NextResponse.json(data)
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

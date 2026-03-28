import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { getApplicantCrmDetail } from "@/lib/applicant-crm"
import { authOptions } from "@/lib/auth"
import { listFranceReminderRules } from "@/lib/france-cases"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const detail = await getApplicantCrmDetail(session.user.id, session.user.role, params.id)
    if (!detail) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    const visaCase =
      detail.cases.find((item) => item.caseType === "france-schengen" && item.isActive) ??
      detail.cases.find((item) => item.caseType === "france-schengen") ??
      null

    const reminderRules = await listFranceReminderRules()

    return NextResponse.json({
      case: visaCase,
      history: visaCase?.statusHistory || [],
      reminderRules,
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { canWriteApplicants } from "@/lib/access-control"
import { caseWriteForbiddenResponse } from "@/lib/access-control-response"
import { createVisaCaseForApplicant, listVisaCases } from "@/lib/applicant-crm"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const applicantProfileId = searchParams.get("applicantProfileId")?.trim() || undefined
    const cases = await listVisaCases(session.user.id, session.user.role, { applicantProfileId })
    return NextResponse.json({ cases })
  } catch (error) {
    console.error("[API_CASES_GET]", error)
    return NextResponse.json({ error: "获取案件列表失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  if (!canWriteApplicants(session.user.role)) {
    return caseWriteForbiddenResponse()
  }

  try {
    const body = await request.json().catch(() => ({}))
    const visaCase = await createVisaCaseForApplicant(session.user.id, session.user.role, {
      applicantProfileId: typeof body?.applicantProfileId === "string" ? body.applicantProfileId.trim() : "",
      caseType: typeof body?.caseType === "string" ? body.caseType : undefined,
      visaType: typeof body?.visaType === "string" ? body.visaType : undefined,
      applyRegion: typeof body?.applyRegion === "string" ? body.applyRegion : undefined,
      tlsCity: typeof body?.tlsCity === "string" ? body.tlsCity : undefined,
      bookingWindow: typeof body?.bookingWindow === "string" ? body.bookingWindow : undefined,
      acceptVip: typeof body?.acceptVip === "string" ? body.acceptVip : undefined,
      slotTime: typeof body?.slotTime === "string" ? body.slotTime : undefined,
      priority: typeof body?.priority === "string" ? body.priority : undefined,
      travelDate: typeof body?.travelDate === "string" ? body.travelDate : undefined,
      submissionDate: typeof body?.submissionDate === "string" ? body.submissionDate : undefined,
      assignedToUserId: typeof body?.assignedToUserId === "string" ? body.assignedToUserId : undefined,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : true,
    })

    if (!visaCase) {
      return NextResponse.json({ error: "申请人不存在或无权创建案件" }, { status: 404 })
    }

    return NextResponse.json({ case: visaCase }, { status: 201 })
  } catch (error) {
    console.error("[API_CASES_POST]", error)
    return NextResponse.json({ error: "创建案件失败" }, { status: 500 })
  }
}

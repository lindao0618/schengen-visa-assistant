import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { getVisaCaseDetail, updateVisaCaseBasics } from "@/lib/applicant-crm"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const visaCase = await getVisaCaseDetail(session.user.id, session.user.role, params.id)
    if (!visaCase) {
      return NextResponse.json({ error: "案件不存在" }, { status: 404 })
    }
    return NextResponse.json({ case: visaCase })
  } catch (error) {
    console.error("[API_CASE_GET]", error)
    return NextResponse.json({ error: "获取案件详情失败" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const visaCase = await updateVisaCaseBasics(session.user.id, session.user.role, params.id, {
      visaType: typeof body?.visaType === "string" ? body.visaType : body?.visaType === null ? null : undefined,
      applyRegion:
        typeof body?.applyRegion === "string" ? body.applyRegion : body?.applyRegion === null ? null : undefined,
      tlsCity: typeof body?.tlsCity === "string" ? body.tlsCity : body?.tlsCity === null ? null : undefined,
      priority: typeof body?.priority === "string" ? body.priority : body?.priority === null ? null : undefined,
      travelDate:
        typeof body?.travelDate === "string" ? body.travelDate : body?.travelDate === null ? null : undefined,
      submissionDate:
        typeof body?.submissionDate === "string"
          ? body.submissionDate
          : body?.submissionDate === null
            ? null
            : undefined,
      assignedToUserId:
        typeof body?.assignedToUserId === "string"
          ? body.assignedToUserId
          : body?.assignedToUserId === null
            ? null
            : undefined,
      assignedRole:
        typeof body?.assignedRole === "string" ? body.assignedRole : body?.assignedRole === null ? null : undefined,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
    })

    if (!visaCase) {
      return NextResponse.json({ error: "案件不存在" }, { status: 404 })
    }

    return NextResponse.json({ case: visaCase })
  } catch (error) {
    console.error("[API_CASE_PATCH]", error)
    return NextResponse.json({ error: "更新案件失败" }, { status: 500 })
  }
}

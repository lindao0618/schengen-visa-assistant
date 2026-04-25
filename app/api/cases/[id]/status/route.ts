import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { canWriteApplicants } from "@/lib/access-control"
import { caseWriteForbiddenResponse } from "@/lib/access-control-response"
import { updateVisaCaseStatusById } from "@/lib/applicant-crm"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }
  if (!canWriteApplicants(session.user.role)) {
    return caseWriteForbiddenResponse()
  }

  try {
    const body = await request.json().catch(() => ({}))
    const visaCase = await updateVisaCaseStatusById(session.user.id, session.user.role, params.id, {
      mainStatus: typeof body?.mainStatus === "string" ? body.mainStatus.trim() : "",
      subStatus:
        typeof body?.subStatus === "string" ? body.subStatus : body?.subStatus === null ? null : undefined,
      exceptionCode:
        typeof body?.exceptionCode === "string"
          ? body.exceptionCode
          : body?.exceptionCode === null
            ? null
            : undefined,
      clearException: Boolean(body?.clearException),
      reason: typeof body?.reason === "string" ? body.reason : undefined,
      allowRegression: Boolean(body?.allowRegression),
    })

    if (!visaCase) {
      return NextResponse.json({ error: "案件不存在" }, { status: 404 })
    }

    return NextResponse.json({ case: visaCase })
  } catch (error) {
    console.error("[API_CASE_STATUS_PATCH]", error)
    return NextResponse.json({ error: "更新案件状态失败" }, { status: 500 })
  }
}

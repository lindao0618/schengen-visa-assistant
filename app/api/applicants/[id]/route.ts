import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { resolveApplicantDetailView } from "@/lib/applicant-detail-view"
import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { getApplicantActiveDetail, getApplicantCrmDetail } from "@/lib/applicant-crm"
import { authOptions } from "@/lib/auth"
import { deleteApplicantProfile, updateApplicantProfile } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const detailView = resolveApplicantDetailView(request.nextUrl.searchParams)
    const detail =
      detailView === "active"
        ? await getApplicantActiveDetail(session.user.id, session.user.role, params.id)
        : await getApplicantCrmDetail(session.user.id, session.user.role, params.id)

    if (!detail) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    return NextResponse.json({
      profile: detail.profile,
      cases: detail.cases,
      activeCaseId: detail.activeCaseId,
      availableAssignees: "availableAssignees" in detail ? detail.availableAssignees : [],
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    if (!canWriteApplicants(session.user.role)) {
      return applicantWriteForbiddenResponse()
    }

    const body = await request.json().catch(() => ({}))
    const profile = await updateApplicantProfile(session.user.id, params.id, body ?? {}, session.user.role)
    if (!profile) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    if (!canWriteApplicants(session.user.role)) {
      return applicantWriteForbiddenResponse()
    }

    const deleted = await deleteApplicantProfile(session.user.id, params.id, session.user.role)
    if (!deleted) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

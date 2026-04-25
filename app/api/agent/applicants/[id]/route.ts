import { NextRequest, NextResponse } from "next/server"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { requireAgentActor } from "@/lib/agent-auth"
import { getApplicantCrmDetail } from "@/lib/applicant-crm"
import { deleteApplicantProfile, updateApplicantProfile } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  const detail = await getApplicantCrmDetail(actor.userId, actor.role, params.id)
  if (!detail) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }

  return NextResponse.json(detail)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }
  if (!canWriteApplicants(actor.role)) {
    return applicantWriteForbiddenResponse()
  }

  const body = await request.json().catch(() => ({}))
  const profile = await updateApplicantProfile(actor.userId, params.id, body ?? {}, actor.role)
  if (!profile) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }
  if (!canWriteApplicants(actor.role)) {
    return applicantWriteForbiddenResponse()
  }

  const deleted = await deleteApplicantProfile(actor.userId, params.id, actor.role)
  if (!deleted) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

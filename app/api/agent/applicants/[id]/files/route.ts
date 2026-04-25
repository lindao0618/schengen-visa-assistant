import { NextRequest, NextResponse } from "next/server"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { requireAgentActor } from "@/lib/agent-auth"
import { saveApplicantProfileFilesWithAnalysis } from "@/lib/applicant-profile-file-workflow"
import { ApplicantProfileFileSlot, isApplicantProfileFileSlot } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }
  if (!canWriteApplicants(actor.role)) {
    return applicantWriteForbiddenResponse()
  }

  const formData = await request.formData()
  const entries: Array<{ slot: ApplicantProfileFileSlot; file: File }> = []

  for (const [key, value] of formData.entries()) {
    if (!isApplicantProfileFileSlot(key)) continue
    if (!(value instanceof File)) continue
    if (!value.size) continue
    entries.push({ slot: key, file: value })
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "没有可上传的文件" }, { status: 400 })
  }

  const result = await saveApplicantProfileFilesWithAnalysis(actor.userId, params.id, entries, actor.role)
  if (!result) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }

  return NextResponse.json(result)
}

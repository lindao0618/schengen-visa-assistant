import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { saveApplicantProfileFilesWithAnalysis } from "@/lib/applicant-profile-file-workflow"
import { authOptions } from "@/lib/auth"
import { ApplicantProfileFileSlot, isApplicantProfileFileSlot } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    if (!canWriteApplicants(session.user.role)) {
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

    const result = await saveApplicantProfileFilesWithAnalysis(session.user.id, params.id, entries, session.user.role)
    if (!result) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

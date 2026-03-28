import fs from "fs/promises"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { getApplicantProfileFileByCandidates } from "@/lib/applicant-profiles"
import { authOptions } from "@/lib/auth"
import { extractSchengenApplicantSummaryFromExcelBuffer } from "@/lib/schengen-excel-summary"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const stored = await getApplicantProfileFileByCandidates(session.user.id, params.id, ["schengenExcel", "franceExcel"])
    if (!stored) {
      return NextResponse.json({ summary: null }, { status: 404 })
    }

    const buffer = await fs.readFile(stored.absolutePath)
    const summary = extractSchengenApplicantSummaryFromExcelBuffer(buffer)

    return NextResponse.json({
      summary,
      source: {
        slot: stored.meta.slot,
        originalName: stored.meta.originalName,
      },
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

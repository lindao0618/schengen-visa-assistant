import fs from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
import { getApplicantProfileFileByCandidates } from "@/lib/applicant-profiles"
import { extractSchengenEntryDateIsoFromExcelBuffer } from "@/lib/schengen-entry-date-excel"

export const dynamic = "force-dynamic"

/**
 * 读取当前申请人档案中的申根 Excel（schengenExcel 或 franceExcel），解析「入境申根国日期」为 YYYY-MM-DD。
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const file = await getApplicantProfileFileByCandidates(
      session.user.id,
      params.id,
      ["schengenExcel", "franceExcel"],
      session.user.role,
    )
    if (!file) {
      return NextResponse.json({ entryDate: null as string | null })
    }

    const buffer = await fs.readFile(file.absolutePath)
    const entryDate = extractSchengenEntryDateIsoFromExcelBuffer(buffer)
    return NextResponse.json({ entryDate })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

import fs from "fs/promises"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { saveApplicantProfileFilesWithAnalysis } from "@/lib/applicant-profile-file-workflow"
import { authOptions } from "@/lib/auth"
import { getApplicantProfile, getApplicantProfileFile, isApplicantProfileFileSlot } from "@/lib/applicant-profiles"
import { auditUsVisaExcelBuffer } from "@/lib/us-visa-excel-audit"
import { autoFixUsVisaExcelBuffer } from "@/lib/us-visa-excel-autofix"

const US_VISA_EXCEL_SLOTS = new Set(["usVisaDs160Excel", "usVisaAisExcel", "ds160Excel", "aisExcel"])

export async function POST(_request: Request, { params }: { params: { id: string; slot: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    if (!canWriteApplicants(session.user.role)) {
      return applicantWriteForbiddenResponse()
    }

    if (!isApplicantProfileFileSlot(params.slot) || !US_VISA_EXCEL_SLOTS.has(params.slot)) {
      return NextResponse.json({ error: "该文件类型不支持美签自动修复" }, { status: 400 })
    }

    const file = await getApplicantProfileFile(session.user.id, params.id, params.slot, session.user.role)
    if (!file) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 })
    }

    const originalBuffer = await fs.readFile(file.absolutePath)
    const fixed = autoFixUsVisaExcelBuffer(originalBuffer)
    const nextBuffer = fixed.changed ? fixed.buffer : originalBuffer

    const originalName = /\.xlsx$/i.test(file.meta.originalName)
      ? file.meta.originalName
      : file.meta.originalName.replace(/\.xls$/i, ".xlsx")

    const result = await saveApplicantProfileFilesWithAnalysis(
      session.user.id,
      params.id,
      [
        {
          slot: params.slot,
          file: new File([nextBuffer], originalName, {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        },
      ],
      session.user.role,
    )

    const profile = result?.profile || await getApplicantProfile(session.user.id, params.id, session.user.role, {
      includeUsVisaFullIntake: true,
    })

    if (!profile) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    const usVisaAudit = auditUsVisaExcelBuffer(nextBuffer)

    return NextResponse.json({
      profile,
      changed: fixed.changed,
      fixedCount: fixed.fixedCount,
      changes: fixed.changes,
      parsedUsVisaDetails: result?.parsedUsVisaDetails,
      parsedUsVisaFullIntake: result?.parsedUsVisaFullIntake,
      usVisaAudit,
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

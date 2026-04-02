import fs from "fs/promises"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
import {
  getApplicantProfile,
  getApplicantProfileFile,
  isApplicantProfileFileSlot,
  saveApplicantProfileFileFromBuffer,
} from "@/lib/applicant-profiles"
import { auditUsVisaExcelBuffer } from "@/lib/us-visa-excel-audit"
import { autoFixUsVisaExcelBuffer } from "@/lib/us-visa-excel-autofix"

const US_VISA_EXCEL_SLOTS = new Set(["usVisaDs160Excel", "usVisaAisExcel", "ds160Excel", "aisExcel"])

export async function POST(_request: Request, { params }: { params: { id: string; slot: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    if (!isApplicantProfileFileSlot(params.slot) || !US_VISA_EXCEL_SLOTS.has(params.slot)) {
      return NextResponse.json({ error: "该文件类型不支持美签自动修正" }, { status: 400 })
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

    const profile = fixed.changed
      ? await saveApplicantProfileFileFromBuffer({
          userId: session.user.id,
          id: params.id,
          slot: params.slot,
          buffer: nextBuffer,
          originalName,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          role: session.user.role,
        })
      : await getApplicantProfile(session.user.id, params.id, session.user.role)

    if (!profile) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    const usVisaAudit = auditUsVisaExcelBuffer(nextBuffer)

    return NextResponse.json({
      profile,
      changed: fixed.changed,
      fixedCount: fixed.fixedCount,
      changes: fixed.changes,
      usVisaAudit,
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

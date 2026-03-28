import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
import {
  ApplicantProfileFileSlot,
  isApplicantProfileFileSlot,
  saveApplicantProfileFiles,
  updateApplicantProfileSchengenDetails,
  updateApplicantProfileUsVisaDetails,
} from "@/lib/applicant-profiles"
import { extractFranceTlsCityFromExcelBuffer } from "@/lib/france-tls-city-excel"
import { extractUsVisaApplicantDetailsFromExcelBuffer } from "@/lib/us-visa-excel-parser"

export const dynamic = "force-dynamic"

const US_VISA_EXCEL_SLOTS = new Set<ApplicantProfileFileSlot>([
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "ds160Excel",
  "aisExcel",
])

const SCHENGEN_EXCEL_SLOTS = new Set<ApplicantProfileFileSlot>(["schengenExcel", "franceExcel"])

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
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

    let profile = await saveApplicantProfileFiles(session.user.id, params.id, entries, session.user.role)
    if (!profile) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    const excelEntry = entries.find((entry) => US_VISA_EXCEL_SLOTS.has(entry.slot))
    const schengenExcelEntry = entries.find((entry) => SCHENGEN_EXCEL_SLOTS.has(entry.slot))
    let parsedUsVisaDetails:
      | {
          surname?: string
          birthYear?: string
          passportNumber?: string
        }
      | undefined
    let parsedSchengenDetails:
      | {
          city?: string
        }
      | undefined

    if (excelEntry) {
      const parsed = extractUsVisaApplicantDetailsFromExcelBuffer(
        Buffer.from(await excelEntry.file.arrayBuffer()),
      )
      if (parsed.surname || parsed.birthYear || parsed.passportNumber) {
        const updatedProfile = await updateApplicantProfileUsVisaDetails(session.user.id, params.id, parsed)
        if (updatedProfile) {
          profile = updatedProfile
        }
        parsedUsVisaDetails = parsed
      }
    }

    if (schengenExcelEntry) {
      const city = extractFranceTlsCityFromExcelBuffer(
        Buffer.from(await schengenExcelEntry.file.arrayBuffer()),
      )
      if (city) {
        const updatedProfile = await updateApplicantProfileSchengenDetails(session.user.id, params.id, { city })
        if (updatedProfile) {
          profile = updatedProfile
        }
        parsedSchengenDetails = { city }
      }
    }

    return NextResponse.json({ profile, parsedUsVisaDetails, parsedSchengenDetails })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

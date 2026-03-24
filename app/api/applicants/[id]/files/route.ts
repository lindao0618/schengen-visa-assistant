import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  ApplicantProfileFileSlot,
  isApplicantProfileFileSlot,
  saveApplicantProfileFiles,
  updateApplicantProfileUsVisaDetails,
} from "@/lib/applicant-profiles"
import { extractUsVisaApplicantDetailsFromExcelBuffer } from "@/lib/us-visa-excel-parser"

export const dynamic = "force-dynamic"

const US_VISA_EXCEL_SLOTS = new Set<ApplicantProfileFileSlot>([
  "usVisaDs160Excel",
  "usVisaAisExcel",
  "ds160Excel",
  "aisExcel",
])

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

  let profile = await saveApplicantProfileFiles(session.user.id, params.id, entries)
  if (!profile) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }

  const excelEntry = entries.find((entry) => US_VISA_EXCEL_SLOTS.has(entry.slot))
  let parsedUsVisaDetails:
    | {
        surname?: string
        birthYear?: string
        passportNumber?: string
      }
    | undefined

  if (excelEntry) {
    const parsed = extractUsVisaApplicantDetailsFromExcelBuffer(Buffer.from(await excelEntry.file.arrayBuffer()))
    if (parsed.surname || parsed.birthYear || parsed.passportNumber) {
      const updatedProfile = await updateApplicantProfileUsVisaDetails(session.user.id, params.id, parsed)
      if (updatedProfile) {
        profile = updatedProfile
      }
      parsedUsVisaDetails = parsed
    }
  }

  return NextResponse.json({ profile, parsedUsVisaDetails })
}

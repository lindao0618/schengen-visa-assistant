import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import * as fs from "fs/promises"

import { authOptions } from "@/lib/auth"
import { saveVisaCaseDs160PrecheckFile } from "@/lib/applicant-crm"
import { getApplicantProfileFileByCandidates, saveApplicantProfileFileFromBuffer } from "@/lib/applicant-profiles"
import { extractDs160PrecheckFromExcelBuffer } from "@/lib/us-visa-ds160-precheck"

export const dynamic = "force-dynamic"

const EXCEL_CANDIDATES = ["usVisaDs160Excel", "ds160Excel", "usVisaAisExcel", "aisExcel"] as const

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const applicantProfileId = String(formData.get("applicantProfileId") || "").trim()
    const caseId = String(formData.get("caseId") || "").trim()
    const excelFile = formData.get("excel")

    let buffer: Buffer | null = null
    let sourceName = ""

    if (excelFile instanceof File && excelFile.size > 0) {
      buffer = Buffer.from(await excelFile.arrayBuffer())
      sourceName = excelFile.name || "DS-160 Excel"
    } else if (applicantProfileId) {
      const file = await getApplicantProfileFileByCandidates(
        session.user.id,
        applicantProfileId,
        [...EXCEL_CANDIDATES],
        session.user.role,
      )
      if (!file) {
        return NextResponse.json({ error: "当前申请人档案里没有可用的 DS-160 / AIS Excel" }, { status: 400 })
      }
      buffer = await fs.readFile(file.absolutePath)
      sourceName = file.meta.originalName || file.meta.storedName || "DS-160 Excel"
    }

    if (!buffer) {
      return NextResponse.json({ error: "请先上传 Excel，或选择带有 DS-160 / AIS Excel 的申请人档案" }, { status: 400 })
    }

    const result = extractDs160PrecheckFromExcelBuffer(buffer, sourceName)

    if (caseId) {
      await saveVisaCaseDs160PrecheckFile({
        userId: session.user.id,
        role: session.user.role,
        caseId,
        buffer: Buffer.from(JSON.stringify(result, null, 2), "utf-8"),
        originalName: `ds160-precheck-${caseId}.json`,
        mimeType: "application/json",
      })
    } else if (applicantProfileId) {
      await saveApplicantProfileFileFromBuffer({
        userId: session.user.id,
        id: applicantProfileId,
        slot: "usVisaDs160PrecheckJson",
        buffer: Buffer.from(JSON.stringify(result, null, 2), "utf-8"),
        originalName: "ds160-precheck.json",
        mimeType: "application/json",
        role: session.user.role,
      })
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("DS-160 precheck failed:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "DS-160 预检查失败",
      },
      { status: 500 },
    )
  }
}

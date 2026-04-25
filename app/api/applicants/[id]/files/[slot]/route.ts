import fs from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { canWriteApplicants } from "@/lib/access-control"
import { applicantWriteForbiddenResponse } from "@/lib/access-control-response"
import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { saveApplicantProfileFilesWithAnalysis } from "@/lib/applicant-profile-file-workflow"
import { authOptions } from "@/lib/auth"
import {
  getApplicantProfileFile,
  isApplicantProfileExcelEditableSlot,
  isApplicantProfileFileSlot,
} from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

function buildContentDisposition(filename: string, inline: boolean) {
  const type = inline ? "inline" : "attachment"
  const asciiSafe = /^[\x20-\x7E]*$/.test(filename)
  if (asciiSafe) {
    return `${type}; filename="${filename}"`
  }

  const fallbackExt = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : ""
  const fallbackName = `download${fallbackExt}`
  return `${type}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; slot: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    if (!isApplicantProfileFileSlot(params.slot)) {
      return NextResponse.json({ error: "文件类型不支持" }, { status: 400 })
    }

    const file = await getApplicantProfileFile(session.user.id, params.id, params.slot, session.user.role)
    if (!file) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 })
    }

    const content = await fs.readFile(file.absolutePath)
    const inline = request.nextUrl.searchParams.get("download") !== "1"
    return new NextResponse(content, {
      headers: {
        "Content-Type": file.meta.mimeType || "application/octet-stream",
        "Content-Disposition": buildContentDisposition(file.meta.originalName, inline),
      },
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

const MAX_EXCEL_UPLOAD_BYTES = 20 * 1024 * 1024

export async function PUT(request: NextRequest, { params }: { params: { id: string; slot: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    if (!canWriteApplicants(session.user.role)) {
      return applicantWriteForbiddenResponse()
    }

    if (!isApplicantProfileFileSlot(params.slot) || !isApplicantProfileExcelEditableSlot(params.slot)) {
      return NextResponse.json({ error: "该文件类型不支持在线保存" }, { status: 400 })
    }

    const buffer = Buffer.from(await request.arrayBuffer())
    if (!buffer.length) {
      return NextResponse.json({ error: "文件内容为空" }, { status: 400 })
    }
    if (buffer.length > MAX_EXCEL_UPLOAD_BYTES) {
      return NextResponse.json({ error: "文件过大" }, { status: 413 })
    }

    const headerName = request.headers.get("x-excel-original-name")
    const decodedName = headerName ? decodeURIComponent(headerName) : ""

    const existing = await getApplicantProfileFile(session.user.id, params.id, params.slot, session.user.role)
    const baseName = decodedName || existing?.meta.originalName || `${params.slot}.xlsx`
    const originalName = /\.xlsx$/i.test(baseName) ? baseName : baseName.replace(/\.xls$/i, ".xlsx")

    const result = await saveApplicantProfileFilesWithAnalysis(
      session.user.id,
      params.id,
      [
        {
          slot: params.slot,
          file: new File([buffer], originalName, {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        },
      ],
      session.user.role,
    )

    if (!result?.profile) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    return NextResponse.json({
      profile: result.profile,
      parsedUsVisaDetails: result.parsedUsVisaDetails,
      parsedUsVisaFullIntake: result.parsedUsVisaFullIntake,
      parsedSchengenDetails: result.parsedSchengenDetails,
      parsedSchengenFullIntake: result.parsedSchengenFullIntake,
      schengenAudit: result.schengenAudit,
      usVisaAudit: result.usVisaAudit,
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

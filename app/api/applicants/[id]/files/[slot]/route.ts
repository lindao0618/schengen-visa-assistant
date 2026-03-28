import fs from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
import { getApplicantProfileFile, isApplicantProfileFileSlot } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
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

    const file = await getApplicantProfileFile(
      session.user.id,
      params.id,
      params.slot,
      session.user.role,
    )
    if (!file) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 })
    }

    const content = await fs.readFile(file.absolutePath)
    return new NextResponse(content, {
      headers: {
        "Content-Type": file.meta.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.meta.originalName)}"`,
      },
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { buildApplicantSchengenIntakeView, buildApplicantUsVisaIntakeView } from "@/lib/agent-file-parsing"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

type IntakeScope = "usVisa" | "schengen"

function resolveIntakeScope(value: string | null): IntakeScope | null {
  return value === "usVisa" || value === "schengen" ? value : null
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const scope = resolveIntakeScope(request.nextUrl.searchParams.get("scope"))
    if (!scope) {
      return NextResponse.json({ error: "intake 类型不支持" }, { status: 400 })
    }

    const view =
      scope === "usVisa"
        ? await buildApplicantUsVisaIntakeView(session.user.id, params.id, session.user.role)
        : await buildApplicantSchengenIntakeView(session.user.id, params.id, session.user.role)

    if (!view) {
      return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
    }

    return NextResponse.json({
      scope,
      intake: view.intake,
      sourceFile: view.sourceFile
        ? {
            slot: view.sourceFile.slot,
            originalName: view.sourceFile.originalName,
            uploadedAt: view.sourceFile.uploadedAt,
          }
        : null,
      photo: "photo" in view && view.photo
        ? {
            slot: view.photo.slot,
            originalName: view.photo.originalName,
            uploadedAt: view.photo.uploadedAt,
          }
        : null,
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

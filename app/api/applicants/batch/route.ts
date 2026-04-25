import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { handleApplicantProfileApiError } from "@/lib/applicant-profile-api-error"
import { authOptions } from "@/lib/auth"
import { deleteApplicantProfilesBatch, updateApplicantProfilesGroupName } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

function normalizeIds(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : []
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ids = normalizeIds(body?.ids)
    if (ids.length === 0) {
      return NextResponse.json({ error: "请至少选择一个申请人" }, { status: 400 })
    }

    const groupName =
      typeof body?.groupName === "string" && body.groupName.trim()
        ? body.groupName.trim()
        : null

    const result = await updateApplicantProfilesGroupName(session.user.id, ids, groupName, session.user.role)
    return NextResponse.json({
      success: true,
      updatedIds: result.updatedIds,
      groupName,
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ids = normalizeIds(body?.ids)
    if (ids.length === 0) {
      return NextResponse.json({ error: "请至少选择一个申请人" }, { status: 400 })
    }

    const result = await deleteApplicantProfilesBatch(session.user.id, ids, session.user.role)
    return NextResponse.json({
      success: true,
      deletedIds: result.deletedIds,
    })
  } catch (error) {
    return handleApplicantProfileApiError(error)
  }
}

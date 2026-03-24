import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  deleteApplicantProfile,
  getApplicantProfile,
  updateApplicantProfile,
} from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const profile = await getApplicantProfile(session.user.id, params.id)
  if (!profile) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }
  return NextResponse.json({ profile })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const body = await request.json()
  const profile = await updateApplicantProfile(session.user.id, params.id, body ?? {})
  if (!profile) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }
  return NextResponse.json({ profile })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const deleted = await deleteApplicantProfile(session.user.id, params.id)
  if (!deleted) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}

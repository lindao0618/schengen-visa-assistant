import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { createApplicantProfile, listApplicantProfiles } from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const profiles = await listApplicantProfiles(session.user.id)
  return NextResponse.json({ profiles })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const body = await request.json()
  const profile = await createApplicantProfile(session.user.id, body ?? {})
  return NextResponse.json({ profile }, { status: 201 })
}

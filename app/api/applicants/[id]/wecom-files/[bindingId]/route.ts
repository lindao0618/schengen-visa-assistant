import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { deleteApplicantWecomFileBinding } from "@/lib/applicant-wecom-files"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; bindingId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bindings = await deleteApplicantWecomFileBinding({
    actorUserId: session.user.id,
    applicantId: params.id,
    bindingId: params.bindingId,
    role: session.user.role,
  })

  if (bindings === null) {
    return NextResponse.json({ error: "Binding not found" }, { status: 404 })
  }

  return NextResponse.json({ items: bindings })
}

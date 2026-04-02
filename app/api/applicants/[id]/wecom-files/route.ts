import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import {
  listApplicantWecomFileBindings,
  upsertApplicantWecomFileBinding,
} from "@/lib/applicant-wecom-files"
import { authOptions } from "@/lib/auth"
import { getWecomDriveFileInfo, getWecomDriveRootById, looksLikeWecomFolder } from "@/lib/wecom-drive"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bindings = await listApplicantWecomFileBindings(session.user.id, params.id, session.user.role)
  if (bindings === null) {
    return NextResponse.json({ error: "Applicant not found" }, { status: 404 })
  }

  return NextResponse.json({ items: bindings })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const rootId = typeof body?.rootId === "string" ? body.rootId.trim() : ""
  const fileId = typeof body?.fileId === "string" ? body.fileId.trim() : ""

  if (!rootId || !fileId) {
    return NextResponse.json({ error: "rootId and fileId are required" }, { status: 400 })
  }

  const root = getWecomDriveRootById(rootId)
  if (!root) {
    return NextResponse.json({ error: "Unknown WeCom drive root" }, { status: 404 })
  }

  try {
    const file = await getWecomDriveFileInfo(fileId)
    if (looksLikeWecomFolder(file)) {
      return NextResponse.json({ error: "Folders cannot be linked as applicant files" }, { status: 400 })
    }

    const bindings = await upsertApplicantWecomFileBinding({
      actorUserId: session.user.id,
      applicantId: params.id,
      role: session.user.role,
      rootId: root.id,
      rootLabel: root.label,
      file,
    })

    if (bindings === null) {
      return NextResponse.json({ error: "Applicant not found" }, { status: 404 })
    }

    return NextResponse.json({ items: bindings })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to bind WeCom drive file",
      },
      { status: 500 },
    )
  }
}

import fs from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { getVisaCaseDs160PrecheckFile } from "@/lib/applicant-crm"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const file = await getVisaCaseDs160PrecheckFile(session.user.id, session.user.role, params.id)
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const content = await fs.readFile(file.absolutePath)
    return new NextResponse(content, {
      headers: {
        "Content-Type": file.meta.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.meta.originalName)}"`,
      },
    })
  } catch (error) {
    console.error("[API_CASE_PRECHECK_FILE_GET]", error)
    return NextResponse.json({ error: "Failed to read precheck file" }, { status: 500 })
  }
}

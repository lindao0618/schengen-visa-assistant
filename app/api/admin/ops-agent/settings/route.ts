import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { adminForbiddenResponse, getAdminSession } from "@/lib/admin-auth"
import prisma from "@/lib/db"
import {
  OPS_AGENT_GLOBAL_SETTINGS_KEY,
  normalizeOpsAgentGlobalSettings,
} from "@/lib/ops-agent-settings"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const session = await getAdminSession()
  return session ? session : null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return adminForbiddenResponse()

  const setting = await prisma.adminSetting.findUnique({
    where: { key: OPS_AGENT_GLOBAL_SETTINGS_KEY },
  })
  const settings = normalizeOpsAgentGlobalSettings(setting?.valueJson)

  return NextResponse.json({ success: true, settings })
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return adminForbiddenResponse()

  const body = await request.json().catch(() => ({}))
  const settings = normalizeOpsAgentGlobalSettings(body?.settings ?? body)
  const valueJson = settings as unknown as Prisma.InputJsonValue

  await prisma.adminSetting.upsert({
    where: { key: OPS_AGENT_GLOBAL_SETTINGS_KEY },
    create: { key: OPS_AGENT_GLOBAL_SETTINGS_KEY, valueJson },
    update: { valueJson },
  })

  return NextResponse.json({ success: true, settings })
}

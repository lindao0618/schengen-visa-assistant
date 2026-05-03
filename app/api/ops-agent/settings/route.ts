import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import {
  DEFAULT_OPS_AGENT_USER_PREFS,
  OPS_AGENT_GLOBAL_SETTINGS_KEY,
  buildEffectiveOpsAgentSettings,
  getOpsAgentUserPrefsKey,
  normalizeOpsAgentGlobalSettings,
  normalizeOpsAgentUserPrefs,
} from "@/lib/ops-agent-settings"

export const dynamic = "force-dynamic"

async function loadSettingsForUser(userId: string) {
  const [globalSetting, userSetting] = await Promise.all([
    prisma.adminSetting.findUnique({ where: { key: OPS_AGENT_GLOBAL_SETTINGS_KEY } }),
    prisma.adminSetting.findUnique({ where: { key: getOpsAgentUserPrefsKey(userId) } }),
  ])
  const global = normalizeOpsAgentGlobalSettings(globalSetting?.valueJson)
  const prefs = normalizeOpsAgentUserPrefs(userSetting?.valueJson ?? DEFAULT_OPS_AGENT_USER_PREFS, global)

  return {
    global,
    prefs,
    effective: buildEffectiveOpsAgentSettings(global, prefs),
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const settings = await loadSettingsForUser(userId)
  return NextResponse.json({ success: true, ...settings })
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { global } = await loadSettingsForUser(userId)
  const prefs = normalizeOpsAgentUserPrefs(body?.prefs ?? body, global)
  const valueJson = prefs as unknown as Prisma.InputJsonValue

  await prisma.adminSetting.upsert({
    where: { key: getOpsAgentUserPrefsKey(userId) },
    create: { key: getOpsAgentUserPrefsKey(userId), valueJson },
    update: { valueJson },
  })

  return NextResponse.json({
    success: true,
    global,
    prefs,
    effective: buildEffectiveOpsAgentSettings(global, prefs),
  })
}

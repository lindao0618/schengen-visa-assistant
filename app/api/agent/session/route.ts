import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  return NextResponse.json({
    actor,
    auth: {
      apiKeyConfigured: Boolean(process.env.AGENT_API_KEY),
      boundUserIdConfigured: Boolean(process.env.AGENT_API_USER_ID),
      boundUserEmailConfigured: Boolean(process.env.AGENT_API_USER_EMAIL),
    },
  })
}

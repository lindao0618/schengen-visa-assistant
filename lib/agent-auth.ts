import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

export interface AgentActor {
  userId: string
  role?: string
  name?: string
  email?: string
  authMode: "session" | "api_key"
  isMachine: boolean
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization")?.trim() || ""
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ""
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

async function resolveMachineBoundUser() {
  const userId = process.env.AGENT_API_USER_ID?.trim()
  if (userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, email: true, status: true },
    })
  }

  const email = process.env.AGENT_API_USER_EMAIL?.trim()
  if (email) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, name: true, email: true, status: true },
    })
  }

  return null
}

export async function requireAgentActor(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const configuredApiKey = process.env.AGENT_API_KEY?.trim() || ""
  const providedApiKey =
    request.headers.get("x-agent-api-key")?.trim() ||
    readBearerToken(request)

  if (providedApiKey) {
    if (!configuredApiKey) {
      return {
        actor: null,
        response: jsonError("AGENT_API_KEY 未配置", 500),
      }
    }

    if (!safeEqual(providedApiKey, configuredApiKey)) {
      return {
        actor: null,
        response: jsonError("Agent API Key 无效", 401),
      }
    }

    const boundUser = await resolveMachineBoundUser()
    if (!boundUser) {
      return {
        actor: null,
        response: jsonError("未配置 AGENT_API_USER_ID 或 AGENT_API_USER_EMAIL", 500),
      }
    }

    if (boundUser.status !== "active") {
      return {
        actor: null,
        response: jsonError("Agent 绑定账号不可用", 403),
      }
    }

    return {
      actor: {
        userId: boundUser.id,
        role: boundUser.role,
        name: boundUser.name ?? undefined,
        email: boundUser.email,
        authMode: "api_key" as const,
        isMachine: true,
      },
      response: null,
    }
  }

  if (session?.user?.id) {
    return {
      actor: {
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name ?? undefined,
        email: session.user.email ?? undefined,
        authMode: "session" as const,
        isMachine: false,
      },
      response: null,
    }
  }

  return {
    actor: null,
    response: jsonError(configuredApiKey ? "未授权的 Agent 请求" : "未登录", 401),
  }
}

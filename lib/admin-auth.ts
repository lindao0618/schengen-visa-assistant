import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { canAccessAdminPortal, canManageUsers, normalizeAppRole } from "@/lib/access-control"
import { authOptions } from "@/lib/auth"

export async function getAdminSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  if (!session) return null

  session.user.role = normalizeAppRole(session.user?.role)
  if (!canAccessAdminPortal(session.user.role)) return null

  return session
}

export async function getBossSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  if (!session) return null

  session.user.role = normalizeAppRole(session.user?.role)
  if (!canManageUsers(session.user.role)) return null

  return session
}

export function adminForbiddenResponse() {
  return NextResponse.json(
    { success: false, message: "无权限访问" },
    { status: 403 }
  )
}

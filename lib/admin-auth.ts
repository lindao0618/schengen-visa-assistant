import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"

export async function getAdminSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== "admin") return null
  return session
}

export function adminForbiddenResponse() {
  return NextResponse.json(
    { success: false, message: "无权限访问" },
    { status: 403 }
  )
}

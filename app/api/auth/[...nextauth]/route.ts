import NextAuth from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getPublicUiPreviewSession, isPublicUiPreviewEnabled } from "@/lib/public-ui-preview"

const handler = NextAuth(authOptions)

type NextAuthRouteContext = {
  params: {
    nextauth: string[]
  }
}

export async function GET(request: NextRequest, context: NextAuthRouteContext) {
  if (isPublicUiPreviewEnabled()) {
    const { pathname } = new URL(request.url)
    if (pathname.endsWith("/api/auth/session")) {
      return NextResponse.json(getPublicUiPreviewSession())
    }
  }

  return handler(request, context)
}

export async function POST(request: NextRequest, context: NextAuthRouteContext) {
  return handler(request, context)
}

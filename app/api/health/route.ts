import { NextResponse } from "next/server"

import { getHealthCheck } from "@/lib/health"

export const dynamic = "force-dynamic"

export async function GET() {
  const health = getHealthCheck()
  const status = health.status === "ok" ? 200 : 503
  return NextResponse.json(health, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

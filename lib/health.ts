export type HealthStatus = "ok" | "degraded"

export type HealthCheckResult = {
  status: HealthStatus
  service: string
  timestamp: string
  uptimeSeconds: number
  environment: string
  checks: {
    databaseUrl: boolean
    nextAuthSecret: boolean
    nextAuthUrl: boolean
  }
}

export function getHealthCheck(env: NodeJS.ProcessEnv = process.env): HealthCheckResult {
  const checks = {
    databaseUrl: Boolean(env.DATABASE_URL),
    nextAuthSecret: Boolean(env.NEXTAUTH_SECRET),
    nextAuthUrl: Boolean(env.NEXTAUTH_URL),
  }

  return {
    status: Object.values(checks).every(Boolean) ? "ok" : "degraded",
    service: "visa-assistant",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV || "development",
    checks,
  }
}

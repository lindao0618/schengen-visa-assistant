import assert from "node:assert/strict"
import test from "node:test"

import { getHealthCheck } from "../lib/health"

test("getHealthCheck returns ok when required env exists", () => {
  const health = getHealthCheck({
    DATABASE_URL: "postgresql://example",
    NEXTAUTH_SECRET: "secret",
    NEXTAUTH_URL: "https://example.com",
    NODE_ENV: "production",
  })

  assert.equal(health.status, "ok")
  assert.equal(health.environment, "production")
  assert.deepEqual(health.checks, {
    databaseUrl: true,
    nextAuthSecret: true,
    nextAuthUrl: true,
  })
})

test("getHealthCheck returns degraded when required env is missing", () => {
  const health = getHealthCheck({
    DATABASE_URL: "postgresql://example",
  })

  assert.equal(health.status, "degraded")
  assert.equal(health.checks.databaseUrl, true)
  assert.equal(health.checks.nextAuthSecret, false)
  assert.equal(health.checks.nextAuthUrl, false)
})

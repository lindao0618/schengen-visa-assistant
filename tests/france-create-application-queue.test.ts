import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("france create-application route serializes browser automation jobs", () => {
  const source = readFileSync(
    join(process.cwd(), "app/api/schengen/france/create-application/route.ts"),
    "utf8",
  )

  assert.match(source, /let createApplicationQueue: Promise<void>/)
  assert.match(source, /function enqueueCreateApplicationTask/)
  assert.match(source, /void enqueueCreateApplicationTask/)
  assert.match(source, /已加入生成队列/)
})

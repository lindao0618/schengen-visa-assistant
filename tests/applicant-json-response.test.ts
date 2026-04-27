import test from "node:test"
import assert from "node:assert/strict"

import { readJsonSafely } from "../app/applicants/[id]/detail/json-response"

test("readJsonSafely parses JSON response bodies", async () => {
  const response = new Response(JSON.stringify({ ok: true, count: 2 }))

  assert.deepEqual(await readJsonSafely<{ ok: boolean; count: number }>(response), {
    ok: true,
    count: 2,
  })
})

test("readJsonSafely returns null for empty response bodies", async () => {
  const response = new Response("")

  assert.equal(await readJsonSafely<{ ok: boolean }>(response), null)
})

import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("app/template.tsx is a server shell and does not add a duplicate SessionProvider", () => {
  const source = readSource("app/template.tsx")

  assert.doesNotMatch(source, /"use client"|'use client'/)
  assert.doesNotMatch(source, /SessionProvider/)
  assert.doesNotMatch(source, /next-auth\/react/)
})

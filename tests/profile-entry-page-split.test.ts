import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("profile route lazy-loads its interactive client page", () => {
  const source = readSource("app/profile/page.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/ProfileClientPage["']\)/)
  assert.doesNotMatch(source, /useState/)
  assert.doesNotMatch(source, /TabsContent/)
  assert.doesNotMatch(source, /useEffect/)
})

test("profile client keeps the account editing implementation", () => {
  const source = readSource("app/profile/ProfileClientPage.tsx")

  assert.match(source, /"use client"/)
  assert.match(source, /useState/)
  assert.match(source, /\/api\/users\/me/)
  assert.match(source, /\/api\/users\/avatar/)
})

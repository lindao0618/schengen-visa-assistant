import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("active applicant profile polling skips hidden browser tabs", () => {
  const source = readSource("hooks/use-active-applicant-profile.ts")

  assert.match(source, /document\.visibilityState\s*!==\s*"visible"/)
  assert.match(source, /addEventListener\("visibilitychange"/)
  assert.match(source, /removeEventListener\("visibilitychange"/)
})

test("active applicant profile hydrates file metadata from the dedicated files endpoint", () => {
  const source = readSource("hooks/use-active-applicant-profile.ts")

  assert.match(source, /\/api\/applicants\/\$\{id\}\/files/)
  assert.match(source, /filesData\.files/)
  assert.doesNotMatch(source, /view=active&includeProfileFiles=1/)
})

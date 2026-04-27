import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("ApplicantProfileSelector keeps command search panel out of the base bundle", () => {
  const source = readFileSync(join(process.cwd(), "components/applicant-profile-selector.tsx"), "utf8")

  assert.doesNotMatch(source, /from ["']@\/components\/ui\/command["']/)
  assert.match(source, /dynamic\(/)
})

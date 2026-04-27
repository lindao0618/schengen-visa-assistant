import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("ApplicantProfileSelector does not prefetch applicant detail on mount", () => {
  const source = readFileSync(join(process.cwd(), "components/applicant-profile-selector.tsx"), "utf8")

  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => \{\s*prefetchActiveApplicantDetail\(\)\s*\}, \[prefetchActiveApplicantDetail\]\)/,
  )
})

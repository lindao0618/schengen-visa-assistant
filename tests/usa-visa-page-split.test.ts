import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("usa visa page lazy-loads tab forms and task lists", () => {
  const source = readFileSync(join(process.cwd(), "app/usa-visa/page.tsx"), "utf8")

  assert.match(source, /dynamic\(/)
  assert.doesNotMatch(source, /import \{ PhotoChecker \} from "\.\/components\/photo-checker"/)
  assert.doesNotMatch(source, /import \{ DS160Form \} from "\.\/components\/ds160-form"/)
  assert.doesNotMatch(source, /import \{ SubmitDS160Form \} from "\.\/components\/submit-ds160-form"/)
  assert.doesNotMatch(source, /import \{ RegisterAISForm \} from "\.\/components\/register-ais-form"/)
  assert.doesNotMatch(source, /import \{ InterviewBriefForm \} from "\.\/components\/interview-brief-form"/)
  assert.doesNotMatch(source, /import \{ TaskList \} from "\.\/components\/task-list"/)
})

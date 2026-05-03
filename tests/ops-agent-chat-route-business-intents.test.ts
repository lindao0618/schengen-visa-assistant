import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("ops agent routes dashboard buttons to deterministic business tools", () => {
  const source = readSource("app/api/ops-agent/chat/route.ts")

  assert.match(source, /今日简报/)
  assert.match(source, /getDailyBriefTool/)
  assert.match(source, /待确认队列|缺人文件名|低置信度建档/)
  assert.match(source, /usedModel:\s*false/)
})

test("ops agent daily brief hides raw failure logs behind readable reasons", () => {
  const source = readSource("lib/ops-agent-business-tools.ts")

  assert.match(source, /taskTimestampToIso/)
  assert.match(source, /summary\.rootCause/)
  assert.doesNotMatch(source, /reason:\s*task\.error\s*\|\|\s*task\.message/)
})

test("ops agent file uploads create deterministic archive confirmation cards", () => {
  const source = readSource("app/api/ops-agent/chat/route.ts")

  assert.match(source, /fileArchiveConfirmation/)
  assert.match(source, /确认归档/)
  assert.match(source, /usedModel:\s*false/)
})

test("ops agent follow-up shortcut defaults to missing-materials scenario", () => {
  const source = readSource("app/api/ops-agent/chat/route.ts")

  assert.match(source, /缺\|材料\|补\|催办\|话术/)
  assert.match(source, /generateFollowUpMessageTool/)
})

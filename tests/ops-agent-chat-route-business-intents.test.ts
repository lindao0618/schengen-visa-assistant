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

test("ops agent can list current account visible applicants with permission summary", () => {
  const routeSource = readSource("app/api/ops-agent/chat/route.ts")
  const toolSource = readSource("lib/ops-agent-business-tools.ts")

  assert.match(routeSource, /listCurrentAccountApplicantsTool/)
  assert.match(routeSource, /isCurrentAccountApplicantListIntent/)
  assert.match(routeSource, /renderApplicantList/)
  assert.match(routeSource, /当前账号|我的申请人|申请人列表/)
  assert.match(routeSource, /usedModel:\s*false/)

  assert.match(toolSource, /export async function listCurrentAccountApplicantsTool/)
  assert.match(toolSource, /listApplicantCrmData/)
  assert.match(toolSource, /includeProfileFiles:\s*false/)
  assert.match(toolSource, /canReadAllApplicants/)
  assert.match(toolSource, /canTriggerAutomation/)
})

test("ops agent applicant fact questions query visible applicant records before model fallback", () => {
  const routeSource = readSource("app/api/ops-agent/chat/route.ts")
  const toolSource = readSource("lib/ops-agent-business-tools.ts")

  assert.match(routeSource, /isApplicantFactLookupIntent/)
  assert.match(routeSource, /extractApplicantLookupKeyword/)
  assert.match(routeSource, /keyword:\s*applicantKeyword/)
  assert.match(routeSource, /intent:\s*"lookupApplicantFacts"/)
  assert.match(routeSource, /严禁编造姓名、数量、日期或状态/)

  assert.match(toolSource, /keyword\?:\s*string/)
  assert.match(toolSource, /keyword:\s*params\.keyword/)
})

test("ops agent model fallback exposes only session-scoped internal api tools", () => {
  const routeSource = readSource("app/api/ops-agent/chat/route.ts")

  assert.match(routeSource, /OPS_AGENT_MODEL_TOOLS/)
  assert.match(routeSource, /list_current_account_applicants/)
  assert.match(routeSource, /executeOpsAgentModelToolCall/)
  assert.match(routeSource, /tool_call_id/)
  assert.match(routeSource, /userId,\s*role/)
  assert.doesNotMatch(routeSource, /requestedUserId/)
})

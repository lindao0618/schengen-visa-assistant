import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("deepseek v4 requests include thinking and reasoning effort controls", () => {
  const source = readSource("lib/ops-agent-llm.ts")

  assert.match(source, /deepseek-v4/)
  assert.match(source, /thinking/)
  assert.match(source, /reasoning_effort/)
  assert.match(source, /stream:\s*false/)
})

test("ops agent model calls can pass function tools and preserve tool call messages", () => {
  const source = readSource("lib/ops-agent-llm.ts")

  assert.match(source, /tools\?:\s*OpsAgentToolDefinition\[\]/)
  assert.match(source, /toolCalls:\s*OpsAgentToolCall\[\]/)
  assert.match(source, /tool_choice/)
  assert.match(source, /message\.tool_calls/)
  assert.match(source, /tool_call_id/)
  assert.match(source, /role:\s*"system"\s*\|\s*"user"\s*\|\s*"assistant"\s*\|\s*"tool"/)
})

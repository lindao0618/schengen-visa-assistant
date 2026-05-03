import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("ops agent workbench switches cards by page context", () => {
  const source = readSource("components/ops-agent-dock.tsx")

  assert.match(source, /isApplicantPage/)
  assert.match(source, /GlobalBriefCard/)
  assert.match(source, /PendingQueueCard/)
  assert.match(source, /isApplicantPage\s*\?\s*</)
  assert.match(source, /setInterval\(refreshPageContext/)
})

test("material gaps provide inline upload and left-page targeting", () => {
  const source = readSource("components/ops-agent-dock.tsx")

  assert.match(source, /activeUploadTarget/)
  assert.match(source, /选择文件/)
  assert.match(source, /onDrop/)
  assert.match(source, /emitAgentTargetEvent\("highlight"/)
  assert.match(source, /focusLeftTarget/)
})

test("blocking material gaps disable build-table automation", () => {
  const source = readSource("components/ops-agent-dock.tsx")

  assert.match(source, /hasBlockingGaps/)
  assert.match(source, /disabled=\{hasBlockingGaps/)
  assert.match(source, /核心材料未齐，暂不可建表/)
})

test("structured agent cards render item lists instead of raw json", () => {
  const source = readSource("components/ops-agent-dock.tsx")

  assert.match(source, /formatCardItems/)
  assert.match(source, /item\.nextAction/)
  assert.doesNotMatch(source, /card\.content\s*\|\|\s*card\.description\s*\|\|\s*card\.items/)
})

test("agent chat messages render lightweight markdown formatting", () => {
  const source = readSource("components/ops-agent-dock.tsx")

  assert.match(source, /function MarkdownText/)
  assert.match(source, /function renderInlineMarkdown/)
  assert.match(source, /<strong/)
  assert.match(source, /<ul/)
  assert.match(source, /<MarkdownText content=\{message\.content\}/)
  assert.doesNotMatch(source, /whitespace-pre-wrap leading-6">\{message\.content\}/)
})

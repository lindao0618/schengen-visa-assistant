import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("france automation route lazy-loads its heavy client page", () => {
  const pageSource = readFileSync(join(process.cwd(), "app/schengen-visa/france/automation/page.tsx"), "utf8")

  assert.match(pageSource, /dynamic\(/)
  assert.doesNotMatch(pageSource, /FranceTaskList/)
  assert.doesNotMatch(pageSource, /function StepCard/)
  assert.doesNotMatch(pageSource, /function TlsApplyCard/)
})

test("france automation client lazy-loads task list and quick start modules", () => {
  const clientSource = readFileSync(
    join(process.cwd(), "app/schengen-visa/france/automation/FranceAutomationClientPage.tsx"),
    "utf8",
  )

  assert.match(clientSource, /dynamic\(/)
  assert.doesNotMatch(clientSource, /import \{ FranceTaskList \} from "\.\/FranceTaskList"/)
  assert.doesNotMatch(clientSource, /import \{ FranceQuickStartCard \} from "\.\/FranceQuickStartCard"/)
})

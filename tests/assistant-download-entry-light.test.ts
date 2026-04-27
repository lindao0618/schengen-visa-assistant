import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("app/ai-assistant/page.tsx lazy-loads the chat client page", () => {
  const routeSource = readSource("app/ai-assistant/page.tsx")

  assert.match(routeSource, /dynamic\(/)
  assert.match(routeSource, /import\(["']\.\/AIAssistantClientPage["']\)/)
  assert.doesNotMatch(routeSource, /useState/)
  assert.doesNotMatch(routeSource, /useEffect/)
  assert.doesNotMatch(routeSource, /useRef/)
  assert.doesNotMatch(routeSource, /fetch\(["']http:\/\/localhost:8000\/ask-stream["']/)
})

test("app/ai-assistant/AIAssistantClientPage.tsx keeps the chat implementation", () => {
  const clientPath = "app/ai-assistant/AIAssistantClientPage.tsx"

  assert.equal(existsSync(join(process.cwd(), clientPath)), true)

  const clientSource = readSource(clientPath)
  assert.match(clientSource, /"use client"/)
  assert.match(clientSource, /useState/)
  assert.match(clientSource, /fetch\(["']http:\/\/localhost:8000\/ask-stream["']/)
})

test("app/download/success/page.tsx stays server-only and avoids heavy client UI imports", () => {
  const source = readSource("app/download/success/page.tsx")

  assert.doesNotMatch(source, /"use client"/)
  assert.doesNotMatch(source, /lucide-react/)
  assert.doesNotMatch(source, /@\/components\/ui\/card/)
  assert.doesNotMatch(source, /@\/components\/ui\/button/)
})

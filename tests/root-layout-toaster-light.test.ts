import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("app/layout.tsx does not eagerly load the toaster or no-op theme provider", () => {
  const source = readSource("app/layout.tsx")

  assert.match(source, /LazyToaster/)
  assert.doesNotMatch(source, /@\/components\/ui\/sonner/)
  assert.doesNotMatch(source, /@\/components\/theme-provider/)
  assert.doesNotMatch(source, /<ThemeProvider>/)
})

test("components/lazy-toaster.tsx defers sonner into an async client chunk", () => {
  const path = "components/lazy-toaster.tsx"

  assert.equal(existsSync(join(process.cwd(), path)), true)

  const source = readSource(path)
  assert.match(source, /"use client"/)
  assert.match(source, /dynamic(?:<[^>]+>)?\(/)
  assert.match(source, /import\(["']\.\/ui\/sonner["']\)/)
  assert.match(source, /ssr:\s*false/)
})

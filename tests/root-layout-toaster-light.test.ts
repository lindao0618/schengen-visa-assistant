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

test("app/layout.tsx declares explicit browser icons", () => {
  const source = readSource("app/layout.tsx")

  assert.equal(existsSync(join(process.cwd(), "public/favicon.svg")), true)
  assert.match(source, /icons:/)
  assert.match(source, /icon:\s*"\/favicon\.svg"/)
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

test("global css does not force heavy active tab chrome", () => {
  const source = readSource("app/globals.css")

  assert.doesNotMatch(source, /\[role="tab"\]\[data-state="active"\]::after/)
  assert.doesNotMatch(source, /background-color:\s*#000/)
  assert.doesNotMatch(source, /linear-gradient\(135deg,\s*#d1d5db,\s*#ffffff\)/)
  assert.doesNotMatch(source, /transform:\s*translateY\(-2px\)/)
  assert.doesNotMatch(source, /\.rounded-xl button/)
  assert.doesNotMatch(source, /rgba\(217,\s*119,\s*6/)
  assert.match(source, /rgba\(37,\s*99,\s*235,\s*0\.28\)/)
})

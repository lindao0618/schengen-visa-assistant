import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("components/nav-bar.tsx renders the global navigation without a client bundle", () => {
  const source = readSource("components/nav-bar.tsx")

  assert.doesNotMatch(source, /"use client"/)
  assert.doesNotMatch(source, /next-auth\/react/)
  assert.doesNotMatch(source, /next\/navigation/)
  assert.doesNotMatch(source, /lucide-react/)
  assert.doesNotMatch(source, /@\/components\/ui\/button/)
  assert.doesNotMatch(source, /@\/components\/ui\/dropdown-menu/)
  assert.match(source, /NavBarAuthActions/)
})

test("components/nav-bar.tsx uses the blue-neutral shell palette", () => {
  const source = readSource("components/nav-bar.tsx")

  assert.match(source, /bg-\[linear-gradient\(135deg,_#2563eb,_#38bdf8\)\]/)
  assert.match(source, /bg-blue-50/)
  assert.match(source, /text-blue-700/)
  assert.match(source, /shadow-blue-100/)
  assert.doesNotMatch(source, /bg-gray-900/)
})

test("components/nav-bar-auth-actions.tsx keeps session behavior isolated", () => {
  const path = "components/nav-bar-auth-actions.tsx"

  assert.equal(existsSync(join(process.cwd(), path)), true)

  const source = readSource(path)
  assert.match(source, /"use client"/)
  assert.match(source, /useSession/)
  assert.match(source, /signOut/)
  assert.match(source, /next-auth\/react/)
})

test("components/nav-bar-auth-actions.tsx keeps auth buttons in the same shell palette", () => {
  const source = readSource("components/nav-bar-auth-actions.tsx")

  assert.match(source, /bg-blue-600/)
  assert.match(source, /hover:bg-blue-700/)
  assert.doesNotMatch(source, /bg-gray-900/)
})

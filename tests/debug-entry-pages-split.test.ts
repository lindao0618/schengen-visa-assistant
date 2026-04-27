import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const debugPages = [
  {
    route: "app/debug-auth/page.tsx",
    client: "app/debug-auth/DebugAuthClientPage.tsx",
    importPath: "./DebugAuthClientPage",
  },
  {
    route: "app/admin/test-auth/page.tsx",
    client: "app/admin/test-auth/AdminTestAuthClientPage.tsx",
    importPath: "./AdminTestAuthClientPage",
  },
  {
    route: "app/debug-booking/page.tsx",
    client: "app/debug-booking/DebugBookingClientPage.tsx",
    importPath: "./DebugBookingClientPage",
  },
]

for (const page of debugPages) {
  test(`${page.route} lazy-loads its debug client page`, () => {
    const source = readSource(page.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${page.importPath}["']\\)`))
    assert.doesNotMatch(source, /useState/)
    assert.doesNotMatch(source, /useEffect/)
    assert.doesNotMatch(source, /useSession/)
    assert.doesNotMatch(source, /next-auth\/react/)
  })

  test(`${page.client} keeps the debug implementation`, () => {
    const source = readSource(page.client)

    assert.match(source, /"use client"/)
    assert.match(source, /useState|useSession/)
  })
}

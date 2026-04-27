import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const entryPages = [
  {
    route: "app/schengen-visa/page.tsx",
    client: "app/schengen-visa/SchengenVisaClientPage.tsx",
    importPath: "./SchengenVisaClientPage",
  },
  {
    route: "app/schengen-visa/application/page.tsx",
    client: "app/schengen-visa/application/SchengenApplicationClientPage.tsx",
    importPath: "./SchengenApplicationClientPage",
  },
  {
    route: "app/schengen-visa/slot-booking/page.tsx",
    client: "app/schengen-visa/slot-booking/SchengenSlotBookingClientPage.tsx",
    importPath: "./SchengenSlotBookingClientPage",
  },
]

for (const page of entryPages) {
  test(`${page.route} lazy-loads its heavy client page`, () => {
    const source = readSource(page.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${page.importPath}["']\\)`))
    assert.doesNotMatch(source, /useRouter/)
    assert.doesNotMatch(source, /next\/image/)
    assert.doesNotMatch(source, /lucide-react/)
  })

  test(`${page.client} keeps the interactive implementation`, () => {
    const source = readSource(page.client)

    assert.match(source, /"use client"/)
    assert.match(source, /useRouter/)
    assert.match(source, /next\/image/)
  })
}

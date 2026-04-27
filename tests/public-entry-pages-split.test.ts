import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const publicPages = [
  {
    route: "app/signup/page.tsx",
    client: "app/signup/SignUpClientPage.tsx",
    importPath: "./SignUpClientPage",
  },
  {
    route: "app/visa-info/page.tsx",
    client: "app/visa-info/VisaInfoClientPage.tsx",
    importPath: "./VisaInfoClientPage",
  },
  {
    route: "app/apply/uk/page.tsx",
    client: "app/apply/uk/UKVisaApplicationClientPage.tsx",
    importPath: "./UKVisaApplicationClientPage",
  },
]

for (const page of publicPages) {
  test(`${page.route} lazy-loads its public client page`, () => {
    const source = readSource(page.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${page.importPath}["']\\)`))
    assert.doesNotMatch(source, /useState/)
    assert.doesNotMatch(source, /useRouter/)
  })

  test(`${page.client} keeps the interactive public implementation`, () => {
    const source = readSource(page.client)

    assert.match(source, /"use client"/)
    assert.match(source, /useState/)
  })
}

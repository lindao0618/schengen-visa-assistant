import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const schengenPages = [
  {
    route: "app/schengen-visa/france/page.tsx",
    client: "app/schengen-visa/france/FranceVisaClientPage.tsx",
    importPath: "./FranceVisaClientPage",
  },
  {
    route: "app/schengen-visa/germany/page.tsx",
    client: "app/schengen-visa/germany/GermanyVisaClientPage.tsx",
    importPath: "./GermanyVisaClientPage",
  },
]

for (const page of schengenPages) {
  test(`${page.route} lazy-loads its heavy client page`, () => {
    const source = readSource(page.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${page.importPath}["']\\)`))
    assert.doesNotMatch(source, /useRouter/)
    assert.doesNotMatch(source, /AnimatedSection/)
  })

  test(`${page.client} keeps the interactive form implementation`, () => {
    const source = readSource(page.client)

    assert.match(source, /useRouter/)
    assert.match(source, /AnimatedSection/)
  })
}

test("material review route lazy-loads its heavy client page", () => {
  const source = readSource("app/material-review/page.tsx")

  assert.match(source, /dynamic\(/)
  assert.match(source, /import\(["']\.\/MaterialReviewClientPage["']\)/)
  assert.doesNotMatch(source, /MaterialTaskList/)
})

test("material review client lazy-loads MaterialTaskList", () => {
  const source = readSource("app/material-review/MaterialReviewClientPage.tsx")

  assert.match(source, /dynamic\(/)
  assert.doesNotMatch(source, /import \{ MaterialTaskList \} from ['"]@\/components\/MaterialTaskList['"]/)
})

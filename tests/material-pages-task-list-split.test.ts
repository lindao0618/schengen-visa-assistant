import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const routePages = [
  {
    page: "app/material-customization/page.tsx",
    clientPage: "./MaterialCustomizationClientPage",
  },
  {
    page: "app/services/explanation-letter-writer/page.tsx",
    clientPage: "./ExplanationLetterWriterClientPage",
  },
]

const clientPages = [
  "app/material-customization/MaterialCustomizationClientPage.tsx",
  "app/services/explanation-letter-writer/ExplanationLetterWriterClientPage.tsx",
]

for (const { page, clientPage } of routePages) {
  test(`${page} lazy-loads the heavy client page`, () => {
    const source = readFileSync(join(process.cwd(), page), "utf8")

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${clientPage}["']\\)`))
    assert.doesNotMatch(source, /react-hook-form/)
    assert.doesNotMatch(source, /@hookform\/resolvers\/zod/)
    assert.doesNotMatch(source, /import \{ MaterialTaskList \} from ['"]@\/components\/MaterialTaskList['"]/)
  })
}

for (const page of clientPages) {
  test(`${page} lazy-loads MaterialTaskList`, () => {
    const source = readFileSync(join(process.cwd(), page), "utf8")

    assert.match(source, /dynamic\(/)
    assert.doesNotMatch(source, /import \{ MaterialTaskList \} from ['"]@\/components\/MaterialTaskList['"]/)
  })
}

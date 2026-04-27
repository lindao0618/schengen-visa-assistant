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

test("MaterialTaskList lazy-loads completed task result rendering", () => {
  const source = readFileSync(join(process.cwd(), "components/MaterialTaskList.tsx"), "utf8")

  assert.match(source, /dynamic\(/)
  assert.match(source, /@\/components\/material-task-result-summary/)
  assert.doesNotMatch(source, /function MaterialResultSummary/)
  assert.doesNotMatch(source, /function PreviewPdfButton/)
  assert.doesNotMatch(source, /涓嬭浇|榛樿|鏂扮獥/)
})

test("material task result summary keeps PDF preview copy readable", () => {
  const source = readFileSync(join(process.cwd(), "components/material-task-result-summary.tsx"), "utf8")

  assert.match(source, /export function MaterialResultSummary/)
  assert.match(source, /下载 PDF/)
  assert.match(source, /新窗口打开/)
  assert.doesNotMatch(source, /涓嬭浇|榛樿|鏂扮獥/)
})

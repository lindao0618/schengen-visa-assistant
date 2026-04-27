import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const adminPages = [
  {
    route: "app/admin/page.tsx",
    client: "app/admin/AdminDashboardClientPage.tsx",
    importPath: "./AdminDashboardClientPage",
  },
  {
    route: "app/admin/monitor/page.tsx",
    client: "app/admin/monitor/AdminMonitorClientPage.tsx",
    importPath: "./AdminMonitorClientPage",
  },
  {
    route: "app/admin/users/page.tsx",
    client: "app/admin/users/AdminUsersClientPage.tsx",
    importPath: "./AdminUsersClientPage",
  },
  {
    route: "app/admin/refunds/page.tsx",
    client: "app/admin/refunds/AdminRefundsClientPage.tsx",
    importPath: "./AdminRefundsClientPage",
  },
  {
    route: "app/admin/tasks/page.tsx",
    client: "app/admin/tasks/AdminTasksClientPage.tsx",
    importPath: "./AdminTasksClientPage",
  },
  {
    route: "app/admin/documents/page.tsx",
    client: "app/admin/documents/AdminDocumentsClientPage.tsx",
    importPath: "./AdminDocumentsClientPage",
  },
  {
    route: "app/admin/france-cases/page.tsx",
    client: "app/admin/france-cases/AdminFranceCasesClientPage.tsx",
    importPath: "./AdminFranceCasesClientPage",
  },
  {
    route: "app/admin/usa-cases/page.tsx",
    client: "app/admin/usa-cases/AdminUsaCasesClientPage.tsx",
    importPath: "./AdminUsaCasesClientPage",
  },
  {
    route: "app/admin/logs/page.tsx",
    client: "app/admin/logs/AdminLogsClientPage.tsx",
    importPath: "./AdminLogsClientPage",
  },
]

for (const page of adminPages) {
  test(`${page.route} lazy-loads its admin client page`, () => {
    const source = readSource(page.route)

    assert.match(source, /dynamic\(/)
    assert.match(source, new RegExp(`import\\(["']${page.importPath}["']\\)`))
    assert.doesNotMatch(source, /useState/)
    assert.doesNotMatch(source, /useEffect/)
    assert.doesNotMatch(source, /useSession/)
  })

  test(`${page.client} keeps the interactive admin implementation`, () => {
    const source = readSource(page.client)

    assert.match(source, /"use client"/)
    assert.match(source, /useState/)
  })
}

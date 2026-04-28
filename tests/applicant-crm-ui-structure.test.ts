import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("applicant CRM page header owns the primary workspace actions", () => {
  const pageSource = readSource("app/applicants/ApplicantsCrmClientPage.tsx")
  const headerPath = "app/applicants/applicant-crm-page-header.tsx"

  assert.match(pageSource, /ApplicantCrmPageHeader/)
  assert.doesNotMatch(pageSource, /<h1[^>]*>.*申请人 CRM 工作台/s)
  assert.ok(existsSync(join(process.cwd(), headerPath)))

  const headerSource = readSource(headerPath)
  assert.match(headerSource, /申请人 CRM 工作台/)
  assert.match(headerSource, /管理后台/)
  assert.match(headerSource, /刷新数据/)
  assert.match(headerSource, /新建申请人/)
})

test("applicant CRM batch actions live in a sticky focused toolbar", () => {
  const pageSource = readSource("app/applicants/ApplicantsCrmClientPage.tsx")
  const panelSource = readSource("app/applicants/applicant-crm-list-panel.tsx")
  const toolbarPath = "app/applicants/applicant-crm-batch-toolbar.tsx"

  assert.doesNotMatch(pageSource, /ApplicantCrmBatchToolbar/)
  assert.match(panelSource, /ApplicantCrmBatchToolbar/)
  assert.doesNotMatch(pageSource, /已选中 \{selectedApplicantIds\.length\} 位申请人/)
  assert.ok(existsSync(join(process.cwd(), toolbarPath)))

  const toolbarSource = readSource(toolbarPath)
  assert.match(toolbarSource, /sticky/)
  assert.match(toolbarSource, /取消选择/)
  assert.match(toolbarSource, /onClearSelection/)
  assert.match(toolbarSource, /设置分组/)
  assert.match(toolbarSource, /批量删除/)
})

test("applicant CRM list panel owns list card states and empty actions", () => {
  const pageSource = readSource("app/applicants/ApplicantsCrmClientPage.tsx")
  const panelPath = "app/applicants/applicant-crm-list-panel.tsx"

  assert.match(pageSource, /ApplicantCrmListPanel/)
  assert.doesNotMatch(pageSource, /ApplicantCrmRowsTable/)
  assert.ok(existsSync(join(process.cwd(), panelPath)))

  const panelSource = readSource(panelPath)
  assert.match(panelSource, /ApplicantCrmRowsTable/)
  assert.match(panelSource, /ApplicantCrmBatchToolbar/)
  assert.match(panelSource, /onClearFilters/)
  assert.match(panelSource, /清空筛选/)
  assert.match(panelSource, /先新建申请人/)
  assert.match(panelSource, /加载更多申请人/)
})

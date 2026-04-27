import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("applicant CRM list renders applicants in visible batches", () => {
  const source = readSource("app/applicants/ApplicantsCrmClientPage.tsx")

  assert.match(source, /APPLICANT_CRM_INITIAL_VISIBLE_ROWS/)
  assert.match(source, /const \[visibleRowLimit, setVisibleRowLimit\] = useState/)
  assert.match(source, /const visibleRows = useMemo/)
  assert.match(source, /displayRows\.slice\(0, visibleRowLimit\)/)
  assert.match(source, /visibleRows\.map\(\(row\) =>/)
  assert.match(source, /加载更多申请人/)
})

test("applicant CRM selection applies to currently rendered rows", () => {
  const source = readSource("app/applicants/ApplicantsCrmClientPage.tsx")

  assert.match(source, /displayRowIds = useMemo\(\(\) => visibleRows\.map\(\(row\) => row\.id\), \[visibleRows\]\)/)
  assert.match(source, /当前显示/)
  assert.doesNotMatch(source, /displayRows\.map\(\(row\) =>/)
})

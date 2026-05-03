import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

test("profile page exposes ops agent AI settings without secret editing", () => {
  const source = readSource("app/profile/ProfileClientPage.tsx")

  assert.match(source, /AI 设置/)
  assert.match(source, /deepseek-v4-flash/)
  assert.match(source, /\/api\/ops-agent\/settings/)
  assert.match(source, /服务密钥由服务器环境变量统一读取/)
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY/)
})

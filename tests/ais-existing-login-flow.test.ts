import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

test("one-click AIS payment flow requests existing-account login mode", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "usa-visa", "components", "register-ais-form.tsx"), "utf8")

  assert.match(source, /formData\.append\("login_existing",\s*"true"\)/)
})

test("AIS register API passes login-existing mode to the CLI", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "api", "usa-visa", "register-ais", "route.ts"), "utf8")

  assert.match(source, /loginExisting/)
  assert.match(source, /args\.push\('--login-existing'\)/)
})

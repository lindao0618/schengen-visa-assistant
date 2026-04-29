import test from "node:test"
import assert from "node:assert/strict"

import { buildApplicantGeneratedFilename } from "../lib/generated-filename"

test("generated applicant filenames preserve Chinese names", () => {
  assert.equal(buildApplicantGeneratedFilename("吴子琪", "美签面试必看", ".docx"), "吴子琪-美签面试必看.docx")
})

test("generated applicant filenames replace filesystem-unsafe characters", () => {
  assert.equal(buildApplicantGeneratedFilename("王/小:明*", "美签面试必看", ".pdf"), "王_小_明_-美签面试必看.pdf")
})

import test from "node:test"
import assert from "node:assert/strict"

import {
  buildDirectPdfPreviewUpdate,
  buildMaterialPreviewErrorUpdate,
  buildMaterialPreviewUpdate,
} from "../app/applicants/[id]/detail/material-preview-loader"

test("buildDirectPdfPreviewUpdate 使用接口地址直接预览 PDF", () => {
  assert.deepEqual(buildDirectPdfPreviewUpdate("/api/applicants/1/files/passport"), {
    loading: false,
    kind: "pdf",
    objectUrl: "/api/applicants/1/files/passport",
  })
})

test("buildMaterialPreviewUpdate 读取文本并释放临时地址", async () => {
  const revoked: string[] = []
  const update = await buildMaterialPreviewUpdate({
    slot: "note",
    filename: "note.txt",
    blob: new Blob(["hello"], { type: "text/plain" }),
    objectUrl: "blob:text-preview",
    revokeObjectUrl: (value) => revoked.push(value),
  })

  assert.equal(update.kind, "text")
  assert.equal(update.textContent, "hello")
  assert.deepEqual(revoked, ["blob:text-preview"])
})

test("buildMaterialPreviewUpdate 图片预览保留临时地址", async () => {
  const revoked: string[] = []
  const update = await buildMaterialPreviewUpdate({
    slot: "photo",
    filename: "photo.png",
    blob: new Blob([""], { type: "image/png" }),
    objectUrl: "blob:image-preview",
    revokeObjectUrl: (value) => revoked.push(value),
  })

  assert.equal(update.kind, "image")
  assert.equal(update.objectUrl, "blob:image-preview")
  assert.deepEqual(revoked, [])
})

test("buildMaterialPreviewErrorUpdate 规范化预览错误", () => {
  assert.deepEqual(buildMaterialPreviewErrorUpdate(new Error("读取文件失败")), {
    loading: false,
    kind: "unknown",
    error: "读取文件失败",
  })
})

import fs from "fs/promises"
import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"
import { saveApplicantProfileFilesWithAnalysis } from "@/lib/applicant-profile-file-workflow"
import {
  deleteApplicantProfileFile,
  getApplicantProfileFile,
  isApplicantProfileFileSlot,
} from "@/lib/applicant-profiles"

export const dynamic = "force-dynamic"

const MAX_FILE_BYTES = 25 * 1024 * 1024

function buildContentDisposition(filename: string, inline: boolean) {
  const type = inline ? "inline" : "attachment"
  const asciiSafe = /^[\x20-\x7E]*$/.test(filename)
  if (asciiSafe) {
    return `${type}; filename="${filename}"`
  }

  const fallbackExt = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : ""
  const fallbackName = `download${fallbackExt}`
  return `${type}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; slot: string } },
) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  if (!isApplicantProfileFileSlot(params.slot)) {
    return NextResponse.json({ error: "不支持的文件槽位" }, { status: 400 })
  }

  const file = await getApplicantProfileFile(actor.userId, params.id, params.slot, actor.role)
  if (!file) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 })
  }

  if (request.nextUrl.searchParams.get("raw") === "1" || request.nextUrl.searchParams.get("download") === "1") {
    const content = await fs.readFile(file.absolutePath)
    const inline = request.nextUrl.searchParams.get("download") !== "1"
    return new NextResponse(content, {
      headers: {
        "Content-Type": file.meta.mimeType || "application/octet-stream",
        "Content-Disposition": buildContentDisposition(file.meta.originalName, inline),
      },
    })
  }

  return NextResponse.json({
    file: file.meta,
    rawUrl: `/api/agent/applicants/${encodeURIComponent(params.id)}/files/${encodeURIComponent(params.slot)}?raw=1`,
    downloadUrl: `/api/agent/applicants/${encodeURIComponent(params.id)}/files/${encodeURIComponent(params.slot)}?download=1`,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; slot: string } },
) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  if (!isApplicantProfileFileSlot(params.slot)) {
    return NextResponse.json({ error: "不支持的文件槽位" }, { status: 400 })
  }

  let nextFile: File | null = null
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const value = formData.get("file") ?? formData.get(params.slot)
    if (value instanceof File && value.size > 0) {
      nextFile = value
    }
  } else {
    const buffer = Buffer.from(await request.arrayBuffer())
    if (!buffer.length) {
      return NextResponse.json({ error: "文件内容为空" }, { status: 400 })
    }
    if (buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "文件过大" }, { status: 413 })
    }
    const filename =
      request.headers.get("x-file-name")?.trim() ||
      request.headers.get("x-excel-original-name")?.trim() ||
      `${params.slot}`
    nextFile = new File([buffer], filename, {
      type: contentType || "application/octet-stream",
    })
  }

  if (!nextFile) {
    return NextResponse.json({ error: "没有提供可替换的文件" }, { status: 400 })
  }

  const result = await saveApplicantProfileFilesWithAnalysis(
    actor.userId,
    params.id,
    [{ slot: params.slot, file: nextFile }],
    actor.role,
  )
  if (!result) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }

  return NextResponse.json(result)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; slot: string } },
) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  if (!isApplicantProfileFileSlot(params.slot)) {
    return NextResponse.json({ error: "不支持的文件槽位" }, { status: 400 })
  }

  const result = await deleteApplicantProfileFile(actor.userId, params.id, params.slot, actor.role)
  if (!result) {
    return NextResponse.json({ error: "申请人档案不存在" }, { status: 404 })
  }
  if (!result.deleted) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 })
  }

  return NextResponse.json(result)
}

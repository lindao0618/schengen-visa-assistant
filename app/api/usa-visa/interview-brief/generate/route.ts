import fs from "fs/promises"
import path from "path"
import { spawn } from "child_process"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
  saveApplicantProfileFileFromBuffer,
} from "@/lib/applicant-profiles"
import { writeOutputAccessMetadata } from "@/lib/task-route-access"
import { buildUsVisaInterviewBrief } from "@/lib/us-visa-interview-brief"
import { resolveUsVisaInterviewBriefTemplatePath } from "@/lib/us-visa-interview-brief-template"

export const dynamic = "force-dynamic"
export const maxDuration = 120

type GeneratorResult = {
  success?: boolean
  error?: string
  docx_file?: string
  pdf_file?: string | null
  pdf_warning?: string | null
}

async function runGenerator({
  templatePath,
  payloadPath,
  outputDir,
}: {
  templatePath: string
  payloadPath: string
  outputDir: string
}) {
  const scriptPath = path.join(process.cwd(), "services", "us-visa-interview-brief", "generate_interview_brief.py")

  return new Promise<GeneratorResult>((resolve, reject) => {
    const proc = spawn(
      "python",
      ["-u", scriptPath, "--template", templatePath, "--payload", payloadPath, "--output-dir", outputDir],
      {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      },
    )

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on("close", (code) => {
      const lastJsonLine = stdout
        .trim()
        .split(/\r?\n/)
        .reverse()
        .find((line) => line.trim().startsWith("{"))

      if (!lastJsonLine) {
        reject(new Error(stderr || stdout || `Generator exited with code ${code}`))
        return
      }

      try {
        resolve(JSON.parse(lastJsonLine) as GeneratorResult)
      } catch (error) {
        reject(error)
      }
    })

    proc.on("error", reject)
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录后再生成。" }, { status: 401 })
    }

    const formData = await request.formData()
    const applicantProfileId = String(formData.get("applicantProfileId") || "").trim()
    const templateFile = formData.get("template")
    const hasCustomTemplate = templateFile instanceof File && templateFile.size > 0

    if (!applicantProfileId) {
      return NextResponse.json({ success: false, error: "缺少申请人档案 ID。" }, { status: 400 })
    }

    const applicantProfile = await getApplicantProfile(session.user.id, applicantProfileId, session.user.role)
    if (!applicantProfile) {
      return NextResponse.json({ success: false, error: "申请人档案不存在或无权访问。" }, { status: 404 })
    }

    const storedExcel = await getApplicantProfileFileByCandidates(
      session.user.id,
      applicantProfileId,
      ["usVisaDs160Excel", "ds160Excel", "usVisaAisExcel", "aisExcel"],
      session.user.role,
    )

    if (!storedExcel) {
      return NextResponse.json({ success: false, error: "当前申请人档案里没有可用于定制面试必看的信息表。" }, { status: 400 })
    }

    const outputId = `brief-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const outputDir = path.join(process.cwd(), "temp", "us-visa-interview-brief", outputId)
    await fs.mkdir(outputDir, { recursive: true })
    await writeOutputAccessMetadata(outputDir, {
      userId: session.user.id,
      outputId,
    })

    let customTemplatePath: string | null = null
    if (hasCustomTemplate) {
      const safeTemplateName =
        (templateFile.name || "interview-template.docx").replace(/[^a-zA-Z0-9._-]/g, "_") || "interview-template.docx"
      customTemplatePath = path.join(outputDir, safeTemplateName)
      await fs.writeFile(customTemplatePath, Buffer.from(await templateFile.arrayBuffer()))
    }

    const templatePath = await resolveUsVisaInterviewBriefTemplatePath(customTemplatePath)
    const excelBuffer = await fs.readFile(storedExcel.absolutePath)
    const brief = buildUsVisaInterviewBrief(excelBuffer)

    const safeApplicantName = (applicantProfile.name || applicantProfile.label || "applicant").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    )
    const payloadPath = path.join(outputDir, "brief-payload.json")
    const payload = {
      applicantName: applicantProfile.name || applicantProfile.label || "Applicant",
      blocks: brief.blocks,
      docxFilename: `${safeApplicantName}-美签面试必看.docx`,
      pdfFilename: `${safeApplicantName}-美签面试必看.pdf`,
    }
    await fs.writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf-8")

    const generation = await runGenerator({ templatePath, payloadPath, outputDir })

    if (!generation.success || !generation.docx_file) {
      return NextResponse.json(
        { success: false, error: generation.error || "生成面试材料失败。" },
        { status: 500 },
      )
    }

    await saveApplicantProfileFileFromBuffer({
      userId: session.user.id,
      id: applicantProfileId,
      slot: "usVisaInterviewBriefJson",
      buffer: Buffer.from(
        JSON.stringify(
          {
            fields: brief.fields,
            blocks: brief.blocks,
            issues: brief.issues,
            template_mode: hasCustomTemplate ? "custom" : "default",
          },
          null,
          2,
        ),
      ),
      originalName: "us-visa-interview-brief.json",
      mimeType: "application/json",
      role: session.user.role,
    })

    const docxBuffer = await fs.readFile(path.join(outputDir, generation.docx_file))
    await saveApplicantProfileFileFromBuffer({
      userId: session.user.id,
      id: applicantProfileId,
      slot: "usVisaInterviewBriefDocx",
      buffer: docxBuffer,
      originalName: generation.docx_file,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      role: session.user.role,
    })

    if (generation.pdf_file) {
      const pdfBuffer = await fs.readFile(path.join(outputDir, generation.pdf_file))
      await saveApplicantProfileFileFromBuffer({
        userId: session.user.id,
        id: applicantProfileId,
        slot: "usVisaInterviewBriefPdf",
        buffer: pdfBuffer,
        originalName: generation.pdf_file,
        mimeType: "application/pdf",
        role: session.user.role,
      })
    }

    return NextResponse.json({
      success: true,
      outputId,
      fields: brief.fields,
      blocks: brief.blocks,
      issues: brief.issues,
      template_mode: hasCustomTemplate ? "custom" : "default",
      docx_download_url: `/api/usa-visa/interview-brief/download/${outputId}/${encodeURIComponent(generation.docx_file)}`,
      pdf_download_url: generation.pdf_file
        ? `/api/usa-visa/interview-brief/download/${outputId}/${encodeURIComponent(generation.pdf_file)}`
        : null,
      pdf_warning: generation.pdf_warning || null,
    })
  } catch (error) {
    console.error("Interview brief generation error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    )
  }
}

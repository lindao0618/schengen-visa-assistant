import fs from "fs/promises"

import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { getApplicantProfile, getApplicantProfileFileByCandidates } from "@/lib/applicant-profiles"
import { buildUsVisaInterviewBrief, type InterviewBriefFieldMap } from "@/lib/us-visa-interview-brief"
import { runUsVisaReview } from "@/lib/us-visa-review"
import { listTasks } from "@/lib/usa-visa-tasks"

export const dynamic = "force-dynamic"
export const maxDuration = 120

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseInterviewBriefFields(value: unknown): Partial<InterviewBriefFieldMap> | undefined {
  if (!isRecord(value)) return undefined
  const fields = value.fields
  if (!isRecord(fields)) return undefined

  return {
    schoolName: typeof fields.schoolName === "string" ? fields.schoolName : undefined,
    major: typeof fields.major === "string" ? fields.major : undefined,
    currentOccupation: typeof fields.currentOccupation === "string" ? fields.currentOccupation : undefined,
    hotelName: typeof fields.hotelName === "string" ? fields.hotelName : undefined,
    hotelCity: typeof fields.hotelCity === "string" ? fields.hotelCity : undefined,
    arrivalDate: typeof fields.arrivalDate === "string" ? fields.arrivalDate : undefined,
    departureDate: typeof fields.departureDate === "string" ? fields.departureDate : undefined,
    stayDays: typeof fields.stayDays === "string" ? fields.stayDays : undefined,
    tripPayer: typeof fields.tripPayer === "string" ? fields.tripPayer : undefined,
    tripPayerOther: typeof fields.tripPayerOther === "string" ? fields.tripPayerOther : undefined,
    tripPayerRelationship: typeof fields.tripPayerRelationship === "string" ? fields.tripPayerRelationship : undefined,
    hasUsVisa: typeof fields.hasUsVisa === "string" ? fields.hasUsVisa : undefined,
    previousUsTravel: typeof fields.previousUsTravel === "string" ? fields.previousUsTravel : undefined,
  }
}

function extractPdfPathsFromTaskResult(result: unknown) {
  if (!isRecord(result) || !Array.isArray(result.files)) return []

  return result.files
    .map((item) => {
      if (!isRecord(item)) return null
      const filePath = typeof item.path === "string" ? item.path : ""
      const filename = typeof item.filename === "string" ? item.filename : ""
      if (!filePath || !filename) return null
      if (!/\.pdf$/i.test(filename)) return null
      if (!/ds160[_-]review/i.test(filename)) return null
      return { path: filePath, filename }
    })
    .filter((item): item is { path: string; filename: string } => Boolean(item))
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { applicantProfileId?: string }
    const applicantProfileId = String(body.applicantProfileId || "").trim()
    if (!applicantProfileId) {
      return NextResponse.json({ error: "缺少申请人档案 ID" }, { status: 400 })
    }

    const applicantProfile = await getApplicantProfile(session.user.id, applicantProfileId, session.user.role)
    if (!applicantProfile) {
      return NextResponse.json({ error: "申请人档案不存在或无权访问" }, { status: 404 })
    }

    const excelFile = await getApplicantProfileFileByCandidates(
      session.user.id,
      applicantProfileId,
      ["usVisaDs160Excel", "ds160Excel", "usVisaAisExcel", "aisExcel"],
      session.user.role,
    )

    if (!excelFile) {
      return NextResponse.json({ error: "当前申请人档案中没有可用的美签 Excel" }, { status: 400 })
    }

    const excelBuffer = await fs.readFile(excelFile.absolutePath)

    const tasks = await listTasks(session.user.id, 50, "completed", applicantProfileId)
    const latestDs160Task = tasks.find((task) => task.type === "fill-ds160" && task.status === "completed")
    const taskPdfFiles = latestDs160Task ? extractPdfPathsFromTaskResult(latestDs160Task.result) : []
    const existingPdfFiles: Array<{ path: string; filename: string }> = []

    for (const file of taskPdfFiles) {
      try {
        await fs.access(file.path)
        existingPdfFiles.push(file)
      } catch {
        // Ignore stale temp files.
      }
    }

    let interviewBriefFields: Partial<InterviewBriefFieldMap> | undefined
    let interviewBriefMode: "saved" | "rebuilt" = "saved"

    const interviewBriefJson = await getApplicantProfileFileByCandidates(
      session.user.id,
      applicantProfileId,
      ["usVisaInterviewBriefJson"],
      session.user.role,
    )

    const interviewBriefPdf = await getApplicantProfileFileByCandidates(
      session.user.id,
      applicantProfileId,
      ["usVisaInterviewBriefPdf"],
      session.user.role,
    )

    if (interviewBriefJson) {
      const payload = JSON.parse(await fs.readFile(interviewBriefJson.absolutePath, "utf-8"))
      interviewBriefFields = parseInterviewBriefFields(payload)
    } else if (interviewBriefPdf) {
      interviewBriefFields = buildUsVisaInterviewBrief(excelBuffer).fields
      interviewBriefMode = "rebuilt"
    }

    const result = await runUsVisaReview({
      excelBuffer,
      ds160PdfPaths: existingPdfFiles.map((item) => item.path),
      ds160FileNames: existingPdfFiles.map((item) => item.filename),
      interviewBriefFields,
      interviewBriefMode,
      interviewBriefFileName: interviewBriefPdf?.meta.originalName,
    })

    return NextResponse.json({
      success: true,
      applicant: {
        id: applicantProfile.id,
        name: applicantProfile.name || applicantProfile.label,
        label: applicantProfile.label,
      },
      sourceFiles: {
        excel: excelFile.meta.originalName,
        ds160TaskId: latestDs160Task?.task_id || null,
        interviewBriefPdf: interviewBriefPdf?.meta.originalName || null,
      },
      result,
    })
  } catch (error) {
    console.error("[US_VISA_REVIEW_RUN]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "美签审核失败" },
      { status: 500 },
    )
  }
}

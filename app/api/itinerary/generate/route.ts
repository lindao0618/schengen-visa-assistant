import * as fs from "fs/promises"
import * as path from "path"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import {
  getApplicantProfile,
  saveApplicantProfileFileFromAbsolutePath,
} from "@/lib/applicant-profiles"
import {
  createMaterialTask,
  getMaterialTaskOutputDir,
  updateMaterialTask,
} from "@/lib/material-tasks"
import { toItineraryEnglishCity, toItineraryEnglishCountry } from "@/lib/itinerary-location"

const TRIP_GENERATOR_URL = process.env.TRIP_GENERATOR_URL || "http://localhost:8002"
const TRIP_GENERATOR_TIMEOUT_MS = 180_000
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY?.trim()

export const dynamic = "force-dynamic"
export const maxDuration = 300

function sanitizeFilenameSegment(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function formatDateRangeLabel(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map((item) => Number(item))
  if (!year || !month || !day) return sanitizeFilenameSegment(dateValue)
  return `${month}.${day}`
}

function buildItineraryPdfFilename({
  startDate,
  endDate,
  applicantName,
}: {
  startDate: string
  endDate: string
  applicantName?: string
}) {
  const parts = [`${formatDateRangeLabel(startDate)}-${formatDateRangeLabel(endDate)}`]
  const safeApplicantName = sanitizeFilenameSegment(applicantName || "")
  if (safeApplicantName) {
    parts.push(safeApplicantName)
  }
  parts.push("行程单")
  return `${parts.join("-")}.pdf`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const applicantProfileId =
      typeof body?.applicantProfileId === "string" ? body.applicantProfileId.trim() : ""
    const caseId = typeof body?.caseId === "string" ? body.caseId.trim() : ""

    const requiredFields = [
      "country",
      "departure_city",
      "arrival_city",
      "start_date",
      "end_date",
      "hotel_name",
      "hotel_address",
      "hotel_phone",
    ] as const

    for (const field of requiredFields) {
      if (!body?.[field]) {
        return NextResponse.json({ message: `缺少必填字段: ${field}` }, { status: 400 })
      }
    }

    if (applicantProfileId && !session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录后再关联申请人档案" }, { status: 401 })
    }

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少 DEEPSEEK_API_KEY，行程单服务无法启动。请先在 .env.local 或服务器环境变量里配置后重启服务。",
        },
        { status: 503 }
      )
    }

    const applicantProfile =
      applicantProfileId && session?.user?.id
        ? await getApplicantProfile(session.user.id, applicantProfileId)
        : null

    if (applicantProfileId && !applicantProfile) {
      return NextResponse.json({ success: false, error: "未找到对应的申请人档案" }, { status: 404 })
    }

    try {
      const healthRes = await fetch(`${TRIP_GENERATOR_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!healthRes.ok) throw new Error("health not ok")
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "行程单服务连接超时（3 秒未响应）"
          : "行程单服务未启动或不可达"

      return NextResponse.json(
        {
          success: false,
          error: `${message}。请先启动行程单服务后再重试。`,
        },
        { status: 503 }
      )
    }

    const itineraryRequestBody = {
      ...body,
      country: toItineraryEnglishCountry(body.country),
      departure_city: toItineraryEnglishCity(body.departure_city),
      arrival_city: toItineraryEnglishCity(body.arrival_city),
    }

    const task = await createMaterialTask(
      "itinerary",
      applicantProfile
        ? `行程单 · ${applicantProfile.name || applicantProfile.label}`
        : `行程单 · ${body.departure_city} -> ${body.arrival_city}`,
      applicantProfile
        ? {
            userId: session?.user?.id,
            applicantProfileId,
            applicantName: applicantProfile.name || applicantProfile.label,
            caseId: caseId || undefined,
          }
        : session?.user?.id
          ? { userId: session.user.id }
          : undefined
    )

    ;(async () => {
      try {
        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 10,
          message: "正在连接行程单服务...",
        })

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), TRIP_GENERATOR_TIMEOUT_MS)

        let response: Response
        try {
          response = await fetch(`${TRIP_GENERATOR_URL}/generate-itinerary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itineraryRequestBody),
            signal: controller.signal,
          })
        } catch (error) {
          clearTimeout(timeoutId)
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "行程单生成失败",
            error:
              error instanceof Error && error.name === "AbortError"
                ? "行程单服务响应超时（3 分钟）"
                : error instanceof Error
                  ? error.message
                  : String(error),
          })
          return
        }

        clearTimeout(timeoutId)

        const data = (await response.json().catch(() => ({}))) as {
          pdf_base64?: string
          analysis?: string
          error?: string
          detail?: string
        }

        if (!response.ok) {
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "行程单生成失败",
            error: data.error || data.detail || "服务暂时不可用",
          })
          return
        }

        if (!data.pdf_base64) {
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "未获取到行程单 PDF",
            error: "API 响应格式异常",
          })
          return
        }

        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 80,
          message: "正在保存行程单 PDF...",
        })

        const pdfFilename = buildItineraryPdfFilename({
          startDate: String(body.start_date),
          endDate: String(body.end_date),
          applicantName: applicantProfile?.name || applicantProfile?.label,
        })
        const encodedPdfFilename = encodeURIComponent(pdfFilename)
        const outputDir = getMaterialTaskOutputDir(task.task_id)
        const pdfPath = path.join(outputDir, pdfFilename)
        const pdfBuffer = Buffer.from(data.pdf_base64, "base64")
        await fs.writeFile(pdfPath, pdfBuffer)

        let archivedProfilePdfUrl: string | undefined
        if (session?.user?.id && applicantProfileId) {
          try {
            const archivedProfile = await saveApplicantProfileFileFromAbsolutePath({
              userId: session.user.id,
              id: applicantProfileId,
              slot: "schengenItineraryPdf",
              sourcePath: pdfPath,
              originalName: pdfFilename,
              mimeType: "application/pdf",
            })
            if (archivedProfile) {
              archivedProfilePdfUrl = `/api/applicants/${applicantProfileId}/files/schengenItineraryPdf`
            }
          } catch (archiveError) {
            console.error("Failed to archive itinerary PDF to applicant profile", archiveError)
          }
        }

        await updateMaterialTask(task.task_id, {
          status: "completed",
          progress: 100,
          message: "行程单生成完成",
          result: {
            success: true,
            download_pdf: `/api/material-tasks/download/${task.task_id}/${encodedPdfFilename}`,
            analysis: data.analysis,
            archivedToApplicantProfile: Boolean(archivedProfilePdfUrl),
            archivedProfilePdfUrl,
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await updateMaterialTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "行程单生成失败",
          error: message,
        })
      }
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: applicantProfile
        ? "任务已创建，完成后会自动归档到当前申请人档案。"
        : "任务已创建，请在下方任务列表查看进度与下载链接。",
    })
  } catch (error) {
    console.error("Itinerary generate error:", error)
    const message = error instanceof Error ? error.message : String(error)
    const isConnectionError = message.includes("ECONNREFUSED") || message.includes("fetch failed")

    return NextResponse.json(
      {
        success: false,
        error: isConnectionError ? "行程单服务未启动，请稍后重试。" : "生成行程单失败，请稍后重试。",
      },
      { status: 500 }
    )
  }
}

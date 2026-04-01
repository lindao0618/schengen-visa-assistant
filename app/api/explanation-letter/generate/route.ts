import * as fs from "fs/promises"
import * as path from "path"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
  saveApplicantProfileFileFromAbsolutePath,
} from "@/lib/applicant-profiles"
import {
  createMaterialTask,
  getMaterialTaskOutputDir,
  updateMaterialTask,
} from "@/lib/material-tasks"
import { extractSchengenApplicantSummaryFromExcelBuffer } from "@/lib/schengen-excel-summary"

const EXPLANATION_LETTER_URL = process.env.EXPLANATION_LETTER_URL || "http://localhost:8003"
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY?.trim()

const ISSUE_TYPE_MAP: Record<string, string> = {
  bank_balance: "insufficient_bank_statement",
  large_transfer: "large_deposit",
  temporary_deposit: "temporary_deposit",
  employment_gap: "employment_gap",
  travel_purpose: "travel_purpose",
  document_discrepancy: "document_discrepancy",
}

export const dynamic = "force-dynamic"
export const maxDuration = 300

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

async function saveBase64ToFile(outputDir: string, base64Data: string, filename: string) {
  const buffer = Buffer.from(base64Data, "base64")
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const filePath = path.join(outputDir, safeName)
  await fs.writeFile(filePath, buffer)
  return filePath
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const applicantProfileId =
      typeof body?.applicantProfileId === "string" ? body.applicantProfileId.trim() : ""
    const caseId = typeof body?.caseId === "string" ? body.caseId.trim() : ""

    const session = applicantProfileId ? await getServerSession(authOptions) : null
    if (applicantProfileId && !session?.user?.id) {
      return NextResponse.json({ success: false, error: "请先登录后再关联申请人档案" }, { status: 401 })
    }

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少 DEEPSEEK_API_KEY，解释信服务无法启动。请先在 .env.local 或服务器环境变量里配置后重启服务。",
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

    let schengenSummary:
      | {
          englishName?: string
          organization?: string
          passportNumber?: string
          schengenCountry?: string
        }
      | null = null

    if (session?.user?.id && applicantProfileId) {
      const storedExcel = await getApplicantProfileFileByCandidates(session.user.id, applicantProfileId, [
        "schengenExcel",
        "franceExcel",
      ])
      if (storedExcel) {
        try {
          const buffer = await fs.readFile(storedExcel.absolutePath)
          schengenSummary = extractSchengenApplicantSummaryFromExcelBuffer(buffer)
        } catch (error) {
          console.error("Failed to parse schengen excel summary for explanation letter", error)
        }
      }
    }

    const chineseName =
      normalizeText(body.chinese_name) ||
      normalizeText(applicantProfile?.name) ||
      normalizeText(applicantProfile?.label) ||
      normalizeText(schengenSummary?.englishName)
    const englishName = normalizeText(body.english_name) || normalizeText(schengenSummary?.englishName) || chineseName
    const organization = normalizeText(body.organization) || normalizeText(schengenSummary?.organization) || "学生"
    const passportNumber = normalizeText(body.passport_number) || normalizeText(schengenSummary?.passportNumber)
    const visaCountry =
      normalizeText(body.visa_country) ||
      normalizeText(applicantProfile?.schengen?.country) ||
      normalizeText(schengenSummary?.schengenCountry)
    const visaType = normalizeText(body.visa_type) || "旅游签证"
    const applicantType = normalizeText(body.applicant_type) || "学生"
    const departureDate = normalizeText(body.departure_date)
    const detailedExplanation = normalizeText(body.detailed_explanation)

    if (!englishName || !organization || !passportNumber || !visaCountry || !departureDate || !detailedExplanation) {
      return NextResponse.json(
        {
          success: false,
          error: "解释信基础信息不完整，请确认英文姓名、学校/工作单位、护照号、申请国家、出发时间和问题详情已填写。",
        },
        { status: 400 }
      )
    }

    const problemType = ISSUE_TYPE_MAP[body.problem_type] || body.problem_type || "other"
    const payload = {
      chinese_name: chineseName || englishName,
      english_name: englishName,
      organization,
      passport_number: passportNumber,
      visa_country: visaCountry,
      visa_type: visaType,
      applicant_type: applicantType,
      departure_date: departureDate,
      problem_type: problemType,
      detailed_explanation: detailedExplanation,
      additional_info: normalizeText(body.additional_info),
    }

    const task = await createMaterialTask(
      "explanation-letter",
      applicantProfile
        ? `解释信 · ${applicantProfile.name || applicantProfile.label}`
        : `解释信 · ${englishName || chineseName || "未命名申请人"}`,
      applicantProfile
        ? {
            applicantProfileId,
            applicantName: applicantProfile.name || applicantProfile.label,
            caseId: caseId || undefined,
          }
        : undefined
    )

    ;(async () => {
      try {
        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 10,
          message: "正在生成解释信...",
        })

        const response = await fetch(`${EXPLANATION_LETTER_URL}/generate-explanation-letter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean
          word_chinese_base64?: string
          word_english_base64?: string
          pdf_chinese_base64?: string
          pdf_english_base64?: string
          content_chinese?: string
          content_english?: string
          detail?: string
          message?: string
        }

        if (!response.ok) {
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "解释信生成失败",
            error: data.detail || data.message || "服务暂时不可用",
          })
          return
        }

        if (!data.success || !data.word_chinese_base64 || !data.pdf_chinese_base64) {
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "未获取到解释信结果",
            error: "API 响应格式异常",
          })
          return
        }

        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 80,
          message: "正在保存解释信文件...",
        })

        const outputDir = getMaterialTaskOutputDir(task.task_id)
        await saveBase64ToFile(outputDir, data.word_chinese_base64, "word_cn.docx")
        const pdfChinesePath = await saveBase64ToFile(outputDir, data.pdf_chinese_base64, "pdf_cn.pdf")

        const result: Record<string, unknown> = {
          success: true,
          download_word_chinese: `/api/material-tasks/download/${task.task_id}/word_cn.docx`,
          download_pdf_chinese: `/api/material-tasks/download/${task.task_id}/pdf_cn.pdf`,
          content_chinese: data.content_chinese,
          content_english: data.content_english,
        }

        let pdfEnglishPath: string | undefined
        if (data.word_english_base64) {
          await saveBase64ToFile(outputDir, data.word_english_base64, "word_en.docx")
          result.download_word_english = `/api/material-tasks/download/${task.task_id}/word_en.docx`
        }

        if (data.pdf_english_base64) {
          pdfEnglishPath = await saveBase64ToFile(outputDir, data.pdf_english_base64, "pdf_en.pdf")
          result.download_pdf_english = `/api/material-tasks/download/${task.task_id}/pdf_en.pdf`
        }

        let archivedProfileCnPdfUrl: string | undefined
        let archivedProfileEnPdfUrl: string | undefined

        if (session?.user?.id && applicantProfileId) {
          try {
            const archivedCn = await saveApplicantProfileFileFromAbsolutePath({
              userId: session.user.id,
              id: applicantProfileId,
              slot: "schengenExplanationLetterCnPdf",
              sourcePath: pdfChinesePath,
              originalName: "schengen-explanation-letter-cn.pdf",
              mimeType: "application/pdf",
            })
            if (archivedCn) {
              archivedProfileCnPdfUrl = `/api/applicants/${applicantProfileId}/files/schengenExplanationLetterCnPdf`
            }

            if (pdfEnglishPath) {
              const archivedEn = await saveApplicantProfileFileFromAbsolutePath({
                userId: session.user.id,
                id: applicantProfileId,
                slot: "schengenExplanationLetterEnPdf",
                sourcePath: pdfEnglishPath,
                originalName: "schengen-explanation-letter-en.pdf",
                mimeType: "application/pdf",
              })
              if (archivedEn) {
                archivedProfileEnPdfUrl = `/api/applicants/${applicantProfileId}/files/schengenExplanationLetterEnPdf`
              }
            }
          } catch (archiveError) {
            console.error("Failed to archive explanation letter PDFs to applicant profile", archiveError)
          }
        }

        result.archivedToApplicantProfile = Boolean(archivedProfileCnPdfUrl || archivedProfileEnPdfUrl)
        if (archivedProfileCnPdfUrl) {
          result.archivedProfileCnPdfUrl = archivedProfileCnPdfUrl
        }
        if (archivedProfileEnPdfUrl) {
          result.archivedProfileEnPdfUrl = archivedProfileEnPdfUrl
        }

        await updateMaterialTask(task.task_id, {
          status: "completed",
          progress: 100,
          message: "解释信生成完成",
          result,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isConnectionError = message.includes("ECONNREFUSED") || message.includes("fetch failed")

        await updateMaterialTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "解释信生成失败",
          error: isConnectionError ? "解释信生成服务未启动，请稍后重试。" : message,
        })
      }
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: applicantProfile
        ? "任务已创建，完成后会自动归档到当前申请人档案。"
        : "任务已创建，请在下方任务列表查看进度和下载链接。",
    })
  } catch (error) {
    console.error("Explanation letter generate error:", error)
    const message = error instanceof Error ? error.message : String(error)
    const isConnectionError = message.includes("ECONNREFUSED") || message.includes("fetch failed")

    return NextResponse.json(
      {
        success: false,
        error: isConnectionError ? "解释信生成服务未启动，请稍后重试。" : "生成解释信失败，请稍后重试。",
      },
      { status: 500 }
    )
  }
}

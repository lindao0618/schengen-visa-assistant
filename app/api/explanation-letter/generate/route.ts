import { NextRequest, NextResponse } from "next/server"
import {
  createMaterialTask,
  updateMaterialTask,
  getMaterialTaskOutputDir,
} from "@/lib/material-tasks"
import * as fs from "fs/promises"
import * as path from "path"

const EXPLANATION_LETTER_URL =
  process.env.EXPLANATION_LETTER_URL || "http://localhost:8003"

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

async function saveBase64ToFile(
  outputDir: string,
  base64Data: string,
  filename: string
): Promise<void> {
  const buf = Buffer.from(base64Data, "base64")
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const filePath = path.join(outputDir, safeName)
  await fs.writeFile(filePath, buf)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const problem_type =
      ISSUE_TYPE_MAP[body.problem_type] || body.problem_type || "other"

    const payload = {
      chinese_name: body.chinese_name,
      english_name: body.english_name,
      organization: body.organization,
      passport_number: body.passport_number,
      visa_country: body.visa_country,
      visa_type: body.visa_type,
      applicant_type: body.applicant_type,
      departure_date: body.departure_date,
      problem_type,
      detailed_explanation: body.detailed_explanation,
      additional_info: body.additional_info || "",
    }

    const task = await createMaterialTask(
      "explanation-letter",
      `解释信 · ${body.english_name || body.chinese_name}`
    )

    // 后台执行
    ;(async () => {
      try {
        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 10,
          message: "正在生成解释信...",
        })

        const response = await fetch(
          `${EXPLANATION_LETTER_URL}/generate-explanation-letter`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        )

        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean
          word_chinese_base64?: string
          word_english_base64?: string
          pdf_chinese_base64?: string
          pdf_english_base64?: string
          content_chinese?: string
          content_english?: string
          filename?: string
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

        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 80,
          message: "正在保存文件...",
        })

        if (data.success && data.word_chinese_base64) {
          const outputDir = getMaterialTaskOutputDir(task.task_id)

          await saveBase64ToFile(outputDir, data.word_chinese_base64, "word_cn.docx")
          await saveBase64ToFile(outputDir, data.pdf_chinese_base64!, "pdf_cn.pdf")

          const result: Record<string, unknown> = {
            success: true,
            download_word_chinese: `/api/material-tasks/download/${task.task_id}/word_cn.docx`,
            download_pdf_chinese: `/api/material-tasks/download/${task.task_id}/pdf_cn.pdf`,
            content_chinese: data.content_chinese,
            content_english: data.content_english,
          }

          if (data.word_english_base64) {
            await saveBase64ToFile(outputDir, data.word_english_base64, "word_en.docx")
            result.download_word_english = `/api/material-tasks/download/${task.task_id}/word_en.docx`
          }
          if (data.pdf_english_base64) {
            await saveBase64ToFile(outputDir, data.pdf_english_base64, "pdf_en.pdf")
            result.download_pdf_english = `/api/material-tasks/download/${task.task_id}/pdf_en.pdf`
          }

          await updateMaterialTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: "解释信生成完成",
            result,
          })
        } else {
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "未获取到生成结果",
            error: "API 响应格式异常",
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isConn =
          msg.includes("ECONNREFUSED") || msg.includes("fetch failed")
        await updateMaterialTask(task.task_id, {
          status: "failed",
          progress: 0,
          message: "解释信生成失败",
          error: isConn
            ? "解释信生成服务未启动，请先启动 explanation_letter_generator。"
            : msg,
        })
      }
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "任务已创建，请在下方的任务列表中查看进度与下载链接",
    })
  } catch (error) {
    console.error("Explanation letter generate error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    const isConnectionError =
      msg.includes("ECONNREFUSED") || msg.includes("fetch failed")
    return NextResponse.json(
      {
        success: false,
        error: isConnectionError
          ? "解释信生成服务未启动，请先启动 explanation_letter_generator 服务。"
          : "生成解释信失败，请稍后重试。",
      },
      { status: 500 }
    )
  }
}

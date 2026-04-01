import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import {
  createMaterialTask,
  updateMaterialTask,
  getMaterialTaskOutputDir,
} from "@/lib/material-tasks"
import { authOptions } from "@/lib/auth"
import { getApplicantProfile } from "@/lib/applicant-profiles"
import * as fs from "fs/promises"
import * as path from "path"

const MATERIAL_REVIEW_URL =
  process.env.MATERIAL_REVIEW_URL || "http://localhost:8004"

const DOC_TYPE_LABELS: Record<string, string> = {
  itinerary: "行程单",
  hotel: "酒店预订",
  bank_statement: "银行流水",
  flight: "机票/车票",
  insurance: "旅行保险",
  other: "其他材料",
}

const VISA_TYPE_LABELS: Record<string, string> = {
  schengen: "申根签证",
  usa: "美国签证",
  uk: "英国签证",
  japan: "日本签证",
  australia: "澳大利亚签证",
  canada: "加拿大签证",
  newzealand: "新西兰签证",
  singapore: "新加坡签证",
  korea: "韩国签证",
  other: "其他签证",
}

function getFileNamePrefix(name: string, maxChars = 4): string {
  const base = path.basename(name, path.extname(name))
  return base.slice(0, maxChars) || name.slice(0, maxChars)
}

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 })
    }

    const documentType = (formData.get("document_type") as string) || "itinerary"
    const visaType = (formData.get("visa_type") as string) || "schengen"
    const bookingVerify = (formData.get("booking_verify") as string) === "true"
    const applicantProfileId = String(formData.get("applicantProfileId") || "").trim()
    const caseId = String(formData.get("caseId") || "").trim()

    const session = applicantProfileId ? await getServerSession(authOptions) : null
    if (applicantProfileId && !session?.user?.id) {
      return NextResponse.json({ error: "请先登录后再关联申请人档案" }, { status: 401 })
    }

    const applicantProfile =
      applicantProfileId && session?.user?.id
        ? await getApplicantProfile(session.user.id, applicantProfileId, session.user.role)
        : null

    if (applicantProfileId && !applicantProfile) {
      return NextResponse.json({ error: "当前申请人档案不存在或无权访问" }, { status: 404 })
    }

    if (documentType === "hotel") {
      const customerName = (formData.get("customer_name") as string)?.trim()
      const departureDate = (formData.get("departure_date") as string)?.trim()
      const returnDate = (formData.get("return_date") as string)?.trim()
      if (!customerName) {
        return NextResponse.json({ error: "酒店审核需填写客户姓名" }, { status: 400 })
      }
      if (!departureDate) {
        return NextResponse.json({ error: "酒店审核需填写入住日期" }, { status: 400 })
      }
      if (!returnDate) {
        return NextResponse.json({ error: "酒店审核需填写退房日期" }, { status: 400 })
      }
    }

    const docLabel = DOC_TYPE_LABELS[documentType] || documentType
    const visaLabel = VISA_TYPE_LABELS[visaType] || visaType
    const filePrefix = getFileNamePrefix(file.name)
    const taskMessage = `材料审核 · ${visaLabel} · ${docLabel} · ${filePrefix}`
    const task = await createMaterialTask("material-review", taskMessage, {
      applicantProfileId: applicantProfileId || undefined,
      applicantName: applicantProfile?.name || applicantProfile?.label,
      caseId: caseId || undefined,
    })

    const outputDir = getMaterialTaskOutputDir(task.task_id)
    await fs.mkdir(outputDir, { recursive: true })
    const ext = path.extname(file.name) || ".pdf"
    const savedPath = path.join(outputDir, `upload${ext}`)
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(savedPath, buf)

    const customerName = (formData.get("customer_name") as string) || ""
    const departureDate = (formData.get("departure_date") as string) || ""
    const returnDate = (formData.get("return_date") as string) || ""

    ;(async () => {
      try {
        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 20,
        })

        const fd = new FormData()
        fd.append("file", new Blob([buf], { type: file.type }), file.name)
        fd.append("document_type", documentType)
        fd.append("visa_type", visaType)
        if (bookingVerify) fd.append("booking_verify", "true")
        if (customerName) fd.append("customer_name", customerName)
        if (departureDate) fd.append("departure_date", departureDate)
        if (returnDate) fd.append("return_date", returnDate)

        const response = await fetch(`${MATERIAL_REVIEW_URL}/upload-document`, {
          method: "POST",
          body: fd,
        })

        const data = (await response.json().catch(() => ({}))) as {
          word_download_url?: string
          analysis_result?: Record<string, unknown>
          detail?: string
          error?: string
        }

        if (!response.ok) {
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            error: data.detail || data.error || "服务暂时不可用",
          })
          return
        }

        let wordDownloadUrl = data.word_download_url
        if (wordDownloadUrl) {
          const filename = wordDownloadUrl.replace("/download-ocr-result/", "")
          wordDownloadUrl = `/api/material-review/download-ocr-result/${filename}`
        }

        await updateMaterialTask(task.task_id, {
          status: "completed",
          progress: 100,
          result: {
            success: true,
            word_download_url: wordDownloadUrl,
            analysis_result: data.analysis_result,
            document_type: documentType,
            file_name: file.name,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isConn = msg.includes("ECONNREFUSED") || msg.includes("fetch failed")
        await updateMaterialTask(task.task_id, {
          status: "failed",
          progress: 0,
          error: isConn
            ? "材料审核服务未启动，请先运行 npm run dev:review。"
            : msg,
        })
      }
    })()

    return NextResponse.json({
      success: true,
      task_id: task.task_id,
      message: "任务已创建，请在下方的任务列表中查看进度与结果",
    })
  } catch (error) {
    console.error("Material review upload error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    const isConn = msg.includes("ECONNREFUSED") || msg.includes("fetch failed")
    return NextResponse.json(
      {
        error: isConn
          ? "材料审核服务未启动，请先运行 npm run dev 或 npm run dev:review 启动服务。"
          : "材料审核请求失败，请稍后重试。",
      },
      { status: 500 }
    )
  }
}

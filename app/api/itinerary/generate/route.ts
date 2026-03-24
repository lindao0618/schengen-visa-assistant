import { NextRequest, NextResponse } from "next/server"
import {
  createMaterialTask,
  updateMaterialTask,
  getMaterialTaskOutputDir,
} from "@/lib/material-tasks"
import * as fs from "fs/promises"
import * as path from "path"

const TRIP_GENERATOR_URL =
  process.env.TRIP_GENERATOR_URL || "http://localhost:8002"
const TRIP_GENERATOR_TIMEOUT_MS = 180_000 // 180 秒（AI 调用 + Word/PDF 生成较慢）

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

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
      if (!body[field]) {
        return NextResponse.json(
          { message: `缺少必需字段: ${field}` },
          { status: 400 }
        )
      }
    }

    // 提交前先检测行程单服务是否可达，避免任务卡在 10%
    try {
      const healthRes = await fetch(`${TRIP_GENERATOR_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!healthRes.ok) throw new Error("health not ok")
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "行程单服务连接超时（3 秒未响应）"
          : "行程单服务未启动或不可达"
      return NextResponse.json(
        {
          success: false,
          error: `${msg}。请用 npm run dev 启动（会同时启动行程单），或单独运行 npm run dev:trip 并查看终端报错（如缺 Python 依赖、端口 8002 被占用）。`,
        },
        { status: 503 }
      )
    }

    const task = await createMaterialTask(
      "itinerary",
      `行程单 · ${body.departure_city} → ${body.arrival_city}`
    )

    // 后台执行
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
            body: JSON.stringify(body),
            signal: controller.signal,
          })
        } catch (fetchErr) {
          clearTimeout(timeoutId)
          const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError"
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "行程单生成失败",
            error: isAbort
              ? "行程单服务响应超时（3 分钟），可能因 AI 或 PDF 生成较慢。请重试或查看 trip_generator 终端是否有报错。"
              : (fetchErr instanceof Error ? fetchErr.message : String(fetchErr)),
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

        await updateMaterialTask(task.task_id, {
          status: "running",
          progress: 80,
          message: "正在保存 PDF...",
        })

        if (data.pdf_base64) {
          const outputDir = getMaterialTaskOutputDir(task.task_id)
          const pdfPath = path.join(outputDir, "itinerary.pdf")
          const buf = Buffer.from(data.pdf_base64, "base64")
          await fs.writeFile(pdfPath, buf)

          const downloadUrl = `/api/material-tasks/download/${task.task_id}/itinerary.pdf`
          await updateMaterialTask(task.task_id, {
            status: "completed",
            progress: 100,
            message: "行程单生成完成",
            result: {
              success: true,
              download_pdf: downloadUrl,
              analysis: data.analysis,
            },
          })
        } else {
          await updateMaterialTask(task.task_id, {
            status: "failed",
            progress: 0,
            message: "未获取到 PDF 数据",
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
          message: "行程单生成失败",
          error: isConn
            ? "行程单生成服务未启动，请先启动 trip_generator。"
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
    console.error("Itinerary generate error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    const isConnectionError =
      msg.includes("ECONNREFUSED") || msg.includes("fetch failed")
    return NextResponse.json(
      {
        success: false,
        error: isConnectionError
          ? "行程单生成服务未启动，请先启动 trip_generator 服务。"
          : "生成行程单失败，请稍后重试。",
      },
      { status: 500 }
    )
  }
}

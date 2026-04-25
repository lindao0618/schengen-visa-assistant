import { existsSync } from "fs"
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { NextRequest, NextResponse } from "next/server"

import { requireAgentActor } from "@/lib/agent-auth"

export const dynamic = "force-dynamic"

function buildPrompt(content: string, category: string) {
  switch (category) {
    case "hotel":
      return `请分析以下酒店预订信息是否符合申根签证要求：\n${content}`
    case "flight":
      return `请分析以下航班预订信息是否符合申根签证要求：\n${content}`
    case "insurance":
      return `请分析以下保险信息是否符合申根签证要求：\n${content}`
    default:
      return `请分析以下文件内容是否符合签证材料要求：\n${content}`
  }
}

async function analyzeFile(buffer: Buffer, category: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置")
  }

  const content = buffer.toString("utf-8")
  const prompt = buildPrompt(content, category)
  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-V3",
      messages: [
        {
          role: "system",
          content: "你是专业的签证材料审核助理，需要明确指出材料是否合格以及具体问题。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const result = await response.json()
  return result?.choices?.[0]?.message?.content || ""
}

export async function POST(request: NextRequest) {
  const { actor, response } = await requireAgentActor(request)
  if (!actor) {
    return response
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const category = String(formData.get("category") || "general")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const uploadDir = join(process.cwd(), "uploads")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `${Date.now()}-${file.name}`
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    const analysis = await analyzeFile(buffer, category)
    return NextResponse.json({
      message: "File uploaded and analyzed successfully",
      filename: file.name,
      savedAs: filename,
      category,
      requestedBy: {
        userId: actor.userId,
        authMode: actor.authMode,
      },
      analysis,
    })
  } catch (error) {
    console.error("[API_UPLOAD_POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    )
  }
}

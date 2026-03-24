import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // 创建上传目录
    const uploadDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 获取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 保存文件
    const filename = `${Date.now()}-${file.name}`;
    const filepath = join(uploadDir, filename);
    
    try {
      await writeFile(filepath, buffer);
      console.log("File saved successfully:", filepath);
    } catch (error) {
      console.error("Error saving file:", error);
      return NextResponse.json(
        { error: "Error saving file" },
        { status: 500 }
      );
    }

    // 根据类别分析文件内容
    try {
      const analysis = await analyzeFile(buffer, category);
      return NextResponse.json({
        message: "File uploaded and analyzed successfully",
        filename: file.name,
        category,
        analysis
      });
    } catch (error) {
      console.error("Analysis error:", error);
      return NextResponse.json(
        { error: "Analysis failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

async function analyzeFile(buffer: Buffer, category: string): Promise<string> {
  // 将 Buffer 转换为文本
  const content = buffer.toString('utf-8');
  
  // 构建提示词
  let prompt = "";
  switch (category) {
    case "hotel":
      prompt = `请分析以下酒店预订信息是否符合申根签证要求：\n${content}`;
      break;
    case "flight":
      prompt = `请分析以下航班预订信息是否符合申根签证要求：\n${content}`;
      break;
    case "insurance":
      prompt = `请分析以下保险信息是否符合申根签证要求：\n${content}`;
      break;
    default:
      prompt = `请分析以下文件内容是否符合申根签证要求：\n${content}`;
  }

  try {
    // 调用 AI API 进行分析
    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer sk-wbesypzvuhzaohjvoqgbkvntieelpubwykjjcwjlpclnmunb`
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [
          {
            role: "system",
            content: "你是一个专业的签证材料审核助手，需要仔细检查每份材料是否符合申根签证的要求。请详细说明材料是否合格，如果不合格请指出具体问题。"
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("AI analysis error:", error);
    throw new Error("Failed to analyze file");
  }
}

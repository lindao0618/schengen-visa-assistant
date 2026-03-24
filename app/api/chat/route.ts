import { NextResponse } from "next/server"

// API 配置
const API_CONFIG = {
  url: "https://api.siliconflow.cn/v1/chat/completions",
  model: "deepseek-ai/DeepSeek-V3",  // 使用 V3 模型
  apiKey: "sk-wbesypzvuhzaohjvoqgbkvntieelpubwykjjcwjlpclnmunb"
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    console.log("Received messages:", messages)

    // 准备发送到 Deepseek API 的消息
    const apiMessages = [
      {
        role: "system",
        content: `你是一个专业的签证顾问助手，专门帮助用户解答签证相关问题。
        你需要：
        1. 提供准确、最新的签证申请信息
        2. 根据不同国家的具体要求给出建议
        3. 使用友好、专业的语气
        4. 回答要简洁但详细
        5. 如果不确定的信息，建议用户查询官方网站或咨询使领馆`
      },
      ...messages
    ]

    console.log("Sending request to Deepseek API...")
    const requestBody = {
      model: API_CONFIG.model,
      messages: apiMessages,
      stream: false,
      max_tokens: 512,
      stop: ["null"],
      temperature: 0.7,
      top_p: 0.7,
      top_k: 50,
      frequency_penalty: 0.5,
      n: 1,
      response_format: { type: "text" }
    }
    console.log("Request body:", JSON.stringify(requestBody, null, 2))

    // 添加重试逻辑
    let retries = 3
    let response
    let lastError

    while (retries > 0) {
      try {
        console.log(`Attempt ${4 - retries}: Making request to ${API_CONFIG.url}`)
        response = await fetch(API_CONFIG.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_CONFIG.apiKey}`
          },
          body: JSON.stringify(requestBody)
        })

        const responseText = await response.text()
        console.log(`Attempt ${4 - retries} response. Status: ${response.status}. Response:`, responseText)

        if (response.ok) {
          try {
            const responseData = JSON.parse(responseText)
            if (responseData.choices?.[0]?.message?.content) {
              console.log("Successfully received response from API")
              return NextResponse.json({
                role: "assistant",
                content: responseData.choices[0].message.content
              })
            }
          } catch (e) {
            console.error(`Attempt ${4 - retries}: Failed to parse successful response:`, e)
          }
        }

        lastError = responseText
        console.log(`Attempt ${4 - retries} failed. Status: ${response.status}. Error:`, responseText)
        retries--

        if (retries > 0) {
          const waitTime = (4 - retries) * 2000
          console.log(`Waiting ${waitTime}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      } catch (error) {
        lastError = error
        console.log(`Attempt ${4 - retries}: Network error:`, error)
        retries--

        if (retries > 0) {
          const waitTime = (4 - retries) * 2000
          console.log(`Waiting ${waitTime}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    console.error("All retry attempts failed. Last error:", lastError)
    throw new Error(`API request failed after all retries. Last error: ${lastError}`)
  } catch (error) {
    console.error("Chat API Error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Detailed error:", errorMessage)
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

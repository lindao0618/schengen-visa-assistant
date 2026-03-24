import { NextResponse } from "next/server";

// API u914du7f6e
const API_CONFIG = {
  url: "https://api.siliconflow.cn/v1/chat/completions",
  model: "deepseek-ai/DeepSeek-V3",  // u4f7fu7528 V3 u6a21u578b
  apiKey: "sk-wbesypzvuhzaohjvoqgbkvntieelpubwykjjcwjlpclnmunb"
};

export async function POST(req: Request) {
  try {
    const { question, visa_type, country, applicant_location, applicant_status, use_rag } = await req.json();
    console.log("u63a5u6536u5230u7684u95eeu9898:", question);
    console.log("u7b7eu8bc1u7c7bu578b:", visa_type);
    console.log("u7533u8bf7u56fdu5bb6:", country);
    console.log("u6240u5728u5730:", applicant_location);
    console.log("u7533u8bf7u4ebau8eabu4efd:", applicant_status);
    console.log("u4f7fu7528RAG:", use_rag);

    // u6784u5efau7cfbu7edfu63d0u793a
    let systemPrompt = `u4f60u662fu4e00u4e2au4e13u4e1au7684u7b7eu8bc1u987eu95eeu52a9u624buff0cu4e13u95e8u5e2eu52a9u7528u6237u89e3u7b54u7b7eu8bc1u76f8u5173u95eeu9898u3002
    u4f60u9700u8981uff1a
    1. u63d0u4f9bu51c6u786eu3001u6700u65b0u7684u7b7eu8bc1u7533u8bf7u4fe1u606f
    2. u6839u636eu4e0du540cu56fdu5bb6u7684u5177u4f53u8981u6c42u7ed9u51fau5efau8bae
    3. u4f7fu7528u53cbu597du3001u4e13u4e1au7684u8bedu6c14
    4. u56deu7b54u8981u7b80u6d01u4f46u8be6u7ec6
    5. u5982u679cu4e0du786eu5b9au7684u4fe1u606fuff0cu5efau8baeu7528u6237u67e5u8be2u5b98u65b9u7f51u7ad9u6216u54a8u8be2u4f7fu9886u9986`;

    // u6dfbu52a0u7b7eu8bc1u7c7bu578bu548cu56fdu5bb6u4fe1u606f
    if (visa_type) {
      systemPrompt += `\nu7528u6237u6b63u5728u54a8u8be2${visa_type}u76f8u5173u95eeu9898u3002`;
    }
    
    if (country) {
      systemPrompt += `\nu9488u5bf9u7684u56fdu5bb6u662f${country}u3002`;
    }
    
    if (applicant_location) {
      systemPrompt += `\nu7528u6237u76eeu524du6240u5728u5730u662f${applicant_location}u3002`;
    }
    
    if (applicant_status) {
      systemPrompt += `\nu7528u6237u7684u8eabu4efdu662f${applicant_status}u3002`;
    }

    // u51c6u5907u53d1u9001u5230 API u7684u6d88u606f
    const apiMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: question
      }
    ];

    // u521bu5efau4e00u4e2au53efu8bfbu6d41u6765u5904u7406 API u54cdu5e94
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // u521bu5efau4e00u4e2au81eau5b9au4e49u7684u6d41u6765u5904u7406u6570u636e
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(API_CONFIG.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify({
              model: API_CONFIG.model,
              messages: apiMessages,
              stream: true,
              max_tokens: 1024,
              temperature: 0.7,
              top_p: 0.7
            })
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.error("APIu9519u8bef:", errorData);
            controller.enqueue(encoder.encode("u62b1u6b49uff0cu6211u9047u5230u4e86u4e00u4e9bu95eeu9898u3002u8bf7u7a0du540eu518du8bd5u3002"));
            controller.close();
            return;
          }

          const reader = response.body!.getReader();
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // u89e3u7801u5185u5bb9
            buffer += decoder.decode(value, { stream: true });
            
            // u5904u7406u6570u636eu884c
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.trim() === 'data: [DONE]') continue;
              
              try {
                // u5220u9664u884cu9996u7684 "data: "
                const json = line.replace(/^data: /, '').trim();
                const data = JSON.parse(json);
                
                // u63d0u53d6u5185u5bb9
                const content = data.choices[0]?.delta?.content || '';
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch (e) {
                console.error("u89e3u6790u9519u8bef:", e, "u884c:", line);
              }
            }
          }
        } catch (error) {
          console.error("u6d41u5904u7406u9519u8bef:", error);
          controller.enqueue(encoder.encode(`u5904u7406u51fau9519: ${error instanceof Error ? error.message : String(error)}`));
        } finally {
          controller.close();
        }
      }
    });

    // 使用原生Web API实现流式响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error("APIu9519u8bef:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 验证请求数据
    if (!body.tlsAccount || !body.bookingParams) {
      return NextResponse.json({
        success: false,
        message: "缺少必要的TLS账号信息或预约参数"
      }, { status: 400 })
    }
    
    // 构建Python脚本的输入数据
    const pythonInput = {
      tlsAccount: body.tlsAccount,
      bookingParams: body.bookingParams,
      payment: body.payment
    }
    
    console.log("预约请求数据:", JSON.stringify(pythonInput, null, 2))
    
    // 调用Python脚本
    const pythonScript = path.join(process.cwd(), "app", "slot_appoint", "tls_slot_appoint", "submit_and_check(tls）.py")
    
    return new Promise<Response>((resolve) => {
      const pythonProcess = spawn("python", [pythonScript], {
        stdio: ["pipe", "pipe", "pipe"]
      })
      const timeoutId = setTimeout(() => {
        pythonProcess.kill()
        resolve(NextResponse.json({
          success: false,
          message: "预约处理超时"
        }, { status: 408 }))
      }, 300000)
      
      let output = ""
      let errorOutput = ""
      
      // 发送数据到Python脚本
      console.log("发送到Python的数据:", JSON.stringify(pythonInput, null, 2))
      pythonProcess.stdin.write(JSON.stringify(pythonInput))
      pythonProcess.stdin.end()
      
      // 收集输出
      pythonProcess.stdout.on("data", (data) => {
        output += data.toString()
      })
      
      pythonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString()
      })
      
      pythonProcess.on("close", (code) => {
        clearTimeout(timeoutId)
        console.log("Python脚本执行完成，退出码:", code)
        console.log("Python输出:", output)
        
        if (code !== 0) {
          console.error("Python脚本错误:", errorOutput)
          resolve(NextResponse.json({
            success: false,
            message: "预约处理失败",
            error: errorOutput
          }, { status: 500 }))
          return
        }
        
        try {
          // 尝试解析Python输出
          const result = JSON.parse(output)
          resolve(NextResponse.json({
            success: true,
            message: "预约请求已提交",
            data: result
          }))
        } catch (parseError) {
          console.error("解析Python输出失败:", parseError)
          resolve(NextResponse.json({
            success: true,
            message: "预约请求已提交",
            data: { output, raw: true }
          }))
        }
      })
    })
    
  } catch (error) {
    console.error("处理预约请求时出错:", error)
    return NextResponse.json({
      success: false,
      message: "服务器内部错误",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

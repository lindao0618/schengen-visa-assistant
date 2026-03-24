import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 测试数据
    const testData = {
      tlsAccount: {
        username: "test@example.com",
        password: "testpass",
        country: "uk",
        city: "london"
      },
      bookingParams: {
        dateTimeRanges: [
          {
            startDate: "2025-01-01",
            endDate: "2025-01-31",
            startTime: "09:00",
            endTime: "17:00"
          }
        ],
        slotTypes: ["normal"]
      },
      payment: {
        peopleCount: 1,
        totalAmount: 350
      }
    }
    
    console.log("测试数据:", JSON.stringify(testData, null, 2))
    
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
          message: "测试超时"
        }, { status: 408 }))
      }, 30000)
      
      let output = ""
      let errorOutput = ""
      
      // 发送数据到Python脚本
      pythonProcess.stdin.write(JSON.stringify(testData))
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
        console.log("Python错误:", errorOutput)
        
        resolve(NextResponse.json({
          success: true,
          exitCode: code,
          output: output,
          error: errorOutput,
          inputData: testData
        }))
      })
      
    })
    
  } catch (error) {
    console.error("测试时出错:", error)
    return NextResponse.json({
      success: false,
      message: "服务器内部错误",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}





























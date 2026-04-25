#!/usr/bin/env node
const fs = require("fs")
const path = require("path")

// 简单的环境变量加载
function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8")
    const lines = content.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIndex = trimmed.indexOf("=")
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim()
          let value = trimmed.substring(eqIndex + 1).trim()
          // 去除引号
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1)
          }
          process.env[key] = value
        }
      }
    }
  }
}

loadEnv(path.join(__dirname, "..", ".env.local"))
loadEnv(path.join(__dirname, "..", ".env"))

const nodemailer = require("nodemailer")

async function sendEmail(options) {
  const smtpUser = process.env.SMTP_USER || "ukvisa20242024@163.com"
  const smtpPassword = process.env.SMTP_PASSWORD || ""
  const smtpHost = process.env.SMTP_HOST || "smtp.163.com"
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10)

  console.log("SMTP 配置:")
  console.log("  Host:", smtpHost)
  console.log("  Port:", smtpPort)
  console.log("  User:", smtpUser)
  console.log("  Password:", smtpPassword ? "***" : "未设置")
  console.log()

  // 创建 Nodemailer 传输器
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  })

  // 验证连接
  console.log("验证 SMTP 连接...")
  await transporter.verify()
  console.log("✅ SMTP 连接验证成功")
  console.log()

  // 邮件配置
  const mailOptions = {
    from: smtpUser,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  }

  console.log("发送邮件到:", options.to)
  console.log("主题:", options.subject)
  console.log()

  // 发送邮件
  const info = await transporter.sendMail(mailOptions)
  console.log("✅ 邮件发送成功!")
  console.log("  Message ID:", info.messageId)
  console.log("  Response:", info.response)
  return info
}

function buildReminderEmailContent(applicantName, reminderBody, statusLabel) {
  const name = applicantName || "申请人"
  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>签证提醒</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      margin-bottom: 20px;
      background: white;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .status {
      margin-top: 20px;
      padding: 15px;
      background: #e8f4fd;
      border-radius: 8px;
      border: 1px solid #b8daff;
    }
    .status-label {
      font-weight: 600;
      color: #0066cc;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>【签证提醒】</h1>
  </div>
  <div class="content">
    <div class="greeting">${name} 您好，</div>
    <div class="message">${reminderBody.replace(/\n/g, '<br>')}</div>
    <div class="status">
      <div>当前案件状态：<span class="status-label">${statusLabel}</span></div>
    </div>
  </div>
  <div class="footer">
    此邮件由系统自动发送，请勿直接回复。<br>
    如有疑问，请联系您的签证顾问。
  </div>
</body>
</html>`

  const textContent = `【签证提醒】

${name} 您好，

${reminderBody}

当前案件状态：${statusLabel}

此邮件由系统自动发送，请勿直接回复。
如有疑问，请联系您的签证顾问。`

  return { html: htmlContent, text: textContent }
}

async function testEmail() {
  console.log("=".repeat(60))
  console.log("           邮件发送测试")
  console.log("=".repeat(60))
  console.log()

  const testEmail = "ukvisa20242024@163.com" // 先发给自己测试
  // const testEmail = "your-email@example.com" // 换成你的邮箱

  console.log("--- 测试 1: 简单文本邮件 ---")
  try {
    const info1 = await sendEmail({
      to: testEmail,
      subject: "【测试】简单文本邮件 - " + new Date().toLocaleString("zh-CN"),
      text: "这是一封简单的测试邮件。\n\n发送时间：" + new Date().toLocaleString("zh-CN"),
    })
    console.log("✅ 简单文本邮件发送成功!")
  } catch (error) {
    console.error("❌ 简单文本邮件发送失败:", error.message)
    if (error.response) {
      console.error("  响应:", error.response)
    }
  }

  console.log()
  console.log("--- 测试 2: 美签提醒邮件（HTML）---")
  try {
    const emailContent = buildReminderEmailContent(
      "测试申请人",
      "这是一条测试提醒。\n距离面签还有 3 天，请准备好材料！",
      "已预约 - 等待面签"
    )

    const info2 = await sendEmail({
      to: testEmail,
      subject: "【美签提醒】测试提醒邮件 - " + new Date().toLocaleString("zh-CN"),
      text: emailContent.text,
      html: emailContent.html,
    })
    console.log("✅ 美签提醒邮件发送成功!")
  } catch (error) {
    console.error("❌ 美签提醒邮件发送失败:", error.message)
    if (error.response) {
      console.error("  响应:", error.response)
    }
  }

  console.log()
  console.log("=".repeat(60))
  console.log("           测试完成")
  console.log("=".repeat(60))
}

testEmail().catch((error) => {
  console.error("测试脚本执行失败:", error)
  process.exit(1)
})

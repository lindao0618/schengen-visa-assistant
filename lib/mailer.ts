import nodemailer from "nodemailer"

interface EmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(options: EmailOptions) {
  const smtpUser = process.env.SMTP_USER || "ukvisa20242024@163.com"
  const smtpPassword = process.env.SMTP_PASSWORD || ""
  const smtpHost = process.env.SMTP_HOST || "smtp.163.com"
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10)

  // 创建 Nodemailer 传输器
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 端口通常使用 SSL
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  })

  // 邮件配置
  const mailOptions = {
    from: smtpUser,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  }

  // 发送邮件
  const info = await transporter.sendMail(mailOptions)
  console.log("邮件发送成功:", info.messageId)
  return info
}

export function buildReminderEmailContent(
  applicantName: string | null | undefined,
  reminderBody: string,
  statusLabel: string,
) {
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

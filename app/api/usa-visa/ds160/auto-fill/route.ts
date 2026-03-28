import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createTask, updateTask } from '@/lib/usa-visa-tasks'

export const dynamic = 'force-dynamic'
import { spawn } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import nodemailer from 'nodemailer'
import {
  getApplicantProfile,
  getApplicantProfileFileByCandidates,
  updateApplicantProfileUsVisaDetails,
} from '@/lib/applicant-profiles'

const DS160_CC_EMAIL = 'ukvisa20242024@163.com'

/** 从 Python 输出目录读取 Excel 个人邮箱，若无或无效则返回 null */
async function readExcelRecipientEmail(pythonOutputDir: string): Promise<string | null> {
  try {
    const p = path.join(pythonOutputDir, 'recipient_email.txt')
    const content = await fs.readFile(p, 'utf-8')
    const email = (content || '').trim()
    if (email && email.includes('@')) return email
  } catch {
    /* 文件不存在或读取失败 */
  }
  return null
}

/** 申请人信息，用于邮件模板 */
interface ApplicantInfo {
  email?: string
  surname?: string
  birth_date?: string
  passport_number?: string
  primary_phone?: string
  security_question?: string
  security_answer?: string
}

/** 从 Python 输出目录读取 applicant_info.json */
async function readApplicantInfo(pythonOutputDir: string): Promise<ApplicantInfo | null> {
  try {
    const p = path.join(pythonOutputDir, 'applicant_info.json')
    const content = await fs.readFile(p, 'utf-8')
    const data = JSON.parse(content || '{}') as ApplicantInfo
    return data
  } catch {
    return null
  }
}

async function syncApplicantProfileFromDs160Output(params: {
  userId: string
  applicantProfileId?: string
  aaCode?: string
  applicantInfo?: ApplicantInfo | null
}) {
  const { userId, applicantProfileId, aaCode, applicantInfo } = params
  if (!applicantProfileId) return

  await updateApplicantProfileUsVisaDetails(userId, applicantProfileId, {
    aaCode,
    surname: applicantInfo?.surname,
    birthDate: applicantInfo?.birth_date,
    passportNumber: applicantInfo?.passport_number,
  })
}

// 邮件发送函数（支持抄送 extraEmail）
async function sendEmailWithAttachments(toEmail: string, subject: string, bodyHtml: string, attachmentPaths: string[], extraEmail?: string) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.163.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'ukvisa20242024@163.com',
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || ''
      }
    })

    const mailOptions: Record<string, unknown> = {
      from: process.env.SMTP_USER || 'ukvisa20242024@163.com',
      to: toEmail,
      subject: subject,
      html: bodyHtml,
      attachments: attachmentPaths.map(filePath => ({
        filename: path.basename(filePath),
        path: filePath
      }))
    }
    if (extraEmail && extraEmail.trim() && extraEmail.trim().toLowerCase() !== toEmail.toLowerCase()) {
      mailOptions.cc = extraEmail.trim()
    }

    const result = await transporter.sendMail(mailOptions)
    console.log('邮件发送成功', result.messageId)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error('邮件发送失败', error)
    return { success: false, error: error }
  }
}

function buildDs160EmailHtml(params: {
  aaCode?: string
  files?: Array<{ filename: string; size?: number }>
  applicant?: ApplicantInfo | null
}) {
  const { aaCode, files = [], applicant } = params
  const fileList = files.length
    ? files
        .map((file) => {
          const size = typeof file.size === "number" ? ` (${(file.size / 1024).toFixed(1)} KB)` : ""
          return `<li>${file.filename}${size}</li>`
        })
        .join("")
    : "<li>未找到附件</li>"
  const infoLines: string[] = []
  if (applicant?.email) infoLines.push(`<tr><td style="padding:2px 8px 2px 0;">邮箱：</td><td>${applicant.email}</td></tr>`)
  if (applicant?.surname) infoLines.push(`<tr><td style="padding:2px 8px 2px 0;">姓：</td><td>${applicant.surname}</td></tr>`)
  if (applicant?.birth_date) infoLines.push(`<tr><td style="padding:2px 8px 2px 0;">生日（Birth Date）：</td><td>${applicant.birth_date}</td></tr>`)
  if (applicant?.passport_number) infoLines.push(`<tr><td style="padding:2px 8px 2px 0;">护照号：</td><td>${applicant.passport_number}</td></tr>`)
  if (applicant?.primary_phone) infoLines.push(`<tr><td style="padding:2px 8px 2px 0;">主要电话：</td><td>${applicant.primary_phone}</td></tr>`)
  const applicantBlock = infoLines.length
    ? `<p style="margin: 8px 0 4px;"><b>📧 申请人信息：</b></p>
       <table style="margin: 4px 0; border-collapse: collapse;">${infoLines.join("")}</table>`
    : ""
  const securityBlock =
    applicant?.security_question || applicant?.security_answer
      ? `<p style="margin: 8px 0 4px;"><b>安全问题：</b>${applicant?.security_question || "-"}</p>
         <p style="margin: 4px 0 8px;"><b>答案：</b>${applicant?.security_answer || "-"}</p>`
      : ""
  return `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; padding: 16px; line-height: 1.5;">
        <h2 style="color: #2f6fed; margin: 0 0 12px;">DS-160 表单填写成功 🎉</h2>
        <p style="margin: 6px 0;">您好！</p>
        <p style="margin: 6px 0;">您提交的 DS-160 表单 已成功填写！</p>
        ${applicantBlock}
        ${aaCode ? `<p style="margin: 12px 0 8px;"><b>AA 码：</b><span style="color: #d63384; font-size: 1.1em;">${aaCode}</span></p>` : ""}
        ${securityBlock}
        <p style="margin: 12px 0;">请查收 <b>多个附件</b> 中的 PDF 确认页。</p>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
        <h3 style="margin: 0 0 8px;">📋 生成的文件：</h3>
        <ul style="margin: 6px 0 0; padding-left: 20px;">${fileList}</ul>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">
        <h3 style="margin: 0 0 8px;">🔄 下一步操作：</h3>
        <ul style="margin: 6px 0 0; padding-left: 20px;">
          <li>审核 DS160 表格信息</li>
          <li>验证美签网站邮件</li>
          <li>打印确认页并预约签证面试</li>
          <li>携带确认页参加面试</li>
        </ul>
        <p style="margin-top: 20px; font-size: 14px;">祝您签证顺利！</p>
        <p style="font-size: 12px; color: #666;">来自申根签证助手团队 💼</p>
        <p style="font-size: 11px; color: #888; margin-top: 12px;">此邮件由系统自动发送，请勿直接回复。</p>
      </body>
    </html>
  `
}

interface Ds160BackgroundParams {
  excelPath: string
  excelFileName: string
  photoPath: string
  tempDir: string
  outputPath: string
  emailToUse: string
  extraEmail: string
  tempId: string
  userId: string
  applicantProfileId?: string
}

/** 从 stdout/stderr 提取简短错误信息（优先展示 [DS160-ERROR] 结构化错误，其次 Python traceback） */
function extractErrorSnippet(stdout: string, stderr: string): string {
  const combined = (stderr + '\n' + stdout).split(/\r?\n/)
  const meaningful: string[] = []
  const ds160ErrorLines: string[] = []
  const pythonErrorLines: string[] = []
  for (const line of combined) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^PROGRESS:\d+:/i.test(trimmed) || /^TIMING:/i.test(trimmed) || /^STEP:/i.test(trimmed)) continue
    if (/^(console:|browser console:)/i.test(trimmed) || /failed to load resource/i.test(trimmed)) continue
    meaningful.push(trimmed)
    // 优先收集 [DS160-ERROR] 结构化错误（失败步骤、失败原因）
    if (/^\[DS160-ERROR\]/.test(trimmed)) {
      ds160ErrorLines.push(trimmed.replace(/^\[DS160-ERROR\]\s*/, ''))
    }
    if (/^(Traceback|  File |  \w+Error|  \w+Exception|Error:|Exception:)/.test(trimmed) || /line \d+/.test(trimmed)) {
      pythonErrorLines.push(trimmed)
    }
  }
  // 若有 [DS160-ERROR] 结构化错误，优先展示（便于用户快速定位）
  if (ds160ErrorLines.length > 0) {
    const header = ds160ErrorLines.join('\n')
    if (pythonErrorLines.length > 0) {
      const trace = pythonErrorLines.slice(-8).join('\n')
      return header + '\n\n--- 详细堆栈 ---\n' + (trace.length > 400 ? trace.slice(-400) + '...' : trace)
    }
    return header
  }
  if (pythonErrorLines.length > 0) {
    const snippet = pythonErrorLines.slice(-12).join('\n')
    return snippet.length > 800 ? snippet.slice(-800) + '...' : snippet
  }
  const last = meaningful.slice(-15).join('\n')
  if (last.length > 600) return last.slice(-600) + '...'
  return last || ''
}

async function findLatestErrorScreenshot(pythonServicePath: string, outputPath: string, tempDir: string) {
  try {
    const files = await fs.readdir(pythonServicePath)
    const errorShots = files.filter((f) => /^error_\d+\.png$/.test(f))
    if (errorShots.length === 0) return null
    let latestFile = errorShots[0]
    let latestMtime = 0
    for (const file of errorShots) {
      const stat = await fs.stat(path.join(pythonServicePath, file))
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs
        latestFile = file
      }
    }
    const sourcePath = path.join(pythonServicePath, latestFile)
    const targetPath = path.join(outputPath, latestFile)
    await fs.copyFile(sourcePath, targetPath)
    return {
      filename: latestFile,
      path: targetPath,
      downloadUrl: `/api/usa-visa/ds160/download/${path.basename(tempDir)}/${latestFile}`
    }
  } catch {
    return null
  }
}

interface DownloadableArtifact {
  filename: string
  path: string
  size: number
  downloadUrl: string
}

async function collectCopiedArtifacts(params: {
  sourceDir: string
  outputPath: string
  tempDir: string
  predicate: (filename: string) => boolean
}): Promise<DownloadableArtifact[]> {
  const { sourceDir, outputPath, tempDir, predicate } = params
  const artifacts: DownloadableArtifact[] = []
  const files = await fs.readdir(sourceDir)

  for (const file of files) {
    if (!predicate(file)) continue
    const sourcePath = path.join(sourceDir, file)
    const targetPath = path.join(outputPath, file)
    await fs.copyFile(sourcePath, targetPath)
    const stats = await fs.stat(targetPath)
    artifacts.push({
      filename: file,
      path: targetPath,
      size: stats.size,
      downloadUrl: `/api/usa-visa/ds160/download/${path.basename(tempDir)}/${file}`,
    })
  }

  return artifacts.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }))
}

async function collectGuideScreenshots(pythonOutputDir: string, outputPath: string, tempDir: string) {
  try {
    return await collectCopiedArtifacts({
      sourceDir: pythonOutputDir,
      outputPath,
      tempDir,
      predicate: (filename) => /^guide_\d+_.+\.png$/i.test(filename),
    })
  } catch {
    return []
  }
}

async function buildGuideScreenshotBundle(outputPath: string, tempDir: string, filenames: string[]) {
  if (!filenames.length) return null

  const bundleName = 'ds160-guide-screenshots.zip'
  const bundlePath = path.join(outputPath, bundleName)
  const zipScript = [
    'import sys, os, zipfile',
    'zip_path = sys.argv[1]',
    'base_dir = sys.argv[2]',
    'files = sys.argv[3:]',
    'with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:',
    '    for name in files:',
    '        full = os.path.join(base_dir, name)',
    '        if os.path.isfile(full):',
    '            zf.write(full, arcname=name)',
  ].join('; ')

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('python', ['-c', zipScript, bundlePath, outputPath, ...filenames], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `zip failed with code ${code}`))
    })
    proc.on('error', reject)
  })

  const stats = await fs.stat(bundlePath)
  return {
    filename: bundleName,
    path: bundlePath,
    size: stats.size,
    downloadUrl: `/api/usa-visa/ds160/download/${path.basename(tempDir)}/${bundleName}`,
  }
}

async function runDs160FillInBackground(taskId: string, params: Ds160BackgroundParams): Promise<void> {
  const { excelPath, excelFileName, photoPath, tempDir, outputPath, emailToUse, extraEmail, tempId, userId, applicantProfileId } = params
  const prefix = excelFileName ? `[${excelFileName}] ` : ''
  const pythonServicePath = path.join(process.cwd(), 'services', 'usvisa-runtime', 'ds160-server-package')
  const scriptPath = path.join(pythonServicePath, 'ds160_server.py')
  const countryMapPath = path.join(pythonServicePath, 'country_map.xlsx')
  const captchaKey = process.env.CAPTCHA_API_KEY || process.env['2CAPTCHA_API_KEY'] || ''
  const capsolverKey = process.env.CAPSOLVER_API_KEY || process.env.CAPSOLVER_KEY || ''
  const scriptArgs = [
    '-u',  // 无缓冲输出，确保 PROGRESS 行实时到达 Node
    scriptPath, excelPath, photoPath, emailToUse,
    '--country_map', countryMapPath,
    ...(captchaKey ? ['--api_key', captchaKey] : []),
    ...(capsolverKey ? ['--capsolver_api_key', capsolverKey] : []),
    '--debug',
    ...(process.env.DS160_TIMING === '1' ? ['--timing'] : [])
  ]
  const env = {
    ...process.env,
    HEADLESS: 'true',
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    SMTP_USER: process.env.SMTP_USER || 'ukvisa20242024@163.com',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || ''
  }
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('python', scriptArgs, { cwd: pythonServicePath, stdio: ['pipe', 'pipe', 'pipe'], env })
    let stdout = ''
    let stderr = ''
    let progressBuffer = ''
    let lastStep = ''
    const flushProgress = (chunk: string) => {
      progressBuffer += chunk
      const lines = progressBuffer.split(/\r?\n/)
      progressBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const stepM = line.match(/^STEP:([^:]+):(.+)$/)
        if (stepM) {
          lastStep = stepM[1]
        }
        const m = line.match(/^PROGRESS:(\d+):(.+)$/)
        if (m) {
          const pct = parseInt(m[1], 10)
          let msg = m[2].trim()
          if (lastStep) msg = `[${lastStep}] ${msg}`
          void updateTask(taskId, { status: 'running', progress: pct, message: prefix + msg })
        }
      }
    }
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString()
      flushProgress(d.toString())
    })
    proc.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString()
      flushProgress(d.toString())
    })
    proc.on('close', async (code) => {
      if (code !== 0) {
        const screenshot = await findLatestErrorScreenshot(pythonServicePath, outputPath, tempDir)
        const errSnippet = extractErrorSnippet(stdout, stderr)
        const baseError = screenshot ? '已生成错误截图' : '执行失败'
        const fullError = errSnippet ? `${baseError}：${errSnippet}` : baseError
        await updateTask(taskId, {
          status: 'failed',
          progress: 0,
          message: '填表失败，请查看错误信息',
          error: fullError,
          result: screenshot ? { screenshot } : undefined
        })
        console.error('[DS160] Python 进程退出码:', code)
        if (errSnippet) console.error('[DS160] 错误详情:', errSnippet)
        if (screenshot) console.error('[DS160] 错误截图:', screenshot.filename)
        reject(new Error(fullError || 'DS160 failed'))
        return
      }
      try {
        const emailFolderName = emailToUse.replace('@', '_').replace(/\./g, '_').replace(/\+/g, '_')
        const pythonOutputDir = path.join(pythonServicePath, emailFolderName)
        let pdfFiles: Array<{ filename: string; path: string; size: number; downloadUrl: string }> = []
        let guideScreenshots: Array<{ filename: string; path: string; size: number; downloadUrl: string }> = []
        let pdfPathsForEmail: string[] = []

        try {
          pdfFiles = await collectCopiedArtifacts({
            sourceDir: pythonOutputDir,
            outputPath,
            tempDir,
            predicate: (file) => file.endsWith('.pdf'),
          })
          guideScreenshots = await collectGuideScreenshots(pythonOutputDir, outputPath, tempDir)
          pdfPathsForEmail = pdfFiles.map((file) => file.path)
        } catch {
          const resultFiles = await fs.readdir(outputPath).catch(() => [])
          for (const file of resultFiles) {
            if (!file.endsWith('.pdf')) continue
            const filePath = path.join(outputPath, file)
            const stats = await fs.stat(filePath)
            pdfFiles.push({
              filename: file,
              path: filePath,
              size: stats.size,
              downloadUrl: `/api/usa-visa/ds160/download/${path.basename(tempDir)}/${file}`,
            })
            pdfPathsForEmail.push(filePath)
          }
          guideScreenshots = resultFiles
            .filter((file) => /^guide_\d+_.+\.png$/i.test(file))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .map((file) => ({
              filename: file,
              path: path.join(outputPath, file),
              size: 0,
              downloadUrl: `/api/usa-visa/ds160/download/${path.basename(tempDir)}/${file}`,
            }))
        }

        if (pdfFiles.length === 0) {
          await updateTask(taskId, { status: 'failed', progress: 0, message: '未找到 PDF 文件', error: 'DS160表格生成失败' })
          reject(new Error('No PDF files'))
          return
        }

        const screenshotBundle = await buildGuideScreenshotBundle(
          outputPath,
          tempDir,
          guideScreenshots.map((file) => file.filename),
        ).catch(() => null)

        let aaCode = ''
        const lines = stdout.split('\n')
        for (const line of lines) {
          const m = line.match(/AA[A-Z0-9]{8}/)
          if (m) {
            aaCode = m[0]
            break
          }
        }
        const excelEmail = await readExcelRecipientEmail(pythonOutputDir)
        const applicantInfo = await readApplicantInfo(pythonOutputDir)
        if (applicantProfileId) {
          await syncApplicantProfileFromDs160Output({
            userId,
            applicantProfileId,
            aaCode,
            applicantInfo,
          })
        }
        const toEmail = excelEmail || emailToUse
        if (toEmail) {
          const bodyHtml = buildDs160EmailHtml({ aaCode, files: pdfFiles, applicant: applicantInfo })
          await sendEmailWithAttachments(
            toEmail,
            `DS-160 填表完成${aaCode ? ` | AA码: ${aaCode}` : ''}`,
            bodyHtml,
            pdfPathsForEmail,
            DS160_CC_EMAIL,
          )
        }
        const emailMsg = toEmail ? `结果已发送至 ${toEmail}` : '（未配置邮箱）'
        await updateTask(taskId, {
          status: 'completed',
          progress: 100,
          message: `${prefix}DS-160 填表完成，${emailMsg}`,
          result: {
            success: true,
            files: pdfFiles,
            guideScreenshots,
            guideScreenshotsZip: screenshotBundle || undefined,
            aaCode,
            emailSent: !!toEmail,
            emailTo: toEmail || undefined,
            sourceFile: excelFileName,
          }
        })
        resolve()
      } catch (e) {
        await updateTask(taskId, { status: 'failed', progress: 0, message: '处理失败', error: String(e) })
        reject(e)
      }
    })
    proc.on('error', (e) => {
      void updateTask(taskId, { status: 'failed', progress: 0, message: '进程启动失败', error: String(e) })
      reject(e)
    })
    const timeoutId = setTimeout(async () => {
      proc.kill()
      const screenshot = await findLatestErrorScreenshot(pythonServicePath, outputPath, tempDir)
      const errMsg = screenshot ? '执行超时（15分钟），已生成错误截图' : '执行超时（15分钟）'
      void updateTask(taskId, {
        status: 'failed',
        progress: 0,
        message: errMsg,
        error: errMsg,
        result: screenshot ? { screenshot } : undefined,
      })
      reject(new Error('Timeout'))
    }, 900000)
    proc.on('close', () => clearTimeout(timeoutId))
    proc.on('error', () => clearTimeout(timeoutId))
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }

    const formData = await request.formData()
    let excelFile = formData.get('excel') as File | null
    let photoFile = formData.get('photo') as File | null
    let email = (formData.get('email') as string) || ''
    const extraEmail = (formData.get('extra_email') as string) || ''
    const applicantProfileId = (formData.get('applicantProfileId') as string | null)?.trim() || ''
    const asyncMode = formData.get('async') === 'true' || formData.get('async') === '1'
    let profile = null

    if (applicantProfileId) {
      profile = await getApplicantProfile(session.user.id, applicantProfileId)
      const ds160Excel = await getApplicantProfileFileByCandidates(session.user.id, applicantProfileId, ['usVisaDs160Excel', 'ds160Excel'])
      const photo = await getApplicantProfileFileByCandidates(session.user.id, applicantProfileId, ['usVisaPhoto', 'photo'])
      if (!excelFile && ds160Excel) {
        const content = await fs.readFile(ds160Excel.absolutePath)
        excelFile = new File([content], ds160Excel.meta.originalName, {
          type: ds160Excel.meta.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      }
      if (!photoFile && photo) {
        const content = await fs.readFile(photo.absolutePath)
        photoFile = new File([content], photo.meta.originalName, {
          type: photo.meta.mimeType || 'image/jpeg',
        })
      }
      if (!email && profile?.email) {
        email = profile.email
      }
    }

    if (!excelFile || !photoFile) {
      return NextResponse.json({
        success: false,
        error: '缺少必要文件',
        message: '请上传Excel文件和照片文件'
      }, { status: 400 })
    }

    const emailToUse = (email || extraEmail || 'ukvisa20242024@163.com').trim()

    const tempId = `ds160-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tempDir = path.join(process.cwd(), 'temp', tempId)
    const outputPath = path.join(tempDir, 'output')
    
    await fs.mkdir(tempDir, { recursive: true })
    await fs.mkdir(outputPath, { recursive: true })

    const excelPath = path.join(tempDir, 'ds160_data.xlsx')
    const photoPath = path.join(tempDir, 'photo.jpg')
    
    await fs.writeFile(excelPath, Buffer.from(await excelFile.arrayBuffer()))
    await fs.writeFile(photoPath, Buffer.from(await photoFile.arrayBuffer()))

    if (asyncMode) {
      const excelFileName = excelFile.name || 'ds160_data.xlsx'
      const task = await createTask(session.user.id, 'fill-ds160', excelFileName, {
        applicantProfileId: applicantProfileId || undefined,
        applicantName: profile?.name || profile?.label,
      })
      await updateTask(task.task_id, { status: 'running', progress: 1, message: `[${excelFileName}] 准备中...` })
      runDs160FillInBackground(task.task_id, {
        excelPath,
        excelFileName,
        photoPath,
        tempDir,
        outputPath,
        emailToUse,
        extraEmail,
        tempId,
        userId: session.user.id,
        applicantProfileId: applicantProfileId || undefined,
      }).catch((err) => {
        console.error('[DS160] Background task error:', err)
        updateTask(task.task_id, {
          status: 'failed',
          progress: 0,
          message: '填表失败，请查看错误截图',
          error: err instanceof Error ? err.message : String(err)
        }).catch((e) => console.error('[DS160] updateTask failed:', e))
      })
      return NextResponse.json({ task_id: task.task_id, status: 'pending', message: '任务已创建' })
    }

    console.log('文件已保存', { excelPath, photoPath })

    // Python脚本路径
    const pythonServicePath = path.join(process.cwd(), 'services', 'usvisa-runtime', 'ds160-server-package')
    const scriptPath = path.join(pythonServicePath, 'ds160_server.py')
    const countryMapPath = path.join(pythonServicePath, 'country_map.xlsx')
      
    console.log('Python脚本路径:', scriptPath)
    console.log('Excel文件路径:', excelPath)
    console.log('照片文件路径:', photoPath)
    console.log('用户邮箱:', emailToUse)
      
    const captchaKey = process.env.CAPTCHA_API_KEY || process.env['2CAPTCHA_API_KEY'] || ''
    const capsolverKey = process.env.CAPSOLVER_API_KEY || process.env.CAPSOLVER_KEY || ''
    const scriptArgs = [
      scriptPath,
      excelPath,
      photoPath,
      emailToUse,
      '--country_map', countryMapPath,
      ...(captchaKey ? ['--api_key', captchaKey] : []),
      ...(capsolverKey ? ['--capsolver_api_key', capsolverKey] : []),
      '--debug',
      ...(process.env.DS160_TIMING === '1' ? ['--timing'] : [])
    ]
      
    // 执行Python脚本（cwd 设为脚本目录，便于找到 country_map 和输出）
    const result = await new Promise<{
      success: boolean
      message: string
      files: Array<{filename: string, path: string, size: number, downloadUrl: string}>
      guideScreenshots?: Array<{filename: string, path: string, size: number, downloadUrl: string}>
      guideScreenshotsZip?: { filename: string; path: string; size: number; downloadUrl: string }
      screenshot?: { filename: string; path: string; downloadUrl: string } | null
      summary: any
      logs: any
    }>((resolve, reject) => {
        const pythonProcess = spawn('python', scriptArgs, {
          cwd: pythonServicePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            HEADLESS: 'true',
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1',
            SMTP_USER: process.env.SMTP_USER || 'ukvisa20242024@163.com',
            SMTP_PASSWORD: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || ''
          }
        })
        
        let stdout = ''
        let stderr = ''
        
        // 实时输出stdout
        pythonProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          stdout += output
          console.log('Python STDOUT:', output.trim())
        })
        
        // 实时输出stderr
        pythonProcess.stderr.on('data', (data: Buffer) => {
          const error = data.toString()
          stderr += error
          console.error('Python STDERR:', error.trim())
        })
        
        pythonProcess.on('close', async (code: number) => {
          console.log('='.repeat(60))
          console.log(`Python脚本执行完成，退出码: ${code}`)
          console.log('STDOUT:', stdout)
          console.log('STDERR:', stderr)
          console.log('='.repeat(60))
          
          if (code !== 0) {
            const screenshot = await findLatestErrorScreenshot(pythonServicePath, outputPath, tempDir)
            resolve({
              success: false,
              message: '填表失败，请查看错误截图',
              files: [],
              screenshot: screenshot || undefined,
              summary: {
                processedAt: new Date().toISOString(),
                tempId: path.basename(tempDir)
              },
              logs: { hasErrors: true }
            })
            return
          }
          
          try {
            const emailFolderName = emailToUse.replace('@', '_').replace(/\./g, '_').replace(/\+/g, '_')
            const pythonOutputDir = path.join(pythonServicePath, emailFolderName)
            console.log('Checking Python output directory:', pythonOutputDir)

            let pdfFiles: Array<{ filename: string, path: string, size: number, downloadUrl: string }> = []
            let guideScreenshots: Array<{ filename: string, path: string, size: number, downloadUrl: string }> = []
            let pdfPathsForEmail: string[] = []

            try {
              const resultFiles = await fs.readdir(pythonOutputDir)
              console.log('Python output directory files:', resultFiles)
              pdfFiles = await collectCopiedArtifacts({
                sourceDir: pythonOutputDir,
                outputPath,
                tempDir,
                predicate: (file) => file.endsWith('.pdf'),
              })
              guideScreenshots = await collectGuideScreenshots(pythonOutputDir, outputPath, tempDir)
              pdfPathsForEmail = pdfFiles.map((file) => file.path)
            } catch (e) {
              console.log('Python output directory not found, checking temp output directory...')
              const resultFiles = await fs.readdir(outputPath).catch(() => [])
              console.log('Temp output directory files:', resultFiles)

              for (const file of resultFiles) {
                if (!file.endsWith('.pdf')) continue
                const filePath = path.join(outputPath, file)
                const stats = await fs.stat(filePath)
                pdfFiles.push({
                  filename: file,
                  path: filePath,
                  size: stats.size,
                  downloadUrl: `/api/usa-visa/ds160/download/${path.basename(tempDir)}/${file}`
                })
                pdfPathsForEmail.push(filePath)
              }
              guideScreenshots = resultFiles
                .filter((file) => /^guide_\d+_.+\.png$/i.test(file))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                .map((file) => ({
                  filename: file,
                  path: path.join(outputPath, file),
                  size: 0,
                  downloadUrl: `/api/usa-visa/ds160/download/${path.basename(tempDir)}/${file}`,
                }))
            }

            if (pdfFiles.length === 0) {
              throw new Error('DS160表格生成失败，未找到PDF文件')
            }

            const guideScreenshotsZip = await buildGuideScreenshotBundle(
              outputPath,
              tempDir,
              guideScreenshots.map((file) => file.filename),
            ).catch(() => null)

            console.log(`Found ${pdfFiles.length} PDF files:`, pdfFiles.map((f) => f.filename))

            let emailSent = false
            let aaCode = ''

            try {
              const lines = stdout.split('\n')
              for (const line of lines) {
                if (line.includes('AA') && line.length > 5) {
                  const match = line.match(/AA[A-Z0-9]{8}/)
                  if (match) {
                    aaCode = match[0]
                  }
                }
              }
            } catch (e) {
              console.log('无法解析AA码', e)
            }

            const excelEmail = await readExcelRecipientEmail(pythonOutputDir)
            const applicantInfo = await readApplicantInfo(pythonOutputDir)
            if (applicantProfileId && session.user.id) {
              await syncApplicantProfileFromDs160Output({
                userId: session.user.id,
                applicantProfileId,
                aaCode,
                applicantInfo,
              })
            }
            const toEmail = excelEmail || emailToUse
            if (toEmail) {
              try {
                const bodyHtml = buildDs160EmailHtml({ aaCode, files: pdfFiles, applicant: applicantInfo })
                const emailResult = await sendEmailWithAttachments(
                  toEmail,
                  `DS-160 填表完成${aaCode ? ` | AA码: ${aaCode}` : ''}`,
                  bodyHtml,
                  pdfPathsForEmail,
                  DS160_CC_EMAIL
                )
                emailSent = emailResult.success
              } catch (emailError) {
                console.error('邮件发送失败', emailError)
              }
            }

            const response = {
              success: true,
              message: 'DS160表格自动填写完成',
              files: pdfFiles,
              guideScreenshots,
              guideScreenshotsZip: guideScreenshotsZip || undefined,
              summary: {
                totalFiles: pdfFiles.length,
                guideScreenshotCount: guideScreenshots.length,
                processedAt: new Date().toISOString(),
                tempId: path.basename(tempDir),
                aaCode: aaCode,
                emailSent: emailSent,
                email: toEmail
              },
              logs: {
                stdout: stdout.split('\n'),
                hasErrors: stderr && !stderr.includes('WARNING')
              }
            }

            console.log('DS160处理完成:', response.summary)
            resolve(response)

          } catch (error) {
            reject(error)
          }
        })
        
        pythonProcess.on('error', (error: Error) => {
          console.error('Python进程启动失败:', error)
          reject(error)
        })
        
        // 设置超时
        setTimeout(() => {
          pythonProcess.kill()
          reject(new Error('Python脚本执行超时（15分钟）'))
      }, 900000) // 15分钟超时
      })

    return NextResponse.json(result)

  } catch (error) {
    console.error('DS160自动填表错误:', error)
    
    return NextResponse.json({
      success: false,
      error: 'DS160表格处理失败',
      message: error instanceof Error ? error.message : '未知错误',
      details: {
        timestamp: new Date().toISOString(),
        stack: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.stack : '') : undefined
      }
    }, { status: 500 })
  }
}

// GET方法：获取处理状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tempId = searchParams.get('tempId')
    
    if (!tempId) {
      return NextResponse.json({ error: 'Missing tempId' }, { status: 400 })
    }

    const tempDir = path.join(process.cwd(), 'temp', tempId)
    const outputPath = path.join(tempDir, 'output')
    
    try {
      const files = await fs.readdir(outputPath)
      const results = []
      
      for (const file of files) {
        const filePath = path.join(outputPath, file)
        const stats = await fs.stat(filePath)
        
        results.push({
          filename: file,
          size: stats.size,
          downloadUrl: `/api/usa-visa/ds160/download/${tempId}/${file}`
        })
      }
      
      return NextResponse.json({
        success: true,
        files: results,
        totalFiles: results.length
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: '文件目录不存在或无法访问'
      }, { status: 404 })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '获取处理状态失败'
    }, { status: 500 })
  }
}

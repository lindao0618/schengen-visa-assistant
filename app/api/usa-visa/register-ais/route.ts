import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createTask, updateTask } from '@/lib/usa-visa-tasks'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { getApplicantProfile, getApplicantProfileFileByCandidates } from '@/lib/applicant-profiles'
import { writeOutputAccessMetadata } from '@/lib/task-route-access'

/** 当 Python 未返回 screenshot 时，扫描输出目录查找最新错误截图 */
async function findLatestAisErrorScreenshot(outputDir: string) {
  try {
    const files = await fs.readdir(outputDir)
    const errorShots = files.filter((f) => /^ais_register_error_.*\.png$/i.test(f))
    if (errorShots.length === 0) return null
    let latest = errorShots[0]
    let latestMtime = 0
    for (const f of errorShots) {
      const stat = await fs.stat(path.join(outputDir, f))
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs
        latest = f
      }
    }
    return latest
  } catch {
    return null
  }
}

const env = {
  ...process.env,
  PYTHONIOENCODING: 'utf-8',
  PYTHONUTF8: '1',
  SMTP_USER: process.env.SMTP_USER || 'ukvisa20242024@163.com',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.163.com',
  SMTP_PORT: process.env.SMTP_PORT || '465',
}

async function runAisRegisterInBackground(
  taskId: string,
  excelPath: string,
  outputDir: string,
  excelFileName: string,
  password: string,
  sendActivationEmail: boolean,
  extraEmail: string,
  testMode: boolean
): Promise<void> {
  const scriptPath = path.join(process.cwd(), 'services', 'us-ais-register', 'us_ais_register_cli.py')
  const args = [
    '-u',
    scriptPath,
    excelPath,
    '--password', password,
    '--output-dir', outputDir,
  ]
  if (!sendActivationEmail) args.push('--no-email')
  if (extraEmail) args.push('--extra-email', extraEmail)
  if (testMode) args.push('--test-mode')

  const prefix = excelFileName ? `[${excelFileName}] ` : ''
  let stdout = ''
  let progressBuffer = ''
  const flushProgress = (chunk: string) => {
    progressBuffer += chunk
    const lines = progressBuffer.split(/\r?\n/)
    progressBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const m = line.match(/^PROGRESS:(\d+):(.+)$/)
      if (m) {
        const pct = parseInt(m[1], 10)
        const msg = m[2].trim()
        void updateTask(taskId, { status: 'running', progress: pct, message: prefix + msg })
      }
    }
  }

  const outputId = `ais-${taskId}`
  const proc = spawn('python', args, { cwd: process.cwd(), env, stdio: ['pipe', 'pipe', 'pipe'] })
  proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
  proc.stderr?.on('data', (d: Buffer) => { flushProgress(d.toString()) })
  proc.on('close', async (code) => {
    try {
      const data = JSON.parse(stdout.trim() || '{}') as {
        success?: boolean
        message?: string
        error?: string
        email?: string
        screenshot?: string
      }
      if (data.success) {
        await updateTask(taskId, {
          status: 'completed',
          progress: 100,
          message: prefix + (data.message || 'AIS 账号注册完成'),
          result: { success: true, email: data.email, message: data.message },
        })
      } else {
        let screenshotFilename: string | undefined = data.screenshot ?? undefined
        if (!screenshotFilename) {
          const outputDir = path.join(process.cwd(), 'temp', 'ais-register-outputs', outputId)
          screenshotFilename = (await findLatestAisErrorScreenshot(outputDir)) ?? undefined
        }
        const screenshot = screenshotFilename
          ? {
              filename: screenshotFilename,
              downloadUrl: `/api/usa-visa/ais-register/download/${outputId}/${encodeURIComponent(screenshotFilename)}`,
            }
          : undefined
        await updateTask(taskId, {
          status: 'failed',
          progress: 0,
          message: prefix + '注册失败',
          error: data.error || `退出码 ${code}`,
          result: {
            success: false,
            error: data.error,
            email: data.email,
            ...(screenshot && { screenshot }),
          },
        })
      }
    } catch {
      await updateTask(taskId, {
        status: 'failed',
        progress: 0,
        message: prefix + '解析结果失败',
        error: stdout || `退出码 ${code}`,
      })
    }
  })
  proc.on('error', async (err) => {
    await updateTask(taskId, { status: 'failed', progress: 0, message: '进程启动失败', error: String(err) })
  })
  setTimeout(() => {
    proc.kill()
    void updateTask(taskId, { status: 'failed', progress: 0, message: '执行超时（10分钟）', error: 'Timeout' })
  }, 600000)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }

    const formData = await request.formData()
    const password = (formData.get('password') as string) || 'Visa202520252025!'
    const sendActivationEmail = formData.get('send_activation_email') !== 'false'
    const extraEmail = (formData.get('extra_email') as string) || ''
    const applicantProfileId = (formData.get('applicantProfileId') as string | null)?.trim() || ''
    const caseId = (formData.get('caseId') as string | null)?.trim() || ''
    const applicantProfile = applicantProfileId ? await getApplicantProfile(session.user.id, applicantProfileId) : null
    const testMode = formData.get('test_mode') === 'true'

    const excelFiles: File[] = []
    const raw = formData.getAll('excel')
    for (const f of raw) {
      if (f && typeof f === 'object' && 'arrayBuffer' in f) excelFiles.push(f as File)
    }
    if (excelFiles.length === 0) {
      const one = formData.get('excel') as File | null
      if (one) excelFiles.push(one)
    }
    if (excelFiles.length === 0 && applicantProfileId) {
      const aisExcel = await getApplicantProfileFileByCandidates(session.user.id, applicantProfileId, ['usVisaDs160Excel', 'ds160Excel', 'usVisaAisExcel', 'aisExcel'])
      const ds160Excel = await getApplicantProfileFileByCandidates(session.user.id, applicantProfileId, ['usVisaDs160Excel', 'ds160Excel'])
      const chosen = aisExcel || ds160Excel
      if (chosen) {
        const content = await fs.readFile(chosen.absolutePath)
        excelFiles.push(
          new File([content], chosen.meta.originalName, {
            type: chosen.meta.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })
        )
      }
    }
    if (excelFiles.length === 0) {
      return NextResponse.json({ success: false, error: '请上传至少一个 Excel 文件' }, { status: 400 })
    }

    const scriptPath = path.join(process.cwd(), 'services', 'us-ais-register', 'us_ais_register_cli.py')
    try {
      await fs.access(scriptPath)
    } catch {
      return NextResponse.json({ success: false, error: 'AIS 注册服务未找到，请确认 services/us-ais-register 已部署' }, { status: 500 })
    }

    const taskIds: string[] = []
    for (let i = 0; i < excelFiles.length; i++) {
      const file = excelFiles[i]
      const name = file.name || `data_${i + 1}.xlsx`
      const task = await createTask(session.user.id, 'register-ais', `AIS 注册 · ${name}`, {
        applicantProfileId: applicantProfileId || undefined,
        caseId: caseId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      })
      taskIds.push(task.task_id)
      const outputId = `ais-${task.task_id}`
      const outputDir = path.join(process.cwd(), 'temp', 'ais-register-outputs', outputId)
      await fs.mkdir(outputDir, { recursive: true })
      await writeOutputAccessMetadata(outputDir, {
        userId: session.user.id,
        taskId: task.task_id,
        outputId,
      })
      const excelPath = path.join(outputDir, name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'data.xlsx')
      await fs.writeFile(excelPath, Buffer.from(await file.arrayBuffer()))
      await updateTask(task.task_id, { status: 'running', progress: 1, message: `[${name}] 准备中...` })
      runAisRegisterInBackground(
        task.task_id,
        excelPath,
        outputDir,
        name,
        password,
        sendActivationEmail,
        extraEmail,
        testMode
      ).catch((err) => {
        console.error('[AIS] Background task error:', err)
        void updateTask(task.task_id, { status: 'failed', progress: 0, message: '注册失败', error: String(err) })
      })
    }

    return NextResponse.json({
      success: true,
      task_ids: taskIds,
      message: `已创建 ${taskIds.length} 个 AIS 注册任务，请在下方的 AIS 注册任务列表中查看进度`,
    })
  } catch (error) {
    console.error('AIS 注册错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 })
  }
}

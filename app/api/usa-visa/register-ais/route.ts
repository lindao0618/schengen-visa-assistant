import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createTask, updateTask } from '@/lib/usa-visa-tasks'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { getApplicantProfile, getApplicantProfileFileByCandidates } from '@/lib/applicant-profiles'
import { writeOutputAccessMetadata } from '@/lib/task-route-access'
import { getPythonRuntimeCommand } from '@/lib/python-runtime'

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
  AIS_EXECUTION_PROFILE: process.env.AIS_EXECUTION_PROFILE || 'unified-v1',
  AIS_HEADLESS: process.env.AIS_HEADLESS || 'true',
  AIS_LOCALE: process.env.AIS_LOCALE || 'en-GB',
  AIS_TIMEZONE: process.env.AIS_TIMEZONE || 'Europe/London',
}

async function runAisRegisterInBackground(
  taskId: string,
  excelPath: string,
  outputDir: string,
  excelFileName: string,
  password: string,
  sendActivationEmail: boolean,
  extraEmail: string,
  testMode: boolean,
  loginExisting: boolean
): Promise<void> {
  const pythonRuntime = getPythonRuntimeCommand()
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
  if (loginExisting) args.push('--login-existing')

  const prefix = excelFileName ? `[${excelFileName}] ` : ''
  const operationLabel = loginExisting ? '一键到支付页' : '注册'
  let stdout = ''
  let stderr = ''
  let progressBuffer = ''
  const debugLogs: string[] = []
  const pushDebugLog = (line: string) => {
    const text = String(line || '').trim()
    if (!text) return
    debugLogs.push(text)
    if (debugLogs.length > 120) debugLogs.shift()
  }
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
        continue
      }
      const traceMatch = line.match(/^TRACE:([^:]+):([^:]+):(.*)$/)
      if (traceMatch) {
        const [, ts, stage, detail] = traceMatch
        const clean = `[${ts}] ${stage}${detail ? ` - ${detail.trim()}` : ''}`
        pushDebugLog(clean)
        continue
      }
      const traceJsonMatch = line.match(/^TRACE_JSON:(\{.*\})$/)
      if (traceJsonMatch) {
        try {
          const payload = JSON.parse(traceJsonMatch[1]) as { ts?: string; stage?: string; detail?: string }
          const ts = payload.ts || ''
          const stage = payload.stage || 'unknown'
          const detail = (payload.detail || '').trim()
          const clean = `[${ts}] ${stage}${detail ? ` - ${detail}` : ''}`
          pushDebugLog(clean)
          continue
        } catch {
          // fall through to plain log
        }
      }
      const trimmed = line.trim()
      if (trimmed) pushDebugLog(trimmed)
    }
  }

  const outputId = `ais-${taskId}`
  const proc = spawn(pythonRuntime, args, { cwd: process.cwd(), env, stdio: ['pipe', 'pipe', 'pipe'] })
  pushDebugLog(`[runtime] python=${pythonRuntime}`)
  pushDebugLog(`[runtime] execution_profile=${env.AIS_EXECUTION_PROFILE};headless=${env.AIS_HEADLESS};locale=${env.AIS_LOCALE};timezone=${env.AIS_TIMEZONE}`)
  proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
  proc.stderr?.on('data', (d: Buffer) => {
    const text = d.toString()
    stderr += text
    flushProgress(text)
  })
  proc.on('close', async (code) => {
    clearTimeout(timeoutId)
    try {
      const data = JSON.parse(stdout.trim() || '{}') as {
        success?: boolean
        message?: string
        error?: string
        email?: string
        screenshot?: string
        debug_html?: string
        chinese_name?: string
        account_password?: string
        payment_url?: string
        payment_screenshot?: string
        activation_required?: boolean
        activation_screenshot?: string
        registration_status?: string
      }
      if (data.success) {
        const paymentScreenshot = data.payment_screenshot
          ? {
              filename: data.payment_screenshot,
              downloadUrl: `/api/usa-visa/ais-register/download/${outputId}/${encodeURIComponent(data.payment_screenshot)}`,
            }
          : undefined
        const activationScreenshot = data.activation_screenshot
          ? {
              filename: data.activation_screenshot,
              downloadUrl: `/api/usa-visa/ais-register/download/${outputId}/${encodeURIComponent(data.activation_screenshot)}`,
            }
          : undefined
        await updateTask(taskId, {
          status: 'completed',
          progress: 100,
          message: prefix + (data.message || (loginExisting ? 'AIS 已推进到支付页' : 'AIS 账号注册完成')),
          result: {
            success: true,
            email: data.email,
            message: data.message,
            chineseName: data.chinese_name,
            password: data.account_password || password,
            paymentUrl: data.payment_url || '',
            registrationStatus: data.registration_status || '',
            activationRequired: Boolean(data.activation_required),
            ...(paymentScreenshot ? { paymentScreenshot } : {}),
            ...(activationScreenshot ? { activationScreenshot } : {}),
            debugLogs: debugLogs.slice(-60),
          },
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
        const debugHtml = data.debug_html
          ? {
              filename: data.debug_html,
              downloadUrl: `/api/usa-visa/ais-register/download/${outputId}/${encodeURIComponent(data.debug_html)}`,
            }
          : undefined
        const latestLogs = debugLogs.slice(-10)
        const lastStepHint = latestLogs.length > 0 ? `；最后步骤：${latestLogs[latestLogs.length - 1]}` : ''
        await updateTask(taskId, {
          status: 'failed',
          progress: 0,
          message: prefix + `${operationLabel}失败`,
          error: `${data.error || `退出码 ${code}`}${lastStepHint}`,
          result: {
            success: false,
            error: data.error,
            email: data.email,
            debugLogs: debugLogs.slice(-60),
            ...(screenshot && { screenshot }),
            ...(debugHtml && { debugHtml }),
          },
        })
      }
    } catch {
      const latestLogs = debugLogs.slice(-10)
      const detail = latestLogs.length ? `\n---stderr日志---\n${latestLogs.join('\n')}` : ''
      await updateTask(taskId, {
        status: 'failed',
        progress: 0,
        message: prefix + `${operationLabel}结果解析失败`,
        error: (stdout || `退出码 ${code}`) + detail,
        result: {
          debugLogs: debugLogs.slice(-60),
        },
      })
    }
  })
  proc.on('error', async (err) => {
    clearTimeout(timeoutId)
    await updateTask(taskId, {
      status: 'failed',
      progress: 0,
      message: '进程启动失败',
      error: String(err),
      result: { debugLogs: debugLogs.slice(-60) },
    })
  })
  const timeoutId = setTimeout(() => {
    const latestLogs = debugLogs.slice(-10)
    const timeoutDetail = latestLogs.length ? `；最后步骤：${latestLogs[latestLogs.length - 1]}` : ''
    proc.kill()
    void updateTask(taskId, {
      status: 'failed',
      progress: 0,
      message: '执行超时（10分钟）',
      error: `Timeout${timeoutDetail}`,
      result: { debugLogs: debugLogs.slice(-60) },
    })
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
    const loginExisting =
      formData.get('login_existing') === 'true' ||
      formData.get('mode') === 'login-existing'

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
      const taskTitle = loginExisting ? `AIS 到支付页 · ${name}` : `AIS 注册 · ${name}`
      const task = await createTask(session.user.id, 'register-ais', taskTitle, {
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
        applicantProfileId: applicantProfileId || undefined,
        caseId: caseId || undefined,
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
        testMode,
        loginExisting
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

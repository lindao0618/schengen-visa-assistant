import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { createTask, updateTask } from '@/lib/usa-visa-tasks';
import { getApplicantProfile, getApplicantProfileFileByCandidates, saveApplicantProfileFileFromAbsolutePath } from '@/lib/applicant-profiles';
import { writeOutputAccessMetadata } from '@/lib/task-route-access';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

const hasChinese = (text: string) => /[\u4e00-\u9fff]/.test(text);
const hasEnglish = (text: string) => /[A-Za-z]/.test(text);

const fallbackTranslateEnglish = (english: string) => {
  const lower = english.toLowerCase();
  if (lower.includes('illumination appears to be poor')) return '光照不足';
  if (lower.includes('timeout')) return '连接超时';
  if (lower.includes('no json') || lower.includes('no valid output')) return '未获取到检测结果';
  if (lower.includes('process exited')) return '检测进程异常退出';
  if (lower.includes('spawn') && lower.includes('python')) return '未找到Python运行环境';
  if (lower.includes('python') && lower.includes('not found')) return '未找到Python运行环境';
  if (lower.includes('enoent')) return '未找到检测程序或文件';
  if (lower.includes('connection') && lower.includes('refused')) return '连接服务失败';
  if (lower.includes('invalid') && lower.includes('response')) return '服务器返回了无效响应';
  return '';
};

const parsePrefixedMessage = (message: string) => {
  const m = message.match(/^([✅❌]?\s*[^:：]+)[:：]\s*(.+)$/);
  if (m) return { prefix: m[1].trim(), body: m[2].trim() };
  return { prefix: '', body: message.trim() };
};

const translatePhotoErrorDetail = async (raw: string) => {
  const message = String(raw || '').trim();
  if (!message) return { translation: '检测失败', suggestion: '' };

  const { prefix, body } = parsePrefixedMessage(message);
  const target = body || message;

  if (!hasEnglish(target)) {
    return { translation: message, suggestion: '' };
  }

  const fallback = fallbackTranslateEnglish(target);
  if (fallback) {
    const translation = prefix ? `${prefix}：${fallback}` : fallback;
    const suggestion = fallback === '光照不足' ? '在光线更好的环境重新拍摄，避免阴影或逆光' : '';
    return { translation, suggestion };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('http://127.0.0.1:8003/translate-photo-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: target }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      const translation = String(data?.translation || '').trim();
      const suggestion = String(data?.suggestion || '').trim();
      if (translation) {
        return {
          translation: prefix ? `${prefix}：${translation}` : translation,
          suggestion,
        };
      }
    }
  } catch {}

  return { translation: message, suggestion: '' };
};

const translatePhotoErrorMessage = async (raw: string) => {
  const { translation, suggestion } = await translatePhotoErrorDetail(raw);
  if (suggestion) return `${translation}。建议：${suggestion}`;
  return translation;
};

const normalizePhotoResult = async (result: Record<string, unknown>) => {
  if (typeof result.message === 'string') {
    result.message = await translatePhotoErrorMessage(result.message);
  }
  if (Array.isArray(result.checks)) {
    const checks = result.checks.map(async (item) => {
      if (typeof item !== 'string') return item;
      if (!hasEnglish(item)) return item;
      const { translation } = await translatePhotoErrorDetail(item);
      return translation || item;
    });
    result.checks = await Promise.all(checks);
  }
  return result;
};

function inferImageMimeType(filename: string) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

async function replaceApplicantProfilePhoto(params: {
  userId: string
  applicantProfileId?: string
  outputDir: string
  result: Record<string, unknown>
}) {
  const { userId, applicantProfileId, outputDir, result } = params
  if (!applicantProfileId || !result.success || !result.processed_photo_file) return false

  const processedPhotoPath = path.join(outputDir, String(result.processed_photo_file))
  await fs.access(processedPhotoPath)
  await saveApplicantProfileFileFromAbsolutePath({
    userId,
    id: applicantProfileId,
    slot: 'usVisaPhoto',
    sourcePath: processedPhotoPath,
    originalName: String(result.processed_photo_file),
    mimeType: inferImageMimeType(String(result.processed_photo_file)),
  })
  result.profile_photo_replaced = true
  return true
}

/**
 * 处理美国签证照片检测请求
 * 支持同步/异步模式，本地Python服务和外部API服务
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const formData = await request.formData();
    let photo = formData.get('photo');
    const applicantProfileId = (formData.get('applicantProfileId') as string | null)?.trim() || '';
    const caseId = (formData.get('caseId') as string | null)?.trim() || '';
    const applicantProfile = applicantProfileId ? await getApplicantProfile(session.user.id, applicantProfileId) : null;

    if (!photo && applicantProfileId) {
      const stored = await getApplicantProfileFileByCandidates(session.user.id, applicantProfileId, ['usVisaPhoto', 'photo']);
      if (!stored) {
        return NextResponse.json(
          { success: false, message: '当前申请人档案中没有可用照片' },
          { status: 400 }
        );
      }
      const fileBuffer = await fs.readFile(stored.absolutePath);
      photo = new File([fileBuffer], stored.meta.originalName, {
        type: stored.meta.mimeType || 'image/jpeg',
      });
    }

    if (!photo) {
      return NextResponse.json(
        { success: false, message: '没有提供照片' },
        { status: 400 }
      );
    }

    if (!(photo instanceof Blob)) {
      return NextResponse.json(
        { success: false, message: '照片格式无效' },
        { status: 400 }
      );
    }

    const useWebsite = formData.get('useWebsite') === 'true' || formData.get('useWebsite') === '1';
    const asyncMode = formData.get('async') === 'true' || formData.get('async') === '1';

    const outputId = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const outputDir = path.join(process.cwd(), 'temp', 'photo-check-outputs', outputId);
    const tempDir = path.join(outputDir, 'input');
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await writeOutputAccessMetadata(outputDir, {
      userId: session.user.id,
      outputId,
    });

    const originalFilename = photo instanceof File ? photo.name : 'photo.jpg';
    const photoBuffer = await photo.arrayBuffer();
    const photoPath = path.join(tempDir, 'photo.jpg');
    await fs.writeFile(photoPath, Buffer.from(photoBuffer));

    // 异步模式：创建任务，后台执行，任务列表会显示进度
    if (asyncMode) {
      const task = await createTask(session.user.id, 'check-photo', `准备中 · ${originalFilename}`, {
        applicantProfileId: applicantProfileId || undefined,
        caseId: caseId || undefined,
        applicantName: applicantProfile?.name || applicantProfile?.label,
      });
      await updateTask(task.task_id, { status: 'running', progress: 5, message: `准备中 · ${originalFilename}` });
      await writeOutputAccessMetadata(outputDir, {
        userId: session.user.id,
        taskId: task.task_id,
        outputId,
      });
      runPhotoCheckInBackground(task.task_id, {
        userId: session.user.id,
        applicantProfileId: applicantProfileId || undefined,
        photoPath,
        outputDir,
        outputId,
        tempDir,
        useWebsite,
        originalFilename,
      }).catch((err) => {
        console.error('[PhotoCheck] Background error:', err);
        void updateTask(task.task_id, { status: 'failed', progress: 0, message: '检测失败', error: String(err) });
      });
      return NextResponse.json({ task_id: task.task_id, status: 'pending', message: '任务已创建' });
    }

    // 同步模式
    try {
      const result = await runPhotoCheckSync(photoPath, outputDir, outputId, useWebsite);
      await replaceApplicantProfilePhoto({
        userId: session.user.id,
        applicantProfileId: applicantProfileId || undefined,
        outputDir,
        result,
      }).catch((error) => {
        console.error('[PhotoCheck] replace profile photo failed:', error);
      });
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
      return NextResponse.json({ ...result, service_type: 'local_python' });
    } catch (localError) {
      console.warn('本地Python服务失败，尝试外部API:', localError);
      return await callExternalAPI(photo);
    }
  } catch (error: any) {
    console.error('照片检测处理错误:', error);
    const translated = await translatePhotoErrorMessage(error?.message || error || '错误');
    return NextResponse.json(
      { success: false, message: translated },
      { status: 500 }
    );
  }
}

async function runPhotoCheckSync(
  photoPath: string,
  outputDir: string,
  outputId: string,
  useWebsite: boolean
): Promise<Record<string, unknown>> {
  const pythonServicePath = path.join(process.cwd(), 'services', 'photo-checker');
  const { stdout, stderr } = await execAsync(
    ['python', path.join(pythonServicePath, 'checker.py'), photoPath, '--output-dir', outputDir, ...(useWebsite ? ['--website'] : [])].map((s) => (s.includes(' ') ? `"${s}"` : s)).join(' '),
    {
      timeout: 90000,
      maxBuffer: 1024 * 1024 * 5,
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    }
  );
  const jsonLine = stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
  if (!jsonLine) throw new Error(stderr || 'Python 未返回结果');
  const result = JSON.parse(jsonLine) as Record<string, unknown>;
  await normalizePhotoResult(result);
  if (result.processed_photo_file) {
    result.processed_photo_download_url = `/api/usa-visa/photo-check/download/${outputId}/${encodeURIComponent(String(result.processed_photo_file))}`;
  }
  result.output_id = outputId;
  return result;
}

interface PhotoCheckParams {
  userId: string;
  applicantProfileId?: string;
  photoPath: string;
  outputDir: string;
  outputId: string;
  tempDir: string;
  useWebsite: boolean;
  originalFilename?: string;
}

async function runPhotoCheckInBackground(taskId: string, params: PhotoCheckParams): Promise<void> {
  const { userId, applicantProfileId, photoPath, outputDir, outputId, tempDir, useWebsite, originalFilename } = params;
  const pythonServicePath = path.join(process.cwd(), 'services', 'photo-checker');
  const scriptPath = path.join(pythonServicePath, 'checker.py');
  const args = [scriptPath, photoPath, '--output-dir', outputDir, ...(useWebsite ? ['--website'] : [])];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('python', args, {
      cwd: pythonServicePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    });
    let stdout = '';
    let progressBuffer = '';
    const flushProgress = (chunk: string) => {
      progressBuffer += chunk;
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const m = line.match(/^PROGRESS:(\d+):(.+)$/);
        if (m) {
          const pct = parseInt(m[1], 10);
          const msg = m[2].trim();
          void updateTask(taskId, { status: 'running', progress: pct, message: originalFilename ? `${msg} · ${originalFilename}` : msg });
        }
      }
    };
    proc.stdout?.on('data', (d: Buffer) => {
      const t = d.toString();
      stdout += t;
      flushProgress(t);
    });
    proc.stderr?.on('data', (d: Buffer) => {
      stdout += d.toString();
      flushProgress(d.toString());
    });
    const timeoutId = setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
      }
      void translatePhotoErrorMessage('Timeout').then((translated) =>
        updateTask(taskId, { status: 'failed', progress: 0, message: '检测超时（90秒）', error: translated })
      );
      reject(new Error('Timeout'));
    }, 90000);

    proc.on('close', async (code) => {
      clearTimeout(timeoutId);
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
      if (code !== 0) {
        const translated = await translatePhotoErrorMessage('Process exited');
        await updateTask(taskId, { status: 'failed', progress: 0, message: translated, error: translated });
        reject(new Error('Process exited with code ' + code));
        return;
      }
      const jsonLine = stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
      if (!jsonLine) {
        await updateTask(taskId, { status: 'failed', progress: 0, message: '未获取到检测结果', error: '无有效输出' });
        reject(new Error('No JSON output'));
        return;
      }
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(jsonLine) as Record<string, unknown>;
      } catch (parseErr) {
        console.error('[PhotoCheck] parse result failed:', parseErr);
        await updateTask(taskId, { status: 'failed', progress: 0, message: '解析结果失败', error: '无有效输出' });
        reject(parseErr);
        return;
      }
      if (result.processed_photo_file) {
        result.processed_photo_download_url = `/api/usa-visa/photo-check/download/${outputId}/${encodeURIComponent(String(result.processed_photo_file))}`;
      }
      result.output_id = outputId;
      if (originalFilename) result.originalFilename = originalFilename;
      await normalizePhotoResult(result);
      const success = !!result.success;
      if (success) {
        await replaceApplicantProfilePhoto({
          userId,
          applicantProfileId,
          outputDir,
          result,
        }).catch((error) => {
          console.error('[PhotoCheck] replace profile photo failed:', error);
        });
      }
      await updateTask(taskId, {
        status: success ? 'completed' : 'failed',
        progress: success ? 100 : 0,
        message: success ? (result.message as string) || '检测完成' : (result.message as string) || '检测未通过',
        result: result as Record<string, unknown>,
        error: success ? undefined : (result.message as string),
      });
      resolve();
    });
    proc.on('error', (e) => {
      clearTimeout(timeoutId);
      void translatePhotoErrorMessage(String(e)).then((translated) =>
        updateTask(taskId, { status: 'failed', progress: 0, message: '进程启动失败', error: translated })
      );
      reject(e);
    });
  });
}

/**
 * 使用外部API进行照片检测
 */
async function callExternalAPI(photo: Blob) {
  try {
    // 创建新的FormData用于转发请求
    const outgoingFormData = new FormData();
    outgoingFormData.append('photo', photo);

    console.log('正在发送请求到外部API...');
    
    // 使用更长的超时时间和错误处理改进的fetch请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    try {
      // 将请求转发到外部API
      const response = await fetch('http://43.165.7.132:5001/api/check_photo', {
        method: 'POST',
        body: outgoingFormData,
        signal: controller.signal,
        // 确保不缓存结果
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      // 检查响应状态
      if (!response.ok) {
        console.error(`API响应错误: ${response.status} ${response.statusText}`);
        let errorText = '';
        try {
          errorText = await response.text();
          console.error('错误详情:', errorText);
        } catch (textError) {
          console.error('无法读取错误响应内容');
        }
        
        return NextResponse.json(
          { 
            success: false, 
            message: `服务器返回错误(${response.status}): 照片检测服务暂时不可用` 
          },
          { status: 502 }
        );
      }
      
      // 尝试解析JSON响应
      try {
        const data = await response.json();
        if (data && data.success === false && typeof data.message === 'string') {
          data.message = await translatePhotoErrorMessage(data.message);
        }
        console.log('外部API响应成功:', data.success);
        return NextResponse.json(data);
      } catch (jsonError) {
        console.error('解析API响应JSON失败:', jsonError);
        return NextResponse.json(
          { 
            success: false, 
            message: '服务器返回了无效的响应格式' 
          },
          { status: 502 }
        );
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // 特殊处理超时错误
      if (error.name === 'AbortError') {
        console.error('请求超时:', error);
        return NextResponse.json(
          { 
            success: false, 
            message: '连接服务器超时，请稍后重试' 
          },
          { status: 504 }
        );
      }
      
      throw error; // 重新抛出其他错误
    }
  } catch (error: any) {
    console.error('外部API调用失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '照片检测服务不可用，请稍后重试',
        error: error.message || '错误'
      },
      { status: 503 }
    );
  }
}

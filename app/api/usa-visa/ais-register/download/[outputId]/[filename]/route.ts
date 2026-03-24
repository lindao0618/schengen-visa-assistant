import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import fs from 'fs/promises'

/** GET /api/usa-visa/ais-register/download/[outputId]/[filename] - 返回 AIS 注册错误截图 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ outputId: string; filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { outputId, filename } = await params

    if (!outputId || !filename) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    if (outputId.includes('..') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'temp', 'ais-register-outputs', outputId, filename)

    const stats = await fs.stat(filePath)
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = await fs.readFile(filePath)
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Disposition', `inline; filename="${filename}"`)

    return new NextResponse(fileBuffer, { status: 200, headers })
  } catch (error) {
    console.error('AIS 截图下载错误:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

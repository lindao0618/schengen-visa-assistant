import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import fs from 'fs/promises'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ outputId: string; filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    let { outputId, filename } = await params
    const decodedFilename = decodeURIComponent(filename || '')
    if (!outputId || !filename || outputId.includes('..') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    const dirPath = path.join(process.cwd(), 'temp', 'ds160-submit-outputs', outputId)
    let filePath = path.join(dirPath, decodedFilename)
    let actualFilename = decodedFilename

    try {
      const stats = await fs.stat(filePath)
      if (!stats.isFile()) throw new Error('Not a file')
    } catch {
      // 精确匹配失败时，列出目录查找任意 PDF 或 PNG
      try {
        const files = await fs.readdir(dirPath)
        const found = files.find((f) => f.endsWith('.pdf') || f.endsWith('.png'))
        if (found) {
          filePath = path.join(dirPath, found)
          actualFilename = found
        } else {
          return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }
      } catch {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
    }

    const buffer = await fs.readFile(filePath)
    const isPdf = actualFilename.toLowerCase().endsWith('.pdf') &&
      buffer.length >= 100 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
    const headers = new Headers()
    headers.set('Content-Type', isPdf ? 'application/pdf' : 'image/png')
    headers.set('Content-Length', String(buffer.length))
    headers.set('Content-Disposition', `attachment; filename="${actualFilename.replace(/"/g, '%22')}"`)
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

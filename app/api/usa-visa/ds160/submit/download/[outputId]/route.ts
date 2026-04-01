import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import fs from 'fs/promises'
import { getAuthorizedDs160SubmitOutput } from '@/lib/task-route-access'

/** GET /api/usa-visa/ds160/submit/download/[outputId] - 返回目录下第一个 PDF 或 PNG，无需文件名 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ outputId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { outputId } = await params
    if (!outputId || outputId.includes('..')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const authorized = await getAuthorizedDs160SubmitOutput(session.user.id, outputId)
    if (!authorized?.preferredFilename) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const dirPath = authorized.dirPath
    const found = authorized.preferredFilename
    const filePath = path.join(dirPath, found)
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const buffer = await fs.readFile(filePath)
    const isPdf = found.toLowerCase().endsWith('.pdf') &&
      buffer.length >= 100 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
    const headers = new Headers()
    headers.set('Content-Type', isPdf ? 'application/pdf' : 'image/png')
    headers.set('Content-Length', String(buffer.length))
    headers.set('Content-Disposition', `attachment; filename="${found.replace(/"/g, '%22')}"`)
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}

import fs from 'fs/promises'
import path from 'path'

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { getAuthorizedDs160SubmitOutput, sanitizeDownloadFilename } from '@/lib/task-route-access'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ outputId: string; filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '璇峰厛鐧诲綍' }, { status: 401 })
    }

    const { outputId, filename } = await params
    if (!outputId || !filename || outputId.includes('..')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const authorized = await getAuthorizedDs160SubmitOutput(session.user.id, outputId)
    if (!authorized) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const requestedName = sanitizeDownloadFilename(filename)
    if (authorized.preferredFilename && requestedName !== authorized.preferredFilename) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const actualFilename = authorized.preferredFilename || requestedName
    const filePath = path.join(authorized.dirPath, actualFilename)
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

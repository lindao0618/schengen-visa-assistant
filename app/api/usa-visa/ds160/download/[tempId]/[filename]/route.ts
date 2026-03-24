import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import fs from 'fs/promises'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tempId: string; filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { tempId, filename } = await params
    
    // 验证参数
    if (!tempId || !filename) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    // 安全检查：防止目录遍历攻击
    if (tempId.includes('..') || filename.includes('..')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    
    // 构建文件路径
    const filePath = path.join(process.cwd(), 'temp', tempId, 'output', filename)
    
    try {
      // 检查文件是否存在
      const stats = await fs.stat(filePath)
      if (!stats.isFile()) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
      
      // 读取文件
      const fileBuffer = await fs.readFile(filePath)
      
      // 设置响应头
      const headers = new Headers()
      headers.set('Content-Type', getContentType(filename))
      headers.set('Content-Length', stats.size.toString())
      headers.set('Content-Disposition', `attachment; filename="${filename}"`)
      headers.set('Cache-Control', 'private, no-cache')
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers
      })
      
    } catch (error) {
      console.error('文件读取错误:', error)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
  } catch (error) {
    console.error('文件下载错误:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.zip': 'application/zip',
    '.html': 'text/html',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  }
  
  return mimeTypes[ext] || 'application/octet-stream'
} 
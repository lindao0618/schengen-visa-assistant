import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listTasks } from '@/lib/usa-visa-tasks'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** 独立的任务列表接口，避免与 tasks/[taskId] 路由冲突 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const statusFilter = searchParams.get('status') // 'completed' | 'failed' | 'running' | null
  const applicantProfileId = searchParams.get('applicantProfileId') || undefined
  const caseId = searchParams.get('caseId') || undefined
  const tasks = await listTasks(session.user.id, limit, statusFilter || undefined, applicantProfileId, caseId)
  return NextResponse.json({ tasks })
}

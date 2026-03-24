import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processForm } from '@/app/slot_appoint/us_slot_appoint/form_mapper'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    
    console.log('收到美签抢号提交请求:', body)
    
    // 验证必要字段
    if (!body.country || !body.city || !body.dateRanges || !body.username || !body.password) {
      return NextResponse.json({
        success: false,
        message: '缺少必要字段'
      }, { status: 400 })
    }
    
    // 转换数据格式以匹配form_mapper的要求
    const formData = {
      country: body.country,
      city: body.city,
      dateRanges: body.dateRanges,
      email: body.email || '',
      phone: body.phone || '',
      username: body.username,
      password: body.password,
      ivrNumber: body.ivrNumber || '',
      groupId: body.groupId || '',
      securityQuestions: body.securityQuestions || [],
      groupSize: body.groupSize || 1,
      isExpedited: body.isExpedited || false,
      notifyByEmail: body.notifyByEmail || false,
      notifyByPhone: body.notifyByPhone || false
    }
    
    console.log('转换后的表单数据:', formData)
    
    // 调用form_mapper处理数据
    const result = await processForm(formData)
    
    console.log('处理结果:', result)
    
    return NextResponse.json({
      success: true,
      message: '提交成功',
      data: {
        system: result.mapped.system,
        url: result.mapped.url,
        submitResult: result.submitResult,
        monitorData: result.monitorData
      }
    })
    
  } catch (error) {
    console.error('美签抢号提交失败:', error)
    
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '提交失败',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}











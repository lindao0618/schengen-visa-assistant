import { NextRequest, NextResponse } from "next/server"

// 法国签证申请数据结构
interface FranceVisaApplication {
  id: string
  visaType: string
  visaCenter: string
  personalInfo: {
    lastName: string
    firstName: string
    birthDate: string
    birthPlace: string
    nationality: string
    passportNumber: string
    passportIssueDate: string
    passportExpiryDate: string
    email: string
    phone: string
  }
  travelInfo: {
    entryDate: string
    exitDate: string
    accommodation: string
    itinerary: string
    previousVisits: boolean
    previousVisitDates: string
  }
  supportingDocs: {
    hasPassport: boolean
    hasPhotos: boolean
    hasFlightReservation: boolean
    hasAccommodationProof: boolean
    hasInsurance: boolean
    hasFinancialProof: boolean
    hasEmploymentLetter: boolean
  }
  status: "draft" | "submitted" | "processing" | "approved" | "rejected"
  createdAt: string
  updatedAt: string
}

// 模拟数据库存储
let applications: FranceVisaApplication[] = []

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 验证必需字段
    const requiredFields = [
      'visaType', 'visaCenter', 'personalInfo', 'travelInfo', 'supportingDocs'
    ]
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`,
          message: '缺少必需字段'
        }, { status: 400 })
      }
    }

    // 验证个人信息的必需字段
    const personalInfoFields = [
      'lastName', 'firstName', 'birthDate', 'nationality', 
      'passportNumber', 'passportIssueDate', 'passportExpiryDate', 'email'
    ]
    
    for (const field of personalInfoFields) {
      if (!body.personalInfo[field]) {
        return NextResponse.json({
          success: false,
          error: `Missing personal info field: ${field}`,
          message: `缺少个人信息字段: ${field}`
        }, { status: 400 })
      }
    }

    // 验证旅行信息的必需字段
    const travelInfoFields = ['entryDate', 'exitDate', 'accommodation']
    
    for (const field of travelInfoFields) {
      if (!body.travelInfo[field]) {
        return NextResponse.json({
          success: false,
          error: `Missing travel info field: ${field}`,
          message: `缺少旅行信息字段: ${field}`
        }, { status: 400 })
      }
    }

    // 创建申请记录
    const application: FranceVisaApplication = {
      id: `FR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      visaType: body.visaType,
      visaCenter: body.visaCenter,
      personalInfo: body.personalInfo,
      travelInfo: body.travelInfo,
      supportingDocs: body.supportingDocs,
      status: "submitted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 存储申请记录
    applications.push(application)

    // 返回成功响应
    return NextResponse.json({
      success: true,
      applicationId: application.id,
      status: application.status,
      message: "法国签证申请提交成功",
      nextSteps: [
        "请前往选定的签证中心提交生物识别信息",
        "携带所有原件和复印件",
        "在签证中心现场支付申请费用",
        "等待5-15个工作日的处理时间"
      ]
    })

  } catch (error) {
    console.error("法国签证申请提交失败:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      message: "申请提交失败，请稍后重试"
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('id')
    
    if (applicationId) {
      // 查询特定申请
      const application = applications.find(app => app.id === applicationId)
      
      if (!application) {
        return NextResponse.json({
          success: false,
          error: "Application not found",
          message: "申请记录未找到"
        }, { status: 404 })
      }
      
      return NextResponse.json({
        success: true,
        application
      })
    } else {
      // 返回所有申请列表（分页）
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '10')
      const offset = (page - 1) * limit
      
      const paginatedApplications = applications
        .slice(offset, offset + limit)
        .map(app => ({
          id: app.id,
          visaType: app.visaType,
          visaCenter: app.visaCenter,
          personalInfo: {
            lastName: app.personalInfo.lastName,
            firstName: app.personalInfo.firstName,
            email: app.personalInfo.email
          },
          status: app.status,
          createdAt: app.createdAt
        }))
      
      return NextResponse.json({
        success: true,
        applications: paginatedApplications,
        total: applications.length,
        page,
        limit
      })
    }
  } catch (error) {
    console.error("查询法国签证申请失败:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      message: "查询失败，请稍后重试"
    }, { status: 500 })
  }
} 
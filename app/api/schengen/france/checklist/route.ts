import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 法国签证材料清单
const franceVisaChecklist = {
  short_stay: {
    required: [
      {
        id: "passport",
        name: "有效护照",
        description: "护照有效期必须超过计划离开申根区日期后至少6个月，且至少有两页空白页",
        example: "护照原件及复印件"
      },
      {
        id: "photos",
        name: "签证照片",
        description: "近6个月内拍摄的2张白底彩色照片，尺寸35x45mm",
        example: "照片需符合申根签证标准"
      },
      {
        id: "application_form",
        name: "签证申请表",
        description: "完整填写的申根签证申请表，需本人签名",
        example: "在线填写并打印"
      },
      {
        id: "flight_reservation",
        name: "往返机票预订",
        description: "往返机票预订证明，显示入境和出境日期",
        example: "航空公司出具的预订确认函"
      },
      {
        id: "accommodation_proof",
        name: "住宿证明",
        description: "在法国的住宿安排证明，如酒店预订、邀请函等",
        example: "酒店预订确认函或邀请人出具的住宿证明"
      },
      {
        id: "travel_insurance",
        name: "旅行保险",
        description: "覆盖整个申根区停留期间的旅行医疗保险，最低保额3万欧元",
        example: "保险公司出具的保险证明"
      },
      {
        id: "financial_proof",
        name: "资金证明",
        description: "证明有足够资金支付旅行费用的文件",
        example: "银行对账单、工资单、存款证明等"
      }
    ],
    optional: [
      {
        id: "employment_letter",
        name: "在职证明",
        description: "雇主出具的在职证明，说明职位、薪资和假期安排",
        example: "公司抬头纸打印，加盖公章"
      },
      {
        id: "student_letter",
        name: "学生证明",
        description: "学校出具的在读证明",
        example: "学校抬头纸打印，加盖公章"
      },
      {
        id: "invitation_letter",
        name: "邀请函",
        description: "法国邀请人出具的邀请函",
        example: "包含邀请人信息和被邀请人信息的正式邀请函"
      }
    ]
  },
  long_stay: {
    required: [
      {
        id: "passport",
        name: "有效护照",
        description: "护照有效期必须超过计划离开申根区日期后至少6个月",
        example: "护照原件及复印件"
      },
      {
        id: "photos",
        name: "签证照片",
        description: "近6个月内拍摄的2张白底彩色照片，尺寸35x45mm",
        example: "照片需符合申根签证标准"
      },
      {
        id: "application_form",
        name: "长期签证申请表",
        description: "完整填写的长期签证申请表",
        example: "在线填写并打印"
      },
      {
        id: "purpose_proof",
        name: "长期停留目的证明",
        description: "根据停留目的提供相应证明文件",
        example: "工作合同、学校录取通知书、家庭团聚证明等"
      },
      {
        id: "accommodation_proof",
        name: "长期住宿证明",
        description: "在法国的长期住宿安排证明",
        example: "租房合同、购房合同或邀请人出具的长期住宿证明"
      },
      {
        id: "financial_proof",
        name: "资金证明",
        description: "证明有足够资金支付长期停留期间费用的文件",
        example: "银行对账单、工资单、奖学金证明等"
      },
      {
        id: "health_insurance",
        name: "健康保险",
        description: "覆盖长期停留期间的健康保险证明",
        example: "保险公司出具的长期健康保险证明"
      }
    ],
    optional: [
      {
        id: "criminal_record",
        name: "无犯罪记录证明",
        description: "原籍国出具的无犯罪记录证明",
        example: "经公证和认证的无犯罪记录证明"
      },
      {
        id: "medical_certificate",
        name: "健康证明",
        description: "体检证明，证明身体健康",
        example: "指定医院出具的体检报告"
      }
    ]
  },
  student: {
    required: [
      {
        id: "passport",
        name: "有效护照",
        description: "护照有效期必须超过计划离开申根区日期后至少6个月",
        example: "护照原件及复印件"
      },
      {
        id: "photos",
        name: "签证照片",
        description: "近6个月内拍摄的2张白底彩色照片，尺寸35x45mm",
        example: "照片需符合申根签证标准"
      },
      {
        id: "application_form",
        name: "学生签证申请表",
        description: "完整填写的学生签证申请表",
        example: "在线填写并打印"
      },
      {
        id: "admission_letter",
        name: "录取通知书",
        description: "法国教育机构出具的正式录取通知书",
        example: "学校抬头纸打印的录取通知书"
      },
      {
        id: "accommodation_proof",
        name: "住宿证明",
        description: "在法国的住宿安排证明",
        example: "学生公寓预订证明或寄宿家庭证明"
      },
      {
        id: "financial_proof",
        name: "资金证明",
        description: "证明有足够资金支付学费和生活费用的文件",
        example: "银行对账单、奖学金证明、父母资助证明等"
      },
      {
        id: "health_insurance",
        name: "学生健康保险",
        description: "覆盖学习期间的健康保险证明",
        example: "学生健康保险证明"
      }
    ],
    optional: [
      {
        id: "language_certificate",
        name: "语言能力证明",
        description: "法语或英语语言能力证明",
        example: "DELF、DALF、TOEFL、IELTS等语言考试成绩"
      },
      {
        id: "previous_education",
        name: "学历证明",
        description: "最高学历证明文件",
        example: "毕业证书、学位证书等"
      }
    ]
  },
  work: {
    required: [
      {
        id: "passport",
        name: "有效护照",
        description: "护照有效期必须超过计划离开申根区日期后至少6个月",
        example: "护照原件及复印件"
      },
      {
        id: "photos",
        name: "签证照片",
        description: "近6个月内拍摄的2张白底彩色照片，尺寸35x45mm",
        example: "照片需符合申根签证标准"
      },
      {
        id: "application_form",
        name: "工作签证申请表",
        description: "完整填写的工作签证申请表",
        example: "在线填写并打印"
      },
      {
        id: "work_contract",
        name: "工作合同",
        description: "法国雇主出具的正式工作合同",
        example: "包含工作内容、薪资、期限等详细信息的合同"
      },
      {
        id: "work_permit",
        name: "工作许可",
        description: "法国劳动部门出具的工作许可",
        example: "雇主申请的工作许可证明"
      },
      {
        id: "accommodation_proof",
        name: "住宿证明",
        description: "在法国的住宿安排证明",
        example: "租房合同或雇主提供的住宿证明"
      },
      {
        id: "financial_proof",
        name: "资金证明",
        description: "证明有足够资金支付初期生活费用的文件",
        example: "银行对账单、存款证明等"
      }
    ],
    optional: [
      {
        id: "criminal_record",
        name: "无犯罪记录证明",
        description: "原籍国出具的无犯罪记录证明",
        example: "经公证和认证的无犯罪记录证明"
      },
      {
        id: "medical_certificate",
        name: "健康证明",
        description: "体检证明，证明身体健康",
        example: "指定医院出具的体检报告"
      },
      {
        id: "professional_qualifications",
        name: "专业资格证明",
        description: "相关专业资格或技能证明",
        example: "职业资格证书、技能证书等"
      }
    ]
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const visaType = searchParams.get('visaType')
    const duration = searchParams.get('duration')
    
    if (!visaType) {
      return NextResponse.json({
        success: false,
        error: "Missing visaType parameter",
        message: "缺少签证类型参数"
      }, { status: 400 })
    }
    
    const checklist = franceVisaChecklist[visaType as keyof typeof franceVisaChecklist]
    
    if (!checklist) {
      return NextResponse.json({
        success: false,
        error: "Invalid visa type",
        message: "无效的签证类型"
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      country: "France",
      visaType,
      duration: duration || "standard",
      required: checklist.required,
      optional: checklist.optional,
      notes: [
        "所有文件必须提供原件和复印件",
        "非中文文件需要提供翻译件",
        "某些文件可能需要公证和认证",
        "具体要求可能因个人情况而异，建议咨询签证中心"
      ]
    })
    
  } catch (error) {
    console.error("获取法国签证材料清单失败:", error)
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      message: "获取材料清单失败，请稍后重试"
    }, { status: 500 })
  }
} 

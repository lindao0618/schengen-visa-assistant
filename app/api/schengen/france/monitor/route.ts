import { NextRequest, NextResponse } from "next/server"

// 国家名称到国家代码的映射
const COUNTRY_CODE_MAP: Record<string, string> = {
  // 申根国家
  'France': 'fr',
  'Germany': 'de', 
  'Italy': 'it',
  'Spain': 'es',
  'Netherlands': 'nl',
  'Belgium': 'be',
  'Austria': 'at',
  'Portugal': 'pt',
  'Greece': 'gr',
  'Poland': 'pl',
  'Czech Republic': 'cz',
  'Hungary': 'hu',
  'Slovakia': 'sk',
  'Slovenia': 'si',
  'Estonia': 'ee',
  'Latvia': 'lv',
  'Lithuania': 'lt',
  'Luxembourg': 'lu',
  'Malta': 'mt',
  'Finland': 'fi',
  'Sweden': 'se',
  'Denmark': 'dk',
  'Norway': 'no',
  'Switzerland': 'ch',
  'Iceland': 'is',
  
  // 其他常见国家
  'China': 'cn',
  'United States': 'us',
  'United Kingdom': 'uk',
  'Canada': 'ca',
  'Australia': 'au',
  'Japan': 'jp',
  'South Korea': 'kr',
  'India': 'in',
  'Brazil': 'br',
  'Russia': 'ru'
}

// 城市名称到城市代码的映射
const CITY_CODE_MAP: Record<string, string> = {
  // 中国主要城市
  'Shanghai': 'SHA',
  'Beijing': 'BJS', 
  'Guangzhou': 'CAN',
  'Shenzhen': 'SZX',
  'Chengdu': 'CTU',
  'Hangzhou': 'HGH',
  'Nanjing': 'NKG',
  'Wuhan': 'WUH',
  'Xi\'an': 'XIY',
  'Chongqing': 'CKG',
  'Shenyang': 'SHE',
  'Kunming': 'KMG',
  
  // 法国主要城市
  'Paris': 'CDG',
  'Lyon': 'LYS',
  'Marseille': 'MRS',
  'Nice': 'NCE',
  'Toulouse': 'TLS',
  'Strasbourg': 'SXB',
  'Bordeaux': 'BOD',
  'Lille': 'LIL',
  
  // 德国主要城市
  'Berlin': 'BER',
  'Munich': 'MUC',
  'Frankfurt': 'FRA',
  'Hamburg': 'HAM',
  'Cologne': 'CGN',
  'Stuttgart': 'STR',
  'Düsseldorf': 'DUS',
  'Dortmund': 'DTM',
  
  // 英国主要城市
  'London': 'LON',
  'Manchester': 'MNC',
  'Birmingham': 'BHX',
  'Glasgow': 'GLA',
  'Edinburgh': 'EDI',
  'Liverpool': 'LPL',
  'Bristol': 'BRS',
  'Leeds': 'LBA',
  
  // 意大利主要城市
  'Rome': 'FCO',
  'Milan': 'MXP',
  'Naples': 'NAP',
  'Turin': 'TRN',
  'Venice': 'VCE',
  'Florence': 'FLR',
  'Bologna': 'BLQ',
  
  // 西班牙主要城市
  'Madrid': 'MAD',
  'Barcelona': 'BCN',
  'Valencia': 'VLC',
  'Seville': 'SVQ',
  'Bilbao': 'BIO',
  'Malaga': 'AGP',
  
  // 荷兰主要城市
  'Amsterdam': 'AMS',
  'Rotterdam': 'RTM',
  'The Hague': 'HAG',
  'Utrecht': 'UTC',
  'Eindhoven': 'EIN',
  
  // 美国主要城市
  'New York': 'NYC',
  'Los Angeles': 'LAX',
  'Chicago': 'CHI',
  'Houston': 'HOU',
  'Phoenix': 'PHX',
  'Philadelphia': 'PHL',
  'San Antonio': 'SAT',
  'San Diego': 'SAN',
  'Dallas': 'DFW',
  'San Jose': 'SJC',
  
  // 其他国家主要城市
  'Tokyo': 'NRT',
  'Seoul': 'ICN',
  'Sydney': 'SYD',
  'Toronto': 'YYZ',
  'Vancouver': 'YVR',
  'Moscow': 'SVO',
  'São Paulo': 'GRU',
  'Mumbai': 'BOM',
  'Delhi': 'DEL'
}

// 将国家名称转换为小写国家代码
function convertToCountryCode(countryName: string): string {
  const code = COUNTRY_CODE_MAP[countryName]
  if (code) {
    return code.toLowerCase()
  }
  // 如果没有找到映射，返回原始值的小写形式
  return countryName.toLowerCase()
}

// 将城市名称转换为大写城市代码
function convertToCityCode(cityName: string): string {
  const code = CITY_CODE_MAP[cityName]
  if (code) {
    return code.toUpperCase()
  }
  // 如果没有找到映射，返回原始值的大写形式
  return cityName.toUpperCase()
}

// 监控配置接口
interface MonitorConfig {
  application_country: string
  application_city: string
  visa_type: string
  travel_purpose: string
  slot_types: string[]
  date_ranges: Array<{
    start_date: string
    end_date: string
    start_time: string
    end_time: string
  }>
  notifications: {
    email: string | null
    phone: string | null
  }
}

// TLS监控器API配置
const TLS_MONITOR_CONFIG = {
  baseUrl: process.env.TLS_MONITOR_URL || "http://localhost:8004",
  timeout: 10000
}

export async function POST(request: NextRequest) {
  try {
    const body: MonitorConfig = await request.json()
    
    // 验证必需字段
    const requiredFields = [
      'application_country', 'application_city', 'visa_type', 'travel_purpose', 'slot_types', 'date_ranges', 'notifications'
    ]
    
    for (const field of requiredFields) {
      if (!(body as any)[field]) {
        return NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`,
          message: '缺少必需字段'
        }, { status: 400 })
      }
    }

    // 验证日期范围
    if (body.date_ranges.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No date ranges provided",
        message: '请至少提供一个日期范围'
      }, { status: 400 })
    }

    // 验证通知设置
    if (!body.notifications.email && !body.notifications.phone) {
      return NextResponse.json({
        success: false,
        error: "No notification method provided",
        message: '请至少提供一种通知方式（邮箱或手机号）'
      }, { status: 400 })
    }

    // 直接设置标准的国家代码和城市代码（无需转换）
    // 默认设置为中国申请人的标准代码
    body.application_country = 'cn'  // 中国国家代码
    body.application_city = 'SHA'    // 上海城市代码
    
    // 添加visa_country字段（法国签证）
    const visaCountryCode = 'fr' // 法国签证监控
    const extendedBody = {
      ...body,
      visa_country: visaCountryCode
    }
    
    // 记录详细的监控条件
    console.log('🚀 [前端监控] 启动法国签证监控')
    console.log('🌍 [国家代码] 直接设置: cn (中国)')
    console.log('🏢 [城市代码] 直接设置: SHA (上海)')
    console.log('🎯 [签证国家] visa_country:', visaCountryCode)
    console.log('🌍 [申请国家] application_country:', extendedBody.application_country)
    console.log('🏢 [申请城市] application_city:', extendedBody.application_city)
    console.log('💼 [前端提交] 签证类型:', extendedBody.visa_type)
    console.log('✈️ [前端提交] 旅行目的:', extendedBody.travel_purpose)
    console.log('📅 [前端提交] 日期范围:', JSON.stringify(extendedBody.date_ranges))
    console.log('🔔 [前端提交] 通知方式:', JSON.stringify(extendedBody.notifications))
    console.log('🎯 [前端提交] Slot类型:', JSON.stringify(extendedBody.slot_types))
    console.log('📦 [前端提交] 完整JSON数据:', JSON.stringify(extendedBody, null, 2))
    
    // 额外的详细信息日志
    if (body.date_ranges && body.date_ranges.length > 0) {
      body.date_ranges.forEach((range: any, index: number) => {
        console.log(`📅 [日期范围${index + 1}] 开始: ${range.start || range.start_date}, 结束: ${range.end || range.end_date}`)
      })
    }
    
    if (body.notifications) {
      if (body.notifications.email) {
        console.log('📧 [通知邮箱]:', body.notifications.email)
      }
      if (body.notifications.phone) {
        console.log('📱 [通知短信]:', body.notifications.phone)
      }
    }
    
    if (body.slot_types && body.slot_types.length > 0) {
      console.log('🎯 [监控Slot类型数量]:', body.slot_types.length)
      body.slot_types.forEach((type: string, index: number) => {
        console.log(`🎯 [Slot类型${index + 1}]:`, type)
      })
    }

    // 调用TLS监控器API
    console.log('🔗 [前端监控] 调用TLS监控器:', `${TLS_MONITOR_CONFIG.baseUrl}/monitor/start`)
    const response = await fetch(`${TLS_MONITOR_CONFIG.baseUrl}/monitor/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(extendedBody),
      signal: AbortSignal.timeout(TLS_MONITOR_CONFIG.timeout)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('TLS监控器响应错误:', response.status, errorText)
      
      return NextResponse.json({
        success: false,
        error: `TLS monitor error: ${response.status}`,
        message: response.status === 503 
          ? 'TLS监控服务未启动，请确保监控服务正在运行'
          : '监控启动失败，请稍后重试'
      }, { status: response.status })
    }

    const result = await response.json()
    console.log('监控启动成功:', result)

    return NextResponse.json({
      success: true,
      message: "法国签证监控启动成功",
      monitorId: `FR-${Date.now()}`,
      config: result.config,
      nextSteps: [
        "监控已启动，系统将自动检测符合条件的预约名额",
        "当发现可用名额时，将通过您提供的联系方式通知您",
        "您可以在监控管理页面查看监控状态和结果"
      ]
    })

  } catch (error) {
    console.error("启动法国签证监控失败:", error)
    
    // 检查是否是网络错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json({
        success: false,
        error: "Network error",
        message: "无法连接到TLS监控服务，请确保监控服务正在运行"
      }, { status: 503 })
    }
    
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      message: "监控启动失败，请稍后重试"
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'status') {
      // 获取监控状态
      const response = await fetch(`${TLS_MONITOR_CONFIG.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        const status = await response.json()
        return NextResponse.json({
          success: true,
          status: "running",
          message: "TLS监控服务运行正常"
        })
      } else {
        return NextResponse.json({
          success: false,
          status: "stopped",
          message: "TLS监控服务未运行"
        })
      }
    }
    
    if (action === 'slots') {
      // 获取最新的slot信息
      const response = await fetch(`${TLS_MONITOR_CONFIG.baseUrl}/slots/latest?limit=10`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        const slots = await response.json()
        return NextResponse.json({
          success: true,
          slots: slots
        })
      } else {
        return NextResponse.json({
          success: false,
          error: "Failed to fetch slots",
          message: "获取预约信息失败"
        }, { status: 500 })
      }
    }
    
    // 默认返回监控服务状态
    return NextResponse.json({
      success: false,
      error: "Invalid action",
      message: "无效的操作"
    }, { status: 400 })
    
  } catch (error) {
    console.error("获取监控状态失败:", error)
    return NextResponse.json({
      success: false,
      error: "Service unavailable",
      message: "监控服务不可用"
    }, { status: 503 })
  }
} 
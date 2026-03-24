// 美签抢号表单映射函数
// 将前端表单数据标准化并映射到对应系统的API

export type System = "ais" | "cgi-v2" | "avits";

export type DateRange = { 
  startDate: string; 
  endDate: string; 
};

export type FormData = {
  country: string;
  city: string;
  dateRanges: DateRange[];
  email: string;
  phone?: string;
  username: string;
  password: string;
  ivrNumber?: string;
  groupId?: string;
  securityQuestions?: Array<{
    question: string;
    answer: string;
  }>;
  groupSize?: number;
  isExpedited?: boolean;
  notifyByEmail?: boolean;
  notifyByPhone?: boolean;
};

// 城市代码映射表
const CITY_MAPPING: Record<string, string> = {
  // 中国城市
  "SH": "Shanghai", "BJ": "Beijing", "GZ": "Guangzhou", "CD": "Chengdu", 
  "SY": "Shenyang", "HKC": "Hong Kong",
  // 英国城市
  "LON": "London", "MAN": "Manchester", "EDI": "Edinburgh", "BFS": "Belfast",
  // 加拿大城市
  "YYZ": "Toronto", "YVR": "Vancouver", "YUL": "Montreal", "YYC": "Calgary",
  // 澳大利亚城市
  "SYD": "Sydney", "MEL": "Melbourne", "BNE": "Brisbane", "PER": "Perth",
  // 其他国家城市
  "MEX": "Mexico City", "SCL": "Santiago", "GRU": "Sao Paulo", "EZE": "Buenos Aires",
  "BOG": "Bogota", "LIM": "Lima", "AKL": "Auckland", "CHC": "Christchurch"
};

// API端点
const ENDPOINTS: Record<System, string> = {
  "ais":    "https://us-ais.vis.lol/api/users",
  "cgi-v2": "https://us-cgi-v2.vis.lol/api/users",
  "avits":  "https://us-avits.vis.lol/api/users",
};

// 系统类型映射（根据国家代码）
const SYSTEM_BY_COUNTRY: Record<string, System> = {
  // CGI Federal系统国家
  "cn": "cgi-v2", "in": "cgi-v2", "ca": "cgi-v2", "mx": "cgi-v2", "br": "cgi-v2", 
  "co": "cgi-v2", "cl": "cgi-v2", "sg": "cgi-v2", "tw": "cgi-v2", "my": "cgi-v2", 
  "th": "cgi-v2", "vn": "cgi-v2", "il": "cgi-v2", "sa": "cgi-v2", "qa": "cgi-v2", 
  "ae": "cgi-v2", "ar": "cgi-v2", "pe": "cgi-v2",
  
  // AIS系统国家
  "jp": "ais", "kr": "ais", "gb": "ais", "fr": "ais", "de": "ais", "it": "ais", 
  "es": "ais", "nl": "ais", "be": "ais", "ch": "ais", "gr": "ais", "pt": "ais", 
  "se": "ais", "dk": "ais", "fi": "ais", "ie": "ais", "no": "ais", "tr": "ais", 
  "hu": "ais", "me": "ais",
  
  // AVITS系统国家
  "au": "avits", "nz": "avits", "fj": "avits", "hk": "avits"
};

export type MappedResult = {
  system: System;
  url: string;
  idField: "email" | "username";
  idValue: string;
  payload: any;
  monitorData: any; // 用于你自家的监控系统
};

/**
 * 将日期字符串转换为整数格式 (YYYY-MM-DD -> YYYYMMDD)
 */
function toIntDate(dateStr: string): number {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`非法日期格式: ${dateStr}，期望 YYYY-MM-DD`);
  }
  return parseInt(match[1] + match[2] + match[3], 10);
}

/**
 * 映射城市代码到实际城市名
 */
function mapCityCode(cityCode: string): string {
  return CITY_MAPPING[cityCode.toUpperCase()] || cityCode;
}

/**
 * 构造过滤器数组
 */
function makeFilters(
  dateRanges: DateRange[], 
  city?: string, 
  skipDays: number = 0
): Array<{
  cities: string[];
  from: number;
  to: number;
  skip_days: number;
}> {
  const cities = city ? [mapCityCode(city)] : []; // 想"全中心"就传空数组
  return dateRanges.map(range => ({
    cities,
    from: toIntDate(range.startDate),
    to: toIntDate(range.endDate),
    skip_days: skipDays,
  }));
}

/**
 * 根据国家代码获取系统类型
 */
export function getSystemByCountry(countryCode: string): System {
  const system = SYSTEM_BY_COUNTRY[countryCode.toLowerCase()];
  if (!system) {
    throw new Error(`不支持的国家代码: ${countryCode}`);
  }
  return system;
}

/**
 * 将前端表单数据映射到对应系统的API格式
 */
export function mapFormToVisLol(formData: FormData): MappedResult {
  const country = formData.country.toLowerCase();
  const system = getSystemByCountry(country);
  const url = ENDPOINTS[system];

  console.log(`映射表单到 ${system} 系统，国家: ${country}`);

  let payload: any;
  let idField: "email" | "username";
  let idValue: string;

  switch (system) {
    case "ais": {
      payload = {
        action: "create",
        country: country,
        email: formData.email,
        password: formData.password,
        ivr: (formData.ivrNumber || "").trim(),
        language: "zh",
        filters: makeFilters(formData.dateRanges, formData.city, 0),
      };
      idField = "email";
      idValue = payload.email;
      break;
    }

    case "cgi-v2": {
      // 处理安全问题，确保有3个
      const securityQuestions = (formData.securityQuestions || []).map(qa => ({
        question: (qa.question || "").trim(),
        answer: (qa.answer || "").trim(),
      }));

      // 如果安全问题不足3个，补充空的安全问题
      while (securityQuestions.length < 3) {
        securityQuestions.push({ question: "", answer: "" });
      }

      payload = {
        action: "create",
        country: country,
        username: formData.username,
        password: formData.password,
        language: "zh",
        link_appointment_cities: true,
        security_questions: securityQuestions,
        filters: makeFilters(formData.dateRanges, formData.city, 1),
      };
      idField = "username";
      idValue = payload.username;
      break;
    }

    case "avits": {
      payload = {
        action: "create",
        application_id: formData.groupId || "",
        country: country,
        username: formData.username,
        password: formData.password,
        language: "zh",
        filters: makeFilters(formData.dateRanges, formData.city, 0),
      };
      idField = "username";
      idValue = payload.username;
      break;
    }

    default:
      throw new Error(`不支持的系统: ${system}`);
  }

  // 构造监控数据（用于你自家的监控系统）
  const monitorData = {
    selectedCountries: [formData.country],
    selectedVisaTypes: ["B1/B2", "F1"],
    timeRanges: formData.dateRanges.map(range => ({
      startDate: range.startDate,
      endDate: range.endDate
    })),
    city: formData.city,
    source: "usa-visa-frontend",
    user_agent: "usa-visa-page",
    system: system,
    identifier: idValue,
    filters: payload.filters
  };

  return {
    system,
    url,
    idField,
    idValue,
    payload,
    monitorData
  };
}

/**
 * 提交到vis.lol API
 */
export async function submitToVisLol(mapped: MappedResult): Promise<any> {
  const token = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658";
  
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JavaScript/1.0",
    "X-Vis-Lol-Token": token,
    "X-Vis-Lol-Api": "1",
    "Origin": "https://vis.lol"
  };

  try {
    console.log(`🚀 开始提交到 ${mapped.system} 系统...`);
    console.log(`📍 URL: ${mapped.url}`);
    console.log(`🔑 Token: ${token.substring(0, 8)}...`);
    console.log("📦 Payload:", JSON.stringify(mapped.payload, null, 2));

    // 添加超时设置
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    const response = await fetch(mapped.url, {
      method: "POST",
      headers,
      body: JSON.stringify(mapped.payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`📊 响应状态码: ${response.status}`);
    console.log(`📋 响应头:`, Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log("✅ 提交成功:", result);
      return {
        success: true,
        status: response.status,
        data: result,
        mapped
      };
    } else {
      const errorText = await response.text();
      console.error("❌ 提交失败:", errorText);
      return {
        success: false,
        status: response.status,
        error: errorText,
        mapped
      };
    }
  } catch (error) {
    console.error("💥 提交异常:", error);
    
    // 详细的错误信息
    let errorMessage = "未知错误";
    if (error instanceof TypeError && error.message.includes("fetch")) {
      errorMessage = "网络请求失败 - 可能是CORS问题或网络连接问题";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }

    return {
      success: false,
      error: errorMessage,
      errorDetails: error,
      mapped
    };
  }
}

/**
 * 完整的表单处理流程
 */
export async function processForm(formData: FormData): Promise<{
  mapped: MappedResult;
  submitResult: any;
  monitorData: any;
}> {
  try {
    console.log("🔄 开始处理表单...");
    
    // 1. 映射表单数据
    const mapped = mapFormToVisLol(formData);
    console.log("✅ 表单映射完成");
    
    // 2. 提交到vis.lol
    const submitResult = await submitToVisLol(mapped);
    console.log("✅ vis.lol提交完成");

    return {
      mapped,
      submitResult,
      monitorData: mapped.monitorData
    };
  } catch (error) {
    console.error("💥 表单处理异常:", error);
    throw error;
  }
}

// 使用示例
export const exampleUsage = {
  // CGI-V2（中国）示例
  cgiExample: {
    country: "cn",
    city: "SH",
    dateRanges: [
      { startDate: "2024-12-01", endDate: "2024-12-31" },
      { startDate: "2025-01-01", endDate: "2025-01-31" }
    ],
    email: "zhang.san@example.com",
    phone: "13800138000",
    username: "zhang.san@example.com",
    password: "mypassword123",
    securityQuestions: [
      { question: "您最喜欢的颜色是什么？", answer: "红色" },
      { question: "您的出生地是哪里？", answer: "上海" },
      { question: "您最喜欢的食物是什么？", answer: "小笼包" },
    ],
    groupSize: 2,
    isExpedited: true
  },

  // AIS（英国）示例
  aisExample: {
    country: "gb",
    city: "LON",
    dateRanges: [
      { startDate: "2024-12-15", endDate: "2025-01-15" }
    ],
    email: "john.smith@example.com",
    username: "john.smith@example.com",
    password: "ukpassword456",
    ivrNumber: "12345678",
    groupSize: 1,
    isExpedited: false
  },

  // AVITS（澳大利亚）示例
  avitsExample: {
    country: "au",
    city: "SYD",
    dateRanges: [
      { startDate: "2025-01-01", endDate: "2025-02-28" },
      { startDate: "2025-03-01", endDate: "2025-03-31" }
    ],
    email: "mike.wilson@example.com",
    username: "mike.wilson@example.com",
    password: "aupassword789",
    groupId: "GROUP123456",
    groupSize: 3,
    isExpedited: true
  }
};

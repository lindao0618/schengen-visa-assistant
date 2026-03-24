# API路由设计详细文档

## 🚀 API架构总览

### 核心API模块
- **申根签证** - `/api/schengen/*`
- **美国签证** - `/api/usa-visa/*`
- **Slot抢号预约** - `/api/slot/*`
- **照片审核** - `/api/photo/*`
- **材料定制** - `/api/material/*`
- **AI助手** - `/api/ai-assistant/*`
- **通用功能** - `/api/auth/*`, `/api/upload/*`

---

## 📋 1. 申根签证 API (`/api/schengen/`)

### 1.1 基础信息接口
```typescript
// 获取申根国家列表
GET /api/schengen/countries
Response: {
  countries: Array<{
    code: string;
    name: string;
    requirements: string[];
    processingTime: string;
    fee: number;
  }>
}

// 获取特定国家要求
GET /api/schengen/countries/[country]
Response: {
  country: string;
  requirements: {
    documents: string[];
    conditions: string[];
    specialNotes: string[];
  };
  embassy: {
    address: string;
    phone: string;
    workingHours: string;
  }
}
```

### 1.2 申请流程接口
```typescript
// 创建申根签证申请
POST /api/schengen/applications
Body: {
  country: string;
  visaType: string;
  personalInfo: object;
  travelPlan: object;
}
Response: {
  applicationId: string;
  status: string;
  requiredDocuments: string[];
}

// 获取申请状态
GET /api/schengen/applications/[id]
Response: {
  id: string;
  status: string;
  progress: number;
  nextSteps: string[];
  documents: Array<DocumentStatus>;
}

// 更新申请信息
PUT /api/schengen/applications/[id]
Body: { /* 更新字段 */ }

// 提交申请
POST /api/schengen/applications/[id]/submit
Response: {
  success: boolean;
  submissionId: string;
  trackingNumber: string;
}
```

### 1.3 材料清单接口
```typescript
// 获取材料清单
GET /api/schengen/checklist/[country]
Query: { visaType: string, duration: number }
Response: {
  required: Array<{
    id: string;
    name: string;
    description: string;
    example: string;
    template?: string;
  }>;
  optional: Array<Document>;
  countrySpecific: Array<Document>;
}
```

---

## 🇺🇸 2. 美国签证 API (`/api/usa-visa/`)

### 2.1 DS-160表格接口
```typescript
// 创建DS-160表格
POST /api/usa-visa/ds160
Body: {
  applicantInfo: object;
  passportInfo: object;
  travelInfo: object;
}
Response: {
  ds160Id: string;
  confirmationNumber: string;
  status: string;
}

// 保存DS-160草稿
PUT /api/usa-visa/ds160/[id]/draft
Body: { sectionData: object }

// 获取DS-160表格
GET /api/usa-visa/ds160/[id]
Response: {
  formData: object;
  completionStatus: {
    personal: boolean;
    travel: boolean;
    security: boolean;
    // ... 其他部分
  };
  validation: {
    errors: string[];
    warnings: string[];
  }
}

// 提交DS-160表格
POST /api/usa-visa/ds160/[id]/submit
Response: {
  success: boolean;
  confirmationNumber: string;
  barcodeImage: string;
}
```

### 2.2 面试预约接口
```typescript
// 获取可用面试时间
GET /api/usa-visa/interview/slots
Query: { 
  consulate: string;
  visaType: string;
  dateFrom: string;
  dateTo: string;
}
Response: {
  availableSlots: Array<{
    date: string;
    time: string;
    location: string;
    available: boolean;
  }>
}

// 预约面试
POST /api/usa-visa/interview/book
Body: {
  slotId: string;
  applicantId: string;
  ds160Number: string;
}
Response: {
  appointmentId: string;
  confirmationNumber: string;
  appointmentDetails: object;
}

// 重新安排面试
PUT /api/usa-visa/interview/[id]/reschedule
Body: { newSlotId: string }
```

### 2.3 状态查询接口
```typescript
// 查询签证状态
GET /api/usa-visa/status/[passportId]
Response: {
  status: string;
  lastUpdated: string;
  trackingDetails: Array<{
    date: string;
    status: string;
    location: string;
  }>;
  estimatedDelivery?: string;
}
```

---

## ⏰ 3. Slot抢号预约 API (`/api/slot/`)

### 3.1 监控管理
```typescript
// 创建监控任务
POST /api/slot/monitors
Body: {
  targetUrl: string;
  monitorType: string;
  criteria: {
    country?: string;
    consulate?: string;
    dateRange: { from: string; to: string };
  };
  notifications: {
    email: boolean;
    sms: boolean;
  }
}
Response: {
  monitorId: string;
  status: string;
  nextCheck: string;
}

// 自动抢号
POST /api/slot/auto-booking
Body: {
  monitorId: string;
  credentials: object;
  preferences: object;
}
```

### 3.2 自动抢号
```typescript
// 获取抢号结果
GET /api/slot/booking-results/[monitorId]
Response: {
  attempts: Array<{
    timestamp: string;
    success: boolean;
    slot?: object;
    error?: string;
  }>;
  totalAttempts: number;
  successRate: number;
}
```

### 3.3 实时通知
```typescript
// 发送即时通知
POST /api/slot/notify
Body: {
  monitorId: string;
  slotDetails: object;
  urgency: 'low' | 'medium' | 'high';
}

// 获取通知历史
GET /api/slot/notifications/[userId]
Response: {
  notifications: Array<{
    id: string;
    timestamp: string;
    type: string;
    message: string;
    read: boolean;
  }>
}
```

---

## 📸 4. 照片审核 API (`/api/photo/`)

### 4.1 照片上传与检测
```typescript
// 上传照片进行检测
POST /api/photo/upload
Body: FormData {
  photo: File;
  purpose: 'visa' | 'passport' | 'id';
  country?: string;
}
Response: {
  photoId: string;
  analysis: {
    dimensions: object;
    quality: object;
    compliance: {
      isCompliant: boolean;
      issues: string[];
      suggestions: string[];
    };
    face: object;
  }
}

// 自动修复照片
POST /api/photo/[photoId]/auto-fix
Body: {
  fixes: string[];
  targetSpecs: object;
}
Response: {
  processedPhotoId: string;
  processedUrl: string;
  appliedFixes: string[];
}
```

### 4.2 照片处理
```typescript
// 批量处理照片
POST /api/photo/batch-process
Body: {
  photoIds: string[];
  operations: Array<{
    operation: string;
    parameters: object;
  }>
}
Response: {
  batchId: string;
  status: string;
  results: Array<{
    photoId: string;
    success: boolean;
    outputUrl?: string;
    error?: string;
  }>
}
```

### 4.3 规格验证
```typescript
// 验证照片规格
POST /api/photo/validate
Body: {
  photoId: string;
  requirements: {
    country: string;
    documentType: string;
    specificRequirements?: object;
  }
}
Response: {
  isValid: boolean;
  score: number; // 0-100
  validations: Array<{
    rule: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  certificationReport?: string; // PDF证书
}
```

---

## 📄 5. 材料定制 API (`/api/material/`)

### 5.1 模板管理
```typescript
// 获取可用模板
GET /api/material/templates
Query: { 
  category: string;
  country?: string;
  language?: string;
}
Response: {
  templates: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    fields: Array<object>;
    preview: string;
  }>
}

// 获取特定模板
GET /api/material/templates/[templateId]
Response: {
  template: {
    id: string;
    content: string; // HTML/JSON模板
    styles: string; // CSS样式
    fields: object; // 字段定义
    logic: object; // 业务逻辑
  };
  metadata: object;
}

// 创建自定义模板
POST /api/material/templates/custom
Body: {
  name: string;
  baseTemplate?: string;
  customizations: object;
  fields: object;
}
Response: {
  templateId: string;
  previewUrl: string;
}
```

### 5.2 智能填表
```typescript
// 智能数据提取
POST /api/material/extract
Body: {
  sourceType: 'profile' | 'document' | 'form';
  sourceData: object | File;
  targetTemplate: string;
}
Response: {
  extractedData: object;
  confidence: number;
  suggestions: Array<{
    field: string;
    value: any;
    confidence: number;
    source: string;
  }>;
  missingFields: string[];
}

// 自动填写表单
POST /api/material/auto-fill
Body: {
  templateId: string;
  userData: object;
  preferences: object;
}
Response: {
  filledFormId: string;
  previewUrl: string;
  completionRate: number;
  validationResults: object;
}
```

### 5.3 文档生成
```typescript
// 生成最终文档
POST /api/material/generate
Body: {
  templateId: string;
  formData: object;
  outputFormat: 'pdf' | 'docx' | 'html';
}
Response: {
  documentId: string;
  downloadUrl: string;
  fileSize: number;
}

// 批量生成多种格式
POST /api/material/batch-generate
Body: {
  documents: Array<{
    templateId: string;
    data: object;
    formats: string[];
  }>
}
Response: {
  batchId: string;
  status: string;
  documents: Array<{
    templateId: string;
    outputs: Array<{
      format: string;
      url: string;
      status: string;
    }>
  }>
}
```

### 5.4 个性化定制
```typescript
// 创建个性化材料包
POST /api/material/customize
Body: {
  userId: string;
  requirements: {
    visaType: string;
    country: string;
    personalSituation: object;
    timelineRequirements: object;
  };
  preferences: {
    language: string;
    complexity: 'simple' | 'detailed';
    includeExamples: boolean;
  }
}
Response: {
  customPackageId: string;
  recommendedDocuments: Array<{
    templateId: string;
    priority: 'required' | 'recommended' | 'optional';
    reason: string;
    estimatedTime: number;
  }>;
  timeline: Array<{
    step: string;
    documents: string[];
    deadline: string;
  }>;
}

// 获取个性化建议
POST /api/material/recommendations
Body: {
  userProfile: object;
  visaRequirements: object;
  currentDocuments: string[];
}
Response: {
  recommendations: Array<{
    type: 'missing' | 'improvement' | 'alternative';
    document: string;
    reason: string;
    priority: number;
    actionRequired: string;
  }>;
  completionScore: number;
  estimatedSuccessRate: number;
}
```

---

## 🤖 6. AI助手 API (`/api/ai-assistant/`)

### 6.1 智能对话
```typescript
// 发送消息
POST /api/ai-assistant/chat
Body: {
  message: string;
  context?: object;
  attachments?: File[];
}
Response: {
  response: string;
  suggestions: string[];
  actions?: Array<object>;
  confidence: number;
}

// 获取会话历史
GET /api/ai-assistant/conversations/[userId]
Response: {
  conversations: Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: string;
    messageCount: number;
  }>
}
```

### 6.2 文档分析
```typescript
// 分析上传文档
POST /api/ai-assistant/analyze-document
Body: FormData {
  document: File;
  analysisType: string;
}
Response: {
  analysis: {
    documentType: string;
    extractedInfo: object;
    qualityScore: number;
    compliance: object;
  };
  recommendations: string[];
}
```

---

## 🔐 7. 认证与通用 API

### 7.1 用户认证 (`/api/auth/`)
```typescript
// NextAuth.js 标准接口
GET /api/auth/session
POST /api/auth/signin
POST /api/auth/signout

// 自定义认证接口
POST /api/auth/register
GET /api/auth/user/profile
PUT /api/auth/user/profile
```

### 7.2 文件上传 (`/api/upload/`)
```typescript
// 通用文件上传
POST /api/upload
Body: FormData {
  file: File;
  category: string;
  metadata?: object;
}
Response: {
  fileId: string;
  url: string;
  size: number;
  type: string;
}
```

---

## 📊 8. 数据模型扩展

### 新增数据表设计
- **templates** - 模板管理
- **slot_monitors** - Slot监控
- **photo_reviews** - 照片审核
- **material_customizations** - 材料定制记录

---

## 🚀 9. 技术实现要点

### 9.1 核心技术栈
- **Next.js 14** - API Routes
- **Prisma** - 数据库ORM
- **Redis** - 缓存和队列
- **腾讯云COS** - 文件存储
- **OpenAI** - AI功能
- **计算机视觉API** - 照片分析

### 9.2 性能优化
- **API缓存策略**
- **数据库查询优化**
- **文件处理异步化**
- **负载均衡配置**

### 9.3 安全措施
- **JWT认证**
- **Rate Limiting**
- **输入验证**
- **文件安全扫描**

---

## 📋 10. API安全策略

### 10.1 认证与授权
- **JWT Token** - 用户身份验证
- **Rate Limiting** - API调用频率限制
- **CORS Policy** - 跨域访问控制
- **Input Validation** - 输入数据验证
- **SQL Injection Prevention** - SQL注入防护

### 10.2 数据保护
- **数据加密** - 敏感数据加密存储
- **HTTPS Only** - 强制HTTPS通信
- **文件扫描** - 上传文件安全扫描
- **访问日志** - 详细的访问记录

---

这个API设计涵盖了您要求的所有功能模块，提供了完整的签证申请助手服务。每个API都有详细的请求/响应格式，便于前端开发和第三方集成。 
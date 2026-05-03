const now = "2026-04-30T04:00:00.000Z"
const yesterday = "2026-04-29T04:00:00.000Z"
const lastWeek = "2026-04-23T04:00:00.000Z"

const previewUsers = [
  {
    id: "preview-user-boss",
    email: "owner@example.com",
    name: "公开预览老板",
    role: "boss",
    status: "active",
    createdAt: lastWeek,
    updatedAt: now,
    _count: {
      usVisaTasks: 4,
      frenchVisaTasks: 3,
      documents: 12,
      applications: 5,
    },
  },
  {
    id: "preview-user-supervisor",
    email: "supervisor@example.com",
    name: "公开预览主管",
    role: "supervisor",
    status: "active",
    createdAt: lastWeek,
    updatedAt: yesterday,
    _count: {
      usVisaTasks: 2,
      frenchVisaTasks: 5,
      documents: 18,
      applications: 7,
    },
  },
  {
    id: "preview-user-service",
    email: "service@example.com",
    name: "公开预览客服",
    role: "service",
    status: "inactive",
    createdAt: yesterday,
    updatedAt: now,
    _count: {
      usVisaTasks: 1,
      frenchVisaTasks: 1,
      documents: 4,
      applications: 2,
    },
  },
]

const previewTasks = [
  {
    taskId: "PREVIEW-US-001",
    source: "us-visa",
    type: "register-ais",
    status: "running",
    progress: 62,
    message: "演示 AIS 注册任务正在运行",
    error: null,
    result: { preview: true },
    createdAt: yesterday,
    updatedAt: now,
    user: { id: "preview-user-boss", email: "owner@example.com", name: "公开预览老板" },
  },
  {
    taskId: "PREVIEW-FR-001",
    source: "french-visa",
    type: "tls-register",
    status: "completed",
    progress: 100,
    message: "演示 TLS 注册任务已完成",
    error: null,
    result: { preview: true },
    createdAt: lastWeek,
    updatedAt: yesterday,
    user: { id: "preview-user-supervisor", email: "supervisor@example.com", name: "公开预览主管" },
  },
  {
    taskId: "PREVIEW-MAT-001",
    source: "material",
    type: "material-review",
    status: "failed",
    progress: 35,
    message: "公开预览失败任务示例",
    error: "公开预览模式下的示例错误，不含真实日志",
    result: { preview: true },
    createdAt: yesterday,
    updatedAt: yesterday,
    user: null,
  },
]

const previewDocuments = [
  {
    id: "preview-doc-1",
    type: "bank",
    filename: "preview-bank-statement.pdf",
    fileUrl: "#",
    status: "pending",
    createdAt: yesterday,
    updatedAt: now,
    user: { id: "preview-user-boss", email: "owner@example.com", name: "公开预览老板" },
    application: {
      id: "preview-application-1",
      visaType: "France Schengen",
      country: "France",
      status: "reviewing",
    },
    _count: { reviews: 2 },
  },
  {
    id: "preview-doc-2",
    type: "hotel",
    filename: "preview-hotel-booking.pdf",
    fileUrl: "#",
    status: "completed",
    createdAt: lastWeek,
    updatedAt: yesterday,
    user: { id: "preview-user-supervisor", email: "supervisor@example.com", name: "公开预览主管" },
    application: {
      id: "preview-application-2",
      visaType: "US B1/B2",
      country: "United States",
      status: "docs_ready",
    },
    _count: { reviews: 1 },
  },
]

function buildCaseData(kind: "france" | "usa") {
  const isFrance = kind === "france"
  const prefix = isFrance ? "FR" : "US"
  const mainStatus = isFrance ? "TLS_PROCESSING" : "SLOT_BOOKED"
  const subStatus = isFrance ? "SLOT_HUNTING" : "AWAITING_INTERVIEW"
  const exceptionCode = isFrance ? "SLOT_TIMEOUT" : "VISA_RESULT_DELAYED"

  return {
    success: true,
    summary: {
      activeCaseCount: 18,
      exceptionCaseCount: 3,
      pendingReminderCount: 6,
      dueReminderCount: 2,
      urgentReminderCount: 1,
    },
    cases: [
      {
        id: `preview-${kind}-case-1`,
        mainStatus,
        subStatus,
        exceptionCode: null,
        updatedAt: now,
        applicantProfile: { id: `preview-${kind}-applicant-1`, name: `${prefix} 演示申请人 A` },
        user: { id: "preview-user-supervisor", email: "supervisor@example.com", name: "公开预览主管" },
        pendingReminderCount: 2,
        dueReminderCount: 1,
        nextReminderAt: now,
      },
      {
        id: `preview-${kind}-case-2`,
        mainStatus: "REVIEWING",
        subStatus: "HUMAN_REVIEWING",
        exceptionCode,
        updatedAt: yesterday,
        applicantProfile: { id: `preview-${kind}-applicant-2`, name: `${prefix} 演示申请人 B` },
        user: { id: "preview-user-service", email: "service@example.com", name: "公开预览客服" },
        pendingReminderCount: 1,
        dueReminderCount: 1,
        nextReminderAt: yesterday,
      },
    ],
    reminderLogs: [
      {
        id: `preview-${kind}-reminder-1`,
        ruleCode: isFrance ? "FORM_48H_ESCALATION" : "T_MINUS_1_FINAL_REMINDER",
        templateCode: isFrance ? "form_48h_escalation" : "t_minus_1_final_reminder",
        channel: "WECHAT",
        automationMode: "AUTO",
        severity: "URGENT",
        sendStatus: "pending",
        triggeredAt: yesterday,
        sentAt: null,
        errorMessage: null,
        renderedContent: "公开预览模式提醒内容示例，不包含真实客户信息。",
        isDue: true,
        visaCase: {
          id: `preview-${kind}-case-1`,
          mainStatus,
          subStatus,
          exceptionCode: null,
          applicantProfile: { id: `preview-${kind}-applicant-1`, name: `${prefix} 演示申请人 A` },
        },
        user: { id: "preview-user-supervisor", email: "supervisor@example.com", name: "公开预览主管" },
      },
    ],
  }
}

const publicUiPreviewAdminData = {
  dashboard: {
    success: true,
    stats: {
      totalUsers: 128,
      totalApplications: 76,
      totalDocuments: 342,
      activeTasks: 9,
      pendingDocuments: 14,
      failedTasks: 1,
      systemHealth: "healthy",
      userGrowth: 12.5,
      applicationGrowth: 8.4,
      documentGrowth: 15.2,
      taskGrowth: 3.1,
      serviceStatus: {
        updatedAt: now,
        database: { status: "healthy", message: "公开预览演示数据" },
        api: { status: "healthy", message: "接口可用" },
        monitor: { status: "warning", message: "公开预览不运行真实任务" },
        mail: { status: "warning", message: "公开预览不发送邮件" },
      },
    },
  },
  users: {
    success: true,
    total: previewUsers.length,
    users: previewUsers,
  },
  tasks: {
    success: true,
    tasks: previewTasks,
  },
  content: {
    success: true,
    blocks: [
      {
        id: "preview-content-1",
        key: "homepage.hero",
        title: "首页主视觉文案",
        content: "公开预览模式下的首页文案示例。",
        updatedAt: now,
      },
      {
        id: "preview-content-2",
        key: "service.notice",
        title: "服务提醒",
        content: "此内容仅用于展示后台内容管理 UI。",
        updatedAt: yesterday,
      },
    ],
  },
  documents: {
    success: true,
    total: previewDocuments.length,
    documents: previewDocuments,
  },
  settings: {
    success: true,
    settings: [
      {
        id: "preview-setting-1",
        key: "LOG_DIR",
        valueJson: { path: "public-preview-disabled" },
        updatedAt: now,
      },
      {
        id: "preview-setting-2",
        key: "REMINDER_DRY_RUN",
        valueJson: { enabled: true },
        updatedAt: yesterday,
      },
    ],
  },
  logs: {
    success: true,
    logDir: "public-preview-disabled",
    files: ["preview-app.log", "preview-worker.log"],
    fileContent: [
      "[INFO] 公开预览模式已启用",
      "[INFO] 当前日志为演示内容，不读取服务器真实日志",
      "[WARN] 写操作在公开预览模式下仍需要真实管理员登录",
    ].join("\n"),
    dbErrors: {
      usVisa: [],
      frenchVisa: [],
      material: [
        {
          task_id: "PREVIEW-MAT-001",
          type: "material-review",
          status: "failed",
          error: "公开预览模式下的示例错误，不含真实日志",
          message: "演示失败记录",
          user: null,
        },
      ],
    },
  },
  "france-cases": buildCaseData("france"),
  "usa-cases": buildCaseData("usa"),
} as const

export type PublicUiPreviewAdminDataKey = keyof typeof publicUiPreviewAdminData

export function getPublicUiPreviewAdminData<K extends PublicUiPreviewAdminDataKey>(key: K) {
  return publicUiPreviewAdminData[key]
}

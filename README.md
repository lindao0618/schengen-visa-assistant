# 申根签证助手 / Schengen Visa Assistant

一站式智能签证服务平台，集成 AI 问答、DS-160 自动填表、签证预约监控、材料审核等功能。

## 功能概览

| 模块 | 说明 |
|------|------|
| AI 签证顾问 | 基于 RAG 的签证问题智能问答 |
| DS-160 自动填表 | 根据 Excel + 照片自动填写美签 DS-160 |
| 美签照片检测 | 自动检测照片是否符合官方要求 |
| 签证位监控 | TLS/VFS 预约位实时监控与通知 |
| 智能行程单 | 根据目的地与天数生成行程计划 |
| 解释信生成 | 辅助生成签证解释信 |
| 材料审核 | 行程单、酒店订单、银行流水等自动审核 |

## 技术栈

- **前端**: Next.js 14, React, TypeScript, Tailwind CSS
- **后端**: Node.js API Routes, Python 微服务 (FastAPI)
- **数据库**: PostgreSQL + Prisma
- **自动化**: Playwright (DS-160), PaddleOCR (材料审核)

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+
- PostgreSQL
- Git

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/lindao0618/schengen-visa-assistant.git
cd schengen-visa-assistant

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DATABASE_URL、NEXTAUTH_SECRET、NEXTAUTH_URL 等

# 安装依赖
npm install
npx prisma generate
npx prisma migrate deploy

# DS-160 功能需额外配置（生成国家映射表、安装 Playwright 浏览器）
npm run setup:us-visa

# 启动开发服务（Next.js + 行程单 + 解释信 + 材料审核）
npm run dev
```

应用将运行在 http://localhost:3000

### 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| DATABASE_URL | 是 | PostgreSQL 连接串 |
| NEXTAUTH_SECRET | 是 | NextAuth 密钥 |
| NEXTAUTH_URL | 是 | 应用访问地址，开发时为 http://localhost:3000 |
| SMTP_* | DS-160 发邮件 | SMTP 配置 |
| CAPTCHA_API_KEY | DS-160 | 2Captcha API Key |

更多变量见 `.env.example`。

## 项目结构

```
├── app/                    # Next.js 应用（页面、API 路由）
│   ├── api/                # API 路由
│   │   ├── usa-visa/       # 美签（DS-160、照片检测、AIS 等）
│   │   └── schengen/       # 申根（法签等）
│   ├── trip_generator/     # 行程单生成服务
│   ├── material_review/    # 材料审核服务
│   └── monitor/            # 签证位监控
├── services/               # 独立 Python 微服务
├── prisma/                 # 数据库模型与迁移
├── lib/                    # 公共库
└── scripts/                # 工具脚本
```

## License

Private

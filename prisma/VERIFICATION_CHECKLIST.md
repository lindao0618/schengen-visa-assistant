# Postgres 数据库优化 — 验证检查清单

在应用迁移并完成代码修改后，可按此清单自检。

## 1. 迁移与 Client

- [ ] 启动 Postgres 后执行：`npx prisma migrate deploy`（生产）或 `npx prisma migrate dev`（开发）
- [ ] 若之前 `prisma generate` 因文件占用失败，关闭占用进程后执行：`npx prisma generate`
- [ ] 确认无迁移冲突：`prisma/migrations` 下存在 `20260226120000_add_indexes_and_text_fields`

## 2. Schema 与索引

- [ ] 在数据库中用 `\di`（psql）或管理工具确认以下索引已存在：
  - **Application**: `Application_userId_idx`, `Application_userId_status_idx`, `Application_userId_createdAt_idx`
  - **Document**: `Document_userId_idx`, `Document_applicationId_idx`, `Document_userId_status_idx`, `Document_applicationId_status_idx`
  - **Review**: `Review_applicationId_idx`, `Review_documentId_idx`, `Review_applicationId_documentId_idx`
  - **Account**: `Account_userId_idx`
  - **Session**: `Session_userId_idx`
  - **UsVisaTask**: `UsVisaTask_userId_status_idx`
  - **FrenchVisaTask**: `FrenchVisaTask_userId_status_idx`
- [ ] 长文本列类型（可选）：`Document.aiAnalysis`、`Review.result`、`Review.feedback` 为 `TEXT`

## 3. 代码与 API

- [ ] `app/api/users/me/route.ts` 与 `app/api/users/avatar/route.ts` 使用 `import prisma from "@/lib/db"`（不再新建 `PrismaClient`）
- [ ] 美签/法签任务列表接口：`lib/usa-visa-tasks.ts`、`lib/french-visa-tasks.ts` 中 `listTasks` 的 `findMany` 使用 `select` 仅取列表所需字段
- [ ] 登录后访问「个人资料」「头像上传」、美签/法签任务列表，确认功能正常且无 500

## 4. 可选性能验证

- [ ] 在列表页或任务较多时观察响应时间是否稳定
- [ ] 若有慢查询日志，确认 `Application`/`Document`/`Review` 按 `userId` 或 `applicationId` 的查询命中上述索引

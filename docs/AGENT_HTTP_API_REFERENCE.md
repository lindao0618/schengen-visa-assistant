# Agent / OpenClaw 集成与 HTTP API 参考

本文档面向 3 类人：

1. 你自己
2. 负责把本站接入 OpenClaw 的部署人员
3. 后续维护 Agent / Tool / 插件的人

这份文档的目标不是讲页面怎么点，而是讲：

- OpenClaw 应该如何接入本站
- OpenClaw 应该拿什么接口做事
- OpenClaw 平时应该理解哪些“员工式指令”
- OpenClaw 做完事后怎样确认结果、怎样纠错、怎样回档

如果你要看“人工员工操作 SOP”，请看 [OPENCLAW_EMPLOYEE_OPERATION_GUIDE.md](./OPENCLAW_EMPLOYEE_OPERATION_GUIDE.md)。
如果你要看真正给 Agent 用的接口，请以本文为准。
如果你要看 OpenClaw 的部署、Tool 落地、系统提示词模板，请看 [OPENCLAW_DEPLOYMENT_PLAYBOOK.md](./OPENCLAW_DEPLOYMENT_PLAYBOOK.md)。

---

## 1. 结论先说

本站现在最适合 OpenClaw 的接入方式不是“主要依赖网页点击”，而是：

`OpenClaw -> 自定义 Tool / 插件 -> /api/agent/* -> 现有业务接口 -> 任务系统 -> 结果回档到 applicant`

原因很简单：

- 申请人档案、案件、文件、任务，这 4 个核心对象已经在服务端稳定存在
- 大部分自动化任务已经支持 `applicantProfileId`
- 很多产物已经会自动回档
- 现在新增了 `/api/agent/*` 这一层，专门给 Agent 做统一入口

所以后面给 OpenClaw 的部署信息，应该围绕“调用哪些 API”和“平时应该怎么理解你的指令”来组织，而不是围绕前端页面。

---

## 2. 推荐接入方式

### 2.1 推荐方案

推荐使用：

- OpenClaw 自定义插件 / Tool
- Tool 内部通过 HTTP 调用本站 `/api/agent/*`

不推荐把浏览器自动化当成主链路。浏览器可以保留为补救手段，但不应作为主要入口。

### 2.2 为什么优先用 `/api/agent/*`

因为这一层已经把高频动作统一出来了：

- 查当前 Agent 身份
- 查申请人列表
- 查申请人完整工作台
- 创建 / 修改 / 删除申请人
- 上传 / 替换 / 删除申请人文件
- 创建 / 修改案件
- 推进案件状态
- 统一查任务
- 查单个任务
- 提供 OpenAPI 描述

### 2.3 现有业务自动化接口是否还要用

要。

`/api/agent/*` 负责统一入口、档案操作、工作台聚合、任务聚合。
真正执行具体自动化任务时，仍然调用现有业务接口，例如：

- `/api/usa-visa/photo-check`
- `/api/usa-visa/ds160/submit`
- `/api/usa-visa/register-ais`
- `/api/schengen/france/create-application`
- `/api/schengen/france/fill-receipt`
- `/api/schengen/france/submit-final`
- `/api/schengen/france/extract-register`
- `/api/schengen/france/tls-register`

推荐模式是：

1. 先用 `/api/agent/workspace` 看当前档案状态
2. 再调用具体业务任务接口
3. 再用 `/api/agent/tasks` 和 `/api/agent/workspace` 检查结果是否已回档

---

## 3. OpenClaw 侧应该如何部署

### 3.1 你需要给 OpenClaw 部署方的最小信息

至少给这几项：

- 站点根地址
- Agent API Key
- Agent 绑定账号
- 本文档
- `/api/agent/openapi`

举例：

```text
BASE_URL=https://your-domain.com
AGENT_API_KEY=xxxxxx
AGENT_BIND_USER=admin@example.com
OPENAPI_URL=https://your-domain.com/api/agent/openapi
```

### 3.2 服务端必须配置的环境变量

这些变量已经加入 [.env.example](../.env.example)：

- `AGENT_API_KEY`
- `AGENT_API_USER_ID`
- `AGENT_API_USER_EMAIL`

含义如下：

| 变量 | 说明 |
|------|------|
| `AGENT_API_KEY` | OpenClaw 机器调用本站时使用的密钥 |
| `AGENT_API_USER_ID` | 将机器调用绑定到某个已有用户 ID，推荐优先使用 |
| `AGENT_API_USER_EMAIL` | 如果没填 `AGENT_API_USER_ID`，则回退使用邮箱绑定 |

### 3.3 绑定账号怎么选

推荐专门创建一个“Agent 运营账号”。

建议：

- 如果希望 OpenClaw 看见所有档案，绑定管理员账号
- 如果希望 OpenClaw 只看某个业务员的档案，绑定普通账号

注意：

- Agent 拿到的是“绑定账号”的权限
- Agent Key 一旦泄露，相当于该账号的机器身份泄露

### 3.4 OpenClaw 侧推荐两种落地模式

#### 模式 A：自定义插件 / 自定义 Tool

这是最推荐的模式。

做法：

1. 在 OpenClaw 插件里注册工具
2. 每个工具内部 `fetch(BASE_URL + /api/agent/...)`
3. 头部带上 `x-agent-api-key`
4. 根据工具类型决定是否需要用户确认

适合做成 Tool 的动作：

- `find_applicants`
- `get_applicant_workspace`
- `create_applicant`
- `update_applicant`
- `upload_applicant_files`
- `replace_applicant_file`
- `delete_applicant_file`
- `create_case`
- `update_case`
- `update_case_status`
- `list_tasks`
- `get_task`

#### 模式 B：HTTP 封装层 / Gateway 封装层

如果你 OpenClaw 侧已经有统一 HTTP 调用封装，也可以把 `/api/agent/*` 直接包装成工具。

### 3.5 官方参考链接

OpenClaw 官方文档可参考：

- 插件与 Tool 注册：<https://docs.openclaw.ai/plugins/building-plugins>
- Gateway tools invoke：http 接口调用工具：<https://docs.openclaw.ai/gateway/tools-invoke-http-api>

本文不复述 OpenClaw 平台自身安装细节，只说明本站应该怎样提供给它调用。

---

## 4. 推荐的 OpenClaw Tool 设计

### 4.1 最小可用工具集

建议至少做下面这 10 个工具：

| Tool 名 | 作用 |
|------|------|
| `find_applicants` | 查申请人列表 |
| `get_workspace` | 查申请人工作台 |
| `get_parsed_intake` | 查申请人的聚合解析结果 |
| `get_parsed_file` | 查单个文件槽位的结构化解析结果 |
| `create_applicant` | 新建申请人档案 |
| `update_applicant` | 修改申请人资料 |
| `upload_files` | 上传申请人文件 |
| `replace_file` | 替换单个槽位文件 |
| `delete_file` | 删除错文件 |
| `create_case` | 创建案件 |
| `update_case_status` | 推进或纠正案件状态 |
| `list_tasks` | 查看任务进度和结果 |

### 4.2 建议额外做的业务工具

如果你希望 OpenClaw 更像“员工”，再加下面这些业务工具：

| Tool 名 | 作用 |
|------|------|
| `run_us_photo_check` | 跑美签照片检测 |
| `run_us_ds160_submit` | 提交 DS-160 |
| `run_us_ais_register` | 跑 AIS 注册 |
| `run_fr_create_application` | 生成法国新申请 |
| `run_fr_fill_receipt` | 生成法国回执 |
| `run_fr_submit_final` | 生成法国最终表 |
| `run_fr_extract_register` | 提取并注册 |
| `run_fr_tls_register` | TLS 注册 |

### 4.3 有副作用的 Tool 建议

凡是这些动作，OpenClaw 侧都建议设为“需要确认”：

- 删除文件
- 删除申请人
- 推进案件状态到关键节点
- 正式提交类动作
- 替换已存在的重要文件

例如：

- `delete_file`
- `delete_applicant`
- `update_case_status`
- `run_us_ds160_submit`
- `run_fr_submit_final`

---

## 5. 鉴权说明

### 5.1 推荐方式

推荐 OpenClaw 使用机器鉴权：

- Header: `x-agent-api-key: <AGENT_API_KEY>`

也支持：

- Header: `Authorization: Bearer <AGENT_API_KEY>`

### 5.2 兼容方式

浏览器里已经登录的情况下，也可以沿用现有 Session Cookie。

但这不适合长期稳定的 OpenClaw 部署。

### 5.3 鉴权检查接口

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/session` | 检查当前 Agent 身份、鉴权模式、是否绑定成功 |

### 5.4 鉴权示例

```bash
curl -X GET "https://your-domain.com/api/agent/session" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY"
```

成功响应示例：

```json
{
  "actor": {
    "userId": "clx123",
    "role": "admin",
    "name": "Agent Operator",
    "email": "agent@example.com",
    "authMode": "api_key",
    "isMachine": true
  },
  "auth": {
    "apiKeyConfigured": true,
    "boundUserIdConfigured": false,
    "boundUserEmailConfigured": true
  }
}
```

---

## 6. 核心对象模型

OpenClaw 需要理解的核心对象只有 4 个：

### 6.1 Applicant

申请人档案。

里面包含：

- 基础信息
- 美签信息
- 申根信息
- 文件槽位

### 6.2 Case

业务案件。

一个申请人可以有多个案件。

Case 负责承载：

- 当前主状态 / 子状态
- 优先级
- 地区
- 预约时间
- 分配人员
- 状态历史
- 提醒日志

### 6.3 Task

异步任务。

分成两大类：

- 美签任务
- 法签任务

现在 `/api/agent/tasks` 已经做了统一聚合，OpenClaw 不必自己分两套逻辑。

### 6.4 File Slot

每个文件都不是“散文件”，而是挂在申请人档案的固定槽位上。

OpenClaw 操作文件时，应尽量总是说清楚“要操作哪个 slot”。

---

## 7. 文件槽位一览

这些值非常重要，因为上传、替换、删除文件都依赖它们。

### 7.1 美签相关

- `usVisaPhoto`
- `usVisaDs160Excel`
- `usVisaAisExcel`
- `ds160Excel`
- `aisExcel`
- `usVisaDs160ConfirmationPdf`
- `usVisaDs160PrecheckJson`
- `usVisaInterviewBriefJson`
- `usVisaInterviewBriefDocx`
- `usVisaInterviewBriefPdf`

### 7.2 申根 / 法签相关

- `schengenPhoto`
- `schengenExcel`
- `franceExcel`
- `schengenItineraryPdf`
- `schengenExplanationLetterCnDocx`
- `schengenExplanationLetterEnDocx`
- `schengenExplanationLetterCnPdf`
- `schengenExplanationLetterEnPdf`
- `schengenHotelReservation`
- `schengenFlightReservation`
- `franceTlsAccountsJson`
- `franceApplicationJson`
- `franceReceiptPdf`
- `franceFinalSubmissionPdf`

### 7.3 通用

- `photo`
- `passportScan`

### 7.4 OpenClaw 在文件操作上的原则

推荐优先级：

1. 使用明确 slot
2. 如果用户只说“上传 Excel”，根据当前业务上下文推断 slot
3. 如果上下文不够，必须追问，而不是乱传

例如：

- “把这份 DS-160 Excel 传上去” -> `usVisaDs160Excel`
- “把申根表传给张三” -> `schengenExcel`
- “把法国申请 JSON 换掉” -> `franceApplicationJson`

---

## 8. `/api/agent/*` 接口总览

## 8.1 Session

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/session` | 获取当前 Agent 身份与鉴权状态 |

## 8.2 OpenAPI

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/openapi` | 获取 Agent API 的 OpenAPI 描述 |

说明：

- 如果 OpenClaw 侧支持根据 OpenAPI 生成 Tool，可直接利用这份描述
- 如果不直接支持，也可以把它作为插件开发时的 schema 参考

## 8.3 Applicant

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/applicants` | 列表、筛选、搜索 |
| POST | `/api/agent/applicants` | 创建申请人，必要时可同时建首个案件 |
| GET | `/api/agent/applicants/{id}` | 获取申请人详情 |
| PUT | `/api/agent/applicants/{id}` | 更新申请人资料 |
| DELETE | `/api/agent/applicants/{id}` | 删除申请人 |

## 8.4 Applicant Files

| Method | Path | 用途 |
|------|------|------|
| POST | `/api/agent/applicants/{id}/files` | 批量上传文件，按 slot 归档 |
| GET | `/api/agent/applicants/{id}/files/{slot}` | 查单个文件元数据，或下载原文件 |
| GET | `/api/agent/applicants/{id}/parsed-intake` | 读取申请人的聚合解析结果 |
| GET | `/api/agent/applicants/{id}/files/{slot}/parsed` | 读取单个文件槽位的结构化解析结果 |
| PUT | `/api/agent/applicants/{id}/files/{slot}` | 替换单个槽位文件 |
| DELETE | `/api/agent/applicants/{id}/files/{slot}` | 删除单个槽位文件 |

说明：

- `POST /files` 上传后会自动做 Excel 审计和部分信息回写
- `PUT /files/{slot}` 不仅能替换 Excel，也能替换 PDF、图片、JSON 等单个文件
- `DELETE /files/{slot}` 专门用于“这份传错了，删掉重来”

## 8.5 Case

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/cases` | 查询案件列表 |
| POST | `/api/agent/cases` | 创建案件 |
| GET | `/api/agent/cases/{id}` | 获取案件详情 |
| PATCH | `/api/agent/cases/{id}` | 修改案件基础字段 |
| PATCH | `/api/agent/cases/{id}/status` | 推进或修正案件状态 |

## 8.6 Unified Task

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/tasks` | 统一查询美签与法签任务 |
| GET | `/api/agent/tasks/{taskId}` | 查询单个任务 |

查询参数：

- `limit`
- `status`
- `system`
- `applicantProfileId`
- `caseId`

## 8.7 Workspace

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/workspace` | 获取申请人的“员工工作台视图” |

支持参数：

- `applicantProfileId`
- `caseId`
- `taskLimit`

这是最推荐 OpenClaw 在大动作前调用的接口。

---

## 9. `/api/agent/workspace` 的意义

这个接口是专门给 OpenClaw 做决策用的。

它会返回：

- `profile`
- `cases`
- `activeCaseId`
- `activeCase`
- `availableAssignees`
- `visaTypes`
- `fileGroups`
- `missingFileGroups`
- `missingInformation`
- `recommendedActions`
- `recentTasks`
- `taskSummary`

### 9.1 OpenClaw 应该怎么用 workspace

建议规则：

1. 用户一旦说“看看这个客户现在到哪一步了”，先调 workspace
2. 用户一旦要执行关键动作，先调 workspace
3. 文件上传 / 替换 / 删除之后，再调一次 workspace
4. 任务完成后，再调一次 workspace 确认是否已回档

### 9.2 典型用途

例如用户说：

- “看看张三还缺什么”
- “这单现在下一步该做什么”
- “为什么还不能提交”
- “这个档案当前有哪些错误”

都应优先使用 workspace。

---

## 10. 常用接口示例

## 10.1 查申请人列表

```bash
curl "https://your-domain.com/api/agent/applicants?keyword=张三&includeStats=1" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY"
```

## 10.2 查工作台

```bash
curl "https://your-domain.com/api/agent/workspace?applicantProfileId=abc123&taskLimit=10" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY"
```

## 10.3 新建申请人并同时建案

```bash
curl -X POST "https://your-domain.com/api/agent/applicants" \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "name": "张三",
    "phone": "13800138000",
    "passportNumber": "E12345678",
    "visaTypes": ["france-schengen"],
    "createFirstCase": true,
    "applyRegion": "china",
    "priority": "high"
  }'
```

## 10.4 批量上传文件

```bash
curl -X POST "https://your-domain.com/api/agent/applicants/abc123/files" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY" \
  -F "schengenExcel=@D:/files/client.xlsx" \
  -F "passportScan=@D:/files/passport.pdf"
```

## 10.5 替换单个文件

`multipart/form-data` 方式：

```bash
curl -X PUT "https://your-domain.com/api/agent/applicants/abc123/files/franceApplicationJson" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY" \
  -F "file=@D:/files/new_application.json"
```

原始字节方式：

```bash
curl -X PUT "https://your-domain.com/api/agent/applicants/abc123/files/schengenExcel" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY" \
  -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  -H "x-file-name: client.xlsx" \
  --data-binary "@D:/files/client.xlsx"
```

## 10.6 删除错文件

```bash
curl -X DELETE "https://your-domain.com/api/agent/applicants/abc123/files/passportScan" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY"
```

## 10.7 推进案件状态

```bash
curl -X PATCH "https://your-domain.com/api/agent/cases/case123/status" \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "mainStatus": "REVIEWING",
    "subStatus": "HUMAN_REVIEWING",
    "reason": "材料已生成，进入人工审核"
  }'
```

## 10.8 查统一任务列表

```bash
curl "https://your-domain.com/api/agent/tasks?status=running&applicantProfileId=abc123" \
  -H "x-agent-api-key: YOUR_AGENT_API_KEY"
```

---

## 11. 业务自动化接口参考

这些不是 `/api/agent/*`，但 OpenClaw 真正干活时要调用。

## 11.1 美签

| 用途 | Method | Path |
|------|------|------|
| 照片检测 | POST | `/api/usa-visa/photo-check` |
| DS-160 自动填 | POST | `/api/usa-visa/ds160/auto-fill` |
| DS-160 提交 | POST | `/api/usa-visa/ds160/submit` |
| AIS 注册 | POST | `/api/usa-visa/register-ais` |
| 面谈简报 | POST | `/api/usa-visa/interview-brief/generate` |
| 任务列表 | GET | `/api/usa-visa/tasks-list` |

## 11.2 法签 / 申根

| 用途 | Method | Path |
|------|------|------|
| 提取并注册 | POST | `/api/schengen/france/extract-register` |
| TLS 注册 | POST | `/api/schengen/france/tls-register` |
| 生成新申请 | POST | `/api/schengen/france/create-application` |
| 填写回执 | POST | `/api/schengen/france/fill-receipt` |
| 提交最终表 | POST | `/api/schengen/france/submit-final` |
| 任务列表 | GET | `/api/schengen/france/tasks-list` |

### 11.3 调业务接口时的建议

强烈建议总是带上：

- `applicantProfileId`
- `caseId`

这样后续：

- 任务能挂到正确申请人名下
- 任务能挂到正确案件名下
- 产物更容易回档
- OpenClaw 后续查任务时更容易定位

---

## 12. OpenClaw 应该理解的“常用中文指令”

这是最关键的一节。

你平时大概率会这样对 OpenClaw 下指令。
OpenClaw 应该把这些中文意图映射为固定 API 动作。

| 你对 OpenClaw 说的话 | 推荐动作 |
|------|------|
| “找一下张三的档案” | `GET /api/agent/applicants?keyword=张三` |
| “看张三现在缺什么” | `GET /api/agent/workspace?applicantProfileId=...` |
| “给李四新建法国申根档案” | `POST /api/agent/applicants` |
| “给这个人建一个美国签证案件” | `POST /api/agent/cases` |
| “把这份 Excel 传到张三档案” | `POST /api/agent/applicants/{id}/files` |
| “把护照扫描件删掉，重新传” | `DELETE /files/{slot}` 然后 `POST /files` |
| “把这份法国申请 JSON 替换掉” | `PUT /files/franceApplicationJson` |
| “把这个案件推进到审核中” | `PATCH /api/agent/cases/{id}/status` |
| “看看张三最近任务跑成什么样了” | `GET /api/agent/tasks?applicantProfileId=...` |
| “这单下一步你建议做什么” | `GET /api/agent/workspace` 后读取 `recommendedActions` |
| “帮我看看哪些任务失败了” | `GET /api/agent/tasks?status=failed` |

### 12.1 需要 OpenClaw 追问的情况

如果出现这些情况，OpenClaw 应该先问，不要直接执行：

- 同名申请人不止一个
- 用户没说清楚是美签还是法签
- 用户说“上传 Excel”，但无法判断 slot
- 用户让它“删掉这个文件”，但没说是哪个 slot
- 用户要推进案件状态，但目标状态不明确

### 12.2 不允许 OpenClaw 擅自猜测的内容

- AA 码
- 护照号
- 出生年份
- 案件状态
- 申请 JSON 内容
- 文件 slot

---

## 13. 推荐给 OpenClaw 的操作规则

可以把下面这段规则直接整理进 OpenClaw 的系统提示或运行规则里。

### 13.1 工作规则

1. 所有客户操作优先围绕“申请人档案”展开。
2. 做关键动作前，先读取申请人工作台。
3. 如果用户表达含糊，先澄清再执行。
4. 修改资料后，再次读取工作台确认结果。
5. 启动异步任务后，返回任务 ID，并主动检查任务状态。
6. 任务完成后，确认产物是否已经回档到正确 slot。
7. 不要虚构 AA 码、状态、护照号、任务结果。
8. 删除、替换、正式提交类动作必须谨慎。

### 13.2 文件规则

1. 优先上传到申请人档案，不要优先走通用上传。
2. 优先使用明确 slot。
3. 发现传错文件时，优先使用单 slot 删除或替换。
4. 上传 Excel 后，要关注解析回写结果。

### 13.3 任务规则

1. 创建任务时尽量传 `applicantProfileId` 和 `caseId`。
2. 查询任务时优先按申请人或案件过滤。
3. 失败任务先看 `error`，再结合 workspace 判断下一步。

### 13.4 案件规则

1. 若存在 `activeCaseId`，优先操作 active case。
2. 推进案件状态前，先确认当前业务节点是否合理。
3. 如状态推进失败，不要反复盲重试。

---

## 14. 典型流程编排

## 14.1 新客户，美签流程

推荐顺序：

1. `POST /api/agent/applicants`
2. `POST /api/agent/applicants/{id}/files`
3. `GET /api/agent/workspace`
4. `POST /api/usa-visa/photo-check`
5. `GET /api/agent/tasks?applicantProfileId=...`
6. `POST /api/usa-visa/ds160/submit`
7. `GET /api/agent/tasks?applicantProfileId=...`
8. `GET /api/agent/workspace`

## 14.2 新客户，法国申根流程

推荐顺序：

1. `POST /api/agent/applicants`
2. `POST /api/agent/applicants/{id}/files`
3. `GET /api/agent/workspace`
4. `POST /api/schengen/france/create-application`
5. `GET /api/agent/tasks?applicantProfileId=...`
6. `POST /api/schengen/france/fill-receipt`
7. `GET /api/agent/tasks?applicantProfileId=...`
8. `POST /api/schengen/france/submit-final`
9. `GET /api/agent/workspace`

## 14.3 发现文件传错，纠错流程

推荐顺序：

1. `GET /api/agent/workspace`
2. `DELETE /api/agent/applicants/{id}/files/{slot}`
3. `PUT /api/agent/applicants/{id}/files/{slot}` 或 `POST /files`
4. `GET /api/agent/workspace`

## 14.4 失败任务排查流程

推荐顺序：

1. `GET /api/agent/tasks?status=failed`
2. `GET /api/agent/tasks/{taskId}`
3. `GET /api/agent/workspace?applicantProfileId=...`
4. 根据缺失文件、缺失字段、失败原因决定是否重传或重跑

---

## 15. 错误处理规则

常见状态码：

- `401`：未授权
- `400`：参数错误 / 文件缺失 / 类型不支持
- `404`：申请人、案件或文件不存在
- `413`：文件过大
- `500`：服务端异常

### 15.1 OpenClaw 应该怎么反馈错误

建议反馈模板：

- 出错动作是什么
- 操作的是哪个申请人 / 案件
- 当前报错是什么
- 下一步建议是什么

例如：

```text
我已经尝试替换张三的 franceApplicationJson，但接口返回 404，说明这个槽位当前没有文件或档案不存在。
建议先检查 applicantProfileId 是否正确，或者先重新上传该文件。
```

---

## 16. 安全建议

1. `AGENT_API_KEY` 不要写死在仓库中。
2. 最好为 OpenClaw 单独创建绑定账号。
3. 删除 / 提交类工具建议要求确认。
4. 如果 OpenClaw 不需要全局权限，不要绑定管理员。
5. `/api/upload` 只用于通用分析，不应替代申请人档案文件归档。

---

## 17. 维护建议

每次新增或修改 `/api/agent/*` 路由时，至少同步更新这 4 处：

1. 本文档
2. `.env.example`
3. `/api/agent/openapi`
4. OpenClaw 侧 Tool 定义

如果未来新增高频编排接口，例如：

- `/api/agent/actions/create-or-find-applicant`
- `/api/agent/actions/prepare-france-case`
- `/api/agent/actions/repair-applicant-file`

也应继续沿用“员工式动作”的设计思路，而不是把 OpenClaw 再拉回零散底层接口。

---

## 18. 推荐的下一步

文档写完之后，建议下一步按这个顺序推进：

1. 在 OpenClaw 侧先实现 10 个最小工具
2. 先打通 `/api/agent/session`
3. 再打通 `/api/agent/workspace`
4. 再打通 applicant / files / tasks
5. 最后接业务自动化接口

如果要进一步提高 OpenClaw 的“员工感”，推荐再加一层：

- `/api/agent/actions/*`

这类接口专门把多步动作封装成一步，例如：

- “建立法国客户并检查还缺什么”
- “替换错文件并重新检查”
- “根据当前档案建议下一步”

---

## 19. 当前相关实现位置

如需查代码，请优先看：

- `lib/agent-auth.ts`
- `lib/agent-tasks.ts`
- `lib/applicant-profile-file-workflow.ts`
- `lib/agent-file-parsing.ts`
- `app/api/agent/**/route.ts`
- `app/api/usa-visa/**/route.ts`
- `app/api/schengen/france/**/route.ts`

---

## 20. Parsed-First 补充接口

为了让 OpenClaw 不再依赖“下载 Excel 后再看”，现在新增两条优先给 Agent 使用的结构化读取接口。

### 20.1 聚合解析接口

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/applicants/{id}/parsed-intake` | 获取申请人的聚合解析结果 |

返回内容重点包括：

- `profile`
- `parsedSources.usVisaExcel`
- `parsedSources.schengenExcel`
- `parsedSources.jsonFiles`

### 20.2 单文件解析接口

| Method | Path | 用途 |
|------|------|------|
| GET | `/api/agent/applicants/{id}/files/{slot}/parsed` | 获取单个 slot 的结构化解析结果 |

### 20.3 当前支持的解析类型

美签 Excel：

- `usVisaDs160Excel`
- `ds160Excel`
- `usVisaAisExcel`
- `aisExcel`

当前返回：

- `parsed.details`
- `parsed.audit`

申根 Excel：

- `schengenExcel`
- `franceExcel`

当前返回：

- `parsed.summary`
- `parsed.tlsCity`
- `parsed.audit`

JSON 文件：

- `franceApplicationJson`
- `franceTlsAccountsJson`
- `usVisaDs160PrecheckJson`
- `usVisaInterviewBriefJson`

### 20.4 推荐调用顺序

如果目标是“让 OpenClaw 像员工一样看材料”，推荐顺序改成：

1. `GET /api/agent/workspace`
2. `GET /api/agent/applicants/{id}/parsed-intake`
3. 如需针对某个 slot 深看，再调 `GET /api/agent/applicants/{id}/files/{slot}/parsed`
4. 只有在 parser 不支持或用户明确要求时，才读取 raw 文件

### 20.5 推荐命令映射

| 用户说法 | 推荐接口 |
|------|------|
| “直接看这个客户 Excel 里有什么” | `GET /api/agent/applicants/{id}/parsed-intake` |

---

## 21. Dedicated Intake APIs

For OpenClaw, if the goal is to read one business line's full intake body, prefer these dedicated endpoints instead of reconstructing from `parsed-intake`.

### 21.1 `GET /api/agent/applicants/{id}/us-visa-intake`

Purpose:

- Return the full persisted U.S. visa intake snapshot
- Return the current U.S. visa summary fields
- Return source Excel metadata and raw/download URLs
- Return the linked applicant photo metadata and raw/download URLs

Response body includes:

- `applicantProfileId`
- `applicantLabel`
- `usVisa`
- `intake`
- `sourceFile`
- `photo`

Recommended usage:

- “看这个客户美签 Excel 的完整信息”
- “直接看美签 intake，不要下载 Excel”
- “把美签 intake 和照片一起给我”

### 21.2 `GET /api/agent/applicants/{id}/schengen-intake`

Purpose:

- Return the full persisted Schengen intake snapshot
- Return the current Schengen summary fields
- Return source Excel metadata and raw/download URLs

Response body includes:

- `applicantProfileId`
- `applicantLabel`
- `schengen`
- `intake`
- `sourceFile`

Recommended usage:

- “看这个客户申根 Excel 的完整信息”
- “直接看申根 intake，不要原文件”
- “把申根个人资料全部整理出来”

### 21.3 Recommended Call Order

1. `GET /api/agent/workspace`
2. If you need a cross-file overview, call `GET /api/agent/applicants/{id}/parsed-intake`
3. If you need one vertical full body, call:
   `GET /api/agent/applicants/{id}/us-visa-intake`
   or
   `GET /api/agent/applicants/{id}/schengen-intake`
4. Only fall back to `GET /api/agent/applicants/{id}/files/{slot}/parsed` for one specific slot
| “直接看这份 DS-160 Excel 的关键信息” | `GET /api/agent/applicants/{id}/files/usVisaDs160Excel/parsed` |
| “直接看这份申根表里的关键信息” | `GET /api/agent/applicants/{id}/files/schengenExcel/parsed` |
| “看这个申请 JSON 里都有什么” | `GET /api/agent/applicants/{id}/files/franceApplicationJson/parsed` |

如果本文和代码不一致，以代码为准。

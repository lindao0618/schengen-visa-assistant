# OpenClaw 部署与 Tool 落地手册

本文档和 [AGENT_HTTP_API_REFERENCE.md](./AGENT_HTTP_API_REFERENCE.md) 的分工不同：

- `AGENT_HTTP_API_REFERENCE.md` 负责解释本站给 Agent 的接口
- 本文档负责解释怎样把这些接口真正接入 OpenClaw 并投入使用

如果你需要一份“可以直接交给 OpenClaw”的完整业务指令，请看 [OPENCLAW_READY_PROMPT.md](./OPENCLAW_READY_PROMPT.md)。

适用对象：

1. 负责部署 OpenClaw 的人
2. 负责写 OpenClaw 插件 / Tool 的人
3. 负责给 OpenClaw 配系统提示词和操作规则的人

---

## 1. 最终目标

希望达到的效果是：

- 你平时像安排员工一样给 OpenClaw 下中文指令
- OpenClaw 不靠乱点网页，而是优先调用本站 API
- OpenClaw 知道应该先看档案、再看工作台、再执行任务
- OpenClaw 执行后会回头确认结果，而不是只说“已完成”

推荐的总体链路：

`用户中文指令 -> OpenClaw -> 自定义 Tool -> /api/agent/* 或业务任务接口 -> 返回结构化结果 -> OpenClaw 总结并继续追踪`

---

## 2. 推荐部署架构

推荐采用 4 层结构：

1. `OpenClaw Gateway / Agent Runtime`
2. `OpenClaw 自定义插件`
3. `本站 Agent API`
4. `本站现有业务任务接口`

关系如下：

```text
User
  -> OpenClaw Agent
    -> OpenClaw Plugin Tools
      -> /api/agent/*
      -> /api/usa-visa/*
      -> /api/schengen/france/*
        -> task store / applicant profile / case / file slots
```

### 为什么不建议主打浏览器自动化

因为浏览器链路有 4 个天然问题：

1. 对页面结构敏感
2. 不容易稳定拿到结构化结果
3. 不容易严格控制副作用
4. 不容易长期维护

而本站已经具备：

- 申请人档案
- 案件
- 文件槽位
- 统一任务查询
- 工作台聚合

这些都更适合给 Agent 调用。

---

## 3. 部署前准备

部署 OpenClaw 前，先确认本站服务端具备这些条件。

## 3.1 站点必须可访问

至少要能从 OpenClaw 所在环境访问：

- `GET /api/agent/session`
- `GET /api/agent/openapi`

### 3.2 环境变量

本站必须配置：

```env
AGENT_API_KEY=replace_with_a_long_random_machine_key
AGENT_API_USER_ID=
AGENT_API_USER_EMAIL=agent@example.com
```

建议：

- 优先配置 `AGENT_API_USER_ID`
- `AGENT_API_USER_EMAIL` 作为回退
- `AGENT_API_KEY` 使用高强度随机字符串

## 3.3 绑定账号建议

推荐新建一个专门的 Agent 账号，例如：

- `agent.ops@example.com`

如果你想让 OpenClaw 拥有全局视角，就把它设成管理员。

如果你只希望它操作某一位业务员的客户，就绑定普通账号。

---

## 4. OpenClaw 侧接入模式

OpenClaw 官方支持插件注册 Tool，也支持 Gateway 通过 HTTP 触发工具调用。官方文档：

- 插件与 Agent Tools：<https://docs.openclaw.ai/plugins/agent-tools>
- Plugins 总览：<https://docs.openclaw.ai/plugins>
- Gateway tools invoke：http 调用：<https://docs.openclaw.ai/gateway/tools-invoke-http-api>

本站推荐优先使用“插件注册 Tool”的模式。

## 4.1 模式 A：插件注册 Tool

这是最推荐模式。

思路：

1. 在 OpenClaw 插件里注册多个 Tool
2. Tool 内部调用本站 HTTP 接口
3. 用 `x-agent-api-key` 完成机器鉴权
4. Tool 返回结构化结果给模型

优点：

- Tool 参数可控
- 更容易做确认策略
- 更容易做权限分层
- 更适合长期维护

## 4.2 模式 B：Gateway HTTP 工具转发

如果你们已有内部 Gateway 编排层，也可以用 HTTP 方式从外部驱动 OpenClaw 工具。

适合场景：

- 你已有外部控制台
- 你已有任务中台
- 你要远程统一调度多个 Agent

但即便如此，建议底层 Tool 仍然调用本站 API，不要直接在 Tool 里写浏览器自动化。

---

## 5. 推荐 Tool 清单

下面是推荐的分层。

## 5.1 核心 Tool

这些工具建议第一批就实现。

| Tool 名 | 是否必须 | 用途 |
|------|------|------|
| `find_applicants` | 必须 | 搜索申请人 |
| `get_workspace` | 必须 | 获取申请人完整工作台 |
| `get_parsed_intake` | 建议 | 获取申请人聚合解析结果 |
| `get_parsed_file` | 建议 | 获取单个文件槽位的结构化解析结果 |
| `create_applicant` | 必须 | 创建申请人 |
| `update_applicant` | 必须 | 修改申请人资料 |
| `upload_files` | 必须 | 批量上传文件 |
| `replace_file` | 必须 | 替换错误文件 |
| `delete_file` | 必须 | 删除错误文件 |
| `create_case` | 必须 | 创建案件 |
| `update_case` | 建议 | 修改案件基础字段 |
| `update_case_status` | 必须 | 推进 / 纠正案件状态 |
| `list_tasks` | 必须 | 统一查询任务 |
| `get_task` | 必须 | 查询单个任务 |

## 5.2 业务执行 Tool

这些工具用于真正执行自动化业务。

| Tool 名 | 用途 |
|------|------|
| `run_us_photo_check` | 美签照片检测 |
| `run_us_ds160_submit` | DS-160 提交 |
| `run_us_ais_register` | AIS 注册 |
| `run_fr_extract_register` | 法签提取 + 注册 |
| `run_fr_tls_register` | TLS 注册 |
| `run_fr_create_application` | 生成法国新申请 |
| `run_fr_fill_receipt` | 生成法国回执 |
| `run_fr_submit_final` | 提交法国最终表 |

## 5.3 只读 Tool

这类工具建议默认可用：

- `find_applicants`
- `get_workspace`
- `get_parsed_intake`
- `get_parsed_file`
- `list_tasks`
- `get_task`

---

## 20. Dedicated Intake APIs

If OpenClaw needs the full intake body for one business line, do not let it re-assemble data from `workspace` and `parsed-intake`.
Use these dedicated APIs directly.

### 20.1 Recommended Read-Only Tools

| Tool | Method | Path | Purpose |
|------|------|------|------|
| `get_us_visa_intake` | GET | `/api/agent/applicants/{id}/us-visa-intake` | Full U.S. visa intake, source Excel, photo, and raw file URLs |
| `get_schengen_intake` | GET | `/api/agent/applicants/{id}/schengen-intake` | Full Schengen intake and source Excel URLs |

### 20.2 Response Shape

`get_us_visa_intake` returns:

- `applicantProfileId`
- `applicantLabel`
- `usVisa`
- `intake`
- `sourceFile`
- `photo`

`get_schengen_intake` returns:

- `applicantProfileId`
- `applicantLabel`
- `schengen`
- `intake`
- `sourceFile`

### 20.3 When To Use

Use `get_us_visa_intake` when the user says:

- “直接看这个客户美签 Excel 的完整信息”
- “把美签 Excel 里的所有个人信息告诉我”
- “看这个客户美签 intake 和照片”

Use `get_schengen_intake` when the user says:

- “直接看这个客户申根 Excel 的完整信息”
- “把申根表里的个人信息全部整理出来”
- “看这个客户申根 intake”

### 20.4 Decision Order

Recommended order for OpenClaw:

1. `find_applicants`
2. `get_workspace`
3. If the user wants “overall status”, use `get_parsed_intake`
4. If the user wants one vertical full body, use `get_us_visa_intake` or `get_schengen_intake`
5. Only use `get_parsed_file` when you need one specific slot

### 20.5 UI Alignment

The applicant detail page now mirrors this same structure:

- U.S. visa basic fields
- Collapsible full U.S. visa intake block
- Source Excel metadata
- Photo preview
- Full extracted field list
- Raw JSON for verification

- Schengen basic fields
- Collapsible full Schengen intake block
- Source Excel metadata
- Full extracted field list
- Raw JSON for verification

## 5.4 有副作用 Tool

这类工具建议需要确认：

- `create_applicant`
- `update_applicant`
- `upload_files`
- `replace_file`
- `delete_file`
- `create_case`
- `update_case`
- `update_case_status`
- 全部 `run_*` 工具

---

## 6. Tool 与本站接口映射

## 6.1 核心映射表

| Tool 名 | Method | Path |
|------|------|------|
| `find_applicants` | GET | `/api/agent/applicants` |
| `get_workspace` | GET | `/api/agent/workspace` |
| `get_parsed_intake` | GET | `/api/agent/applicants/{id}/parsed-intake` |
| `get_parsed_file` | GET | `/api/agent/applicants/{id}/files/{slot}/parsed` |
| `create_applicant` | POST | `/api/agent/applicants` |
| `update_applicant` | PUT | `/api/agent/applicants/{id}` |
| `upload_files` | POST | `/api/agent/applicants/{id}/files` |
| `replace_file` | PUT | `/api/agent/applicants/{id}/files/{slot}` |
| `delete_file` | DELETE | `/api/agent/applicants/{id}/files/{slot}` |
| `create_case` | POST | `/api/agent/cases` |
| `update_case` | PATCH | `/api/agent/cases/{id}` |
| `update_case_status` | PATCH | `/api/agent/cases/{id}/status` |
| `list_tasks` | GET | `/api/agent/tasks` |
| `get_task` | GET | `/api/agent/tasks/{taskId}` |

## 6.2 业务 Tool 映射表

| Tool 名 | Method | Path |
|------|------|------|
| `run_us_photo_check` | POST | `/api/usa-visa/photo-check` |
| `run_us_ds160_submit` | POST | `/api/usa-visa/ds160/submit` |
| `run_us_ais_register` | POST | `/api/usa-visa/register-ais` |
| `run_fr_extract_register` | POST | `/api/schengen/france/extract-register` |
| `run_fr_tls_register` | POST | `/api/schengen/france/tls-register` |
| `run_fr_create_application` | POST | `/api/schengen/france/create-application` |
| `run_fr_fill_receipt` | POST | `/api/schengen/france/fill-receipt` |
| `run_fr_submit_final` | POST | `/api/schengen/france/submit-final` |

---

## 7. 插件实现骨架

下面是一份推荐骨架。

说明：

- 这是面向 OpenClaw 插件的示意代码
- 核心思路是统一写一个 `agentFetch`
- 然后每个 Tool 只关心参数和 endpoint

```ts
import { Type } from "@sinclair/typebox";

const BASE_URL = process.env.VISA_ASSISTANT_BASE_URL!;
const AGENT_API_KEY = process.env.VISA_ASSISTANT_AGENT_API_KEY!;

async function agentFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-agent-api-key": AGENT_API_KEY,
      ...(init?.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${response.status}`
    );
  }

  return data;
}

export default function registerVisaAssistantTools(api: any) {
  api.registerTool({
    name: "find_applicants",
    description: "Search applicant profiles by keyword and filters.",
    parameters: Type.Object({
      keyword: Type.Optional(Type.String()),
      visaTypes: Type.Optional(Type.Array(Type.String())),
      statuses: Type.Optional(Type.Array(Type.String())),
      regions: Type.Optional(Type.Array(Type.String())),
      priorities: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(_id: string, params: any) {
      const search = new URLSearchParams();
      if (params.keyword) search.set("keyword", params.keyword);
      if (params.visaTypes?.length) search.set("visaTypes", params.visaTypes.join(","));
      if (params.statuses?.length) search.set("statuses", params.statuses.join(","));
      if (params.regions?.length) search.set("regions", params.regions.join(","));
      if (params.priorities?.length) search.set("priorities", params.priorities.join(","));
      search.set("includeStats", "1");

      const data = await agentFetch(`/api/agent/applicants?${search.toString()}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  });
}
```

---

## 8. 推荐的 Tool 参数设计

建议每个 Tool 的参数尽量直白，不要把业务规则塞给模型自己猜。

## 8.1 `find_applicants`

建议参数：

```ts
{
  keyword?: string;
  visaTypes?: string[];
  statuses?: string[];
  regions?: string[];
  priorities?: string[];
}
```

## 8.2 `get_workspace`

建议参数：

```ts
{
  applicantProfileId?: string;
  caseId?: string;
  taskLimit?: number;
}
```

规则：

- 优先用 `applicantProfileId`
- 如果只有 `caseId`，也可让服务端反查

## 8.3 `upload_files`

建议参数：

```ts
{
  applicantProfileId: string;
  files: Array<{
    slot: string;
    localPath: string;
  }>;
}
```

规则：

- 强制要求 `slot`
- Tool 层自己把本地文件封成 multipart/form-data

## 8.4 `replace_file`

建议参数：

```ts
{
  applicantProfileId: string;
  slot: string;
  localPath: string;
}
```

## 8.5 `delete_file`

建议参数：

```ts
{
  applicantProfileId: string;
  slot: string;
  reason?: string;
}
```

## 8.6 `update_case_status`

建议参数：

```ts
{
  caseId: string;
  mainStatus: string;
  subStatus?: string | null;
  exceptionCode?: string | null;
  clearException?: boolean;
  reason?: string;
  allowRegression?: boolean;
}
```

---

## 9. 推荐的 Tool 返回风格

推荐原则：

1. Tool 返回结构化 JSON
2. OpenClaw 再把 JSON 转成中文总结
3. 不要让 Tool 自己返回大量自然语言

推荐结构：

```json
{
  "ok": true,
  "data": { ... },
  "nextHints": ["..."]
}
```

如果当前阶段不额外包一层，也至少把服务端原样 JSON 返回给模型。

---

## 10. OpenClaw 系统提示词模板

下面这段建议直接作为 OpenClaw 的业务系统提示词底稿。

```text
你是签证业务执行助理，不是闲聊助手。

你的主要职责：
1. 维护申请人档案
2. 检查申请人当前工作台状态
3. 上传、替换、删除文件
4. 创建和更新案件
5. 调用签证业务自动化任务
6. 检查任务结果是否成功并是否已回档

工作规则：
1. 所有客户操作优先围绕申请人档案进行。
2. 在执行关键动作前，优先调用 get_workspace。
3. 如果用户表达不明确，不要猜，先澄清。
4. 如果存在同名申请人，必须先确认正确对象。
5. 如果用户没有明确文件 slot，不要擅自上传到不确定位置。
6. 删除、替换、正式提交、状态推进等动作要谨慎。
7. 启动异步任务后，要返回 task_id，并建议继续跟踪任务状态。
8. 任务完成后，要重新检查 workspace，确认产物是否已经回档。
9. 不要虚构 AA 码、护照号、出生年份、任务结果或文件内容。
10. 如果接口报错，要明确说明失败原因和下一步建议。

优先使用的工具：
1. find_applicants
2. get_workspace
3. get_parsed_intake / get_parsed_file
4. create_applicant / update_applicant
5. upload_files / replace_file / delete_file
6. create_case / update_case / update_case_status
7. list_tasks / get_task
8. run_* 业务工具

常用策略：
- 用户说“看看这个客户还缺什么”：先 get_workspace
- 用户说“直接看这个客户 Excel / JSON 里有什么”：先 get_parsed_intake
- 用户说“给这个客户传材料”：先确认 applicantProfileId 和 slot
- 用户说“帮我做下一步”：先 get_workspace，再根据 recommendedActions 决定
- 用户说“为什么没成功”：先 get_task，再 get_workspace
```

---

## 11. OpenClaw 应该理解的中文命令模板

下面这些是建议你平时对 OpenClaw 使用的表达方式。

## 11.1 查找类

- “找一下张三的档案”
- “查一下最近失败的任务”
- “看看李四这个案子现在到哪一步”
- “看看这个客户还缺什么文件”

## 11.2 档案维护类

- “给王五新建一个法国申根档案”
- “把张三的护照号改成 E12345678”
- “把这个客户的 TLS 城市改成上海”
- “把这个客户的优先级改成 urgent”

## 11.3 文件操作类

- “把这份 DS-160 Excel 传到张三档案”
- “把李四的 passportScan 删除”
- “把张三的 franceApplicationJson 替换掉”
- “把这张照片上传成 usVisaPhoto”

## 11.4 任务执行类

- “帮张三跑美签照片检测”
- “帮李四提交 DS-160”
- “帮王五生成法国新申请”
- “帮赵六生成法国回执”

## 11.5 追踪与排查类

- “看看这个任务为什么失败”
- “这个客户下一步该做什么”
- “这份结果有没有回档到申请人”

---

## 12. 推荐的工作决策顺序

给 OpenClaw 一条很重要的操作顺序：

### 12.1 用户给出一个客户任务时

1. 先识别客户是谁
2. 找到 `applicantProfileId`
3. 读取 `workspace`
4. 判断当前缺什么
5. 再决定是改资料、传文件还是跑任务

### 12.2 用户要求“继续往下做”时

不要直接猜下一步。

正确做法：

1. 先读 `workspace`
2. 看 `missingFileGroups`
3. 看 `missingInformation`
4. 看 `recommendedActions`
5. 再决定下一动作

### 12.3 用户要求“纠错”时

建议：

1. 查工作台
2. 找出错对象
3. 删除或替换对应文件
4. 必要时修改 applicant / case
5. 再次查看工作台确认

---

## 13. 业务任务 Tool 的实现建议

业务任务 Tool 和档案 Tool 不同，建议遵循以下规则。

## 13.1 总是尽量带上这些字段

- `applicantProfileId`
- `caseId`

原因：

- 任务可以挂到正确申请人
- 任务可以挂到正确案件
- 产物更容易回档
- 后续排查更容易

## 13.2 任务完成后不要立刻结束对话

建议 Tool 调用后的 Agent 行为：

1. 返回 `task_id`
2. 告知任务已创建
3. 提醒稍后查询
4. 如需要，主动调用 `list_tasks` 或 `get_task`

## 13.3 不要让模型自己拼复杂 multipart 逻辑

建议在 Tool 代码层把 multipart 打包好。

模型只负责提供：

- 申请人 ID
- 案件 ID
- 文件路径
- 业务动作参数

---

## 14. 推荐的上线测试清单

OpenClaw 接好之后，至少做下面这些检查。

## 14.1 鉴权测试

- `get_session` 成功
- 错误 API key 被拒绝
- 绑定账号权限正确

## 14.2 档案测试

- 能搜索申请人
- 能创建申请人
- 能修改申请人
- 能创建案件

## 14.3 文件测试

- 能上传 `schengenExcel`
- 能上传 `usVisaDs160Excel`
- 能替换 `franceApplicationJson`
- 能删除 `passportScan`

## 14.4 任务测试

- 能查询统一任务列表
- 能按 `applicantProfileId` 过滤
- 能按 `caseId` 过滤
- 能查询单个任务

## 14.5 工作台测试

- 能正确返回 `recommendedActions`
- 能正确返回 `missingFileGroups`
- 能正确返回 `recentTasks`

## 14.6 业务流测试

至少打通两个最短链路：

1. 美签照片检测链路
2. 法签生成新申请链路

---

## 15. 推荐的灰度上线顺序

不要一口气开放所有 Tool。

推荐顺序：

### 第 1 阶段：只读

- `find_applicants`
- `get_workspace`
- `get_parsed_intake`
- `get_parsed_file`
- `list_tasks`
- `get_task`

### 第 2 阶段：档案维护

- `create_applicant`
- `update_applicant`
- `upload_files`
- `replace_file`
- `delete_file`

### 第 3 阶段：案件维护

- `create_case`
- `update_case`
- `update_case_status`

### 第 4 阶段：业务自动化

- 先开放照片检测、生成新申请这类风险相对可控动作
- 最后开放正式提交类动作

---

## 16. 推荐的回滚策略

如果上线后 OpenClaw 行为异常，优先按下面顺序回滚：

1. 先在 OpenClaw 侧禁用高风险 Tool
2. 保留只读 Tool
3. 若还不稳定，先只保留 `get_workspace` 和 `list_tasks`
4. 最后再逐个恢复写操作 Tool

---

## 17. 已知限制

当前阶段仍有这些限制：

1. `/api/agent/*` 主要是统一入口和工作台层，不是所有业务动作都封成一步
2. 具体业务执行依然要调用 `/api/usa-visa/*` 和 `/api/schengen/france/*`
3. 某些业务动作仍然依赖外部 Python 服务或脚本环境
4. 当前还没有把“多步动作编排”统一收敛成 `/api/agent/actions/*`

---

## 18. 下一步建议

如果你要继续提高“像员工一样执行”的体验，推荐下一阶段新增：

### 18.1 编排类动作接口

例如：

- `prepare_us_visa_case`
- `prepare_france_case`
- `repair_profile_files`
- `suggest_next_action`

### 18.2 更严格的二次确认策略

例如：

- 删除类动作必须确认
- 提交类动作必须确认
- 状态回退必须确认

### 18.3 结果摘要层

让 Tool 返回：

- 当前动作结果
- 是否回档成功
- 下一步建议

这样 OpenClaw 的“员工感”会明显更强。

---

## 19. Parsed-First Tool 补充

现在已经不建议让 OpenClaw 以“下载 Excel 再查看”为主流程。

更高效的方式是直接读取服务端已经整理好的结构化结果。

新增推荐只读 Tool：

| Tool 名 | Method | Path | 用途 |
|------|------|------|------|
| `get_parsed_intake` | GET | `/api/agent/applicants/{id}/parsed-intake` | 获取申请人的聚合解析结果 |
| `get_parsed_file` | GET | `/api/agent/applicants/{id}/files/{slot}/parsed` | 获取单个文件槽位的结构化解析结果 |

### 19.1 推荐用途

- `get_parsed_intake` 适合“先整体看这个客户资料里到底有什么、缺什么、Excel 里提取出了什么、JSON 文件里已经归档了什么”
- `get_parsed_file` 适合“我只想看某一个 slot 的结构化结果，不想看原文件”

### 19.2 推荐调用顺序

当用户说这些话时，优先调用 parsed 类工具：

- “看看这个客户 Excel 里写了什么”
- “直接看这份表格里的关键信息”
- “这个客户的申请 JSON 里有什么”
- “不要下载文件，直接告诉我内容”

推荐顺序：

1. `find_applicants`
2. `get_workspace`
3. `get_parsed_intake`
4. 如有必要，再调用 `get_parsed_file`

### 19.3 何时不需要下载原文件

以下场景通常不需要下载原文件：

- 只想看美签 Excel 提取出的姓、出生年、护照号、审计结果
- 只想看申根 Excel 提取出的姓名、护照号、递签城市、TLS 城市、审计结果
- 只想看已经归档的 JSON 内容，例如 `franceApplicationJson`、`franceTlsAccountsJson`、`usVisaInterviewBriefJson`

### 19.4 何时才读取原文件

只有在这些情况下才建议读取 raw 文件：

- 当前 slot 还没有结构化 parser
- 用户明确要求看原始文件
- 你需要核对某个没有被提取出来的原始单元格内容

### 19.5 建议加入第一阶段灰度的只读 Tool

第一阶段只读 Tool 现在建议改成：

- `find_applicants`
- `get_workspace`
- `get_parsed_intake`
- `get_parsed_file`
- `list_tasks`
- `get_task`

# VISTORIA 618 PRO UI Redesign Design

## Summary

将当前签证助手的公共用户体验升级为参考 UI 的 `VISTORIA 618 PRO` 风格。第一轮覆盖首页、全局公共导航、AI 助手、用户个人中心/签证服务工作台、登录和注册入口。目标是让产品从普通表单型网站升级为高端签证自动化控制台，同时保留现有业务能力、路由和数据接口。

默认视觉方向为深色 Pro：黑色主背景、半透明 glass UI、悬浮导航、数据仪表卡、微动效、蓝/绿/琥珀业务状态色。参考来源为 `D:\360Downloads\download_chrome\ui-optimization-assistant.zip` 中的 `src/App.tsx` 与 `src/index.css`。

## Goals

- 将品牌呈现统一为 `VISTORIA 618 PRO`。
- 首页形成强第一屏信号：这是一个面向签证办理、材料审核、预约监控和自动化任务的 AI 工作台。
- AI 助手从普通聊天页升级为签证咨询控制台，保留现有流式问答、签证类型、国家、所在地、申请人身份筛选。
- Dashboard 从浅色个人中心升级为深色任务工作台，保留现有模块切换、用户资料、签证任务列表、材料审核任务列表。
- 登录和注册页与新版品牌风格一致，减少进入系统前后的视觉断层。
- 改造保持现有 Next.js App Router、React、Tailwind、shadcn 风格基础组件、`framer-motion`、`lucide-react` 技术栈。

## Non-Goals

- 第一轮不改管理后台 `/admin`。
- 第一轮不改申请人 CRM `/applicants` 和申请人详情页。
- 第一轮不改 API 行为、鉴权逻辑、数据库模型、自动化任务执行逻辑。
- 不直接把参考 Vite 应用整页复制到 Next.js 项目里；迁移的是视觉语言和交互模式。
- 不新增新的大型 UI 框架。

## Design Approach

采用“共享视觉系统 + 页面级重组”的方式。

新增或整理一个公共的 Pro UI 视觉层，用于复用 glass 卡片、状态徽标、悬浮面板、指标卡、深色页面背景和品牌标识。页面保持现有路由和业务组件边界：业务数据、表单提交、任务列表继续由现有组件负责；新版 UI 负责外层布局、层级、视觉和入口组织。

这样可以避免把参考项目变成一次性大文件，也避免重写已有登录、AI 请求、任务轮询和 localStorage 逻辑。

## Visual System

### Brand

- Primary name: `VISTORIA 618 PRO`
- Product tone: 高端、自动化、可信、签证工作台
- Logo mark: 参考 UI 中黑白方块风格，可用纯 CSS 方形 mark 实现；不引入图片依赖。

### Color

- Page background: `#050505` / `#000000`
- Panel background: `rgba(255,255,255,0.03-0.07)`
- Panel border: `rgba(255,255,255,0.08-0.14)`
- Primary text: `#ffffff`
- Secondary text: `rgba(255,255,255,0.42-0.62)`
- Muted text: `rgba(255,255,255,0.24-0.36)`
- Active blue: `#3b82f6` / `#60a5fa`
- Success green: `#10b981` / `#34d399`
- Warning amber: `#f59e0b` / `#fbbf24`
- Error red: `#ef4444`

### Shape And Spacing

- 主要 app 容器不使用营销页大卡套卡。
- 卡片半径使用 `24px-32px`，贴近参考 UI；工具按钮和表单控件使用 `12px-16px`。
- 页面主内容宽度以 `max-w-7xl` 为主，公共导航居中 `max-w-5xl`。
- 首屏内容保留高密信息，但移动端改为单列，防止文字和卡片挤压。

### Motion

- 使用已有 `framer-motion`。
- 页面进入：轻微 `opacity + y` stagger。
- 导航 active underline 使用 `layoutId`。
- Hover：卡片边框增强、图标反色、箭头轻微移动。
- Loading/processing：保留 pulse 点、进度条、扫描线等参考 UI 元素。

## Architecture

### Shared UI Layer

新增 `components/pro-ui/` 作为视觉系统层，建议拆为：

- `pro-logo.tsx`: `VISTORIA 618 PRO` 标识和方形 mark。
- `pro-shell.tsx`: 深色页面背景、主内容宽度、通用 padding。
- `pro-card.tsx`: glass card、metric card、section card 的轻量封装。
- `pro-status.tsx`: 在线、处理中、成功、警告、失败等状态徽标。

这些组件只处理视觉，不读取业务数据，不调用 API。

### Navigation

修改 `components/nav-bar.tsx`：

- 由 sticky 白色导航改为 fixed glass bar。
- 品牌改为 `VISTORIA 618 PRO`。
- 保留当前导航结构和下拉入口。
- `NavBarAuthActions` 保持原组件，只调整外层兼容样式。
- 移动端先保持可用入口，不引入复杂 hamburger 重构。

### Home

重写 `app/HomeClientPage.tsx` 的视觉结构：

- Hero header：`Architecture of Trust` 或中文等价主标题，结合签证业务文案。
- 指标卡：成功率、活跃请求、自动化节点等，结合现有业务表达。
- 主控制台面板：材料审核、预约监控、DS-160、申根流程以数据化方式展示。
- 服务模块卡：申根签证、美国签证、材料审核、AI 答疑、申请人档案入口。
- Footer 简化为深色品牌 footer，避免当前浅色社交图标和大块渐变断层。

### AI Assistant

修改 `app/ai-assistant/AIAssistantClientPage.tsx`：

- 保留现有 state、fetch 到 `http://localhost:8000/ask-stream`、SSE 解析、消息格式化。
- 布局改为深色工作台：顶部标题/状态条，左侧筛选面板，右侧聊天区域。
- 筛选项放入 glass 面板，select 控件统一深色样式。
- 输入栏固定在聊天卡底部，发送按钮使用图标 + 简短文本。
- 错误消息以 red status card 呈现。

### Dashboard

修改 `app/dashboard/DashboardClientPage.tsx`：

- 外层改为深色 app shell。
- 左侧 module nav 改为 glass rail，active 状态反色。
- 顶部增加当前用户/工作台概览。
- 各模块卡片从浅色 card 改为 Pro glass panel。
- 保留模块切换和用户资料编辑逻辑。

修改 `app/dashboard/components/visa-services.tsx`：

- 外层服务卡、Tabs、任务 loading、任务区域统一深色。
- 保留现有动态导入 `TaskList`、`FranceTaskList`、`MaterialTaskList`。
- 不改任务轮询和 localStorage 读取。

### Auth Pages

修改 `app/login/LoginClientPage.tsx` 和 `app/register/RegisterClientPage.tsx`：

- 使用同一深色品牌登录 shell。
- 左侧为 `VISTORIA 618 PRO` 信任/安全/自动化能力说明。
- 右侧为 glass form card。
- 保留现有登录、注册提交逻辑和错误状态。

## Data Flow

数据流保持现状。

- 首页：使用静态营销/产品入口内容，不新增远程数据依赖。
- AI 助手：用户输入和筛选项进入现有 `/ask-stream` 请求体，SSE 响应继续写入 `messages`。
- Dashboard：`useSession`、`/api/users/me`、任务列表动态组件、localStorage 任务 ID 读取保持不变。
- 登录/注册：NextAuth credentials 登录和 `/api/auth/register` 注册保持不变。

视觉组件不拥有业务数据源，只通过 props 或 children 渲染。

## Error Handling

- AI 助手请求失败：保留当前错误捕获，改为深色 red alert panel。
- Dashboard 用户资料更新失败：保留现有错误消息，改为 Pro alert 样式。
- 注册/登录失败：保留当前错误文案，改为 red status card。
- 动态任务组件加载：保留 loading fallback，改为深色 skeleton/loading card。
- 若用户未登录访问 Dashboard，继续使用现有 session 判断和提示。

## Accessibility And Responsive Behavior

- 所有按钮继续使用原生 `button` 或现有 `Button`，保留键盘可达性。
- 深色背景下文本对比度不低于当前页面；正文避免使用过低透明度。
- 表单 input/select 保留 label。
- 移动端：
  - 首页指标卡单列或两列。
  - AI 助手左侧筛选面板堆叠到聊天区上方。
  - Dashboard 侧栏在小屏改为横向/顶部模块切换区。
  - 悬浮导航减少菜单项，保证不溢出。

## Testing

### Automated Checks

- `npm run lint` 检查类型和 Next lint。
- `npm run build` 验证生产构建。
- 若改动影响现有测试覆盖区域，运行相关测试：
  - `npm run test:dates` 只在日期相关逻辑变化时需要。
  - 当前 UI 改造主要依赖 lint/build 和浏览器手动验证。

### Manual Browser QA

使用本地 Next dev server 检查：

- `/` 首页：桌面和移动宽度下首屏无文字重叠，服务入口可点击。
- `/ai-assistant`：发送按钮、输入框自适应、select 控件、错误状态仍可用。
- `/dashboard`：模块切换、用户资料编辑 UI、签证任务 Tabs 可渲染。
- `/login`：登录表单可输入、错误提示可见、链接可点击。
- `/register`：注册表单可输入、错误提示可见、登录链接可点击。

## Risks And Mitigations

- 风险：全局 `globals.css` 中已有针对 `input`、`.rounded-xl.bg-card` 的宽泛样式，可能污染新版深色 UI。
  - 缓解：Pro 页面使用明确 class，提高选择器优先级；必要时把旧宽泛样式限制到旧页面范围。
- 风险：`NavBar` 是全局组件，修改后会影响 `/admin` 和 `/applicants`。
  - 缓解：先让新版导航保持业务入口完整；若管理后台出现明显不适配，再在 admin layout 中隔离导航或提供后台专用壳层。
- 风险：参考 UI 使用大量动效和透明层，低性能设备可能卡顿。
  - 缓解：动效只用于首屏进入、hover、状态点，不做持续大面积动画。
- 风险：深色 select/input 在浏览器默认样式下可能不一致。
  - 缓解：为 Pro 页面显式设置背景、边框、文字、focus ring。

## Rollout

第一轮按页面分批落地：

1. 建立 Pro UI 共享组件和全局样式 tokens。
2. 改造 `NavBar` 和首页，先完成品牌第一印象。
3. 改造登录/注册，保证入口一致。
4. 改造 AI 助手，保留问答功能。
5. 改造 Dashboard 和签证服务模块。
6. 启动 dev server 做桌面/移动手动 QA，再运行 lint/build。

如果第一轮验证稳定，第二轮再评估 `/admin` 和 `/applicants` 是否统一为同一套 Pro shell。

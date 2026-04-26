# 申请人详情页拆分设计

## 目标

在不改变 `/applicants/[id]` 路由形态、用户可见流程和现有自动化行为的前提下，降低 [d:\Ai-user\schengen-visa-assistant (2)\visa-assistant\app\applicants\[id]\ApplicantDetailClientPage.tsx](d:\Ai-user\schengen-visa-assistant%20(2)\visa-assistant\app\applicants\%5Bid%5D\ApplicantDetailClientPage.tsx) 的运行压力和维护压力。

这次的直接目标，是把当前单体客户端组件拆成若干职责清晰的小模块，让页面后续更安全、更容易继续做性能优化。

## 当前问题

当前详情页是一个约 3300 行的单一客户端组件，里面混合了这些职责：

- 申请人详情数据拉取和刷新逻辑
- 权限和只读控制
- 申请人基础表单状态
- Case 表单状态
- 文件上传和下载动作
- Excel 预览与在线编辑
- Word/HTML/文本预览
- 审核弹窗状态和修复动作
- tab 布局和顶层消息提示

这会带来三个实际问题：

1. 页面很难理解，改动后容易引入回归。
2. 预览逻辑和大块弹窗状态常驻在主页面包里，即使用户只是在看基础详情。
3. 后续再做懒加载、缓存收紧、页面级性能分析时会很难，因为职责没有边界。

## 范围

本设计只覆盖 `/applicants/[id]` 这一个申请人详情页。

包含在范围内的内容：

- 把状态和 UI 职责拆成几个聚焦模块
- 保留现有 tab 结构
- 保留前面已经落地的角色权限行为
- 为后续的包体和渲染优化创造条件

不包含在范围内的内容：

- 修改路由路径
- 修改页面已使用的 API 契约
- 删除任何现有文件预览、Excel 编辑或审核行为
- 重写自动化流程
- 重新设计视觉布局

## 推荐方案

采用“页面壳 + 单一控制器 Hook + tab 子组件”的结构。

推荐结构如下：

- 保留 [d:\Ai-user\schengen-visa-assistant (2)\visa-assistant\app\applicants\[id]\page.tsx](d:\Ai-user\schengen-visa-assistant%20(2)\visa-assistant\app\applicants\%5Bid%5D\page.tsx) 作为服务端入口
- 把 [d:\Ai-user\schengen-visa-assistant (2)\visa-assistant\app\applicants\[id]\ApplicantDetailClientPage.tsx](d:\Ai-user\schengen-visa-assistant%20(2)\visa-assistant\app\applicants\%5Bid%5D\ApplicantDetailClientPage.tsx) 降成页面壳
- 共享状态和副作用迁到控制器 Hook
- 预览弹窗和各 tab 内容迁到独立文件

相比“只做懒加载”的方案，这种方式更适合当前问题，因为现在的核心问题不只是包体大，更是职责缠在一起。相比“整页彻底重写”，这种方式风险更低，因为现有流程已经在线运行，而且和业务逻辑耦合很深。

## 目标文件结构

拆分后，在当前路由目录下新增一个 `detail` 模块目录：

- `app/applicants/[id]/detail/use-applicant-detail-controller.ts`
- `app/applicants/[id]/detail/basic-tab.tsx`
- `app/applicants/[id]/detail/cases-tab.tsx`
- `app/applicants/[id]/detail/materials-tab.tsx`
- `app/applicants/[id]/detail/progress-tab.tsx`
- `app/applicants/[id]/detail/material-preview-dialog.tsx`
- `app/applicants/[id]/detail/audit-dialog.tsx`
- `app/applicants/[id]/detail/types.ts`

现有页面壳文件继续作为集成入口，负责组装这些模块。

## 各模块职责

### ApplicantDetailClientPage 页面壳

页面壳只负责：

- 从 URL 读取当前请求的 tab
- 初始化控制器 Hook
- 渲染 tab 列表和共享页头
- 把控制器提供的状态和动作传给各 tab 组件
- 挂载拆出来的弹窗组件

页面壳不再直接持有详细的 Excel 预览逻辑、大块 Case 表单渲染逻辑，以及大部分异步请求代码。

### use-applicant-detail-controller

这个 Hook 作为页面的唯一状态协调器，负责：

- 详情数据拉取和刷新
- 顶层 loading 和 message 状态
- 当前选中 Case 与表单初始化
- 申请人和 Case 的保存、删除、创建动作
- 从权限推导出的 `isReadOnly`、`canAssign`、`canRunAutomation` 等布尔值
- 弹窗的开关状态和载荷

这个 Hook 是让 UI 变成声明式结构的关键边界。

### basic-tab

这个组件接收：

- 申请人基础表单状态
- 只读控制
- 保存动作
- 展示辅助函数

它不直接拉数据，也不管理与自己无关的页面状态。

### cases-tab

这个组件接收：

- Case 列表
- 当前选中 Case id
- Case 表单状态
- 创建、保存、切换动作
- 按角色推导出的能力标记

它负责承接 Case 的渲染和编辑 UI，但不拥有跨页面的弹窗状态。

### materials-tab

这个组件接收：

- 申请人文件和文件元数据
- 上传和下载动作
- 打开预览弹窗的动作
- 打开审核弹窗的动作
- 只读和自动化能力标记

它不自己实现预览解析逻辑，只负责触发专门的弹窗组件。

### progress-tab

这个组件接收已经准备好的数据，只负责渲染进度、提醒和状态时间线等内容。

### material-preview-dialog

这个组件负责最重的预览工作区：

- Excel 工作簿解析和 Sheet 切换
- Excel 单元格在线编辑
- 工作簿保存回档案
- 通过 `mammoth` 做 Word 预览
- 文本、图片、HTML 等预览模式

这样可以把最重、使用频率又不是最高的逻辑从页面壳里剥离出来。

### audit-dialog

这个组件负责：

- 审核进度状态展示
- 问题列表渲染
- 自动修复触发流程
- 审核相关辅助提示

这样可以把自动化相关的弹窗逻辑从主页面主体里分离出来。

## 数据流

拆分后的数据流应该变成：

1. `page.tsx` 校验 session，并传入 `applicantId` 和 `viewerRole`
2. `ApplicantDetailClientPage` 解析当前请求 tab
3. `useApplicantDetailController` 拉取并整理详情状态
4. 各 tab 组件只从控制器提供的数据里渲染
5. 各弹窗只接收聚焦后的状态切片和动作回调

这样可以把远程请求、副作用和共享状态集中在一个地方，同时让 UI 模块保持聚焦。

## 拆分顺序

为了降低风险，实施必须按增量方式推进。

### 第一步：抽控制器

先把拉取、刷新、权限标记和顶层变更动作迁到 `use-applicant-detail-controller.ts`，UI 暂时尽量保持原样。

先做这一步的原因：

- 视觉风险最低
- 可以立刻减少页面壳里的状态膨胀
- 能为后续 UI 拆分提供稳定接口

### 第二步：抽预览和审核弹窗

把预览、Excel 编辑、`mammoth` 解析和审核弹窗渲染迁到独立模块。

先做第二步的原因：

- 可以最快砍掉主文件里最重的逻辑
- 把最不常用但最复杂的路径单独隔离出来
- 为后续懒加载创造条件

### 第三步：抽 cases-tab

把 Case 编辑、切换和新建 UI 迁到 `cases-tab.tsx`。

第三步的原因：

- 这是第二大职责块
- 在控制器先抽出来之后，它已经具备独立成块的条件

### 第四步：抽 basic-tab 和 progress-tab

把剩余相对简单的 tab 内容拆到独立文件里，让页面壳最终退化成组合层。

最后做这一步的原因：

- 紧迫性低于预览和 Case 工作区
- 在前面边界已经稳定后，这一块最容易落地

## 行为保证

这次拆分必须保证以下行为不变：

- 路由仍然是 `/applicants/[id]`
- tab 名称和 tab 切换行为不变
- 申请人保存、删除和 Case 保存流程不变
- 文件上传、预览和下载行为不变
- Excel 在线编辑和保存回档案行为不变
- 审核弹窗和自动修复行为不变
- 老板、主管、专员、客服四种角色的权限不回退

这次的目标是先改善结构，不是改流程。

## 错误处理

拆分后仍然保持当前行为，但错误归属要更清楚：

- controller 负责请求失败和顶层用户消息
- 预览弹窗负责预览解析和预览保存失败
- 审核弹窗负责审核动作的状态切换
- 各 tab 组件尽量保持展示型，不再自行发明新的拉取层

这样可以降低重复报错和错误展示不一致的概率。

## 测试策略

实施时需要从三个层面验证：

- 单元测试：覆盖新抽出的纯函数或控制器工具函数
- 集成验证：覆盖详情页加载、Case 切换、预览打开和保存等关键路径
- 构建验证：确保拆分后路由仍能正常编译

每一步拆分至少都要保持：

- `npm run lint`
- `npm run build`

在可行的情况下，继续为控制器级逻辑或新抽出的纯辅助函数补针对性测试。

## 风险

### props 传递过多

如果控制器暴露的表面太宽，各 tab 组件可能收到很长的 props 列表。缓解方式：把共享类型放到 `detail/types.ts`，并把相关动作按对象分组。

### 隐式状态耦合

当前单体文件里有些本地状态可能依赖执行顺序。缓解方式：按增量顺序逐步抽离，每一步拆完都做验证，再继续下一步。

### 视觉抖动

大量 JSX 挪动容易无意中改坏布局。缓解方式：拆分时保持现有 markup 不变，不做顺手重设计。

## 成功标准

满足以下条件时，这份设计就算成功：

- 终端用户看到的详情页行为保持一致
- `ApplicantDetailClientPage.tsx` 从单体文件降成较小的集成壳
- 预览和审核逻辑不再堆在页面壳里
- Case 编辑 UI 不再和材料预览逻辑混在一起
- 后续性能优化可以针对更小的模块继续推进，而不是继续盯着一个 3300 行的大文件


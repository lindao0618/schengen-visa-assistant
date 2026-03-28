# Codex Continuation Notes

## 当前主线

当前已经完成一条“法签案件提醒系统”的基础链路，但还没有接真实发送渠道。

已完成：
- `VisaCase`
- `VisaCaseStatusHistory`
- `ReminderRule`
- `ReminderLog`
- 法签 `10` 节点案件状态机
- 案件状态变化时自动生成 `ReminderLog`
- 后台页面：`/admin/france-cases`
- 后台查看法签案件、异常、提醒日志
- 后台手动更新提醒日志状态：
  - `processing`
  - `sent`
  - `skipped`
  - `failed`
- “处理到期提醒”按钮
- 到期提醒的模拟发送：
  - 扫描 `pending`
  - 生成模板话术
  - 写回 `renderedContent`
  - 标记为 `sent`

未完成：
- 真实微信发送
- 真实邮件发送
- 定时任务自动扫描
- 重试机制
- 发送渠道配置页

## 关键页面与接口

- 后台页：
  - `/admin/france-cases`

- 后台接口：
  - `/api/admin/france-cases`

- 申请人法签进度接口：
  - `/api/applicants/[id]/france-case`

## 关键文件

- [france-case-machine.ts](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/lib/france-case-machine.ts)
- [france-cases.ts](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/lib/france-cases.ts)
- [france-reminder-runner.ts](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/lib/france-reminder-runner.ts)
- [france-case-labels.ts](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/lib/france-case-labels.ts)
- [france-case-progress-card.tsx](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/components/france-case-progress-card.tsx)
- [admin france-cases route](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/app/api/admin/france-cases/route.ts)
- [admin france-cases page](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/app/admin/france-cases/page.tsx)

## 下一步建议

建议顺序：

1. 做“定时处理到期提醒”的入口
2. 接真实发送渠道
3. 增加失败重试和冷却时间
4. 增加发送历史筛选和导出

## 下次怎么叫回这条线

下次可以直接对 Codex 说：

```text
继续法签案件提醒系统那条线：我们已经做完 VisaCase / ReminderLog / 后台 /admin/france-cases / 处理到期提醒的模拟发送，但还没接真实微信和邮件，请在这个基础上继续。
```

也可以再补一句：

```text
提醒你：当前项目里法签案件状态机、ReminderRule、ReminderLog、admin/france-cases 页面和 process_due_logs 模拟发送都已经做好了。
```

## 本地验证情况

最近一次确认：
- `npm run build` 通过
- `npm run lint` 通过

仍有一个旧 warning：
- [ApplicantsClientPage.tsx](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/app/applicants/ApplicantsClientPage.tsx)
  - `<img>` 的 Next lint warning

## 额外提醒

- 当前“提醒发送”还是模拟发送，不要误以为已经真的发微信或邮件。
- 真实发送接入前，先保留现在这套 `ReminderLog` 流程，不要推翻重做。
- 这个项目里单独跑 `npx tsc --noEmit` 可能会被 `.next-build/types` 干扰；更可信的是 `npm run build`。

## TLS / 服务器部署提醒

- Chrome 大版本升级后，要同步更新 `TLS_UC_CHROME_VERSION`
- Linux 服务器上，`UC Chrome` 用纯 `headless` 过 Cloudflare 的成功率可能比有界面低
- 如果服务器上经常卡 Cloudflare，优先考虑：
  - `headless=false`
  - 配 `Xvfb` 模拟显示器
- `TLS_HEADLESS` 只影响 `UC Chrome` 那段过 Cloudflare 的逻辑
- `TLS_HEADLESS` 不影响 Playwright 主流程本身

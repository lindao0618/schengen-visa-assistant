# Hotel Booking 支付页人工接手说明

## 功能位置
- 前端页面：[/hotel-booking](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/app/hotel-booking/page.tsx)
- 表单组件：[HotelBookingForm.tsx](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/app/hotel-booking/HotelBookingForm.tsx)
- 后端接口：[/api/hotel-booking/book](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/app/api/hotel-booking/book/route.ts)
- 自动化脚本：[booking_auto.py](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/services/hotel-booking/booking_auto.py)

## 当前行为
- 流程会自动完成：
  - Booking.com 登录
  - 搜索酒店
  - 选择酒店和房型
  - 填写入住人信息
  - 点击 `Next: Final details`
- 到达支付页后，如果表单里开启了 `到支付页先暂停（推荐）`：
  - 会保存支付页截图、HTML、字段清单和会话状态
  - 任务会标记为成功暂停
  - 当前实现是“逻辑暂停”，不是“浏览器保持打开”
  - 也就是脚本执行结束后，浏览器会关闭

## 停在哪里
- 当前暂停点：`Booking.com 支付页`
- 典型 URL 形态：
  - `https://secure.booking.com/book.html?...selected_currency=GBP&lang=en-gb...`
- 停止前会保存这些页面现场：
  - 支付页截图
  - 支付页 HTML
  - 支付页字段清单 JSON
  - 会话状态 JSON

## 文件保存在哪里

### 通过网页/API 正常发起任务
- 每次任务会保存在：
  - `temp/hotel-booking/hotel-<task_id>/`

常见文件结构：

```text
temp/hotel-booking/hotel-<task_id>/
├─ booking_job.json
├─ booking_results.json
├─ payment_handoff.json
├─ payment_storage_state.json
├─ runner_stdout.log
├─ runner_stderr.log
└─ artifacts/
   ├─ 12_guest_form.png
   ├─ 12_guest_form.html
   ├─ 13_guest_form_filled.png
   ├─ 13_guest_form_filled.html
   ├─ 14_before_next.png
   ├─ 14_before_next.html
   ├─ 14_payment_stage2.png
   ├─ 14_payment_stage2.html
   ├─ 14_before_payment_pause.png
   ├─ 14_before_payment_pause.html
   └─ 14_payment_fields.json
```

### 当前本地测试案例
- 我最近一次测试输出在：
  - [test-run](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/temp/hotel-booking/test-run)

关键文件：
- [booking_results.json](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/temp/hotel-booking/test-run/booking_results.json)
- [payment_handoff.json](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/temp/hotel-booking/test-run/payment_handoff.json)
- [payment_storage_state.json](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/temp/hotel-booking/test-run/payment_storage_state.json)
- [14_before_payment_pause.png](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/temp/hotel-booking/test-run/artifacts/14_before_payment_pause.png)
- [14_before_payment_pause.html](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/temp/hotel-booking/test-run/artifacts/14_before_payment_pause.html)
- [14_payment_fields.json](d:/Ai-user/schengen-visa-assistant%20(2)/visa-assistant/temp/hotel-booking/test-run/artifacts/14_payment_fields.json)

## 每个文件是干什么的
- `booking_results.json`
  - 任务结果总文件
  - 里面会有：
    - `success`
    - `paused_before_payment`
    - `payment_handoff_ready`
    - `payment_url`
- `payment_handoff.json`
  - 人工接手包的总说明
  - 包含：
    - 当前支付页 URL
    - 酒店、城市、入住人等元数据
    - 相关文件路径索引
- `payment_storage_state.json`
  - Playwright 会话状态
  - 里面含有 cookie / session
  - 这是敏感文件，不建议外发
- `14_before_payment_pause.png`
  - 到支付页后的整页截图
- `14_before_payment_pause.html`
  - 到支付页后的原始 HTML
- `14_payment_fields.json`
  - 支付页主页面和 iframe 里的可见字段清单
  - 适合后续分析银行卡输入框、账单地址输入框、按钮位置

## 如何自己查看
1. 先看 `booking_results.json`
   - 确认：
     - `success = true`
     - `paused_before_payment = true`
2. 再看 `14_before_payment_pause.png`
   - 先确认是不是已经到你想要的支付页
3. 再开 `14_before_payment_pause.html`
   - 如果要分析字段结构，用这个最直观
4. 最后看 `14_payment_fields.json`
   - 这里能快速知道：
     - 哪些输入框在主页面
     - 哪些输入框在 iframe
     - 它们的 `name / id / placeholder / aria-label`

## 当前限制
- 现在是“保存现场后结束任务”，不是“浏览器保持打开”
- 所以你不能直接在原浏览器窗口里继续填卡
- 如果后面需要真正人工接管，有两个方向：
  - 方案 A：到支付页后浏览器保持打开一段时间
  - 方案 B：用 `payment_storage_state.json` 恢复会话，再重新打开支付页

## 安全提醒
- 不要把真实银行卡号、CVV、有效期发到聊天里
- `payment_storage_state.json` 包含登录会话，应该按敏感文件处理
- 如果要给别人看页面结构，优先发：
  - `14_before_payment_pause.png`
  - `14_before_payment_pause.html`
  - `14_payment_fields.json`
- 不建议外发：
  - `payment_storage_state.json`

## 目前测试状态
- 最近一次本地测试结果：
  - `success: true`
  - `paused_before_payment: true`
  - `payment_handoff_ready: true`
- 已验证：
  - 登录为 `English (UK)`
  - 页面货币为 `GBP`
  - 已完成入住人信息填写
  - 已进入支付页并保存现场

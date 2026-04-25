# TLS/Cloudflare 交接记录（2026-04-10）

本文档用于把当前「法签 TLS 账户注册」排障状态交接给其他同事。

## 1) 当前问题结论

- `TLS 账户注册` 当前主要失败点是 **Cloudflare challenge**（`Attention Required / Just a moment`）。
- 系统已经在跑 **UC (undetected-chromedriver) + 自动重启重试**，不是未启用 UC。
- 最近日志显示：
  - UC 有时能拿到 `cf_clearance`（部分通过）
  - 但注入 Playwright 后又被二次 challenge，最终失败。
- 在「无代理」条件下，本地与服务器都可复现该问题，说明核心瓶颈偏向 **IP/网络信誉**。

## 2) 已完成的关键修复

### A. 后端链路修复（Node API）

- 文件：`app/api/schengen/france/tls-register/route.ts`
  - 修复 `run_results.json` 缺失时报错展示，避免误导性的 `ENOENT` 主错误。
  - `results_path/artifacts_path/accounts_path` 改为绝对路径写入 job。
  - TLS 脚本路径支持配置并带 fallback：
    - `TLS_REGISTER_SCRIPT_PATH` / `TLS_REGISTER_SCRIPT`
    - fallback: `/opt/visa-assistant/tls_auto/tls_auto_register.py`
  - 若脚本不存在，直接给出清晰错误（不再静默失败）。
  - 启动 Python 时支持 `xvfb-run`（Linux 默认启用，除非 `TLS_USE_XVFB=false`）。
  - `headless` 默认逻辑改为按 Xvfb 场景自动推导。

- 文件：`app/api/schengen/france/tls-apply/route.ts`
  - 同步了脚本路径 fallback 与清晰错误。
  - 同步了 `xvfb-run` 启动策略。
  - 不再默认强制 `browser_channel: "chrome"`；改为仅在环境变量配置时传入。
  - 错误详情优先展示真实 stderr，不再优先 `ENOENT`。

- 文件：`app/api/schengen/france/extract-register/route.ts`
  - `python` 调用改为统一 `getPythonRuntimeCommand()`，避免跑到错误 Python 环境。
  - 注册阶段失败判定增强：即便脚本返回 `success=true`，只要 `fail_count>0 && success_count=0` 也按失败处理，并展示更具体错误。

### B. 法签 Python 配置修复

- 文件：`services/french-visa/config.py`
  - `CAPTCHA_API_KEY` 兼容增加 `TWOCAPTCHA_API_KEY`。

### C. 服务器运行环境修复

- 已安装：
  - `google-chrome-stable`
  - `xvfb`
  - Python 包：`selenium`, `playwright-stealth`, `undetected-chromedriver`
- 已上传脚本到服务器：
  - `/opt/visa-assistant/tls_auto/tls_auto_register.py`
  - `/opt/visa-assistant/tls_auto/tls_apply.py`

## 3) UC 是否真的在运行（结论：是）

最近任务日志中可见 UC 运行痕迹：

- `Launching UC Chrome to pass Cloudflare ...`
- `CF passed after ...`
- `Extracted ... cookies (CF-related: ['__cf_bm', 'cf_clearance'])`
- `CF gate not cleared, restarting browser (1/3)...`

因此当前不是“没走 UC”，而是“UC->Playwright 接管后稳定性不足 + 无代理网络信誉不足”。

## 4) 本地验证结果（最新）

本地运行：

- 命令：`python tls_auto_register.py --job job.example.json`
- 结果：UC 触发并重试 3 次，但全部 `CF did not clear within 30s`，最终 `browser_restart` 失败。

结论：在当前无代理环境下，本地也无法稳定通过 CF，不建议按当前配置继续盲目上线尝试。

## 5) 当前推荐策略（下一步）

### 推荐优先级

1. 使用 **方案 A**：`UC + Xvfb 有头 + 英国住宅代理（sticky）`
2. 调大 UC 过 CF 等待窗口（从 30s 提升到 60-90s，可配置化）
3. 保留并增强“UC cookies 注入后多轮稳定化重试”

### 建议补充环境变量

- `TLS_PROXY`（英国住宅代理，建议 sticky session）
- `TLS_UC_CHROME_VERSION`（与服务器 Chrome 主版本一致）
- `TLS_USE_XVFB=true`
- `TLS_HEADLESS` 可留空（当前逻辑会按 Xvfb 自动推导）
- 如需强制浏览器 channel，再设置 `TLS_BROWSER_CHANNEL=chrome`

## 6) 关键任务样本（便于复盘）

- `fv-1775813575828-c1c6uhx`
  - 表现：UC 部分过 CF（拿到 `cf_clearance`），但接管后仍被 challenge，最终失败。
- `fv-1775810212646-eu0kblx`
  - 表现：UC 二进制/连接异常历史样本（已用于修复环境）。

## 7) 注意事项

- 目前脚本与链路已具备重试、日志、截图和下载调试文件能力。
- 若继续失败，优先抓这三个文件：
  - `runner_stdout.log`
  - `runner_stderr.log`
  - `run_results.json`
- 先看 `stdout` 中 UC/CF 时序日志，再判断是网络问题还是脚本逻辑问题。


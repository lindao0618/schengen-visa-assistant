"""
Booking.com 自动预约酒店脚本

用法:
    python booking_auto.py --job <job_config.json>

job_config.json 格式:
{
  "booking_email": "user@example.com",
  "booking_password": "password",
  "city": "Paris",
  "checkin_date": "2026-04-15",
  "checkout_date": "2026-04-18",
  "adults": 1,
  "rooms": 1,
  "guest_first_name": "John",
  "guest_last_name": "Doe",
  "guest_email": "john@example.com",
  "credit_card_number": "4111111111111111",
  "credit_card_expiry_month": "12",
  "credit_card_expiry_year": "2028",
  "credit_card_cvv": "123",
  "credit_card_holder": "John Doe",
  "filter_no_prepayment": true,
  "sort_by": "price",
  "max_price_per_night": null,
  "headless": false,
  "proxy": "",
  "slow_mo_ms": 500,
  "navigation_timeout_ms": 60000,
  "results_path": "booking_results.json",
  "artifacts_dir": "artifacts"
}
"""

import argparse
import email as email_lib
import imaplib
import json
import os
import re
import sys
import time
import traceback
from datetime import datetime, timezone, timedelta
from pathlib import Path


def log(msg: str):
    """输出日志（stdout flush）"""
    print(msg, flush=True)


def progress(pct: int, msg: str):
    """输出进度，格式为 PROGRESS:XX:message"""
    print(f"PROGRESS:{pct}:{msg}", flush=True)


def save_results(results_path: str, data: dict):
    try:
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log(f"[WARN] 保存结果文件失败: {e}")


def load_job(job_path: str) -> dict:
    with open(job_path, "r", encoding="utf-8") as f:
        return json.load(f)


def take_screenshot(page, artifacts_dir: str, name: str):
    try:
        os.makedirs(artifacts_dir, exist_ok=True)
        path = os.path.join(artifacts_dir, name)
        page.screenshot(path=path, full_page=False)
        log(f"[screenshot] {name}")
    except Exception as e:
        log(f"[WARN] 截图失败 {name}: {e}")


def save_html(page, artifacts_dir: str, name: str):
    try:
        os.makedirs(artifacts_dir, exist_ok=True)
        path = os.path.join(artifacts_dir, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(page.content())
        log(f"[html] {name}")
    except Exception as e:
        log(f"[WARN] 保存 HTML 失败 {name}: {e}")


def save_json(output_dir: str, name: str, data: dict | list):
    try:
        os.makedirs(output_dir, exist_ok=True)
        path = os.path.join(output_dir, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        log(f"[json] {name}")
    except Exception as e:
        log(f"[WARN] 淇濆瓨 JSON 澶辫触 {name}: {e}")


def snapshot_visible_form_fields(frame, frame_label: str) -> dict:
    try:
        fields = frame.evaluate(
            """(label) => {
                const isVisible = (el) => {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return style.visibility !== "hidden" &&
                        style.display !== "none" &&
                        rect.width > 0 &&
                        rect.height > 0;
                };

                const readNodes = (selector, kind) => Array.from(document.querySelectorAll(selector))
                    .filter(isVisible)
                    .map((el, index) => ({
                        kind,
                        index,
                        tag: el.tagName.toLowerCase(),
                        type: el.getAttribute("type") || "",
                        name: el.getAttribute("name") || "",
                        id: el.id || "",
                        placeholder: el.getAttribute("placeholder") || "",
                        ariaLabel: el.getAttribute("aria-label") || "",
                        autocomplete: el.getAttribute("autocomplete") || "",
                        value: kind === "button" ? "" : ((el.value ?? "") + "").slice(0, 200),
                        checked: typeof el.checked === "boolean" ? el.checked : null,
                        disabled: !!el.disabled,
                        readOnly: !!el.readOnly,
                        required: !!el.required,
                        text: (kind === "button" ? (el.innerText || el.textContent || "") : "").trim().slice(0, 200),
                        options: el.tagName.toLowerCase() === "select"
                            ? Array.from(el.options || []).map((opt) => ({
                                value: opt.value,
                                text: (opt.text || "").trim().slice(0, 120),
                                selected: !!opt.selected,
                            }))
                            : [],
                    }));

                return {
                    frameLabel: label,
                    title: document.title || "",
                    url: location.href,
                    inputs: readNodes("input, textarea, select", "field"),
                    buttons: readNodes("button, [role='button']", "button"),
                };
            }""",
            frame_label,
        )
        return fields
    except Exception as e:
        return {
            "frameLabel": frame_label,
            "error": str(e),
            "inputs": [],
            "buttons": [],
        }


def capture_payment_handoff(page, context, output_dir: str, artifacts_dir: str, meta: dict | None = None):
    handoff_meta = dict(meta or {})
    handoff_meta.update(
        {
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "paymentUrl": page.url,
        }
    )

    frame_snapshots = []
    try:
        frame_snapshots.append(snapshot_visible_form_fields(page.main_frame, "main"))
    except Exception as e:
        frame_snapshots.append({"frameLabel": "main", "error": str(e), "inputs": [], "buttons": []})

    try:
        for index, frame in enumerate(page.frames):
            if frame == page.main_frame:
                continue
            snapshot = snapshot_visible_form_fields(frame, f"frame_{index}")
            try:
                snapshot["frameUrl"] = frame.url
            except Exception:
                pass
            frame_snapshots.append(snapshot)
    except Exception as e:
        frame_snapshots.append({"frameLabel": "frames", "error": str(e), "inputs": [], "buttons": []})

    save_json(artifacts_dir, "14_payment_fields.json", frame_snapshots)

    handoff_meta["artifacts"] = {
        "paymentFields": "artifacts/14_payment_fields.json",
        "paymentPauseScreenshot": "artifacts/14_before_payment_pause.png",
        "paymentPauseHtml": "artifacts/14_before_payment_pause.html",
    }

    try:
        state_path = os.path.join(output_dir, "payment_storage_state.json")
        context.storage_state(path=state_path)
        handoff_meta["storageStateFile"] = "payment_storage_state.json"
    except Exception as e:
        handoff_meta["storageStateError"] = str(e)

    save_json(output_dir, "payment_handoff.json", handoff_meta)


def _imap_connect(server: str, port: int, username: str, password: str) -> imaplib.IMAP4_SSL:
    """建立 IMAP 连接并登录，自动选中收件箱（兼容 126/163/QQ 等）"""
    mail = imaplib.IMAP4_SSL(server, port)
    mail.login(username, password)

    # 尝试常见收件箱名称
    inbox_candidates = ["INBOX", "Inbox", "inbox"]
    selected = False
    for name in inbox_candidates:
        status, _ = mail.select(name)
        if status == "OK":
            log(f"[imap] 已选中收件箱: {name}")
            selected = True
            break

    if not selected:
        # 列出所有可用文件夹，选第一个
        _, folders = mail.list()
        log(f"[imap] 可用文件夹: {folders}")
        for folder_line in folders or []:
            folder_str = folder_line.decode() if isinstance(folder_line, bytes) else str(folder_line)
            # 取最后一段引号或空格后的名称
            parts = folder_str.split('"')
            folder_name = parts[-2] if len(parts) >= 2 else folder_str.split()[-1]
            status, _ = mail.select(folder_name)
            if status == "OK":
                log(f"[imap] 已选中文件夹: {folder_name}")
                selected = True
                break

    if not selected:
        raise RuntimeError("IMAP 无法选中任何收件箱文件夹，请检查账号权限")

    return mail


def _extract_text_from_msg(msg) -> str:
    """从 email.message 对象提取纯文本+HTML正文"""
    body_parts = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype in ("text/plain", "text/html"):
                charset = part.get_content_charset() or "utf-8"
                try:
                    body_parts.append(part.get_payload(decode=True).decode(charset, errors="replace"))
                except Exception:
                    pass
    else:
        charset = msg.get_content_charset() or "utf-8"
        try:
            body_parts.append(msg.get_payload(decode=True).decode(charset, errors="replace"))
        except Exception:
            pass
    return "\n".join(body_parts)


def _extract_booking_code(full_body: str) -> str | None:
    """
    从邮件正文提取 Booking.com 验证码。
    格式：6~7 位大写字母+数字混合，如 EYUUP7。
    """
    patterns = [
        # 单独成行的 6~7 位大写字母数字（最准确）
        r"(?m)^\s*([A-Z0-9]{6,7})\s*$",
        # "code" 前后的 6~7 位
        r"code[^A-Z0-9]{0,30}([A-Z0-9]{6,7})",
        r"([A-Z0-9]{6,7})[^A-Z0-9]{0,10}code",
        # sign in 相关
        r"sign.{0,20}in[^A-Z0-9]{0,30}([A-Z0-9]{6,7})",
        # 任意位置独立 6 位（fallback）
        r"(?<![A-Z0-9])([A-Z0-9]{6})(?![A-Z0-9])",
    ]
    for pat in patterns:
        m = re.search(pat, full_body, re.IGNORECASE | re.MULTILINE)
        if m:
            return m.group(1).upper()
    return None


def fetch_verification_code_from_imap(
    imap_server: str,
    imap_port: int,
    username: str,
    password: str,
    sender_filter: str = "booking.com",
    max_wait_sec: int = 90,
    poll_interval_sec: int = 4,
    after_dt: datetime | None = None,
) -> str:
    """
    连接 IMAP，轮询最新邮件，从 Booking.com 验证邮件中提取验证码。
    返回验证码（如 EYUUP7），超时则抛出 RuntimeError。
    """
    log(f"[imap] 连接 {imap_server}:{imap_port} 等待验证码邮件...")
    deadline = time.time() + max_wait_sec
    # 只接受在此时间之后收到的邮件（默认：当前时间前60秒）
    cutoff_dt = after_dt or (datetime.now(timezone.utc) - timedelta(seconds=60))
    if cutoff_dt.tzinfo is None:
        cutoff_dt = cutoff_dt.replace(tzinfo=timezone.utc)
    since_str = cutoff_dt.strftime("%d-%b-%Y")
    log(f"[imap] 只接受 {cutoff_dt.strftime('%H:%M:%S UTC')} 之后的邮件")

    # 先打印诊断信息
    try:
        diag_mail = _imap_connect(imap_server, imap_port, username, password)
        log(f"[imap] 登录成功，开始轮询...")
        diag_mail.logout()
    except Exception as e:
        raise RuntimeError(f"IMAP 连接/登录失败: {e}")

    while time.time() < deadline:
        try:
            mail = _imap_connect(imap_server, imap_port, username, password)

            # 先不限制发件人，搜索最近邮件（部分服务商 FROM 搜索不稳定）
            status, data = mail.search(None, f'SINCE "{since_str}"')

            if status != "OK" or not data or not data[0]:
                mail.logout()
                log(f"[imap] 未找到新邮件，{poll_interval_sec}s 后重试...")
                time.sleep(poll_interval_sec)
                continue

            ids = data[0].split()
            log(f"[imap] 找到 {len(ids)} 封邮件，从最新开始扫描...")

            found_code = None
            for msg_id in reversed(ids[-15:]):
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                if not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = email_lib.message_from_bytes(raw)

                # 检查发件人是否来自 booking.com
                from_addr = str(msg.get("From", "")).lower()
                subject = str(msg.get("Subject", "")).lower()
                date_str = str(msg.get("Date", ""))

                # 解析邮件时间，过滤掉登录请求发出前的旧邮件
                mail_dt = None
                try:
                    from email.utils import parsedate_to_datetime
                    mail_dt = parsedate_to_datetime(date_str)
                    if mail_dt.tzinfo is None:
                        mail_dt = mail_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    pass

                log(f"[imap] 检查邮件 time={date_str!r} from={from_addr!r} subject={subject!r}")

                # 跳过登录前的旧邮件
                if mail_dt and mail_dt < cutoff_dt:
                    log(f"[imap] 跳过旧邮件（{mail_dt.strftime('%H:%M:%S UTC')} < cutoff {cutoff_dt.strftime('%H:%M:%S UTC')}）")
                    continue

                if sender_filter.lower() not in from_addr and sender_filter.lower() not in subject:
                    continue

                full_body = _extract_text_from_msg(msg)
                code = _extract_booking_code(full_body)
                if code:
                    log(f"[imap] 找到验证码: {code}（来自: {from_addr}，时间: {date_str}）")
                    found_code = code
                    break

            mail.logout()

            if found_code:
                return found_code

        except imaplib.IMAP4.error as e:
            log(f"[imap] IMAP 错误: {e}，{poll_interval_sec}s 后重试...")
        except Exception as e:
            log(f"[imap] 未知错误: {e}，{poll_interval_sec}s 后重试...")

        log(f"[imap] 未提取到验证码，{poll_interval_sec}s 后重试（剩余 {int(deadline - time.time())}s）...")
        time.sleep(poll_interval_sec)

    raise RuntimeError(f"等待验证码超时（{max_wait_sec}s），请检查 IMAP 配置或手动查收邮件")


def dismiss_cookie_banner(page):
    """尝试关闭 Cookie 授权弹窗"""
    try:
        # 常见的 accept/dismiss 按钮
        selectors = [
            '[id*="onetrust-accept"]',
            'button[id*="accept"]',
            'button:has-text("Accept")',
            'button:has-text("接受")',
            '[data-testid="accept-button"]',
            '#didomi-notice-agree-button',
        ]
        for sel in selectors:
            btn = page.query_selector(sel)
            if btn and btn.is_visible():
                btn.click()
                page.wait_for_timeout(800)
                log("[cookie] 关闭 cookie 弹窗")
                return
    except Exception:
        pass


def dismiss_signin_modal(page):
    """尝试关闭登录邀请弹窗"""
    try:
        selectors = [
            '[aria-label="Dismiss sign-in info."]',
            'button[aria-label*="ismiss"]',
            '[data-testid="header-sign-in-prompt-close"]',
            'button:has-text("No thanks")',
            'button:has-text("Close")',
        ]
        for sel in selectors:
            btn = page.query_selector(sel)
            if btn and btn.is_visible():
                btn.click()
                page.wait_for_timeout(500)
                log("[modal] 关闭登录邀请弹窗")
                return
    except Exception:
        pass


def click_first_visible(page, selectors: list[str], *, timeout_ms: int = 2000) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=timeout_ms):
                loc.click()
                return True
        except Exception:
            continue
    return False


def select_preferred_option(page, selectors: list[str], preferred_values: list[str]) -> bool:
    normalized = [value.lower() for value in preferred_values]
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if not loc.is_visible(timeout=1500):
                continue
            options = loc.locator("option")
            count = options.count()
            for i in range(count):
                option = options.nth(i)
                value = (option.get_attribute("value") or "").strip()
                label = (option.inner_text() or "").strip()
                candidates = {value.lower(), label.lower()}
                if candidates & set(normalized):
                    loc.select_option(value=value)
                    return True
        except Exception:
            continue
    return False


def login(page, email: str, password: str, artifacts_dir: str, imap_cfg: dict | None = None):
    """
    登录 Booking.com。
    实际流程：输入邮箱 → 点继续 → Booking 发验证码邮件 → 填验证码 → 完成
    （无密码步骤，password 参数保留但不使用）
    imap_cfg: { server, port, username, password, max_wait_sec }
    """
    if not imap_cfg:
        raise RuntimeError(
            "Booking.com 使用无密码登录，必须配置 IMAP 邮箱以自动接收验证码。\n"
            "请在 job config 中添加：\n"
            '  "imap_server": "imap.126.com",\n'
            '  "imap_port": 993,\n'
            '  "imap_username": "yourname@126.com",\n'
            '  "imap_password": "邮箱IMAP授权码"\n'
        )

    progress(10, "正在打开 Booking.com 登录页...")
    page.goto("https://account.booking.com/sign-in?lang=en-gb", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    dismiss_cookie_banner(page)
    take_screenshot(page, artifacts_dir, "01_login_page.png")

    progress(15, "输入邮箱...")
    email_input = page.wait_for_selector(
        'input[type="email"], input[name="username"], input[name="email"]',
        timeout=15000
    )
    email_input.fill(email)
    page.wait_for_timeout(500)
    take_screenshot(page, artifacts_dir, "02_email_entered.png")

    # 记录点击登录的时间，IMAP 只取这之后到达的邮件
    login_submitted_at = datetime.now(timezone.utc)

    # 点击「继续」，Booking 会发验证码邮件
    continue_btn = page.query_selector(
        'button[type="submit"], button:has-text("Continue"), button:has-text("继续")'
    )
    if continue_btn:
        continue_btn.click()
    else:
        email_input.press("Enter")

    progress(18, "已提交邮箱，等待 Booking.com 发送验证码邮件...")
    page.wait_for_timeout(2000)
    take_screenshot(page, artifacts_dir, "03_after_email_submit.png")

    # 等待验证码输入框出现（Booking.com 有时还有中间页）
    otp_input_sel = (
        'input[name="otp"], '
        'input[name="code"], '
        'input[name="verification_code"], '
        'input[autocomplete="one-time-code"], '
        'input[placeholder*="code" i], '
        'input[placeholder*="verification" i], '
        'input[maxlength="6"], '
        'input[maxlength="7"]'
    )
    try:
        page.wait_for_selector(otp_input_sel, timeout=15000)
    except Exception:
        take_screenshot(page, artifacts_dir, "03b_no_otp_input.png")
        raise RuntimeError(
            "未在页面找到验证码输入框，Booking.com 页面可能有变化，请查看截图 03b_no_otp_input.png"
        )

    take_screenshot(page, artifacts_dir, "04_otp_input_found.png")
    log(f"[verify] 验证码输入框已出现，URL: {page.url}")

    # 从 IMAP 收取验证码（只取登录请求发出之后到达的邮件）
    progress(22, "正在从邮箱自动获取验证码...")
    code = fetch_verification_code_from_imap(
        imap_server=imap_cfg["server"],
        imap_port=int(imap_cfg.get("port", 993)),
        username=imap_cfg["username"],
        password=imap_cfg["password"],
        sender_filter=imap_cfg.get("sender_filter", "booking.com"),
        max_wait_sec=int(imap_cfg.get("max_wait_sec", 90)),
        after_dt=login_submitted_at,
    )

    # 填入验证码
    otp_input = page.query_selector(otp_input_sel)
    if not otp_input:
        raise RuntimeError("填写时找不到验证码输入框")
    otp_input.click()
    otp_input.fill(code)
    page.wait_for_timeout(500)
    take_screenshot(page, artifacts_dir, "05_otp_filled.png")
    log(f"[verify] 已填入验证码: {code}")

    # 点击确认
    confirm_btn = page.query_selector(
        'button[type="submit"], '
        'button:has-text("Sign in"), '
        'button:has-text("Verify"), '
        'button:has-text("Confirm"), '
        'button:has-text("Continue")'
    )
    if confirm_btn:
        confirm_btn.click()
    else:
        otp_input.press("Enter")

    page.wait_for_timeout(3000)
    take_screenshot(page, artifacts_dir, "06_after_otp_submit.png")

    current_url = page.url
    log(f"[login] 登录后 URL: {current_url}")
    if "sign-in" in current_url or "login" in current_url or "authenticate" in current_url:
        err = page.query_selector('[data-testid="error-message"], .bui-alert--error, [role="alert"]')
        if err:
            raise RuntimeError(f"登录失败：{err.inner_text().strip()[:200]}")
        raise RuntimeError("登录失败：页面未跳转，请检查验证码或查看截图排查")

    progress(28, "登录成功！")
    log("[login] 登录成功")


def search_hotels(page, city: str, checkin_date: str, checkout_date: str,
                  adults: int, rooms: int, artifacts_dir: str):
    """
    直接用 URL 参数搜索酒店，完全绕过日历交互。
    支持任意日期范围，不受当前可见月份限制。
    """
    progress(30, f"正在搜索 {city} 的酒店（{checkin_date} ~ {checkout_date}）...")

    import urllib.parse
    search_url = (
        "https://www.booking.com/searchresults.en-gb.html?"
        + urllib.parse.urlencode({
            "ss": city,
            "checkin": checkin_date,
            "checkout": checkout_date,
            "group_adults": adults,
            "no_rooms": rooms,
            "group_children": 0,
            "lang": "en-gb",
            "selected_currency": "GBP",
        })
    )
    log(f"[search] 搜索 URL: {search_url}")
    page.goto(search_url, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    dismiss_cookie_banner(page)
    dismiss_signin_modal(page)
    take_screenshot(page, artifacts_dir, "07_search_results.png")
    log(f"[search] 搜索结果页 URL: {page.url}")


def apply_no_prepayment_filter(page, artifacts_dir: str):
    """优先勾选 Free cancellation，再尝试 No prepayment 筛选"""
    progress(42, "应用「免费取消」筛选...")
    try:
        # 先勾 Free cancellation（Popular filters 区域）
        free_cancel_sels = [
            'label:has-text("Free cancellation")',
            'input[name="fcancellation"]',
            '[data-testid="filters-group-label-content"]:has-text("Free cancellation")',
            'span:has-text("Free cancellation")',
        ]
        found = False
        for sel in free_cancel_sels:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000):
                    el.click()
                    page.wait_for_timeout(2000)
                    log(f"[filter] 已勾选 Free cancellation: {sel}")
                    found = True
                    break
            except Exception:
                continue
        if not found:
            log("[WARN] 未找到 Free cancellation 筛选器")

        # 再尝试 No prepayment
        no_prepay_sels = [
            'label:has-text("No prepayment needed")',
            'label:has-text("Book without credit card")',
            'input[name="noprepay"]',
        ]
        for sel in no_prepay_sels:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=1500):
                    el.click()
                    page.wait_for_timeout(1500)
                    log(f"[filter] 已勾选 No prepayment: {sel}")
                    break
            except Exception:
                continue
    except Exception as e:
        log(f"[WARN] 应用筛选器出错: {e}")

    take_screenshot(page, artifacts_dir, "08_filtered_results.png")


def select_hotel(page, max_price: float | None, artifacts_dir: str) -> str:
    """选择第一个合适的酒店，返回酒店名称"""
    progress(48, "选择酒店...")
    try:
        # 等待搜索结果加载
        hotel_cards = page.query_selector_all(
            '[data-testid="property-card"], '
            '[data-testid="accommodation-card"]'
        )
        if not hotel_cards:
            raise RuntimeError("搜索结果为空，请检查日期和城市是否正确")

        # 关闭可能遮挡的浮层（日期选择器、弹窗等）
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except Exception:
            pass

        # 选第一个（或价格<=max_price的第一个）
        selected = None
        for card in hotel_cards[:5]:
            if max_price is not None:
                try:
                    price_el = card.query_selector('[data-testid="price-and-discounted-price"], .bui-price-display__value')
                    if price_el:
                        price_text = price_el.inner_text().replace(",", "").replace("¥", "").replace("€", "").replace("£", "").replace("$", "").strip()
                        nums = re.findall(r"[\d.]+", price_text)
                        if nums and float(nums[0]) > max_price:
                            continue
                except Exception:
                    pass
            selected = card
            break

        if not selected:
            selected = hotel_cards[0]

        # 获取酒店名称
        name_el = selected.query_selector('[data-testid="title"], .sr-hotel__name, h3')
        hotel_name = name_el.inner_text().strip() if name_el else "未知酒店"
        log(f"[hotel] 选择酒店: {hotel_name}")

        # 用 JS 直接触发点击，绕过浮层遮挡
        link = selected.query_selector('a[data-testid="title-link"], a[href*="/hotel/"]')
        if link:
            try:
                page.evaluate("el => el.click()", link)
            except Exception:
                link.click(force=True)
        else:
            try:
                page.evaluate("el => el.click()", selected)
            except Exception:
                selected.click(force=True)

        page.wait_for_load_state("networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        take_screenshot(page, artifacts_dir, "09_hotel_detail.png")
        return hotel_name
    except Exception as e:
        raise RuntimeError(f"选择酒店失败: {e}")


def select_room_and_reserve(page, filter_no_prepayment: bool, artifacts_dir: str):
    """选择房间并点击预定，返回跳转后的页面对象"""
    progress(56, "选择房间...")
    try:
        # 切换到最新标签页（酒店详情页可能在新标签中打开）
        all_pages = page.context.pages
        if len(all_pages) > 1:
            page = all_pages[-1]
            page.bring_to_front()
            page.wait_for_load_state("domcontentloaded", timeout=20000)
            page.wait_for_timeout(1500)

        log(f"[room] 当前页面 URL: {page.url}")
        take_screenshot(page, artifacts_dir, "10_room_selection.png")
        # 保存房间选择页 HTML 方便排查
        try:
            with open(f"{artifacts_dir}/10_room_selection.html", "w", encoding="utf-8") as f:
                f.write(page.content())
        except Exception:
            pass

        reserve_btn = None

        if filter_no_prepayment:
            rows = page.query_selector_all('tr.hprt-table-cell-roomtype, tr[class*="roomrow"], tr[data-block="main_options_table_row"]')
            for row in rows:
                row_text = (row.inner_text() or "").lower()
                if "no prepayment" in row_text or "free cancellation" in row_text or "pay at" in row_text:
                    btn = row.query_selector(
                        'a.roomrow__link, button[data-testid="select-room-button"], '
                        '[data-testid="reservation-button"], a[data-testid="availability-cta-btn"]'
                    )
                    if btn:
                        reserve_btn = btn
                        log("[room] 找到无需预付款房型的预订按钮")
                        break

        if not reserve_btn:
            reserve_btn = page.query_selector(
                'a.roomrow__link, '
                'button[data-testid="select-room-button"], '
                'a[data-testid="availability-cta-btn"], '
                '[data-testid="reservation-button"], '
                'button:has-text("Reserve"), '
                "button:has-text(\"I'll reserve\"), "
                'a:has-text("Reserve")'
            )

        if not reserve_btn:
            raise RuntimeError("未找到预订按钮，该酒店可能已满房或界面有变化")

        log(f"[room] 点击预订按钮（当前 URL: {page.url}）...")
        url_before = page.url

        # 尝试监听新标签页（有些酒店在新 tab 打开填表页）
        new_page = None
        try:
            with page.context.expect_page(timeout=5000) as new_page_info:
                page.evaluate("el => el.click()", reserve_btn)
            new_page = new_page_info.value
            new_page.wait_for_load_state("domcontentloaded", timeout=30000)
            new_page.bring_to_front()
            log(f"[room] 跳转到新标签页: {new_page.url}")
            page = new_page
        except Exception:
            # 没有新标签页，等当前页跳转
            log("[room] 无新标签页，等待当前页跳转...")
            page.evaluate("el => el.click()", reserve_btn)
            try:
                page.wait_for_url(lambda url: url != url_before, timeout=15000)
            except Exception:
                pass
            page.wait_for_load_state("domcontentloaded", timeout=20000)

        page.wait_for_timeout(2000)
        log(f"[room] 预订后 URL: {page.url}")
        take_screenshot(page, artifacts_dir, "11_after_reserve_click.png")
        try:
            with open(f"{artifacts_dir}/11_after_reserve.html", "w", encoding="utf-8") as f:
                f.write(page.content())
        except Exception:
            pass

        return page
    except Exception as e:
        take_screenshot(page, artifacts_dir, "11_reserve_error.png")
        raise RuntimeError(f"选择房间失败: {e}")


def fill_guest_details(page, first_name: str, last_name: str, email: str, artifacts_dir: str,
                        address1: str = "", city_addr: str = "", zip_code: str = "",
                        country_code: str = "cn", phone_country_code: str = "86",
                        phone_number: str = "", travel_purpose: str = "leisure"):
    """Fill in guest details. country_code: ISO 2-letter, e.g. cn/gb/us. phone_country_code: e.g. 86/44/1."""
    progress(65, "填写入住人信息...")
    try:
        log(f"[guest] 当前页面 URL: {page.url}")

        full_name = f"{first_name} {last_name}".strip()

        # ── 步骤1: 点开 "Add main guest details" 弹窗，填合并姓名后 Save ──
        detail_trigger_selectors = [
            'a:has-text("Add main guest details")',
            'button:has-text("Add main guest details")',
            '[data-testid*="main-guest"]',
            'a:has-text("guest details")',
            'button:has-text("guest details")',
        ]
        if click_first_visible(page, detail_trigger_selectors, timeout_ms=2000):
            log("[guest] 已点击 Add main guest details，等待弹窗...")

            # 等待弹窗内的输入框出现
            modal_input_loc = None
            modal_name_sels = [
                'dialog input[type="text"]',
                '[role="dialog"] input[type="text"]',
                'input[placeholder*="First name" i]',
                'input[placeholder*="name" i]',
            ]
            for sel in modal_name_sels:
                try:
                    loc = page.locator(sel).first
                    loc.wait_for(state="visible", timeout=4000)
                    modal_input_loc = loc
                    break
                except Exception:
                    continue

            if modal_input_loc:
                modal_input_loc.click()
                modal_input_loc.fill(full_name)
                log(f"[guest] 弹窗姓名已填: {full_name}")
            else:
                log("[WARN] 未找到弹窗内输入框")

            # 点击弹窗里的 Save 按钮
            save_clicked = click_first_visible(page, [
                'dialog button:has-text("Save")',
                '[role="dialog"] button:has-text("Save")',
                'button:has-text("Save")',
            ], timeout_ms=3000)
            if save_clicked:
                log("[guest] 弹窗 Save 已点击")
                # 等待弹窗关闭
                try:
                    page.locator('dialog').wait_for(state="hidden", timeout=5000)
                except Exception:
                    pass
                page.wait_for_timeout(800)
            else:
                page.keyboard.press("Escape")
                page.wait_for_timeout(800)

        take_screenshot(page, artifacts_dir, "12_guest_form.png")
        save_html(page, artifacts_dir, "12_guest_form.html")

        def fill_field(selectors: list[str], value: str) -> bool:
            if not value:
                return False
            for sel in selectors:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=2000):
                        loc.click()
                        loc.fill(value)
                        return True
                except Exception:
                    continue
            log(f"[WARN] fill_field: 未找到可用输入框，selectors={selectors[:2]}")
            return False

        # ── 步骤2: 填主表单姓名（可能在弹窗关闭后的主页面上） ──
        fill_field([
            'input[data-testid="user-details-firstname"]',
            'input[name="firstname"]', 'input[name="fname"]',
            'input[autocomplete="given-name"]',
        ], first_name)

        fill_field([
            'input[data-testid="user-details-lastname"]',
            'input[name="lastname"]', 'input[name="lname"]',
            'input[autocomplete="family-name"]',
        ], last_name)

        # 邮箱
        fill_field([
            'input[data-testid="user-details-email"]',
            'input[name="email"]', 'input[type="email"]',
            'input[autocomplete="email"]',
        ], email)

        # 地址
        fill_field([
            'input[data-testid="user-details-address1"]',
            'input[name="address1"]', 'input[autocomplete="address-line1"]',
        ], address1)

        fill_field([
            'input[data-testid="user-details-city"]',
            'input[name="city"]', 'input[autocomplete="address-level2"]',
        ], city_addr)

        fill_field([
            'input[data-testid="user-details-zip"]',
            'input[name="zip"]', 'input[autocomplete="postal-code"]',
        ], zip_code)

        # 国家下拉（cc1）
        country_candidates = [country_code.lower()]
        # 加上常见中文/英文国家名
        _country_names = {
            "cn": ["cn", "china", "中国"],
            "gb": ["gb", "united kingdom", "uk"],
            "us": ["us", "united states", "usa"],
            "fr": ["fr", "france"],
            "de": ["de", "germany"],
        }
        country_candidates += _country_names.get(country_code.lower(), [])
        select_preferred_option(
            page,
            [
                'select[data-testid="user-details-cc1"]',
                'select[name="cc1"]',
                'select[autocomplete="country"]',
            ],
            country_candidates,
        )
        log(f"[guest] 国家已选: {country_code}")

        # 电话区号下拉（phone-country-code-select）
        if phone_country_code:
            select_preferred_option(
                page,
                [
                    'select[data-testid="phone-country-code-select"]',
                    'select[name="countryCode"]',
                    'select[autocomplete="tel-country-code"]',
                ],
                [phone_country_code, f"+{phone_country_code}"],
            )
            log(f"[guest] 电话区号已选: +{phone_country_code}")

        # 手机号
        fill_field([
            'input[data-testid="phone-number-input"]',
            'input[name="phoneNumber"]', 'input[name="phone"]',
            'input[autocomplete="tel-national"]',
        ], phone_number)

        # notstayer: 我是主要住客（value="false" 表示我自己是）
        click_first_visible(
            page,
            [
                'input[name="notstayer"][value="false"]',
                'label:has-text("I am the main guest")',
                'label:has-text("main guest")',
            ],
            timeout_ms=1000,
        )

        # 出行目的
        if travel_purpose == "leisure":
            click_first_visible(
                page,
                [
                    'input[name="bp_travel_purpose"][value="leisure"]',
                    'label:has-text("leisure")',
                ],
                timeout_ms=800,
            )
        elif travel_purpose == "business":
            click_first_visible(
                page,
                [
                    'input[name="bp_travel_purpose"][value="business"]',
                    'label:has-text("business")',
                ],
                timeout_ms=800,
            )

        page.wait_for_timeout(1000)
        take_screenshot(page, artifacts_dir, "13_guest_form_filled.png")
        save_html(page, artifacts_dir, "13_guest_form_filled.html")
        log("[guest] 入住人信息已填写")
    except Exception as e:
        raise RuntimeError(f"填写入住人信息失败: {e}")


def fill_credit_card(page, card_number: str, expiry_month: str, expiry_year: str,
                     cvv: str, holder: str, artifacts_dir: str):
    """填写信用卡信息，支持 Adyen iframe（Booking.com 标准）"""
    progress(75, "填写信用卡信息...")
    try:
        take_screenshot(page, artifacts_dir, "14_payment_form.png")
        save_html(page, artifacts_dir, "14_payment_form.html")

        # ── 等待支付 iframe 加载（最多 30 秒）──────────────────────────
        # Booking.com 使用 paymentcomponent.booking.com iframe，
        # 该 iframe 内部可能再嵌套 Adyen 托管字段 iframe
        log("[payment] 等待支付 iframe 加载...")
        adyen_frame = None
        # 卡号字段候选选择器（Adyen hosted fields / 普通 input 均覆盖）
        card_number_sels = [
            'input[data-fieldtype="encryptedCardNumber"]',
            'input[name="encryptedCardNumber"]',
            'input[aria-label*="Card number" i]',
            'input[placeholder*="Card number" i]',
            'input[id*="cardNumber" i]',
            'input[name*="cardNumber" i]',
            'input[autocomplete="cc-number"]',
        ]
        for _ in range(60):  # 最多 60 × 500ms = 30 秒
            for frame in page.frames:
                if frame == page.main_frame:
                    continue
                frame_url = frame.url or ""
                # 优先匹配 Booking 支付组件或 Adyen 地址
                is_payment_frame = any(kw in frame_url for kw in [
                    "paymentcomponent.booking.com",
                    "adyen.com",
                    "checkoutshopper",
                ])
                try:
                    for sel in card_number_sels:
                        el = frame.query_selector(sel)
                        if el and el.is_visible():
                            adyen_frame = frame
                            log(f"[payment] 找到支付 iframe: {frame_url[:80]}")
                            break
                    # 如果是支付域名 iframe 但字段不可见，也记录一下
                    if not adyen_frame and is_payment_frame:
                        log(f"[payment] 检测到支付 iframe（字段尚未就绪）: {frame_url[:80]}")
                except Exception:
                    pass
                if adyen_frame:
                    break
            if adyen_frame:
                break
            page.wait_for_timeout(500)

        if not adyen_frame:
            log("[WARN] 未找到支付 iframe，将在主页面和全部 iframe 中回退查找")

        # ── 核心填写辅助函数 ───────────────────────────────────────────────
        def fill_in_frame(frame, selectors: list, value: str, field_name: str) -> bool:
            """在指定 frame 中填写字段，优先 press_sequentially（Adyen），fallback fill"""
            frame_url = frame.url or ""
            for sel in selectors:
                try:
                    el = frame.query_selector(sel)
                    if el and el.is_visible():
                        el.click()
                        frame.wait_for_timeout(200)
                        try:
                            el.press_sequentially(value, delay=80)
                        except Exception:
                            el.fill(value)
                        log(f"[payment] {field_name} typed (frame:{frame_url[:60]}) via {sel!r}")
                        return True
                except Exception:
                    continue
            return False

        def fill_anywhere(selectors: list, value: str, field_name: str) -> bool:
            if not value:
                return False
            # 优先 Adyen frame
            if adyen_frame and fill_in_frame(adyen_frame, selectors, value, field_name):
                return True
            # 主页面（普通 fill 即可）
            for sel in selectors:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=1500):
                        loc.click()
                        loc.fill(value)
                        log(f"[payment] {field_name} filled (main) via {sel!r}")
                        return True
                except Exception:
                    continue
            # 其他 iframe 回退
            for frame in page.frames:
                if frame == page.main_frame or frame == adyen_frame:
                    continue
                if fill_in_frame(frame, selectors, value, field_name):
                    return True
            log(f"[WARN] payment: could not fill {field_name!r}")
            return False

        def select_anywhere(selectors: list, value: str, field_name: str) -> bool:
            if not value:
                return False
            for sel in selectors:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=1500):
                        loc.select_option(value=value)
                        log(f"[payment] {field_name} selected {value!r} via {sel!r}")
                        return True
                except Exception:
                    continue
            log(f"[WARN] payment: could not select {field_name!r}")
            return False

        # ── 卡号 ──────────────────────────────────────────────────────────
        fill_anywhere([
            'input[data-fieldtype="encryptedCardNumber"]',
            'input[name="encryptedCardNumber"]',
            'input[name="cc_number"]',
            'input[autocomplete="cc-number"]',
            'input[id*="cardNumber" i]',
            'input[placeholder*="Card number" i]',
            'input[aria-label*="Card number" i]',
        ], card_number, "card_number")
        page.wait_for_timeout(400)

        # ── 持卡人姓名 ────────────────────────────────────────────────────
        fill_anywhere([
            'input[data-fieldtype="holderName"]',
            'input[name="holderName"]',
            'input[name="cc_name"]',
            'input[autocomplete="cc-name"]',
            'input[name="holder_name"]',
            'input[id*="cardholder" i]',
            'input[placeholder*="Cardholder" i]',
            'input[placeholder*="Name on card" i]',
            'input[aria-label*="Name on card" i]',
            'input[aria-label*="holder" i]',
        ], holder, "holder_name")
        page.wait_for_timeout(400)

        # ── 有效期 ────────────────────────────────────────────────────────
        # Adyen 使用合并的 MM/YY 格式（单个字段）
        # expiry_year 可能是 4 位 (2029) 或 2 位 (29)
        yy = expiry_year[-2:] if expiry_year else ""
        mm = expiry_month.zfill(2) if expiry_month else ""
        expiry_combined = f"{mm}{yy}"  # e.g. "0829"

        if not fill_anywhere([
            'input[data-fieldtype="encryptedExpiryDate"]',
            'input[name="encryptedExpiryDate"]',
            'input[autocomplete="cc-exp"]',
            'input[placeholder*="MM/YY" i]',
            'input[placeholder*="MM / YY" i]',
            'input[aria-label*="Expiry date" i]',
            'input[aria-label*="expiry" i]',
        ], expiry_combined, "expiry_combined"):
            # fallback：分开填月 / 年
            if not select_anywhere([
                'select[name="cc_expiration_month"]',
                'select[autocomplete="cc-exp-month"]',
            ], expiry_month, "expiry_month"):
                fill_anywhere([
                    'input[data-fieldtype="encryptedExpiryMonth"]',
                    'input[name="expiry_month"]',
                    'input[autocomplete="cc-exp-month"]',
                    'input[placeholder*="MM" i]',
                    'input[aria-label*="Expiry month" i]',
                ], mm, "expiry_month")

            if not select_anywhere([
                'select[name="cc_expiration_year"]',
                'select[autocomplete="cc-exp-year"]',
            ], expiry_year, "expiry_year"):
                fill_anywhere([
                    'input[data-fieldtype="encryptedExpiryYear"]',
                    'input[name="expiry_year"]',
                    'input[autocomplete="cc-exp-year"]',
                    'input[placeholder*="YY" i]',
                    'input[aria-label*="Expiry year" i]',
                ], yy, "expiry_year")
        page.wait_for_timeout(400)

        # ── CVV / CVC ─────────────────────────────────────────────────────
        fill_anywhere([
            'input[data-fieldtype="encryptedSecurityCode"]',
            'input[name="encryptedSecurityCode"]',
            'input[name="cc_cvc"]',
            'input[autocomplete="cc-csc"]',
            'input[id*="cvc" i]',
            'input[id*="cvv" i]',
            'input[placeholder*="CVC" i]',
            'input[placeholder*="CVV" i]',
            'input[placeholder*="Security" i]',
            'input[aria-label*="Security" i]',
            'input[aria-label*="CVC" i]',
        ], cvv, "cvv")

        page.wait_for_timeout(1000)
        take_screenshot(page, artifacts_dir, "15_payment_filled.png")
        save_html(page, artifacts_dir, "15_payment_filled.html")
        log("[payment] 信用卡信息已填写")
    except Exception as e:
        raise RuntimeError(f"填写信用卡信息失败: {e}")


def complete_booking(page, artifacts_dir: str) -> dict:
    """点击确认预订并获取确认信息"""
    progress(85, "确认预订...")
    try:
        # 找确认按钮
        confirm_selectors = [
            'button[type="submit"]:has-text("Complete booking")',
            'button[type="submit"]:has-text("Confirm booking")',
            '[data-testid="submit-button"]',
            'button:has-text("Complete booking")',
            'button:has-text("Confirm")',
            'button[id*="confirm"]',
        ]
        # 等待按钮从 disabled/loading 变成可点击（最多 20 秒）
        confirm_btn = None
        for _ in range(40):
            for sel in confirm_selectors:
                try:
                    el = page.query_selector(sel)
                    if el and el.is_visible() and not el.get_attribute("disabled"):
                        confirm_btn = el
                        break
                except Exception:
                    continue
            if confirm_btn:
                break
            page.wait_for_timeout(500)

        take_screenshot(page, artifacts_dir, "16_before_confirm.png")
        save_html(page, artifacts_dir, "16_before_confirm.html")
        if not confirm_btn:
            raise RuntimeError("未找到「确认预订」按钮，请查看截图 16_before_confirm.png")
        confirm_btn.click()
        page.wait_for_timeout(3000)

        # 等待确认页面
        page.wait_for_load_state("networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        take_screenshot(page, artifacts_dir, "17_confirmation_page.png")

        current_url = page.url
        log(f"[booking] 确认后 URL: {current_url}")

        # 提取预订号
        confirmation_number = ""
        conf_selectors = [
            '[data-testid="confirmation-number"]',
            '.confirmation-number',
            '[class*="confirmation"] strong',
            'h1:has-text("booking")',
        ]
        for sel in conf_selectors:
            el = page.query_selector(sel)
            if el:
                text = el.inner_text().strip()
                if text:
                    confirmation_number = text
                    break

        # 全页截图
        take_screenshot(page, artifacts_dir, "18_confirmation_full.png")

        # 尝试获取确认页完整 HTML（方便后续分析）
        try:
            html_path = os.path.join(artifacts_dir, "confirmation_page.html")
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(page.content())
        except Exception:
            pass

        # 尝试打印为 PDF
        pdf_path = ""
        try:
            pdf_dir = os.path.dirname(artifacts_dir) if artifacts_dir else "."
            pdf_path = os.path.join(pdf_dir, "booking_confirmation.pdf")
            page.pdf(path=pdf_path, format="A4", print_background=True)
            log(f"[booking] 确认单 PDF 已保存: {pdf_path}")
        except Exception as e:
            log(f"[WARN] PDF 导出失败（非 Chromium headless 模式下不支持）: {e}")
            pdf_path = ""

        return {
            "success": True,
            "confirmation_number": confirmation_number,
            "confirmation_url": current_url,
            "pdf_path": pdf_path,
        }
    except Exception as e:
        raise RuntimeError(f"确认预订失败: {e}")


def run(job: dict):
    from playwright.sync_api import sync_playwright

    results_path = job.get("results_path", "booking_results.json")
    output_dir = os.path.dirname(os.path.abspath(results_path)) or os.getcwd()
    artifacts_dir = job.get("artifacts_dir", "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)

    headless = bool(job.get("headless", False))
    slow_mo = int(job.get("slow_mo_ms", 500))
    proxy_url = job.get("proxy", "").strip()
    nav_timeout = int(job.get("navigation_timeout_ms", 60000))

    booking_email = job["booking_email"]
    booking_password = job["booking_password"]
    city = job["city"]
    checkin_date = job["checkin_date"]
    checkout_date = job["checkout_date"]
    adults = int(job.get("adults", 1))
    rooms = int(job.get("rooms", 1))
    guest_first = job.get("guest_first_name", "")
    guest_last = job.get("guest_last_name", "")
    guest_email = job.get("guest_email", booking_email)
    guest_address1 = job.get("guest_address1", "")
    guest_city_addr = job.get("guest_city_addr", "")
    guest_zip = job.get("guest_zip", "")
    guest_country_code = job.get("guest_country_code", "cn")
    guest_phone_country_code = job.get("guest_phone_country_code", "86")
    guest_phone = job.get("guest_phone", "")
    travel_purpose = job.get("travel_purpose", "leisure")
    cc_number = job.get("credit_card_number", "")
    cc_expiry_month = job.get("credit_card_expiry_month", "")
    cc_expiry_year = job.get("credit_card_expiry_year", "")
    cc_cvv = job.get("credit_card_cvv", "")
    cc_holder = job.get("credit_card_holder", f"{guest_first} {guest_last}".strip())
    filter_no_prepayment = bool(job.get("filter_no_prepayment", True))
    max_price = job.get("max_price_per_night")
    if max_price is not None:
        max_price = float(max_price)
    debug_pause_before_payment = bool(job.get("pause_before_payment", job.get("debug_pause_before_payment", False)))
    debug_hold_ms = int(job.get("debug_hold_before_payment_ms", 0))
    debug_pause_before_confirm = bool(job.get("debug_pause_before_confirm", False))

    # IMAP 配置（用于自动接收登录验证码）
    imap_cfg: dict | None = None
    if job.get("imap_server") and job.get("imap_username") and job.get("imap_password"):
        imap_cfg = {
            "server": job["imap_server"],
            "port": int(job.get("imap_port", 993)),
            "username": job["imap_username"],
            "password": job["imap_password"],
            "sender_filter": job.get("imap_sender_filter", "booking.com"),
            "max_wait_sec": int(job.get("imap_max_wait_sec", 90)),
        }
        log(f"[imap] IMAP 已配置: {imap_cfg['server']}:{imap_cfg['port']} / {imap_cfg['username']}")

    progress(5, "启动浏览器...")

    with sync_playwright() as p:
        launch_kwargs = {
            "headless": headless,
            "slow_mo": slow_mo,
            "args": [
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
        }
        if proxy_url:
            launch_kwargs["proxy"] = {"server": proxy_url}

        browser = p.chromium.launch(**launch_kwargs)
        context = browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-GB",
        )
        context.set_default_timeout(nav_timeout)
        page = context.new_page()

        hotel_name = ""
        booking_result = {}

        try:
            # 1. 登录（支持 IMAP 自动接收验证码）
            login(page, booking_email, booking_password, artifacts_dir, imap_cfg)

            # 2. 搜索
            search_hotels(page, city, checkin_date, checkout_date, adults, rooms, artifacts_dir)

            # 3. 筛选无需预付款
            if filter_no_prepayment:
                apply_no_prepayment_filter(page, artifacts_dir)

            # 4. 选择酒店
            hotel_name = select_hotel(page, max_price, artifacts_dir)
            progress(52, f"已选择酒店: {hotel_name}")

            # 5. 选择房间并点击预订
            page = select_room_and_reserve(page, filter_no_prepayment, artifacts_dir)

            # 6. 填写入住人信息
            fill_guest_details(
                page, guest_first, guest_last, guest_email, artifacts_dir,
                address1=guest_address1,
                city_addr=guest_city_addr,
                zip_code=guest_zip,
                country_code=guest_country_code,
                phone_country_code=guest_phone_country_code,
                phone_number=guest_phone,
                travel_purpose=travel_purpose,
            )

            # 7. 点击「Next: Final details」进入付款页（stage 2）
            progress(68, "进入付款页...")
            take_screenshot(page, artifacts_dir, "14_before_next.png")
            save_html(page, artifacts_dir, "14_before_next.html")
            next_clicked = click_first_visible(page, [
                'button[type="submit"]:has-text("Next: Final details")',
                'button[type="submit"]:has-text("Next")',
                'button:has-text("Next: Final details")',
                'button:has-text("Final details")',
                '[data-testid="submit-button"]',
            ], timeout_ms=5000)
            if next_clicked:
                log("[step] 已点击 Next: Final details")
                page.wait_for_load_state("domcontentloaded", timeout=20000)
                page.wait_for_timeout(2000)
                # 滚动到顶部，确保支付 iframe 进入 viewport 触发加载
                try:
                    page.evaluate("window.scrollTo(0, 0)")
                except Exception:
                    pass
                page.wait_for_timeout(1000)
                take_screenshot(page, artifacts_dir, "14_payment_stage2.png")
                save_html(page, artifacts_dir, "14_payment_stage2.html")
                log(f"[step] Stage 2 URL: {page.url}")
            else:
                log("[WARN] 未找到 Next 按钮，可能已在付款页")

            # 8. 调试暂停/截图
            take_screenshot(page, artifacts_dir, "14_before_payment_pause.png")
            save_html(page, artifacts_dir, "14_before_payment_pause.html")
            if debug_pause_before_payment:
                capture_payment_handoff(
                    page,
                    context,
                    output_dir,
                    artifacts_dir,
                    {
                        "hotelName": hotel_name,
                        "city": city,
                        "checkinDate": checkin_date,
                        "checkoutDate": checkout_date,
                        "guestName": f"{guest_first} {guest_last}".strip(),
                        "email": guest_email or booking_email,
                    },
                )
                progress(72, "已到达支付页，已自动暂停，等待人工继续...")
                result = {
                    "success": True,
                    "paused_before_payment": True,
                    "payment_handoff_ready": True,
                    "payment_handoff_file": "payment_handoff.json",
                    "hotel_name": hotel_name,
                    "city": city,
                    "checkin_date": checkin_date,
                    "checkout_date": checkout_date,
                    "guest_name": f"{guest_first} {guest_last}".strip(),
                    "confirmation_number": "",
                    "confirmation_url": page.url,
                    "payment_url": page.url,
                    "pdf_path": "",
                    "message": "已到达支付页并暂停，可人工继续支付。",
                }
                save_results(results_path, result)
                progress(100, "已到达支付页并暂停，等待人工继续")
                return
            elif debug_hold_ms > 0:
                progress(72, f"【调试等待】停留 {debug_hold_ms // 1000} 秒后继续...")
                page.wait_for_timeout(debug_hold_ms)

            if cc_number:
                fill_credit_card(page, cc_number, cc_expiry_month, cc_expiry_year, cc_cvv, cc_holder, artifacts_dir)
            else:
                log("[WARN] 未提供信用卡信息，跳过支付填写")

            # 9. 填完后截图，在点 Complete booking 之前暂停（debug 用）
            take_screenshot(page, artifacts_dir, "15_before_confirm.png")
            save_html(page, artifacts_dir, "15_before_confirm.html")
            if debug_pause_before_confirm:
                progress(80, "已到达最终确认页，已暂停，等待人工检查后继续...")
                result = {
                    "success": True,
                    "paused_before_confirm": True,
                    "hotel_name": hotel_name,
                    "city": city,
                    "checkin_date": checkin_date,
                    "checkout_date": checkout_date,
                    "guest_name": f"{guest_first} {guest_last}".strip(),
                    "confirmation_number": "",
                    "confirmation_url": page.url,
                    "payment_url": page.url,
                    "pdf_path": "",
                    "message": "已到达 Complete booking 页并暂停，请查看截图 15_before_confirm.png",
                }
                save_results(results_path, result)
                progress(100, "已到达最终确认页并暂停")
                return

            # 10. 确认预订
            booking_result = complete_booking(page, artifacts_dir)
            progress(95, "预订完成，保存结果...")

            result = {
                "success": True,
                "hotel_name": hotel_name,
                "city": city,
                "checkin_date": checkin_date,
                "checkout_date": checkout_date,
                "guest_name": f"{guest_first} {guest_last}".strip(),
                "confirmation_number": booking_result.get("confirmation_number", ""),
                "confirmation_url": booking_result.get("confirmation_url", ""),
                "pdf_path": booking_result.get("pdf_path", ""),
            }
            save_results(results_path, result)
            progress(100, f"酒店预订成功！预订号：{result['confirmation_number'] or '请查看截图'}")

        except Exception as e:
            tb = traceback.format_exc()
            log(f"[ERROR] {e}\n{tb}")
            take_screenshot(page, artifacts_dir, "error_screenshot.png")
            err_result = {
                "success": False,
                "error": str(e),
                "hotel_name": hotel_name,
            }
            save_results(results_path, err_result)
            sys.exit(1)
        finally:
            try:
                browser.close()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description="Booking.com 自动预约酒店")
    parser.add_argument("--job", required=True, help="job config JSON 文件路径")
    args = parser.parse_args()

    job = load_job(args.job)
    run(job)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
美签 AIS 账号自动注册 CLI
从 visa-automation-system 迁移，支持通过 spawn 调用，输出 PROGRESS 行供 Node 解析
"""
import html
import os
import re
import sys
import json
import argparse
import platform
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from playwright.sync_api import sync_playwright

AIS_BASE_URL = "https://ais.usvisa-info.com/en-gb/niv/information/niv_questions"
AIS_SIGN_IN_URL = "https://ais.usvisa-info.com/en-gb/niv/users/sign_in"
DEFAULT_PASSWORD = "Visa202520252025!"


def _is_ais_signup_url(url: str) -> bool:
    """UK AIS 注册页可能是 /niv/signup，不一定是 /users/sign_up。"""
    u = (url or "").lower()
    return (
        "/signup" in u
        or "/sign_up" in u
        or "/users/sign_up" in u
        or "/new_user" in u
        or "signup" in u and "/niv/" in u
    )


def _is_ais_signin_url(url: str) -> bool:
    u = (url or "").lower()
    return "/users/sign_in" in u or "/sign_in" in u


def _is_ais_activation_email_sent_page(page) -> bool:
    """AIS 创建账号后会先停在激活邮件页，此状态代表账号已创建，不是注册失败。"""
    texts: List[str] = []
    try:
        texts.append(page.locator("body").inner_text(timeout=2500) or "")
    except Exception:
        pass
    try:
        texts.append(page.content() or "")
    except Exception:
        pass

    content = html.unescape(" ".join(texts))
    content = re.sub(r"\s+", " ", content).lower()
    return bool(
        "activate your account" in content
        and "created an account" in content
        and (
            "instructions provided in the email" in content
            or "resend email" in content
            or "email address above" in content
        )
    )


def _progress(pct: int, msg: str) -> None:
    print(f"PROGRESS:{pct}:{msg}", file=sys.stderr, flush=True)


def _trace(stage: str, detail: str = "") -> None:
    payload = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "stage": str(stage or "").replace("\n", " ").replace("\r", " ").strip(),
        "detail": str(detail or "").replace("\n", " ").replace("\r", " ").strip(),
    }
    print(f"TRACE_JSON:{json.dumps(payload, ensure_ascii=False)}", file=sys.stderr, flush=True)


def _env_int(key: str, default: int) -> int:
    raw = str(os.environ.get(key, "") or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _env_bool(key: str, default: bool) -> bool:
    raw = str(os.environ.get(key, "") or "").strip().lower()
    if not raw:
        return default
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return default


def _get_execution_config(test_mode: bool) -> Dict[str, object]:
    """统一本地/服务器执行配置，避免环境分叉。"""
    profile = str(os.environ.get("AIS_EXECUTION_PROFILE", "unified-v1")).strip() or "unified-v1"
    ua = str(
        os.environ.get(
            "AIS_USER_AGENT",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
    ).strip()
    cfg: Dict[str, object] = {
        "profile": profile,
        "headless": _env_bool("AIS_HEADLESS", True),
        "slow_mo": _env_int("AIS_SLOW_MO", 100 if test_mode else 0),
        "default_timeout_ms": _env_int("AIS_DEFAULT_TIMEOUT_MS", 90000),
        "goto_timeout_ms": _env_int("AIS_GOTO_TIMEOUT_MS", 120000),
        "goto_retries": _env_int("AIS_GOTO_RETRIES", 3),
        "locale": str(os.environ.get("AIS_LOCALE", "en-GB")).strip() or "en-GB",
        "timezone_id": str(os.environ.get("AIS_TIMEZONE", "Europe/London")).strip() or "Europe/London",
        "user_agent": ua,
        "viewport_width": _env_int("AIS_VIEWPORT_WIDTH", 1920),
        "viewport_height": _env_int("AIS_VIEWPORT_HEIGHT", 1080),
    }
    return cfg


def format_date(date_str) -> str:
    """格式化日期为 YYYY-MM-DD"""
    try:
        if pd.isna(date_str) or date_str == "" or date_str is None:
            return ""
        if isinstance(date_str, (pd.Timestamp, datetime)):
            return date_str.strftime("%Y-%m-%d")
        s = str(date_str).strip()
        if not s:
            return ""
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            return s
        obj = pd.to_datetime(date_str, errors="coerce")
        if pd.isna(obj):
            return s
        return obj.strftime("%Y-%m-%d")
    except Exception:
        return str(date_str) if date_str else ""


def _first_non_empty(personal_info: Dict, keys: List[str], default: str = "") -> str:
    for key in keys:
        value = str(personal_info.get(key, "") or "").strip()
        if value:
            return value
    return default


def _normalize_phone_digits(raw: str) -> str:
    return re.sub(r"\D+", "", str(raw or ""))


def _parse_birth_parts(raw_date: str) -> Optional[Dict[str, str]]:
    try:
        dt = pd.to_datetime(raw_date, errors="coerce")
        if pd.isna(dt):
            return None
        return {
            "day": str(int(dt.day)),
            "month": str(int(dt.month)),
            "year": str(int(dt.year)),
        }
    except Exception:
        return None


def _wait_and_fill(page, selectors: List[str], value: str, field_name: str, timeout: int = 12000) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            loc.wait_for(state="visible", timeout=timeout)
            loc.fill(value, timeout=timeout)
            log_value = "***" if "password" in field_name.lower() else value
            _trace("ais.applicant.fill", f"{field_name};selector={sel};value={log_value}")
            return True
        except Exception:
            continue
    return False


def _wait_and_select(page, selectors: List[str], value: str, field_name: str, timeout: int = 12000) -> bool:
    if not value:
        return False
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            loc.wait_for(state="visible", timeout=timeout)
            try:
                loc.select_option(label=value, timeout=timeout)
            except Exception:
                try:
                    loc.select_option(value=value, timeout=timeout)
                except Exception:
                    options = loc.locator("option")
                    matched_value = ""
                    for idx in range(options.count()):
                        text = (options.nth(idx).text_content() or "").strip().lower()
                        if value.strip().lower() in text:
                            matched_value = (options.nth(idx).get_attribute("value") or "").strip()
                            if matched_value:
                                break
                    if not matched_value:
                        raise RuntimeError(f"未匹配到选项: {value}")
                    loc.select_option(value=matched_value, timeout=timeout)
            _trace("ais.applicant.select", f"{field_name};selector={sel};value={value}")
            return True
        except Exception:
            continue
    return False


def _wait_and_check(page, selectors: List[str], field_name: str, timeout: int = 10000) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            loc.wait_for(state="visible", timeout=timeout)
            try:
                loc.check(timeout=timeout)
            except Exception:
                loc.click(timeout=timeout)
            _trace("ais.applicant.check", f"{field_name};selector={sel}")
            return True
        except Exception:
            continue
    return False


def _wait_and_click(page, selectors: List[str], step: str, timeout: int = 15000) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            loc.wait_for(state="visible", timeout=timeout)
            loc.click(timeout=timeout)
            _trace("ais.flow.click", f"{step};selector={sel};url={page.url}")
            return True
        except Exception:
            continue
    return False


def _detect_known_signup_failure_text(text: str) -> str:
    normalized = html.unescape(str(text or ""))
    normalized = re.sub(r"\s+", " ", normalized).strip()
    low = normalized.lower()
    patterns = [
        (r"email[^.。\n]{0,80}already[^.。\n]{0,80}taken", "Email has already been taken"),
        (r"email[^.。\n]{0,80}already[^.。\n]{0,80}registered", "Email has already been registered"),
        (r"password[^.。\n]{0,80}(blank|required|too short|invalid)", "Password validation failed"),
        (r"terms[^.。\n]{0,120}(accept|agree|required|must)", "Terms of use must be accepted"),
        (r"(captcha|robot|recaptcha|verification)[^.。\n]{0,120}(failed|required|invalid)", "Captcha or verification failed"),
    ]
    for pattern, fallback in patterns:
        match = re.search(pattern, low, flags=re.IGNORECASE)
        if match:
            start = max(0, match.start() - 60)
            end = min(len(normalized), match.end() + 80)
            snippet = normalized[start:end].strip(" |:;-")
            return snippet or fallback
    return ""


def _detect_known_login_failure_text(text: str) -> str:
    normalized = html.unescape(str(text or ""))
    normalized = re.sub(r"\s+", " ", normalized).strip()
    low = normalized.lower()
    patterns = [
        (r"invalid[^.。\n]{0,80}(email|password)", "Invalid email or password"),
        (r"(email|password)[^.。\n]{0,80}invalid", "Invalid email or password"),
        (r"(privacy|terms)[^.。\n]{0,120}(accept|agree|required|must|read)", "Terms of use must be accepted"),
        (r"(captcha|robot|recaptcha|verification)[^.。\n]{0,120}(failed|required|invalid)", "Captcha or verification failed"),
        (r"not[^.。\n]{0,80}activated", "AIS account is not activated"),
        (r"confirm[^.。\n]{0,80}email", "AIS account email confirmation is required"),
    ]
    for pattern, fallback in patterns:
        match = re.search(pattern, low, flags=re.IGNORECASE)
        if match:
            start = max(0, match.start() - 60)
            end = min(len(normalized), match.end() + 80)
            snippet = normalized[start:end].strip(" |:;-")
            return snippet or fallback
    return ""


def _extract_signup_error_text(page) -> str:
    """聚合注册页上可见错误，便于快速定位失败原因。"""
    selectors = [
        "form#new_user small.error",
        "form#new_user .error",
        "form#new_user .alert-danger",
        "form#new_user .alert",
        "form#new_user .field_with_errors",
        ".alert-danger",
        ".alert",
        ".error",
        "#error_explanation li",
        "#error_explanation",
    ]
    messages: List[str] = []
    seen = set()
    for sel in selectors:
        try:
            loc = page.locator(sel)
            cnt = min(loc.count(), 6)
            for i in range(cnt):
                text = (loc.nth(i).text_content() or "").strip()
                if not text:
                    continue
                text = re.sub(r"\s+", " ", text)
                key = text.lower()
                if key in seen:
                    continue
                seen.add(key)
                messages.append(text)
        except Exception:
            continue
    joined = " | ".join(messages[:3]).strip()
    if joined:
        return joined
    try:
        body_text = page.locator("body").inner_text(timeout=2500) or ""
        known = _detect_known_signup_failure_text(body_text)
        if known:
            return known
    except Exception:
        pass
    try:
        known = _detect_known_signup_failure_text(page.content() or "")
        if known:
            return known
    except Exception:
        pass
    return ""


def _extract_login_error_text(page) -> str:
    selectors = [
        "form#new_user .error",
        "form#new_user .alert",
        "form#new_user .alert-danger",
        ".alert-danger",
        ".alert",
        ".error",
        "#error_explanation",
    ]
    messages: List[str] = []
    seen = set()
    for sel in selectors:
        try:
            loc = page.locator(sel)
            cnt = min(loc.count(), 6)
            for i in range(cnt):
                text = (loc.nth(i).text_content() or "").strip()
                if not text:
                    continue
                text = re.sub(r"\s+", " ", text)
                key = text.lower()
                if key in seen:
                    continue
                seen.add(key)
                messages.append(text)
        except Exception:
            continue
    joined = " | ".join(messages[:3]).strip()
    if joined:
        return joined
    try:
        known = _detect_known_login_failure_text(page.locator("body").inner_text(timeout=2500) or "")
        if known:
            return known
    except Exception:
        pass
    try:
        known = _detect_known_login_failure_text(page.content() or "")
        if known:
            return known
    except Exception:
        pass
    return ""


def _wait_until_post_signup_ready(page, timeout_ms: int = 30000) -> str:
    """
    等待注册提交后的稳定状态：
    - applicant_form: 已出现 applicant 表单
    - activation_email_sent: 已创建账号，等待邮箱激活
    - schedule_url: 已进入 schedule 流程
    - still_signup: 仍停留在 signup
    - unknown: 其它中间态
    """
    applicant_ready_selectors = [
        "#applicant_passport_country_code",
        "#applicant_passport_number",
        "#applicant_ds160_number",
        'form input[name="applicant[passport_number]"]',
    ]
    deadline = datetime.now().timestamp() + (max(1000, timeout_ms) / 1000.0)
    while datetime.now().timestamp() < deadline:
        current_url = page.url or ""
        low_url = current_url.lower()
        if "/schedule/" in low_url or "/payment" in low_url:
            return "schedule_url"
        if _is_ais_activation_email_sent_page(page):
            return "activation_email_sent"
        if _is_ais_signup_url(current_url) and _extract_signup_error_text(page):
            return "signup_error"
        for sel in applicant_ready_selectors:
            try:
                if page.locator(sel).count() > 0:
                    return "applicant_form"
            except Exception:
                continue
        page.wait_for_timeout(1000)

    return "still_signup" if _is_ais_signup_url(page.url) else "unknown"


def _extract_schedule_id(url: str) -> str:
    m = re.search(r"/schedule/(\d+)", url or "")
    return m.group(1) if m else ""


def load_personal_info_from_excel(excel_path: str) -> List[Dict]:
    """
    从 Excel 读取个人信息，兼容两种格式：
    1）原 DS-160 / AIS 模板：两列「基本信息」+「填写内容」的纵向表
    2）简单横向表：直接以「名」「姓」「个人邮箱」等作为列名
    """
    df = pd.read_excel(excel_path)
    if df is None or df.empty:
        return []

    # 情况 1：原项目 DS-160 同款模板（纵向表：基本信息 / 填写内容）
    if "基本信息" in df.columns and "填写内容" in df.columns:
        # 只引入 AIS 注册和邮件里会用到的字段映射
        field_mapping = {
            "姓": "surname",
            "名": "given_name",
            "中文名": "chinese_name",
            "出生年月日": "birth_date",
            "护照号": "passport_number",
            "主要电话": "Primary Phone Number",
            "个人邮箱": "Personal Email Address",
            "Country / Authority that issued Passport": "Country / Authority that issued Passport",
            "Country of Birth": "Country of Birth",
            "Country of Permanent Residence": "Country of Permanent Residence",
            "DS-160 Number": "DS-160 Number",
            "Visa Class": "Visa Class",
            "Were you previously issued a visa to enter the United States?": "Were you previously issued a visa to enter the United States?",
            "Are you traveling from another country to apply for a U.S. visa in United Kingdom?": "Are you traveling from another country to apply for a U.S. visa in United Kingdom?",
        }
        result: Dict[str, str] = {}
        for _, row in df.iterrows():
            cn_field = str(row.get("基本信息") or "").strip()
            if not cn_field:
                continue
            value = row.get("填写内容")
            if pd.isna(value):
                value = ""
            value_str = str(value)
            # 中文键
            result[cn_field] = value_str
            # 英文键
            en_field = field_mapping.get(cn_field)
            if en_field:
                result[en_field] = value_str
        return [result]

    # 情况 2：简单横向表（第一行数据，列名即字段名）
    row = df.iloc[0]
    mapping = {
        "姓": "surname",
        "名": "given_name",
        "中文名": "chinese_name",
        "个人邮箱": "Personal Email Address",
        "出生年月日": "birth_date",
        "护照号": "passport_number",
        "主要电话": "Primary Phone Number",
    }
    out: Dict[str, str] = {}
    for col in df.columns:
        val = row.get(col)
        if pd.isna(val):
            val = ""
        out[str(col).strip()] = str(val)
    for cn, en in mapping.items():
        if cn in out and en not in out:
            out[en] = out[cn]
        if en in out and cn not in out:
            out[cn] = out[en]
    return [out]


def _save_ais_error_screenshot(page, output_dir: str, error_msg: str = "") -> Optional[str]:
    try:
        if not page:
            return None
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ais_register_error_{timestamp}.png"
        path_dir = Path(output_dir) if output_dir else None
        if not path_dir or not str(path_dir).strip():
            return None
        path_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = path_dir / filename
        try:
            page.screenshot(path=str(screenshot_path), full_page=True, timeout=10000)
        except Exception:
            try:
                page.screenshot(path=str(screenshot_path), full_page=False, timeout=8000)
            except Exception as ex:
                print(f"[WARNING] 截图失败: {ex}", file=sys.stderr)
                return None
        if screenshot_path.exists():
            print(f"[INFO] 已保存错误截图: {filename}", file=sys.stderr)
            return filename
    except Exception as e:
        print(f"[WARNING] 保存 AIS 错误截图失败: {e}", file=sys.stderr)
    return None


def _save_ais_step_screenshot(page, output_dir: str, step_tag: str) -> Optional[str]:
    """保存关键步骤截图，便于快速定位流程卡点。"""
    try:
        if not page:
            return None
        path_dir = Path(output_dir) if output_dir else None
        if not path_dir or not str(path_dir).strip():
            return None
        path_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_tag = re.sub(r"[^a-zA-Z0-9._-]", "_", str(step_tag or "step"))
        filename = f"ais_register_step_{safe_tag}_{timestamp}.png"
        screenshot_path = path_dir / filename
        try:
            page.screenshot(path=str(screenshot_path), full_page=True, timeout=15000)
        except Exception:
            page.screenshot(path=str(screenshot_path), full_page=False, timeout=10000)
        if screenshot_path.exists():
            print(f"[INFO] 已保存步骤截图: {filename}", file=sys.stderr)
            return filename
    except Exception as e:
        print(f"[WARNING] 保存 AIS 步骤截图失败: {e}", file=sys.stderr)
    return None


def _save_ais_debug_html(page, output_dir: str, step_tag: str) -> Optional[str]:
    try:
        if not page:
            return None
        path_dir = Path(output_dir) if output_dir else None
        if not path_dir or not str(path_dir).strip():
            return None
        path_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_tag = re.sub(r"[^a-zA-Z0-9._-]", "_", str(step_tag or "debug"))
        filename = f"ais_register_debug_{safe_tag}_{timestamp}.html"
        (path_dir / filename).write_text(page.content() or "", encoding="utf-8")
        print(f"[INFO] 已保存调试HTML: {filename}", file=sys.stderr)
        return filename
    except Exception as e:
        print(f"[WARNING] 保存 AIS 调试HTML失败: {e}", file=sys.stderr)
    return None


def _complete_post_signup_flow(page, personal_info: Dict, out_dir: str) -> Dict:
    """
    注册后继续执行：
    1) New Applicant 填表并 Create Applicant
    2) applicants 页面 Yes -> 勾选条件 -> Confirm
    3) add_additional_applicants 页面 No
    4) 选择 London 取件点并 Continue
    5) 到 payment 页面截图并返回链接
    """
    passport_country = _first_non_empty(
        personal_info,
        ["Country / Authority that issued Passport", "护照签发国家", "passport_country"],
        "CHINA",
    )
    birth_country = _first_non_empty(personal_info, ["Country of Birth", "出生国家", "birth_country"], "CHINA")
    residency_country = _first_non_empty(
        personal_info,
        ["Country of Permanent Residence", "常住国家", "residency_country"],
        "CHINA",
    )
    passport_number = _first_non_empty(personal_info, ["passport_number", "护照号", "Passport Number"])
    ds160_number = _first_non_empty(personal_info, ["DS-160 Number", "DS160 Number", "Application ID", "AA码"])
    visa_class = _first_non_empty(
        personal_info,
        ["Visa Class", "签证类型"],
        "B1/B2 Business & Tourism (Temporary visitor)",
    )
    birth_date_raw = _first_non_empty(personal_info, ["birth_date", "出生年月日", "Date of Birth"])
    birth_parts = _parse_birth_parts(birth_date_raw)
    primary_phone = _normalize_phone_digits(_first_non_empty(personal_info, ["Primary Phone Number", "主要电话"]))
    email = _first_non_empty(personal_info, ["Personal Email Address", "个人邮箱"])
    is_renewal = _first_non_empty(
        personal_info,
        ["Were you previously issued a visa to enter the United States?", "is_renewal"],
        "No",
    ).strip().lower() in ("yes", "true", "1", "是")
    traveling_to_apply = _first_non_empty(
        personal_info,
        ["Are you traveling from another country to apply for a U.S. visa in United Kingdom?", "traveling_to_apply"],
        "No",
    ).strip().lower() in ("yes", "true", "1", "是")

    _trace("ais.flow.post_signup.start", page.url)
    if _is_ais_signup_url(page.url):
        raise RuntimeError("注册提交后仍停留在 signup 页面，未进入 Applicant 流程")

    # New Applicant 表单
    _wait_and_select(page, ["#applicant_passport_country_code"], passport_country, "passport_country")
    _wait_and_select(page, ["#applicant_birth_country_code"], birth_country, "birth_country")
    _wait_and_select(page, ["#applicant_permanent_residency_country_code"], residency_country, "residency_country")
    _wait_and_fill(page, ["#applicant_passport_number"], passport_number, "passport_number")
    _wait_and_fill(page, ["#applicant_ds160_number"], ds160_number, "ds160_number")
    _wait_and_select(page, ["#applicant_visa_class_id"], visa_class, "visa_class")

    if birth_parts:
        _wait_and_select(page, ["#applicant_date_of_birth_3i"], birth_parts["day"], "dob_day")
        _wait_and_select(page, ["#applicant_date_of_birth_2i"], birth_parts["month"], "dob_month")
        _wait_and_select(page, ["#applicant_date_of_birth_1i"], birth_parts["year"], "dob_year")

    _wait_and_fill(page, ["#applicant_phone1"], primary_phone, "primary_phone")
    _wait_and_fill(page, ["#applicant_email_address"], email, "email")

    # 强制不勾选短信提醒
    try:
        alert_box = page.locator("#applicant_mobile_alerts").first
        if alert_box.count() > 0 and alert_box.is_checked():
            alert_box.uncheck(timeout=8000)
    except Exception:
        pass

    _wait_and_click(
        page,
        [
            'input[type="radio"][name="applicant[is_a_renewal]"][value="true"]' if is_renewal else 'input[type="radio"][name="applicant[is_a_renewal]"][value="false"]',
            "#applicant_is_a_renewal_true" if is_renewal else "#applicant_is_a_renewal_false",
        ],
        "set_is_renewal",
        timeout=8000,
    )
    _wait_and_click(
        page,
        [
            'input[type="radio"][name="applicant[traveling_to_apply]"][value="true"]' if traveling_to_apply else 'input[type="radio"][name="applicant[traveling_to_apply]"][value="false"]',
            "#applicant_traveling_to_apply_true" if traveling_to_apply else "#applicant_traveling_to_apply_false",
        ],
        "set_traveling_to_apply",
        timeout=8000,
    )

    if not _wait_and_click(
        page,
        [
            'input[type="submit"][value="Create Applicant"]',
            'input[name="commit"][value="Create Applicant"]',
            'button:has-text("Create Applicant")',
            'input[type="submit"][value*="Applicant"]',
        ],
        "create_applicant",
        timeout=20000,
    ):
        raise RuntimeError("未找到 Create Applicant 按钮")
    page.wait_for_load_state("domcontentloaded", timeout=90000)
    page.wait_for_timeout(2500)
    _save_ais_step_screenshot(page, out_dir, "10_after_create_applicant")

    # applicants 页面：点击 Yes
    if not _wait_and_click(
        page,
        ['input[type="submit"][value="Yes"]', 'input[name="commit"][value="Yes"]'],
        "applicants_yes",
        timeout=20000,
    ):
        raise RuntimeError("未找到 Yes 按钮")
    page.wait_for_load_state("domcontentloaded", timeout=90000)
    page.wait_for_timeout(1500)

    # 勾选条件
    if not _wait_and_check(
        page,
        [
            "#scheduling_condition_question_answers_0",
            'input[name="scheduling_condition_question_answers[]"][value="1"]',
        ],
        "uk_residency_checkbox",
        timeout=12000,
    ):
        raise RuntimeError("未找到英国居留条件复选框")

    if not _wait_and_click(
        page,
        ['input[type="submit"][value="Confirm"]', 'input[name="commit"][value="Confirm"]'],
        "applicants_confirm",
        timeout=20000,
    ):
        raise RuntimeError("未找到 Confirm 按钮")
    page.wait_for_load_state("domcontentloaded", timeout=90000)
    page.wait_for_timeout(2000)
    _save_ais_step_screenshot(page, out_dir, "11_after_confirm")

    # add_additional_applicants 页面：点击 No
    if not _wait_and_click(
        page,
        ['a.button.primary:has-text("No")', 'a[href*="/continue"]:has-text("No")'],
        "add_additional_applicants_no",
        timeout=20000,
    ):
        raise RuntimeError("未找到 No 按钮")
    page.wait_for_load_state("domcontentloaded", timeout=90000)
    page.wait_for_timeout(1500)

    # 选择 London 取件点
    if not _wait_and_select(
        page,
        ["#group_delivery_address_id", 'select[name="group[delivery_address_id]"]'],
        "Holborn",
        "delivery_address_london",
        timeout=15000,
    ):
        raise RuntimeError("未找到 London 取件点")

    if not _wait_and_click(
        page,
        ['input[type="submit"][value="Continue"]', 'input[name="commit"][value="Continue"]'],
        "delivery_continue",
        timeout=20000,
    ):
        raise RuntimeError("未找到 Continue 按钮")
    page.wait_for_load_state("domcontentloaded", timeout=90000)
    page.wait_for_timeout(3000)

    current_url = page.url
    if "/payment" not in current_url:
        # 兜底：按 schedule id 强制跳转支付页
        schedule_id = _extract_schedule_id(current_url)
        if not schedule_id:
            raise RuntimeError(f"未进入 payment 页面，且无法解析 schedule id，当前 URL: {current_url}")
        payment_url = f"https://ais.usvisa-info.com/en-gb/niv/schedule/{schedule_id}/payment"
        page.goto(payment_url, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(2500)
        current_url = page.url

    payment_shot = _save_ais_step_screenshot(page, out_dir, "12_payment_page")
    _trace("ais.flow.post_signup.done", current_url)
    return {
        "payment_url": current_url,
        "payment_screenshot": payment_shot,
    }


def send_ais_activation_email(to_email: str, personal_info: Dict, password: str) -> bool:
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD") or os.environ.get("SMTP_PASS", "")
    smtp_host = os.environ.get("SMTP_HOST", "smtp.163.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    if not smtp_user or not smtp_pass:
        print("[ERROR] SMTP not configured, cannot send AIS activation email", file=sys.stderr)
        return False

    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        given_name = str(personal_info.get("given_name", "") or personal_info.get("名", "") or "").strip()
        surname = str(personal_info.get("surname", "") or personal_info.get("姓", "") or "").strip()
        birth_date_raw = personal_info.get("birth_date", "") or personal_info.get("出生年月日", "")
        birth_date = format_date(birth_date_raw) if birth_date_raw else str(birth_date_raw).strip()
        passport_number = str(personal_info.get("passport_number", "") or personal_info.get("护照号", "") or "").strip()
        primary_phone = str(personal_info.get("Primary Phone Number", "") or personal_info.get("主要电话", "") or "").strip()
        chinese_name = str(personal_info.get("chinese_name", "") or personal_info.get("中文名", "") or "").strip()
        account_email = str(personal_info.get("Personal Email Address", "") or personal_info.get("个人邮箱", "") or to_email).strip()
        ds160_number = str(
            personal_info.get("DS-160 Number", "")
            or personal_info.get("DS160 Number", "")
            or personal_info.get("Application ID", "")
            or personal_info.get("AA码", "")
            or personal_info.get("aaCode", "")
            or ""
        ).strip()
        passport_country = str(
            personal_info.get("Country / Authority that issued Passport", "")
            or personal_info.get("护照签发国家", "")
            or "China"
        ).strip()
        birth_country = str(
            personal_info.get("Country of Birth", "")
            or personal_info.get("出生国家", "")
            or "China"
        ).strip()
        residence_country = str(
            personal_info.get("Country of Permanent Residence", "")
            or personal_info.get("常住国家", "")
            or "China"
        ).strip()
        visa_class = str(
            personal_info.get("Visa Class", "")
            or personal_info.get("签证类型", "")
            or "B1/B2 Business & Tourism (Temporary visitor)"
        ).strip()

        birth_day = "-"
        birth_month = "-"
        birth_year = "-"
        if birth_date:
            try:
                dt = pd.to_datetime(birth_date, errors="coerce")
                if not pd.isna(dt):
                    birth_day = str(int(dt.day))
                    birth_month = dt.strftime("%B")
                    birth_year = str(int(dt.year))
            except Exception:
                pass
        if birth_year == "-" and birth_date and re.match(r"^\d{4}-\d{2}-\d{2}$", birth_date):
            year, month, day = birth_date.split("-")
            birth_day = str(int(day))
            birth_month = month
            birth_year = year

        g_name, s_name = html.escape(given_name), html.escape(surname)
        b_date = html.escape(birth_date)
        p_num = html.escape(passport_number)
        p_phone = html.escape(primary_phone)
        c_name = html.escape(chinese_name)
        mail_addr = html.escape(account_email)
        ds160_no = html.escape(ds160_number)
        passport_country_html = html.escape(passport_country)
        birth_country_html = html.escape(birth_country)
        residence_country_html = html.escape(residence_country)
        visa_class_html = html.escape(visa_class)
        birth_day_html = html.escape(birth_day)
        birth_month_html = html.escape(birth_month)
        birth_year_html = html.escape(birth_year)
        birth_display_html = html.escape(
            f"{str(birth_day).zfill(2)}/{str(birth_month).zfill(2)}/{birth_year}"
            if birth_day != "-" and birth_month != "-" and birth_year != "-"
            else birth_date
        )

        greeting_cn = f"您好，{c_name}！" if c_name else "您好！"
        greeting_en = f"Hello, {g_name} {s_name}!" if (g_name or s_name) else "Hello!"

        body_html = f"""
        <html>
          <body style="font-family: 'Microsoft YaHei', Arial, sans-serif; color: #333; padding: 24px; line-height: 1.7; background: #f8fafc;">
            <div style="max-width: 760px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background: #fff;">
              <div style="background: linear-gradient(135deg, #0f62fe, #3b82f6); color: #fff; padding: 20px 24px;">
                <h2 style="margin: 0; font-size: 24px;">AIS 账号注册成功 / AIS Account Created Successfully</h2>
              </div>

              <div style="padding: 24px;">
                <p style="margin: 0 0 8px 0;">{greeting_cn}</p>
                <p style="margin: 0 0 16px 0;">{greeting_en}</p>

                <p style="margin: 0 0 10px 0;">
                  您的 AIS 签证预约账号已成功创建，请先点击系统邮件中的激活链接完成激活。
                </p>
                <p style="margin: 0 0 18px 0;">
                  Your AIS visa appointment account has been created successfully. Please click the activation link in the system email to activate your account first.
                </p>

                <div style="font-weight: 700; margin: 0 0 10px 0;">申请人基础信息 / Applicant Basics</div>
                <table style="border-collapse: collapse; width: 100%; max-width: 620px; margin-bottom: 18px;">
                  <tr style="background: #0f62fe; color: white;">
                    <th style="padding: 12px; text-align: left; border: 1px solid #dbeafe;">字段 / Field</th>
                    <th style="padding: 12px; text-align: left; border: 1px solid #dbeafe;">内容 / Value</th>
                  </tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">名 / Given Name</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{g_name or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">姓 / Surname</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{s_name or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Country / Authority that issued Passport</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{passport_country_html or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Country of Birth</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{birth_country_html or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Country of Permanent Residence</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{residence_country_html or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">护照号 / Passport Number</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{p_num or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">DS-160 Number</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{ds160_no or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Visa Class</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{visa_class_html or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Date of Birth</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{birth_display_html or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">主要电话 / Primary Phone</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{p_phone or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Email Address</td><td style="padding: 10px; border: 1px solid #e5e7eb;">{mail_addr or '-'}</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Were you previously issued a visa to enter the United States?</td><td style="padding: 10px; border: 1px solid #e5e7eb;">No</td></tr>
                  <tr><td style="padding: 10px; border: 1px solid #e5e7eb;">Are you traveling from another country to apply for a U.S. visa in United Kingdom?</td><td style="padding: 10px; border: 1px solid #e5e7eb;">No</td></tr>
                </table>

                <p style="margin: 18px 0 6px 0; color: #6b7280;">此邮件由系统自动发送，请勿直接回复。</p>
                <p style="margin: 0; color: #6b7280;">This email was generated automatically. Please do not reply directly.</p>
              </div>
            </div>
          </body>
        </html>
        """

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = "AIS 账号注册成功 / AIS Account Created Successfully"
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        print(f"[INFO] AIS activation email sent to {to_email}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send AIS activation email: {e}", file=sys.stderr)
        return False


def register_ais(
    excel_path: str,
    password: str = DEFAULT_PASSWORD,
    send_activation_email: bool = True,
    extra_email: str = "",
    test_mode: bool = False,
    output_dir: str = "",
    login_existing_account: bool = False,
) -> Dict:
    def callback(pct: int, msg: str) -> None:
        _progress(pct, msg)

    _trace("register_ais.start", f"excel={excel_path}")
    execution_cfg = _get_execution_config(test_mode)
    _trace(
        "execution.fingerprint",
        json.dumps(
            {
                "platform": platform.platform(),
                "python": sys.version.split()[0],
                **execution_cfg,
            },
            ensure_ascii=False,
        ),
    )
    callback(5, "正在解析 Excel 数据...")
    try:
        _trace("excel.parse.start")
        personal_info_list = load_personal_info_from_excel(excel_path)
        if not personal_info_list:
            _trace("excel.parse.empty", "Excel 中未解析到有效数据")
            return {"success": False, "error": "Excel 中未解析到有效数据"}
        personal_info = personal_info_list[0]

        given_name = str(personal_info.get("given_name", "") or personal_info.get("名", "") or "").strip()
        surname = str(personal_info.get("surname", "") or personal_info.get("姓", "") or "").strip()
        email = str(personal_info.get("Personal Email Address", "") or personal_info.get("个人邮箱", "") or "").strip()
        _trace("excel.parse.done", f"email={email}")

        if not given_name or not surname or not email:
            _trace("excel.validate.failed", "missing required fields")
            return {"success": False, "error": "Excel 缺少必填字段：名(given_name)、姓(surname)、个人邮箱"}

        out_dir = Path(output_dir) if output_dir else Path(excel_path).parent
        mode_text = "无头测试模式" if test_mode else "无头模式"
        callback(10, f"启动浏览器（{mode_text}）...")
        _trace("browser.start", f"headless={execution_cfg['headless']}")

        with sync_playwright() as p:
            browser_args = [
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-dev-shm-usage",
                "--disable-setuid-sandbox",
                "--disable-extensions",
                "--disable-popup-blocking",
                f"--window-size={execution_cfg['viewport_width']},{execution_cfg['viewport_height']}",
            ]
            is_headless = bool(execution_cfg["headless"])
            if is_headless:
                browser_args.extend(["--headless=new", "--disable-gpu", "--no-sandbox"])

            browser = p.chromium.launch(
                headless=is_headless,
                args=browser_args,
                slow_mo=int(execution_cfg["slow_mo"]),
            )
            context = browser.new_context(
                viewport={
                    "width": int(execution_cfg["viewport_width"]),
                    "height": int(execution_cfg["viewport_height"]),
                },
                user_agent=str(execution_cfg["user_agent"]),
                locale=str(execution_cfg["locale"]),
                timezone_id=str(execution_cfg["timezone_id"]),
                ignore_https_errors=True,
                java_script_enabled=True,
                extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"},
            )
            page = context.new_page()
            # 站点波动较大，放宽默认超时，避免 30-45s 假超时
            page.set_default_timeout(int(execution_cfg["default_timeout_ms"]))
            _trace("browser.ready")

            def goto_with_retry(url: str, wait_until: str = "domcontentloaded", timeout_ms: Optional[int] = None, retries: Optional[int] = None):
                timeout_ms = int(timeout_ms or int(execution_cfg["goto_timeout_ms"]))
                retries = int(retries or int(execution_cfg["goto_retries"]))
                last_error = None
                for attempt in range(retries):
                    try:
                        _trace("page.goto.attempt", f"url={url};attempt={attempt + 1}/{retries}")
                        page.goto(url, wait_until=wait_until, timeout=timeout_ms)
                        _trace("page.goto.success", url)
                        return
                    except Exception as e:
                        last_error = e
                        _trace("page.goto.error", f"url={url};attempt={attempt + 1};error={e}")
                        if attempt < retries - 1:
                            page.wait_for_timeout(2000)
                            continue
                raise last_error

            signup_first_selectors = [
                "#user_first_name",
                'input[name="user[first_name]"]',
                'input[name="user[given_name]"]',
                "#user_given_name",
                'input[id*="given_name"]',
                'input[id*="first_name"]',
                'input[autocomplete="given-name"]',
                'form#new_user input[type="text"]',
                'form#new_user input[type="email"]',
            ]

            def _scroll_signup_into_view() -> None:
                try:
                    page.evaluate("() => { window.scrollTo(0, 0); }")
                    page.wait_for_timeout(400)
                    page.evaluate("() => { window.scrollTo(0, Math.min(800, document.body.scrollHeight)); }")
                except Exception:
                    pass

            def _wait_signup_by_label(timeout_ms: int) -> bool:
                for pattern in (r"given\s*name", r"first\s*name"):
                    try:
                        page.get_by_label(re.compile(pattern, re.I)).first.wait_for(state="visible", timeout=timeout_ms)
                        _trace("signup_form.wait.success", f"label_re={pattern}")
                        return True
                    except Exception:
                        continue
                return False

            def ensure_signup_form_loaded() -> None:
                """确保已进入 AIS 注册表单页（含 /niv/signup 等路径）。"""

                def _wait_signup_once(timeout_ms: int) -> bool:
                    if _is_ais_signup_url(page.url):
                        _scroll_signup_into_view()
                    for sel in signup_first_selectors:
                        try:
                            loc = page.locator(sel).first
                            loc.wait_for(state="visible", timeout=timeout_ms)
                            _trace("signup_form.wait.success", sel)
                            return True
                        except Exception:
                            continue
                    if _wait_signup_by_label(min(timeout_ms, 12000)):
                        return True
                    return False

                if _wait_signup_once(28000):
                    return

                # 已在注册 URL 时只等待表单，不要再点 Continue（该页没有 Continue）
                if _is_ais_signup_url(page.url):
                    _trace("signup_form.wait.fallback", f"signup_url_only;url={page.url}")
                    for attempt in range(3):
                        _scroll_signup_into_view()
                        page.wait_for_timeout(2000)
                        try:
                            page.wait_for_load_state("domcontentloaded", timeout=15000)
                        except Exception:
                            pass
                        if _wait_signup_once(35000):
                            return
                        if _wait_signup_by_label(15000):
                            return
                    raise RuntimeError(f"注册页已打开但未找到姓名字段，URL: {page.url}")

                # 非注册 URL：保持同一会话，在原页重新触发 Continue
                _trace("signup_form.wait.fallback", f"url={page.url}")
                for retry in range(2):
                    current_url = page.url
                    title = ""
                    body_head = ""
                    try:
                        title = (page.title() or "").strip()
                    except Exception:
                        pass
                    try:
                        body_head = (page.locator("body").inner_text(timeout=5000) or "").strip().lower()[:240]
                    except Exception:
                        pass

                    if "404" in title.lower() or "page not found" in body_head:
                        _trace("signup_form.wait.detect_404", f"retry={retry + 1};url={current_url}")
                        goto_with_retry(AIS_BASE_URL, wait_until="domcontentloaded", timeout_ms=120000, retries=2)
                        page.wait_for_timeout(2000)

                    if _is_ais_signup_url(page.url):
                        _trace("signup_form.wait.signup_after_nav", page.url)
                        if _wait_signup_once(35000):
                            return
                        continue

                    _trace("signup_form.wait.retrigger_continue", f"retry={retry + 1};url={page.url}")
                    select_ds160_option()
                    click_continue_button()
                    page.wait_for_timeout(3000)
                    if _wait_signup_once(30000):
                        return

                raise RuntimeError(f"未进入注册表单页，当前 URL: {page.url}")

            def is_signup_form_visible(timeout_ms: int = 3000) -> bool:
                if _is_ais_signup_url(page.url):
                    try:
                        if page.locator("form#new_user").first.is_visible(timeout=min(timeout_ms, 5000)):
                            return True
                    except Exception:
                        pass
                for sel in signup_first_selectors:
                    try:
                        if page.locator(sel).first.is_visible(timeout=timeout_ms):
                            return True
                    except Exception:
                        continue
                try:
                    if page.get_by_label(re.compile(r"given\s*name", re.I)).first.is_visible(timeout=timeout_ms):
                        return True
                except Exception:
                    pass
                return False

            def select_ds160_option() -> None:
                _trace("step.select_ds160.start")
                if _is_ais_signup_url(page.url):
                    _trace("step.select_ds160.skip", "signup_url")
                    return
                if is_signup_form_visible(timeout_ms=1500):
                    _trace("step.select_ds160.skip", "signup_form_already_visible")
                    return
                selected = False
                # 部分地区/页面结构会变动：有时是 checkbox，有时是 radio，甚至该问题不存在。
                # 优先尝试勾选“已完成 DS-160”，失败后允许走 Continue 再判断。
                ds160_locators = (
                    'input#answer_completed_ds160_form',
                    'input[name="answer[completed_ds160_form]"]',
                    'input[type="checkbox"][id*="ds160"]',
                    'input[type="radio"][id*="ds160"]',
                    'input[type="radio"][name*="ds160"]',
                    'label[for="answer_completed_ds160_form"]',
                )

                for sel in ds160_locators:
                    try:
                        loc = page.locator(sel).first
                        if loc.count() == 0:
                            continue
                        tag = (loc.evaluate("el => el.tagName.toLowerCase()") or "").strip()
                        if tag == "input":
                            input_type = (loc.get_attribute("type") or "").lower()
                            if input_type in ("checkbox", "radio"):
                                loc.check(timeout=8000)
                            else:
                                loc.click(timeout=8000)
                        else:
                            loc.click(timeout=8000)
                        selected = True
                        _trace("step.select_ds160.done", f"selector={sel}")
                        break
                    except Exception:
                        continue

                if selected:
                    return

                # 文本兜底：只要有 DS-160 相关文案，尽量点击文案附近元素。
                for txt in (
                    "I have completed the U.S. Nonimmigrant Visa Application (DS-160) form",
                    "completed the U.S. Nonimmigrant Visa Application",
                    "DS-160",
                ):
                    try:
                        page.locator(f"text={txt}").first.click(timeout=8000)
                        selected = True
                        _trace("step.select_ds160.done", f"text={txt}")
                        break
                    except Exception:
                        continue

                if not selected:
                    current_url = page.url
                    title = ""
                    body_head = ""
                    try:
                        title = (page.title() or "").strip()
                    except Exception:
                        pass
                    try:
                        body_head = (page.locator("body").inner_text(timeout=6000) or "").strip()[:280]
                    except Exception:
                        pass
                    # 不再硬失败，让后续 Continue 去判断是否该题可跳过。
                    _trace(
                        "step.select_ds160.skipped",
                        f"url={current_url};title={title};body_head={body_head}",
                    )

            def click_continue_button() -> None:
                _trace("step.click_continue.start")
                if _is_ais_signup_url(page.url):
                    _trace("step.click_continue.skip", "signup_url")
                    return
                if is_signup_form_visible(timeout_ms=1500):
                    _trace("step.click_continue.skip", "signup_form_already_visible")
                    return
                continue_btn = page.locator(
                    'button:has-text("Continue"), input.primary.button[value="Continue"], input[type="submit"][value="Continue"], .button.primary'
                ).first
                continue_btn.wait_for(state="visible", timeout=30000)
                clicked = False
                for click_action in (
                    lambda: continue_btn.click(timeout=20000),
                    lambda: continue_btn.click(timeout=20000, force=True),
                    lambda: page.evaluate(
                        "() => { const b = document.querySelector(\"button, input[type='submit'], input[value='Continue'], .button.primary\"); if (b) { b.click(); return true; } return false; }"
                    ),
                ):
                    try:
                        click_action()
                        clicked = True
                        _trace("step.click_continue.done")
                        break
                    except Exception:
                        continue
                if not clicked:
                    _trace("step.click_continue.failed", "button_not_clickable")
                    raise RuntimeError("无法点击 Continue 按钮")

            def login_existing_account_and_open_applicant_flow() -> str:
                callback(15, "正在打开 AIS 登录页...")
                _trace("step.login.open.start")
                goto_with_retry(AIS_SIGN_IN_URL, wait_until="domcontentloaded", timeout_ms=120000, retries=3)
                page.wait_for_timeout(3000)
                _trace("step.login.open.done", page.url)
                _save_ais_step_screenshot(page, str(out_dir), "01_login_page")

                callback(25, "正在登录已有 AIS 账号...")
                if not _wait_and_fill(
                    page,
                    ["#user_email", 'input[name="user[email]"]', 'input[type="email"]'],
                    email,
                    "login_email",
                    timeout=20000,
                ):
                    try:
                        page.get_by_label(re.compile(r"email", re.I)).first.fill(email, timeout=15000)
                        _trace("step.login.fill", "email;label_re")
                    except Exception as ex:
                        raise RuntimeError(f"无法填写 AIS 登录邮箱: {ex}")

                if not _wait_and_fill(
                    page,
                    ["#user_password", 'input[name="user[password]"]', 'input[type="password"]'],
                    password,
                    "login_password",
                    timeout=20000,
                ):
                    try:
                        page.get_by_label(re.compile(r"password", re.I)).first.fill(password, timeout=15000)
                        _trace("step.login.fill", "password;label_re")
                    except Exception as ex:
                        raise RuntimeError(f"无法填写 AIS 登录密码: {ex}")

                _wait_and_check(
                    page,
                    [
                        "#policy_confirmed",
                        "#user_policy_confirmed",
                        'input[name="policy_confirmed"]',
                        'input[name="user[policy_confirmed]"]',
                        'form#new_user input[type="checkbox"]',
                        'form input[type="checkbox"]',
                    ],
                    "login_terms",
                    timeout=12000,
                )

                if not _wait_and_click(
                    page,
                    [
                        'input[type="submit"][value="Sign In"]',
                        'input[name="commit"][value="Sign In"]',
                        'button:has-text("Sign In")',
                        'input[type="submit"][value*="Sign"]',
                    ],
                    "login_submit",
                    timeout=20000,
                ):
                    raise RuntimeError("未找到 Sign In 按钮")

                try:
                    page.wait_for_load_state("domcontentloaded", timeout=90000)
                except Exception:
                    pass
                page.wait_for_timeout(3000)
                _trace("step.login.submit.done", page.url)
                _save_ais_step_screenshot(page, str(out_dir), "02_login_submitted")

                if _is_ais_activation_email_sent_page(page):
                    raise RuntimeError("AIS 账号还没有完成邮箱激活，请先打开邮箱点击官方激活链接")

                if _is_ais_signin_url(page.url):
                    error_text = _extract_login_error_text(page) or "AIS 登录失败，请确认邮箱、密码、条款勾选和账号激活状态"
                    raise RuntimeError(error_text[:200])

                callback(45, "登录成功，正在进入申请人流程...")
                _trace("step.login.flow.start", page.url)
                goto_with_retry(AIS_BASE_URL, wait_until="domcontentloaded", timeout_ms=120000, retries=3)
                page.wait_for_timeout(3000)
                _save_ais_step_screenshot(page, str(out_dir), "03_after_login_open_ais")
                select_ds160_option()
                page.wait_for_timeout(1500)
                click_continue_button()
                page.wait_for_timeout(3000)

                state = _wait_until_post_signup_ready(page, timeout_ms=90000)
                _trace("step.login.flow.state", f"{state};url={page.url}")
                _save_ais_step_screenshot(page, str(out_dir), f"04_after_login_flow_{state}")

                if state == "activation_email_sent":
                    raise RuntimeError("AIS 账号还没有完成邮箱激活，请先打开邮箱点击官方激活链接")
                if state in ("still_signup", "signup_error") or _is_ais_signup_url(page.url):
                    signup_error = _extract_signup_error_text(page)
                    if signup_error:
                        raise RuntimeError(f"登录后仍进入注册页：{signup_error[:160]}")
                    raise RuntimeError("登录后仍进入 signup 页面，请确认该邮箱已经完成 AIS 官方激活")
                return state

            try:
                if login_existing_account:
                    callback(12, "准备登录已有 AIS 账号...")
                    _trace("login_existing.start", email)
                    login_state = login_existing_account_and_open_applicant_flow()
                    _trace("login_existing.ready", login_state)

                    callback(92, "正在进入支付页并抓取截图...")
                    payment_flow = _complete_post_signup_flow(page, personal_info, str(out_dir))
                    _trace("login_existing.payment.done", payment_flow.get("payment_url", ""))

                    callback(100, "已登录 AIS 账号并推进到支付页")
                    return {
                        "success": True,
                        "message": f"已登录 AIS 账号 {email}，并推进到 Payment 页面",
                        "registration_status": "existing_account_payment_ready",
                        "activation_required": False,
                        "email": email,
                        "chinese_name": str(personal_info.get("chinese_name", "") or personal_info.get("中文名", "") or "").strip(),
                        "account_password": password,
                        "payment_url": payment_flow.get("payment_url", ""),
                        "payment_screenshot": payment_flow.get("payment_screenshot", ""),
                    }

                callback(15, "正在访问 AIS 网站...")
                _trace("step.open_ais.start")
                goto_with_retry(AIS_BASE_URL, wait_until="domcontentloaded", timeout_ms=120000, retries=3)
                page.wait_for_timeout(5000)
                _trace("step.open_ais.done", page.url)
                _save_ais_step_screenshot(page, str(out_dir), "01_open_ais_done")

                callback(25, "正在选择 DS-160 完成选项...")
                select_ds160_option()
                page.wait_for_timeout(4000)
                _save_ais_step_screenshot(page, str(out_dir), "02_select_ds160_done")

                callback(30, "正在点击 Continue...")
                click_continue_button()
                _save_ais_step_screenshot(page, str(out_dir), "03_click_continue_done")

                ensure_signup_form_loaded()
                page.wait_for_timeout(2000)
                _save_ais_step_screenshot(page, str(out_dir), "04_signup_form_loaded")

                callback(35, "等待注册表单加载...")
                ensure_signup_form_loaded()
                page.wait_for_timeout(3000)
                _save_ais_step_screenshot(page, str(out_dir), "05_signup_form_stable")

                callback(40, "正在填写注册表单...")
                _trace("step.fill_form.start")
                # 先截图当前页面（若后续填写失败，可作错误诊断）
                _save_ais_step_screenshot(page, str(out_dir), "06_before_fill")

                def _fill_first_matching(selectors: List[str], value: str, field_name: str) -> None:
                    last_err: Optional[Exception] = None
                    for sel in selectors:
                        try:
                            page.locator(sel).first.fill(value, timeout=15000)
                            _trace("step.fill_form.field", f"{field_name};selector={sel}")
                            return
                        except Exception as ex:
                            last_err = ex
                            continue
                    if field_name == "surname":
                        try:
                            page.locator('form#new_user input[type="text"]').nth(1).fill(value, timeout=15000)
                            _trace("step.fill_form.field", "surname;form_text_nth_1")
                            return
                        except Exception as ex:
                            last_err = ex
                    try:
                        label_re = re.compile(r"given\s*name", re.I) if field_name == "given" else re.compile(r"surname|last\s*name", re.I)
                        page.get_by_label(label_re).first.fill(value, timeout=15000)
                        _trace("step.fill_form.field", f"{field_name};label_re")
                        return
                    except Exception as ex:
                        last_err = ex
                    raise RuntimeError(f"无法填写{field_name}字段: {last_err}")

                _fill_first_matching(
                    [
                        "#user_first_name",
                        'input[name="user[first_name]"]',
                        'input[name="user[given_name]"]',
                        "#user_given_name",
                        'input[autocomplete="given-name"]',
                        'form#new_user input[type="text"]',
                    ],
                    given_name,
                    "given",
                )
                _fill_first_matching(
                    [
                        "#user_last_name",
                        'input[name="user[last_name]"]',
                        'input[name="user[family_name]"]',
                        "#user_family_name",
                        'input[autocomplete="family-name"]',
                    ],
                    surname,
                    "surname",
                )
                email_filled = False
                for sel in ('#user_email', 'input[name="user[email]"]', 'input[type="email"]'):
                    try:
                        if page.locator(sel).count() == 0:
                            continue
                        page.locator(sel).first.fill(email, timeout=15000)
                        _trace("step.fill_form.field", f"email;selector={sel}")
                        email_filled = True
                        break
                    except Exception:
                        continue
                if not email_filled:
                    page.get_by_label(re.compile(r"email", re.I)).first.fill(email, timeout=15000)
                    _trace("step.fill_form.field", "email;label_re")
                email_conf_filled = False
                for sel in ('#user_email_confirmation', 'input[name="user[email_confirmation]"]'):
                    try:
                        if page.locator(sel).count() == 0:
                            continue
                        page.locator(sel).first.fill(email, timeout=15000)
                        _trace("step.fill_form.field", f"email_confirm;selector={sel}")
                        email_conf_filled = True
                        break
                    except Exception:
                        continue
                if not email_conf_filled:
                    try:
                        emails = page.locator('form#new_user input[type="email"]')
                        if emails.count() >= 2:
                            emails.nth(1).fill(email, timeout=15000)
                            _trace("step.fill_form.field", "email_confirm;form_email_nth_1")
                    except Exception:
                        pass

                pw_filled = False
                for sel in ("#user_password", 'input[name="user[password]"]'):
                    try:
                        if page.locator(sel).count() == 0:
                            continue
                        page.locator(sel).first.fill(password, timeout=15000)
                        _trace("step.fill_form.field", f"password;selector={sel}")
                        pw_filled = True
                        break
                    except Exception:
                        continue
                if not pw_filled:
                    pw_inputs = page.locator('form#new_user input[type="password"]')
                    if pw_inputs.count() >= 1:
                        pw_inputs.nth(0).fill(password, timeout=15000)
                        _trace("step.fill_form.field", "password;form_pw_nth_0")
                        pw_filled = True

                pw_conf_filled = False
                for sel in ("#user_password_confirmation", 'input[name="user[password_confirmation]"]'):
                    try:
                        if page.locator(sel).count() == 0:
                            continue
                        page.locator(sel).first.fill(password, timeout=12000)
                        _trace("step.fill_form.field", f"password_confirm;selector={sel}")
                        pw_conf_filled = True
                        break
                    except Exception:
                        continue
                if not pw_conf_filled:
                    try:
                        pw_inputs2 = page.locator('form#new_user input[type="password"]')
                        if pw_inputs2.count() >= 2:
                            pw_inputs2.nth(1).fill(password, timeout=15000)
                            _trace("step.fill_form.field", "password_confirm;form_pw_nth_1")
                    except Exception:
                        pass

                try:
                    terms_label = page.locator('form#new_user label.icheck-label').filter(has_text="read")
                    terms_label.first.click(timeout=10000)
                except Exception:
                    try:
                        page.locator('form#new_user input[type="checkbox"]').first.check(timeout=10000)
                    except Exception:
                        pass
                page.wait_for_timeout(1000)
                _trace("step.fill_form.done")
                _save_ais_step_screenshot(page, str(out_dir), "07_fill_form_done")

                callback(80, "正在提交创建账号...")
                _trace("step.submit.start")
                if not _wait_and_click(
                    page,
                    [
                        'input[type="submit"][value="Create Account"]',
                        'input[name="commit"][value="Create Account"]',
                        'button:has-text("Create Account")',
                        'input[type="submit"][value*="Account"]',
                    ],
                    "create_account",
                    timeout=20000,
                ):
                    raise RuntimeError("未找到 Create Account 按钮")
                page.wait_for_timeout(2500)
                _trace("step.submit.done", page.url)

                callback(90, "正在检查注册结果...")
                _trace("step.check_result.start")

                post_signup_state = _wait_until_post_signup_ready(page, timeout_ms=90000)
                _trace("step.check_result.state", f"{post_signup_state};url={page.url}")
                _save_ais_step_screenshot(page, str(out_dir), f"08_submit_{post_signup_state}")

                error_el = page.locator('form#new_user small.error')
                if error_el.count() > 0:
                    error_text = (error_el.first.text_content() or "").strip()
                    if "has already been taken" in error_text.lower():
                        _trace("step.check_result.email_taken", error_text)
                        screenshot = _save_ais_error_screenshot(page, str(out_dir), "email_taken")
                        return {
                            "success": False,
                            "error": f"该邮箱（{email}）已被注册，请使用其他邮箱或直接登录",
                            "error_code": "EMAIL_ALREADY_TAKEN",
                            "screenshot": screenshot,
                            "email": email,
                        }

                if post_signup_state == "activation_email_sent":
                    callback(92, "AIS 账号已创建，等待邮箱激活...")
                    _trace("step.check_result.activation_email_sent", email)
                    activation_screenshot = _save_ais_step_screenshot(page, str(out_dir), "10_activation_email_sent")

                    if send_activation_email:
                        callback(95, "正在发送激活指引邮件...")
                        _trace("step.send_email.start", email)
                        send_ais_activation_email(email, personal_info, password)
                        if extra_email and extra_email.strip() and extra_email.strip().lower() != email.lower():
                            send_ais_activation_email(extra_email.strip(), personal_info, password)
                        _trace("step.send_email.done")

                    extra_email_msg = ""
                    if send_activation_email and extra_email and extra_email.strip() and extra_email.strip().lower() != email.lower():
                        extra_email_msg = f"，并抄送 {extra_email.strip()}"
                    callback(100, "AIS 账号创建完成，官方激活邮件已发送！")
                    _trace("register_ais.success.activation_email_sent", email)
                    return {
                        "success": True,
                        "message": f"AIS 账号已创建，官方激活邮件已发送到 {email}，请先完成邮箱激活后再继续填写申请人资料{extra_email_msg}",
                        "registration_status": "activation_email_sent",
                        "activation_required": True,
                        "activation_screenshot": activation_screenshot or "",
                        "email": email,
                        "chinese_name": str(personal_info.get("chinese_name", "") or personal_info.get("中文名", "") or "").strip(),
                        "account_password": password,
                        "payment_url": "",
                        "payment_screenshot": "",
                    }

                if post_signup_state in ("still_signup", "signup_error"):
                    error_text = _extract_signup_error_text(page) or "注册后仍停留在 signup 页面（可能是条款未勾选、验证码或字段校验失败）"
                    _trace("step.check_result.still_signup", error_text[:160])
                    html_snapshot = _save_ais_debug_html(page, str(out_dir), post_signup_state)
                    screenshot = _save_ais_error_screenshot(page, str(out_dir), error_text)
                    error_message = error_text[:200]
                    if "already" in error_text.lower() and "email" in error_text.lower():
                        error_message = f"该邮箱（{email}）已被 AIS 注册，请打开邮箱激活已有账号，或换一个邮箱重新注册"
                    return {
                        "success": False,
                        "error": error_message,
                        "screenshot": screenshot,
                        "debug_html": html_snapshot,
                        "email": email,
                    }

                current_url = page.url
                if "niv_questions" in current_url or "new_user" in current_url:
                    err_el = page.locator(".error, .alert-danger, .field_with_errors")
                    if err_el.count() > 0:
                        error_text = err_el.first.text_content() or "注册失败"
                        _trace("step.check_result.failed", error_text[:160])
                        screenshot = _save_ais_error_screenshot(page, str(out_dir), error_text)
                        return {"success": False, "error": error_text[:200], "screenshot": screenshot, "email": email}

                callback(92, "正在进入支付页并抓取截图...")
                _trace("step.payment_flow.start")
                payment_flow = _complete_post_signup_flow(page, personal_info, str(out_dir))
                _trace("step.payment_flow.done", payment_flow.get("payment_url", ""))

                if send_activation_email:
                    callback(95, "正在发送激活指引邮件...")
                    _trace("step.send_email.start", email)
                    send_ais_activation_email(email, personal_info, password)
                    if extra_email and extra_email.strip() and extra_email.strip().lower() != email.lower():
                        send_ais_activation_email(extra_email.strip(), personal_info, password)
                    _trace("step.send_email.done")

                callback(100, "AIS 账号注册完成！")
                _trace("register_ais.success", email)
                extra_email_msg = ""
                if send_activation_email and extra_email and extra_email.strip() and extra_email.strip().lower() != email.lower():
                    extra_email_msg = f"，并抄送 {extra_email.strip()}"
                return {
                    "success": True,
                    "message": f"AIS 账号注册完成，已向 {email} 发送激活指引邮件{extra_email_msg}",
                    "email": email,
                    "chinese_name": str(personal_info.get("chinese_name", "") or personal_info.get("中文名", "") or "").strip(),
                    "account_password": password,
                    "payment_url": payment_flow.get("payment_url", ""),
                    "payment_screenshot": payment_flow.get("payment_screenshot", ""),
                }

            except Exception as e:
                import traceback
                _trace("register_ais.exception", str(e))
                print(f"[ERROR] AIS 注册异常: {traceback.format_exc()}", file=sys.stderr)
                screenshot = None
                try:
                    screenshot = _save_ais_error_screenshot(page, str(out_dir), str(e))
                    if not screenshot:
                        screenshot = _save_ais_error_screenshot(page, str(out_dir), "error")
                except Exception as ex:
                    print(f"[WARNING] 保存异常截图失败: {ex}", file=sys.stderr)
                return {"success": False, "error": str(e), "screenshot": screenshot, "email": email or ""}
            finally:
                try:
                    browser.close()
                except Exception:
                    pass

    except Exception as e:
        import traceback
        _trace("register_ais.fatal", str(e))
        print(f"[ERROR] AIS 注册失败: {traceback.format_exc()}", file=sys.stderr)
        return {"success": False, "error": str(e)}


def main() -> None:
    parser = argparse.ArgumentParser(description="AIS 账号注册 CLI")
    parser.add_argument("excel_path", help="Excel 文件路径（含名、姓、个人邮箱）")
    parser.add_argument("--password", "-p", default=DEFAULT_PASSWORD, help="账号密码")
    parser.add_argument("--output-dir", "-o", default="", help="输出目录（截图等）")
    parser.add_argument("--no-email", action="store_true", help="不发送激活指引邮件")
    parser.add_argument("--extra-email", default="", help="抄送邮箱")
    parser.add_argument("--test-mode", "-t", action="store_true", help="测试模式（仍使用无头，仅增加慢速执行）")
    parser.add_argument("--login-existing", action="store_true", help="跳过注册，直接登录已激活 AIS 账号并推进到支付页")
    args = parser.parse_args()
    result = register_ais(
        excel_path=args.excel_path,
        password=args.password,
        send_activation_email=not args.no_email,
        extra_email=args.extra_email,
        test_mode=args.test_mode,
        output_dir=args.output_dir,
        login_existing_account=args.login_existing,
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

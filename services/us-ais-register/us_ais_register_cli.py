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
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from playwright.sync_api import sync_playwright

AIS_BASE_URL = "https://ais.usvisa-info.com/en-gb/niv/information/niv_questions"
DEFAULT_PASSWORD = "Visa202520252025!"


def _progress(pct: int, msg: str) -> None:
    print(f"PROGRESS:{pct}:{msg}", file=sys.stderr, flush=True)


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
            page.screenshot(path=str(screenshot_path), full_page=True, timeout=5000)
        except Exception:
            try:
                page.screenshot(path=str(screenshot_path), full_page=False, timeout=3000)
            except Exception as ex:
                print(f"[WARNING] 截图失败: {ex}", file=sys.stderr)
                return None
        if screenshot_path.exists():
            print(f"[INFO] 已保存错误截图: {filename}", file=sys.stderr)
            return filename
    except Exception as e:
        print(f"[WARNING] 保存 AIS 错误截图失败: {e}", file=sys.stderr)
    return None


def send_ais_activation_email(to_email: str, personal_info: Dict, password: str) -> bool:
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD") or os.environ.get("SMTP_PASS", "")
    smtp_host = os.environ.get("SMTP_HOST", "smtp.163.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "465"))
    if not smtp_user or not smtp_pass:
        print("[ERROR] 未配置 SMTP，无法发送激活指引邮件", file=sys.stderr)
        return False
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        given_name = str(personal_info.get("given_name", "") or personal_info.get("名", "") or "").strip()
        surname = str(personal_info.get("surname", "") or personal_info.get("姓", "") or "").strip()
        birth_date_raw = personal_info.get("birth_date", "") or personal_info.get("出生年月日", "")
        birth_date = format_date(birth_date_raw) if birth_date_raw else str(birth_date_raw).strip()
        passport_number = str(personal_info.get("passport_number", "") or personal_info.get("护照号", "") or "").strip()
        primary_phone = str(personal_info.get("Primary Phone Number", "") or personal_info.get("主要电话", "") or "").strip()
        chinese_name = str(personal_info.get("chinese_name", "") or personal_info.get("中文名", "") or "").strip()

        g_name, s_name = html.escape(given_name), html.escape(surname)
        b_date = html.escape(birth_date)
        p_num = html.escape(passport_number)
        p_phone = html.escape(primary_phone)
        c_name = html.escape(chinese_name)

        body_html = f"""
        <html><body style="font-family: 'Microsoft YaHei', Arial, sans-serif; color: #333; padding: 20px;">
            <h2 style="color: #007bff;">AIS 账号注册成功 - 激活指引</h2>
            <p>您好{c_name and f'，{c_name}' or ''}！</p>
            <p>您的 AIS 签证预约账号已成功创建，请点击邮件中的激活链接完成激活。</p>
            <p>激活后请按以下表格填写：</p>
            <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
                <tr style="background: #007bff; color: white;"><th style="padding: 12px;">字段</th><th style="padding: 12px;">填写内容</th></tr>
                <tr><td style="padding: 10px; border: 1px solid #eee;">名 Given name</td><td style="padding: 10px; border: 1px solid #eee;">{g_name}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #eee;">姓 Surname</td><td style="padding: 10px; border: 1px solid #eee;">{s_name}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #eee;">护照号</td><td style="padding: 10px; border: 1px solid #eee;">{p_num}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #eee;">出生日期</td><td style="padding: 10px; border: 1px solid #eee;">{b_date}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #eee;">主要电话</td><td style="padding: 10px; border: 1px solid #eee;">{p_phone}</td></tr>
            </table>
            <p style="color: #888;">祝您签证顺利！</p>
        </body></html>
        """
        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = "AIS 账号注册成功 - 请激活"
        msg.attach(MIMEText(body_html, "html", "utf-8"))
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f"[INFO] AIS 激活指引邮件已发送至 {to_email}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[ERROR] 发送 AIS 激活指引邮件失败: {e}", file=sys.stderr)
        return False


def register_ais(
    excel_path: str,
    password: str = DEFAULT_PASSWORD,
    send_activation_email: bool = True,
    extra_email: str = "",
    test_mode: bool = False,
    output_dir: str = "",
) -> Dict:
    def callback(pct: int, msg: str) -> None:
        _progress(pct, msg)

    callback(5, "正在解析 Excel 数据...")
    try:
        personal_info_list = load_personal_info_from_excel(excel_path)
        if not personal_info_list:
            return {"success": False, "error": "Excel 中未解析到有效数据"}
        personal_info = personal_info_list[0]

        given_name = str(personal_info.get("given_name", "") or personal_info.get("名", "") or "").strip()
        surname = str(personal_info.get("surname", "") or personal_info.get("姓", "") or "").strip()
        email = str(personal_info.get("Personal Email Address", "") or personal_info.get("个人邮箱", "") or "").strip()

        if not given_name or not surname or not email:
            return {"success": False, "error": "Excel 缺少必填字段：名(given_name)、姓(surname)、个人邮箱"}

        out_dir = Path(output_dir) if output_dir else Path(excel_path).parent
        mode_text = "有头模式（测试）" if test_mode else "无头模式"
        callback(10, f"启动浏览器（{mode_text}）...")

        with sync_playwright() as p:
            browser_args = [
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-dev-shm-usage",
                "--disable-setuid-sandbox",
                "--disable-extensions",
                "--disable-popup-blocking",
                "--window-size=1920,1080",
            ]
            is_headless = False  # 有头模式便于排查，完成调试后可改回 not test_mode
            if is_headless:
                browser_args.extend(["--headless=new", "--disable-gpu", "--no-sandbox"])

            browser = p.chromium.launch(
                headless=is_headless,
                args=browser_args,
                slow_mo=100 if test_mode else 0,
            )
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ignore_https_errors=True,
                java_script_enabled=True,
            )
            page = context.new_page()

            try:
                callback(15, "正在访问 AIS 网站...")
                page.goto(AIS_BASE_URL, wait_until="load", timeout=90000)
                page.wait_for_timeout(5000)

                callback(25, "正在选择 DS-160 完成选项...")
                label = page.locator('label[for="answer_completed_ds160_form"]')
                label.wait_for(state="visible", timeout=25000)
                label.click(timeout=15000)
                page.wait_for_timeout(4000)

                callback(30, "正在点击 Continue...")
                continue_btn = page.locator('input.primary.button[value="Continue"], input[type="submit"][value="Continue"]')
                continue_btn.wait_for(state="visible", timeout=20000)
                continue_btn.click(timeout=15000)
                page.wait_for_load_state("networkidle", timeout=45000)
                page.wait_for_timeout(8000)

                callback(35, "等待注册表单加载...")
                page.wait_for_selector("#user_first_name", state="visible", timeout=45000)
                page.wait_for_timeout(6000)

                callback(40, "正在填写注册表单...")
                # 先截图当前页面（若后续填写失败，可作错误诊断）
                _save_ais_error_screenshot(page, str(out_dir), "before_fill")
                page.fill("#user_first_name", given_name, timeout=20000)
                page.fill("#user_last_name", surname, timeout=20000)
                page.fill("#user_email", email, timeout=20000)
                page.fill("#user_email_confirmation", email, timeout=20000)
                page.fill("#user_password", password, timeout=20000)
                page.fill("#user_password_confirmation", password, timeout=20000)

                try:
                    terms_label = page.locator('form#new_user label.icheck-label').filter(has_text="read")
                    terms_label.first.click(timeout=10000)
                except Exception:
                    try:
                        page.locator('form#new_user input[type="checkbox"]').first.check(timeout=10000)
                    except Exception:
                        pass
                page.wait_for_timeout(1000)

                callback(80, "正在提交创建账号...")
                page.click('input[value="Create Account"]', timeout=15000)
                page.wait_for_timeout(8000)

                callback(90, "正在检查注册结果...")
                error_el = page.locator('form#new_user small.error')
                if error_el.count() > 0:
                    error_text = (error_el.first.text_content() or "").strip()
                    if "has already been taken" in error_text.lower():
                        screenshot = _save_ais_error_screenshot(page, str(out_dir), "email_taken")
                        return {
                            "success": False,
                            "error": f"该邮箱（{email}）已被注册，请使用其他邮箱或直接登录",
                            "error_code": "EMAIL_ALREADY_TAKEN",
                            "screenshot": screenshot,
                            "email": email,
                        }

                current_url = page.url
                if "niv_questions" in current_url or "new_user" in current_url:
                    err_el = page.locator(".error, .alert-danger, .field_with_errors")
                    if err_el.count() > 0:
                        error_text = err_el.first.text_content() or "注册失败"
                        screenshot = _save_ais_error_screenshot(page, str(out_dir), error_text)
                        return {"success": False, "error": error_text[:200], "screenshot": screenshot, "email": email}

                if send_activation_email:
                    callback(95, "正在发送激活指引邮件...")
                    send_ais_activation_email(email, personal_info, password)
                    if extra_email and extra_email.strip() and extra_email.strip().lower() != email.lower():
                        send_ais_activation_email(extra_email.strip(), personal_info, password)

                callback(100, "AIS 账号注册完成！")
                # 有头模式：关闭前等待，方便用户查看结果页面
                if not is_headless or test_mode:
                    print("[INFO] 3 秒后关闭浏览器...", file=sys.stderr)
                    page.wait_for_timeout(3000)
                extra_email_msg = ""
                if send_activation_email and extra_email and extra_email.strip() and extra_email.strip().lower() != email.lower():
                    extra_email_msg = f"，并抄送 {extra_email.strip()}"
                return {
                    "success": True,
                    "message": f"AIS 账号注册完成，已向 {email} 发送激活指引邮件{extra_email_msg}",
                    "email": email,
                }

            except Exception as e:
                import traceback
                print(f"[ERROR] AIS 注册异常: {traceback.format_exc()}", file=sys.stderr)
                screenshot = None
                try:
                    screenshot = _save_ais_error_screenshot(page, str(out_dir), str(e))
                    if not screenshot:
                        screenshot = _save_ais_error_screenshot(page, str(out_dir), "error")
                except Exception as ex:
                    print(f"[WARNING] 保存异常截图失败: {ex}", file=sys.stderr)
                # 有头模式或测试模式：关闭前等待，方便用户查看页面
                if not is_headless or test_mode:
                    print("[INFO] 5 秒后关闭浏览器，请查看当前页面状态...", file=sys.stderr)
                    page.wait_for_timeout(5000)
                return {"success": False, "error": str(e), "screenshot": screenshot, "email": email or ""}
            finally:
                try:
                    browser.close()
                except Exception:
                    pass

    except Exception as e:
        import traceback
        print(f"[ERROR] AIS 注册失败: {traceback.format_exc()}", file=sys.stderr)
        return {"success": False, "error": str(e)}


def main() -> None:
    parser = argparse.ArgumentParser(description="AIS 账号注册 CLI")
    parser.add_argument("excel_path", help="Excel 文件路径（含名、姓、个人邮箱）")
    parser.add_argument("--password", "-p", default=DEFAULT_PASSWORD, help="账号密码")
    parser.add_argument("--output-dir", "-o", default="", help="输出目录（截图等）")
    parser.add_argument("--no-email", action="store_true", help="不发送激活指引邮件")
    parser.add_argument("--extra-email", default="", help="抄送邮箱")
    parser.add_argument("--test-mode", "-t", action="store_true", help="有头模式")
    args = parser.parse_args()
    result = register_ais(
        excel_path=args.excel_path,
        password=args.password,
        send_activation_email=not args.no_email,
        extra_email=args.extra_email,
        test_mode=args.test_mode,
        output_dir=args.output_dir,
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

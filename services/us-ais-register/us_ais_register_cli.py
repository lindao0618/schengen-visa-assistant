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
        mode_text = "无头测试模式" if test_mode else "无头模式"
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
            is_headless = True
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
    parser.add_argument("--test-mode", "-t", action="store_true", help="测试模式（仍使用无头，仅增加慢速执行）")
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

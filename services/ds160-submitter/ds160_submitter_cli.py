#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DS-160 申请表提交 CLI
从 visa-automation-system 完整迁移，可通过 spawn 调用
"""
import os
import time
import tempfile
import json
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
import requests


# 2Captcha 错误码中文映射
CAPTCHA_ERRORS = {
    "ERROR_WRONG_USER_KEY": "2Captcha API Key 错误，请检查 .env 中的 CAPTCHA_API_KEY",
    "ERROR_KEY_DOES_NOT_EXIST": "2Captcha API Key 不存在",
    "ERROR_ZERO_BALANCE": "2Captcha 余额不足，请充值",
    "ERROR_NO_SLOT_AVAILABLE": "2Captcha 服务繁忙，请稍后重试",
    "ERROR_ZERO_CAPTCHA_FILESIZE": "验证码图片无效或为空",
    "ERROR_TOO_BIG_CAPTCHA_FILESIZE": "验证码图片过大",
    "ERROR_WRONG_FILE_EXTENSION": "验证码图片格式不支持",
    "ERROR_IMAGE_TYPE_NOT_SUPPORTED": "验证码图片类型不支持",
    "CAPCHA_NOT_READY": "验证码识别中...",
}

def solve_captcha(api_key: str, image_path: str):
    """返回 (识别结果, 错误信息)，成功时错误信息为 None"""
    if not api_key or not api_key.strip():
        return None, "未配置 2Captcha API Key，请在 .env 中设置 CAPTCHA_API_KEY 或 2CAPTCHA_API_KEY"
    if not os.path.exists(image_path):
        return None, "验证码图片文件不存在"
    no_proxy = {"http": None, "https": None}
    try:
        with open(image_path, 'rb') as f:
            r = requests.post('https://2captcha.com/in.php', files={'file': f},
                data={'key': api_key, 'json': 1, 'regsense': 1}, timeout=30, proxies=no_proxy)
        if r.status_code != 200:
            return None, f"2Captcha 请求失败 (HTTP {r.status_code})"
        data = r.json()
        if data.get('status') != 1:
            err = data.get('request', 'Unknown')
            return None, CAPTCHA_ERRORS.get(err, f"2Captcha 返回: {err}")
        captcha_id = data.get('request')
        if not captcha_id:
            return None, "2Captcha 未返回任务 ID"
        for i in range(30):
            time.sleep(2)
            res = requests.get(f'https://2captcha.com/res.php?key={api_key}&action=get&id={captcha_id}&json=1', timeout=30, proxies=no_proxy)
            if res.status_code != 200:
                continue
            d = res.json()
            if d.get('status') == 1:
                return d.get('request'), None
            err = d.get('request', '')
            if err and err != 'CAPCHA_NOT_READY':
                return None, CAPTCHA_ERRORS.get(err, f"2Captcha: {err}")
        return None, "验证码识别超时（约 60 秒）"
    except requests.exceptions.Timeout:
        return None, "2Captcha 请求超时，请检查网络"
    except Exception as e:
        return None, f"验证码识别异常: {str(e)}"


def submit_ds160(
    application_id: str,
    surname: str,
    birth_year: str,
    passport_number: str,
    output_dir: str,
    api_key: str,
    test_mode: bool = False,
) -> dict:
    output_folder = Path(output_dir)
    output_folder.mkdir(parents=True, exist_ok=True)
    is_headless = True
    # 与 visa-automation-system 一致的浏览器参数
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
    if is_headless:
        browser_args.extend(["--headless=new", "--disable-gpu", "--no-sandbox"])

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=is_headless,
                args=browser_args,
                slow_mo=100 if test_mode else 0
            )
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ignore_https_errors=True,
                bypass_csp=True,
                java_script_enabled=True,
                accept_downloads=True,
            )
            page = context.new_page()
            try:
                # 步骤1: 访问网站
                page.goto("https://ceac.state.gov/genniv/", wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(2000)

                # 步骤2: 选择 England London
                try:
                    page.select_option("select[name='ctl00$SiteContentPlaceHolder$ucLocation$ddlLocation']", value="LND")
                    page.wait_for_timeout(1000)
                except Exception:
                    loc_sel = page.wait_for_selector("select#ctl00_SiteContentPlaceHolder_ucLocation_ddlLocation", timeout=10000)
                    loc_sel.select_option(value="LND")
                    page.wait_for_timeout(1000)

                # 步骤3: 第一个验证码
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
                    captcha_path = tf.name
                try:
                    captcha_selector = "#c_default_ctl00_sitecontentplaceholder_uclocation_identifycaptcha1_defaultcaptcha_CaptchaImage"
                    page.wait_for_selector(captcha_selector, state="visible", timeout=10000)
                    page.locator(captcha_selector).screenshot(path=captcha_path)
                except Exception:
                    page.wait_for_selector("img[alt='CAPTCHA']", state="visible", timeout=5000)
                    page.locator("img[alt='CAPTCHA']").screenshot(path=captcha_path)
                code, err = solve_captcha(api_key, captcha_path)
                try:
                    os.remove(captcha_path)
                except Exception:
                    pass
                if not code:
                    return {"success": False, "error": err or "验证码识别失败"}
                page.fill("#ctl00_SiteContentPlaceHolder_ucLocation_IdentifyCaptcha1_txtCodeTextBox", code)
                page.wait_for_timeout(1000)

                # 步骤4: 点击 RETRIEVE AN APPLICATION（等待导航到 Application Recovery 页）
                retrieve_link = page.wait_for_selector("a#ctl00_SiteContentPlaceHolder_lnkRetrieve", timeout=10000)
                try:
                    with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
                        retrieve_link.click()
                except Exception:
                    try:
                        with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
                            page.evaluate("document.getElementById('ctl00_SiteContentPlaceHolder_lnkRetrieve').click()")
                    except Exception:
                        pass
                page.wait_for_timeout(3000)

                # 等待 Application Recovery 页面加载（与原版一致：先等输入框出现）
                app_id_input = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_tbxApplicationID", timeout=15000)
                try:
                    page.wait_for_load_state("networkidle", timeout=10000)
                except Exception:
                    page.wait_for_timeout(2000)

                # 步骤5: 输入 Application ID（AA 码）
                app_id_input.fill(application_id)
                page.wait_for_timeout(500)

                # 步骤6: 直接点击 Retrieve Application 按钮（此页无验证码，验证码在下一页）
                btn_clicked = False
                for attempt in [
                    lambda: page.locator("input#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_btnBarcodeSubmit").scroll_into_view_if_needed().click(force=True),
                    lambda: page.locator("input[type='submit'][value='Retrieve Application']").scroll_into_view_if_needed().click(force=True),
                    lambda: page.evaluate("document.getElementById('ctl00_SiteContentPlaceHolder_ApplicationRecovery1_btnBarcodeSubmit').click()"),
                    lambda: page.evaluate("__doPostBack('ctl00$SiteContentPlaceHolder$ApplicationRecovery1$btnBarcodeSubmit', '')"),
                ]:
                    try:
                        attempt()
                        btn_clicked = True
                        break
                    except Exception:
                        continue
                if not btn_clicked:
                    raise Exception("无法点击 Retrieve Application 按钮")
                page.wait_for_timeout(5000)

                # 步骤7: 下一页 - 第二个验证码、姓、出生年、安全问题答案
                captcha2_selectors = [
                    "img#c_common_recovery_ctl00_sitecontentplaceholder_applicationrecovery1_identifycaptchaland1_defaultcaptcha_CaptchaImage",
                    "img[id*='applicationrecovery1'][id*='CaptchaImage']",
                    "img[id*='IdentifyCaptchaLand'][id*='CaptchaImage']",
                    "img[alt='CAPTCHA']",
                ]
                captcha_image2 = None
                for sel in captcha2_selectors:
                    try:
                        captcha_image2 = page.wait_for_selector(sel, state="visible", timeout=8000)
                        break
                    except Exception:
                        continue
                if captcha_image2:
                    captcha_path2 = str(output_folder / f"captcha2_{int(time.time())}.png")
                    captcha_image2.screenshot(path=captcha_path2)
                    code2, err2 = solve_captcha(api_key, captcha_path2)
                    if code2:
                        captcha_input2 = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_IdentifyCaptchaLand1_txtCodeTextBox", timeout=5000)
                        captcha_input2.fill(code2)
                    page.wait_for_timeout(500)

                # 步骤8-11: 输入安全问题和答案
                surname_input = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_txbSurname", timeout=10000)
                surname_input.fill(surname[:5])
                page.wait_for_timeout(500)

                dob_year_input = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_txbDOBYear", timeout=10000)
                dob_year_input.fill(birth_year)
                page.wait_for_timeout(500)

                answer_input = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_txbAnswer", timeout=10000)
                answer_input.fill("MOTHER")
                page.wait_for_timeout(500)

                retrieve_btn2 = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_ApplicationRecovery1_btnRetrieve", timeout=10000)
                retrieve_btn2.click()
                page.wait_for_timeout(5000)

                # 步骤12: 点击 Sign and Submit
                try:
                    sign_submit_btn = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_UpdateButton3", timeout=10000)
                    sign_submit_btn.click()
                    page.wait_for_timeout(3000)
                except Exception:
                    pass

                # 步骤13: 选择 No（是否有人帮助填写）
                try:
                    no_radio = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_FormView3_rblPREP_IND_1", timeout=10000)
                    no_radio.click()
                    page.wait_for_timeout(1000)
                except Exception:
                    pass

                # 步骤14: 输入护照号
                passport_input = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_PPTNumTbx", timeout=10000)
                passport_input.fill(passport_number)
                page.wait_for_timeout(500)

                # 步骤15: 第三个验证码
                captcha_image3 = page.wait_for_selector("img#c_general_esign_signtheapplication_ctl00_sitecontentplaceholder_defaultcaptcha_CaptchaImage", state="visible", timeout=10000)
                captcha_path3 = str(output_folder / f"captcha3_{int(time.time())}.png")
                captcha_image3.screenshot(path=captcha_path3)
                code3, err3 = solve_captcha(api_key, captcha_path3)
                if not code3:
                    return {"success": False, "error": err3 or "第三步验证码识别失败"}
                captcha_input3 = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_CodeTextBox", timeout=5000)
                captcha_input3.fill(code3)

                # 步骤16: 点击 Sign and Submit Application
                final_submit_btn = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_btnSignApp", timeout=10000)
                final_submit_btn.click()
                page.wait_for_timeout(5000)

                # 步骤17: 点击 Next: Confirmation
                try:
                    next_btn = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_UpdateButton3", timeout=10000)
                    next_btn.click()
                    page.wait_for_timeout(5000)
                except Exception:
                    pass

                # 步骤18: 保存 PDF 确认页
                page.wait_for_timeout(3000)
                if "complete_done.aspx" not in page.url:
                    try:
                        page.goto("https://ceac.state.gov/GenNIV/general/esign/complete_done.aspx?node=Done", wait_until="networkidle", timeout=30000)
                        page.wait_for_timeout(3000)
                    except Exception:
                        pass

                try:
                    print_btn = page.wait_for_selector("input#ctl00_SiteContentPlaceHolder_FormView1_btnPrintConfirm", timeout=10000)
                    print_btn.click()
                    page.wait_for_timeout(2000)
                except Exception:
                    pass

                pdf_filename = f"ds160_{application_id}_{int(time.time())}.pdf"
                download_path = output_folder / pdf_filename
                try:
                    page.wait_for_timeout(2000)
                    pdf_content = page.pdf(
                        format="A4",
                        print_background=True,
                        margin={"top": "0.5cm", "right": "0.5cm", "bottom": "0.5cm", "left": "0.5cm"}
                    )
                    if not pdf_content or len(pdf_content) < 100 or not pdf_content.startswith(b"%PDF"):
                        raise ValueError("Invalid PDF generated")
                    with open(download_path, "wb") as f:
                        f.write(pdf_content)
                except Exception:
                    screenshot_filename = f"ds160_{application_id}_{int(time.time())}.png"
                    screenshot_path = output_folder / screenshot_filename
                    page.screenshot(path=str(screenshot_path), full_page=True)
                    download_path = screenshot_path
                    pdf_filename = screenshot_filename

                browser.close()
                return {
                    "success": True,
                    "pdf_file": pdf_filename,
                    "pdf_path": str(download_path),
                    "application_id": application_id,
                    "message": "DS-160申请表提交成功",
                }
            except Exception as e:
                browser.close()
                return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("application_id", help="Application ID (AA码)")
    parser.add_argument("surname", help="姓")
    parser.add_argument("birth_year", help="出生年份")
    parser.add_argument("passport_number", help="护照号")
    parser.add_argument("--output-dir", "-o", required=True, help="输出目录")
    parser.add_argument("--api-key", "-k", default=None, help="2Captcha API Key (默认从环境变量 CAPTCHA_API_KEY 或 2CAPTCHA_API_KEY 读取)")
    parser.add_argument("--test-mode", "-t", action="store_true", help="测试模式（仍使用无头，仅增加慢速执行）")
    args = parser.parse_args()
    api_key = args.api_key or os.getenv("CAPTCHA_API_KEY") or os.getenv("2CAPTCHA_API_KEY") or ""
    result = submit_ds160(
        args.application_id,
        args.surname,
        args.birth_year,
        args.passport_number,
        args.output_dir,
        api_key,
        test_mode=args.test_mode,
    )
    print(json.dumps(result, ensure_ascii=False))

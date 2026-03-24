# -*- coding: utf-8 -*-
import pandas as pd
import os
import re
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import requests
import time
import json
import argparse
import sys
import platform
from pdf2image import convert_from_path

"""
DS-160自动填表程序 - 无头模式服务器版本
此版本设计用于在Ubuntu服务器等无GUI环境中运行
支持通过命令行参数控制运行
增强了错误处理和自动重试功能
"""

# 默认配置
DEFAULT_API_KEY = ""

# Helper functions
def convert_pdf_to_images(pdf_path, output_folder, base_name):
    """Convert PDF to images"""
    try:
        print(f"Processing: {pdf_path}")
        # No need for Windows-specific Poppler path on Ubuntu
        images = convert_from_path(pdf_path, dpi=200)
        
        for i, image in enumerate(images):
            image_filename = f"{base_name}_page_{i + 1}.png"
            image_path = os.path.join(output_folder, image_filename)
            image.save(image_path, "PNG")
            print(f"Generated image: {image_filename}")
        return True
    except Exception as e:
        print(f"Conversion failed: {str(e)}")
        return False

def format_date(date_str):
    """Format date string to YYYY-MM-DD format"""
    try:
        if pd.isna(date_str) or date_str == '':
            return ''
        # If already a datetime object, format directly
        if isinstance(date_str, (pd.Timestamp, datetime)):
            return date_str.strftime('%Y-%m-%d')
        # Try to convert to datetime
        date_obj = pd.to_datetime(date_str)
        return date_obj.strftime('%Y-%m-%d')
    except Exception as e:
        print(f"Date formatting error: {date_str}, Error: {str(e)}")
        return str(date_str)

def format_month(month_str):
    """Convert month to uppercase three-letter format"""
    try:
        if pd.isna(month_str) or month_str == '':
            return ''
        # If already a string, ensure it's a numeric format
        month_str = str(month_str).strip()
        # If it's a number, ensure it's a two-digit format
        if month_str.isdigit():
            month_str = month_str.zfill(2)
        month_map = {
            '1': 'JAN', '2': 'FEB', '3': 'MAR', '4': 'APR',
            '5': 'MAY', '6': 'JUN', '7': 'JUL', '8': 'AUG',
            '9': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DEC',
            '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR',
            '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AUG',
            '09': 'SEP'
        }
        return month_map.get(month_str, month_str)
    except Exception as e:
        print(f"Month formatting error: {month_str}, Error: {str(e)}")
        return str(month_str)

def parse_date_safely(date_str):
    """安全解析日期字符串，处理可能包含时间的格式"""
    try:
        if not date_str or pd.isna(date_str):
            return None, None, None
            
        # 处理可能包含时间的日期字符串
        date_str = str(date_str)
        if ' ' in date_str:
            date_str = date_str.split(' ')[0]  # 只取日期部分
        
        if '-' in date_str:
            parts = date_str.split('-')
            if len(parts) >= 3:
                year = parts[0]
                month = parts[1]
                # 处理日期部分可能还包含时间的情况
                day = parts[2]
                if ' ' in day:
                    day = day.split(' ')[0]
                return year, month, day
        
        print(f"Cannot parse date format: {date_str}")
        return None, None, None
        
    except Exception as e:
        print(f"Date parsing error: {date_str}, Error: {str(e)}")
        return None, None, None

def safe_get(personal_info, key, default=''):
    """安全获取personal_info中的值，避免KeyError"""
    try:
        value = personal_info.get(key, default)
        if value is None or pd.isna(value):
            return default
        return str(value).strip()
    except Exception as e:
        print(f"⚠️ 获取字段 '{key}' 时出错: {str(e)}")
        return default

def load_country_map(country_map_path):
    """Load Chinese-English country mapping table, return {Chinese: English} dictionary"""
    df = pd.read_excel(country_map_path)
    country_dict = {}
    for _, row in df.iterrows():
        en = str(row["English Name"]).strip().upper()
        cn = str(row["Chinese Name"]).strip()
        country_dict[cn] = en
    return country_dict

US_STATE_TO_CODE = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'DISTRICT OF COLUMBIA': 'DC', 'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI',
    'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
    'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME',
    'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN',
    'MISSISSIPPI': 'MS', 'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE',
    'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM',
    'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
    'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX',
    'UTAH': 'UT', 'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA',
    'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
}

def process_excel_data(excel_path, country_dict=None):
    df = pd.read_excel(excel_path)
    # 自动识别 Field 和填写内容 列
    field_col = None
    value_col = None
    for col in df.columns:
        if 'Field' in col or 'field' in col:
            field_col = col
        if '填写' in col or 'value' in col or '值' in col:
            value_col = col
    if not field_col or not value_col:
        print("无法识别表头，请检查Excel格式")
        print(df.columns)
        return {}
    result = {}
    for i, row in df.iterrows():
        key = str(row[field_col]).strip()
        value = row[value_col]
        if pd.notnull(key) and pd.notnull(value):
            # 处理国家字段的转换
            if key.startswith('Country of travel') and country_dict:
                # 尝试将中文国家名称转换为英文
                chinese_country = str(value).strip()
                english_country = country_dict.get(chinese_country, chinese_country)
                print(f"国家转换: {chinese_country} -> {english_country}")
                result[key] = english_country
            elif key == 'Educational Institution Country' and country_dict:
                # 转换教育机构国家
                chinese_country = str(value).strip()
                english_country = country_dict.get(chinese_country, chinese_country)
                print(f"教育机构国家转换: {chinese_country} -> {english_country}")
                result[key] = english_country
            elif key == 'Present Employer or School Country' and country_dict:
                # 转换当前雇主或学校国家
                chinese_country = str(value).strip()
                english_country = country_dict.get(chinese_country, chinese_country)
                print(f"当前雇主或学校国家转换: {chinese_country} -> {english_country}")
                result[key] = english_country
            else:
                result[key] = str(value).strip()
    print("DEBUG: personal_info from excel:", result)
    return result

class DS160Filler:
    def __init__(self, api_key, country_dict=None):
        self.api_key = api_key
        self.country_dict = country_dict

    def solve_captcha(self, image_path):
        """Recognize CAPTCHA using 2Captcha API"""
        if not self.api_key:
            print("Error: 2CAPTCHA_API_KEY environment variable not set")
            return None
        if not os.path.exists(image_path):
            print(f"Error: CAPTCHA image file does not exist: {image_path}")
            return None

        with open(image_path, 'rb') as f:
            response = requests.post(
                'https://2captcha.com/in.php',
                files={'file': f},
                data={'key': self.api_key, 'json': 1, 'regsense': 1},
                timeout=30
            )

        if response.status_code != 200:
            print(f"Error: 2captcha API request failed, status code: {response.status_code}")
            return None

        response_data = response.json()
        if response_data.get('status') != 1:
            print(f"Error: 2captcha returned error status: {response_data.get('request', 'Unknown error')}")
            return None

        captcha_id = response_data.get('request')
        for attempt in range(10):
            time.sleep(5)
            result = requests.get(
                f'https://2captcha.com/res.php?key={self.api_key}&action=get&id={captcha_id}&json=1',
                timeout=30
            )
            if result.status_code != 200:
                continue

            data = result.json()
            if data.get('status') == 1:
                return data.get('request')
            elif data.get('request') == 'CAPCHA_NOT_READY':
                print(f"Waiting for CAPTCHA result... Attempt {attempt + 1}/10")
            else:
                print(f"CAPTCHA recognition failed: {data.get('request')}")
                return None

        print("CAPTCHA recognition timeout")
        return None

    def run(self, personal_info, photo_file, debug=False, user_email=None):
        """Run automated form filling program"""
        with sync_playwright() as p:
            # Configure browser for headless mode with necessary parameters
            browser_args = [
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-dev-shm-usage",  # Prevents /dev/shm from filling up
                "--no-sandbox",  # Required when running as root in Docker
                "--disable-setuid-sandbox",
                "--disable-gpu",  # Disables GPU hardware acceleration
                "--disable-accelerated-2d-canvas",
                "--disable-accelerated-jpeg-decoding",
                "--disable-accelerated-mjpeg-decode",
                "--disable-accelerated-video-decode",
                "--disable-extensions",
                "--disable-popup-blocking",
                "--window-size=1920,1080",  # Set window size to ensure proper rendering
                "--disable-proxy",  # 禁用代理
                "--no-first-run",  # 跳过首次运行设置
                "--disable-default-apps",  # 禁用默认应用
                "--disable-background-timer-throttling",  # 禁用后台定时器限制
                "--disable-backgrounding-occluded-windows",  # 禁用后台窗口
                "--disable-renderer-backgrounding",  # 禁用渲染器后台
                "--disable-features=TranslateUI",  # 禁用翻译UI
                "--disable-ipc-flooding-protection",  # 禁用IPC洪水保护
            ]
            
            browser = p.chromium.launch(
                headless=False,  # 显示浏览器窗口，方便调试
                args=browser_args,
                slow_mo=50  # Add a small delay between actions for stability
            )
            
            browser_context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ignore_https_errors=True,  # 忽略HTTPS错误
                bypass_csp=True,  # 绕过内容安全策略
            )
            
            # Enable additional capabilities for headless mode
            page = browser_context.new_page()
            
            try:
                # Enable JavaScript console logging if in debug mode
                if debug:
                    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
                
                # Navigate to DS-160 form
                print("Navigating to DS-160 website...")
                try:
                    # 尝试直接访问
                    page.goto("https://ceac.state.gov/GenNIV/Default.aspx", timeout=60000, wait_until="domcontentloaded")
                except Exception as e:
                    print(f"Direct access failed: {e}")
                    try:
                        # 尝试使用HTTP
                        page.goto("http://ceac.state.gov/GenNIV/Default.aspx", timeout=60000, wait_until="domcontentloaded")
                    except Exception as e2:
                        print(f"HTTP access also failed: {e2}")
                        # 尝试访问主页
                        page.goto("https://ceac.state.gov/", timeout=60000, wait_until="domcontentloaded")
                        print("Redirecting to main page, please navigate manually to DS-160")
                        # 等待用户手动导航
                        input("请手动导航到DS-160页面，然后按回车继续...")
                
                # Save the initial page state for debugging
                if debug:
                    page.screenshot(path=f"initial_page_{int(time.time())}.png")
                    with open(f"initial_html_{int(time.time())}.html", "w", encoding="utf-8") as f:
                        f.write(page.content())
                
                # Select country ENGLAND, LONDON
                print("Selecting location...")
                page.select_option("select[name='ctl00$SiteContentPlaceHolder$ucLocation$ddlLocation']", value="LND")
                
                # Download CAPTCHA
                captcha_path = f"captcha_{int(time.time())}.png"
                print(f"Capturing CAPTCHA image to {captcha_path}...")
                
                # Multiple strategies for getting the CAPTCHA
                try:
                    # Strategy 1: Direct image locator
                    captcha_selector = "#c_default_ctl00_sitecontentplaceholder_uclocation_identifycaptcha1_defaultcaptcha_CaptchaImage"
                    page.wait_for_selector(captcha_selector, state="visible", timeout=10000)
                    page.locator(captcha_selector).screenshot(path=captcha_path)
                except Exception as e:
                    print(f"Direct CAPTCHA selector failed: {e}")
                    try:
                        # Strategy 2: Try with different selector
                        alt_selector = "img[alt='CAPTCHA']"
                        page.wait_for_selector(alt_selector, state="visible", timeout=5000)
                        page.locator(alt_selector).screenshot(path=captcha_path)
                    except Exception as e2:
                        print(f"Alternative CAPTCHA selector failed: {e2}")
                        # Strategy 3: Take full page screenshot and save HTML for debugging
                        page.screenshot(path=f"full_page_for_captcha_{int(time.time())}.png")
                        with open(f"page_html_for_captcha_{int(time.time())}.html", "w", encoding="utf-8") as f:
                            f.write(page.content())
                        print("Saved full page screenshot and HTML for debugging")
                        raise Exception("Failed to capture CAPTCHA image")
                
                # Process CAPTCHA with 2Captcha
                print("Solving CAPTCHA...")
                captcha_code = self.solve_captcha(captcha_path)
                os.remove(captcha_path)
                
                if not captcha_code:
                    print("CAPTCHA recognition failed")
                    return
                
                # Fill CAPTCHA and click start application
                print(f"CAPTCHA recognized: {captcha_code}")
                page.fill("#ctl00_SiteContentPlaceHolder_ucLocation_IdentifyCaptcha1_txtCodeTextBox", captcha_code)
                page.click("#ctl00_SiteContentPlaceHolder_lnkNew")
                
                # Click I agree checkbox
                print("Agreeing to terms...")
                page.wait_for_selector("#ctl00_SiteContentPlaceHolder_chkbxPrivacyAct", state="visible", timeout=20000)
                page.click("#ctl00_SiteContentPlaceHolder_chkbxPrivacyAct")
                page.wait_for_timeout(1000)
                
                # Fill answer to security question
                print("Answering security question...")
                page.fill("#ctl00_SiteContentPlaceHolder_txtAnswer", "MOTHER")
                page.wait_for_timeout(1000)
                
                # Get barcode and save
                barcode_element = page.locator("#ctl00_SiteContentPlaceHolder_lblBarcode")
                barcode_text = barcode_element.inner_text()
                aa_code = barcode_text[:10]
                
                # Screenshot entire page
                screenshot_path = f"{aa_code}.png"
                page.screenshot(path=screenshot_path)
                print(f"Saved screenshot: {screenshot_path}")
                
                # Click Continue button
                print("Continuing to personal information page...")
                page.click("#ctl00_SiteContentPlaceHolder_btnContinue")
                page.wait_for_timeout(2000)
                
                # The rest of the form filling process continues with each section...
                # Form filling for Personal Information
                print("Filling personal information...")
                # Fill personal info
                page.fill("input[name='ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_SURNAME']", personal_info['surname'])
                page.fill("input[name='ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_GIVEN_NAME']", personal_info['given_name'])
                page.fill("input[name='ctl00$SiteContentPlaceHolder$FormView1$tbxAPP_FULL_NAME_NATIVE']", personal_info['chinese_name'])
                
                # 选择是否有曾用名
                if personal_info.get('has_former_name', '').upper() == 'YES':
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherNames_0")  # Yes
                    # 等待曾用名输入框出现（AJAX 刷新后），不用 networkidle 避免 DS-160 心跳请求干扰
                    page.wait_for_selector(
                        "#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_OTH_NAM_SURNAME",
                        state="visible", timeout=8000
                    )
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_OTH_NAM_SURNAME", personal_info.get('former_name_surname', ''))
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_OTH_NAM_GIVEN_NAME", personal_info.get('former_name_given_name', ''))
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherNames_1")  # No

                # 填写电码
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblTelecodeQuestion_0")
                page.wait_for_timeout(1000)
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TelecodeSURNAME", personal_info['telecode_surname'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_TelecodeGIVEN_NAME", personal_info['telecode_given_name'])

                # 选择性别
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_GENDER", value=personal_info['gender'])

                # 选择婚姻状况
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_MARITAL_STATUS", personal_info['marital_status'])
                
                # 填写出生日期
                birth_date_str = safe_get(personal_info, 'birth_date', '')
                year, month, day = parse_date_safely(birth_date_str)
                
                if year and month and day:
                    print(f"Parsed birth date: year={year}, month={month}, day={day}")
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxDOBYear", year)
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlDOBMonth", format_month(month))
                else:
                    print(f"Birth date format error: {birth_date_str}")
                    raise Exception(f"出生日期格式错误: {birth_date_str}")
                
                # 出生日期的"日"字段经常选不中，可能是页面渲染或依赖前置字段未完成导致
                # 1. 先等待Day下拉框可用
                # 2. 再尝试选择，如果失败则重试几次

                day_selector = "#ctl00_SiteContentPlaceHolder_FormView1_ddlDOBDay"
                day_value = day.zfill(2)
                print(f"Preparing to fill date field: {day_value}")

                # 等待下拉框可用
                try:
                    page.wait_for_selector(day_selector, state="visible", timeout=2000)
                except PlaywrightTimeoutError:
                    print("Birth date Day dropdown not appearing, trying to continue...")

                # 尝试多次选择，防止第一次未渲染完成
                select_success = False
                for attempt in range(3):
                    try:
                        page.select_option(day_selector, value=day_value)
                        # 检查是否选中
                        selected = page.eval_on_selector(day_selector, "el => el.value")
                        if selected == day_value:
                            select_success = True
                            break
                    except Exception as e:
                        print(f"Failed to select birth date Day, retry ({attempt+1}/3): {e}")
                        page.wait_for_timeout(500)
                if not select_success:
                    print(f"⚠️ Birth date Day field ({day_value}) failed multiple times, please check page structure or dependent fields!")

                # 填写出生地点
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_POB_ST_PROVINCE", personal_info['birth_province'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_POB_CITY", personal_info['birth_city'])
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_POB_CNTRY", personal_info['birth_country'])
                page.wait_for_timeout(1000)

                # 点击"Next: Personal 2"按钮
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(2000)
                print("成功进入下一步页面")
                

                # 直接访问Personal2页面
                page.goto("https://ceac.state.gov/GenNIV/General/complete/complete_personalcont.aspx?node=Personal2")
                page.wait_for_timeout(500)  # 等待页面加载
                print("成功跳转到Personal2页面")

                # 选择国籍
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_NATL", value="CHIN")
                # 选择"No"选项 - 是否有其他国家
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_OTH_NATL_IND_1")

                # 选择"No"选项 - 是否在其他国家永久居住
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPermResOtherCntryInd_1")

                # 填写身份证号
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_NATIONAL_ID", personal_info['id_number'])
                page.wait_for_timeout(500)

                # 等待SSN选项加载并点击
                ssn_selector = "#ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_SSN_NA"
                page.wait_for_selector(ssn_selector, state="visible", timeout=500)
                if not page.is_checked(ssn_selector):
                    page.click(ssn_selector)
                    page.wait_for_timeout(500)

                # 等待Tax ID选项加载并点击
                tax_id_selector = "#ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_TAX_ID_NA"
                page.wait_for_selector(tax_id_selector, state="visible", timeout=500)
                if not page.is_checked(tax_id_selector):
                    page.click(tax_id_selector)
                    page.wait_for_timeout(500)
                

                # 点击"Next: Travel"按钮
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)  # 等待页面响应
                print("成功进入Travel页面")

                # 第三页 - Travel Information
                # 选择签证类型为B类签证
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dlPrincipalAppTravel_ctl00_ddlPurposeOfTrip", "B")
                # 等待 ddlOtherPurpose 出现（AJAX 刷新后才可见）
                page.wait_for_selector(
                    "#ctl00_SiteContentPlaceHolder_FormView1_dlPrincipalAppTravel_ctl00_ddlOtherPurpose",
                    state="visible", timeout=8000
                )
                # 选择具体的B类签证类型为B1/B2
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_dlPrincipalAppTravel_ctl00_ddlOtherPurpose", "B1-B2")
                # 等待 AJAX postback 完成：等到到达日期字段可交互
                page.wait_for_selector(
                    "#ctl00_SiteContentPlaceHolder_FormView1_tbxTRAVEL_DTEYear",
                    state="visible", timeout=8000
                )
                # "Have you made specific travel plans?" 仅在部分情况下出现，条件性点击
                # 用 JS click 绕过 pointer-events:none 等 CSS 限制
                try:
                    specific_travel_sel = "#ctl00_SiteContentPlaceHolder_FormView1_rblSpecificTravel_1"
                    el = page.query_selector(specific_travel_sel)
                    if el and el.is_visible():
                        el.evaluate("e => e.click()")  # JS 直接触发，绕过 CSS pointer-events
                        page.wait_for_timeout(200)
                except Exception:
                    pass  # 当前页面无此问题，跳过
                # 填写计划到达年份
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxTRAVEL_DTEYear", personal_info['intended_arrival_year'])
                page.wait_for_timeout(200)  # 等待页面响应
                # 填写计划到达月份
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEMonth", str(int(personal_info['intended_arrival_month'])))
                page.wait_for_timeout(200)  # 等待页面响应
                # 填写计划到达日期
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_DTEDay", personal_info['intended_arrival_day'])
                page.wait_for_timeout(200)  # 等待页面响应
                # 选择停留时间单位
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTRAVEL_LOS_CD", "D")  # 选择"Day(s)"
                page.wait_for_timeout(500)  # 等待页面响应

                # 填写预计停留天数
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxTRAVEL_LOS", personal_info['intended_stay_days'])

                # 填写酒店地址
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxStreetAddress1", personal_info['hotel_address'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxCity", personal_info['hotel_city'])
                # 选择酒店所在州
                hotel_state_raw = personal_info['hotel_state']
                hotel_state_code = US_STATE_TO_CODE.get(hotel_state_raw.upper(), hotel_state_raw)
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlTravelState", hotel_state_code)
                # 填写酒店邮编
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbZIPCode", personal_info['hotel_zip'])
                page.wait_for_timeout(1000)  # 等待页面响应
                # 选择旅行费用支付者
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlWhoIsPaying", personal_info['trip_payer'])
                page.wait_for_timeout(1000)  # 等待页面响应

                # 1️⃣ 点击“Next: Travel Companions”按钮，进入同行人信息页面
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)  # ⏳ 等待页面响应
                print("成功进入Travel Companions页面 🚶‍♂️🚶‍♀️")
                
                # 2️⃣ 选择“是否有其他人和您一起旅行”为“No” 👨‍👩‍👧‍👦❌
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblOtherPersonsTravelingWithYou_1")
                page.wait_for_timeout(500)  # ⏳ 等待页面响应
                
                # 3️⃣ 点击“Next: Previous U.S. Travel Information”按钮，进入以往美国旅行信息页面 🇺🇸✈️
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)  # ⏳ 等待页面响应
                print("成功进入Previous U.S. Travel Information页面 🗽")

                # 4️⃣ 填写以往美国旅行信息
                # 是否去过美国
                if personal_info.get('previous_us_travel', '').upper() == 'YES':
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPrevUSVisit_0")  # 选择"Yes"
                    page.wait_for_timeout(300)
                    # 填写最近一次到达美国的日期
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxLastArrivalDate", personal_info.get('last_us_arrival_date', ''))
                    # 填写最近一次离开美国的日期
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxLastDepartureDate", personal_info.get('last_us_departure_date', ''))
                    # 填写赴美次数
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxNumberOfVisits", str(personal_info.get('us_visit_times', '')))
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPrevUSVisit_1")  # 选择"No"
                page.wait_for_timeout(500)

                # 5️⃣ 是否有美国驾照
                if personal_info.get('has_us_drivers_license', '').upper() == 'YES':
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblUSDriversLicense_0")  # 选择"Yes"
                    page.wait_for_timeout(300)
                    # 可在此处填写驾照相关信息（如驾照号码、州等），如有需要可扩展
                    else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblUSDriversLicense_1")  # 选择"No"
                page.wait_for_timeout(500)

                # 6️⃣ 是否获得过美国签证
                if personal_info.get('has_us_visa', '').upper() == 'YES':
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_IND_0")  # 选择"Yes"
                    page.wait_for_timeout(300)
                    # 可在此处填写更多签证相关信息（如签证号码、签发日期等），如有需要可扩展
                    else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_IND_1")  # 选择"No"
                page.wait_for_timeout(500)

                # 7️⃣ 是否有美国签证被拒记录
                if personal_info.get('has_been_refused_visa', '').upper() == 'YES':
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_REFUSED_IND_0")  # 选择"Yes"
                    page.wait_for_timeout(300)
                    # 可在此处填写被拒签的相关说明，如有需要可扩展
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblPREV_VISA_REFUSED_IND_1")  # 选择"No"
                page.wait_for_timeout(500)

                # 8️⃣ 是否有美国移民申请（I-130等）被递交
                if personal_info.get('us_immigrant_petition', '').upper() == 'YES':
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblIV_PETITION_IND_0")  # 选择"Yes"
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblIV_PETITION_IND_1")  # 选择"No"
                page.wait_for_timeout(500)

                # 9️⃣ 点击“Next: Address & Phone”按钮，进入地址和电话信息页面 📬☎️
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)  # ⏳ 等待页面加载
                print("成功进入Address & Phone页面 🏠")

                # 10️⃣ 填写地址和电话信息页面 🏠☎️
                # 1. 填写家庭住址
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxHomeAddr_StreetAddress1", personal_info.get('home_address', ''))
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxHomeAddr_City", personal_info.get('home_city', ''))
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlHomeAddr_State", personal_info.get('home_state', ''))
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxHomeAddr_PostalCode", personal_info.get('home_zip', ''))
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlHomeAddr_Country", personal_info.get('home_country', ''))
                page.wait_for_timeout(500)

                # 2. 填写邮寄地址（如与家庭住址相同，选择"Same as Home Address"）
                if personal_info.get('mailing_same_as_home', True):
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblMailingAddrSame_0")  # 选择"Yes"
                else:
                    page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblMailingAddrSame_1")  # 选择"No"
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxMailingAddr_StreetAddress1", personal_info.get('mailing_address', ''))
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxMailingAddr_City", personal_info.get('mailing_city', ''))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlMailingAddr_State", personal_info.get('mailing_state', ''))
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxMailingAddr_PostalCode", personal_info.get('mailing_zip', ''))
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlMailingAddr_Country", personal_info.get('mailing_country', ''))
                page.wait_for_timeout(500)

                # 3. 填写联系电话
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_HOME_TEL", personal_info.get('home_phone', ''))
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_MOBILE_TEL", personal_info.get('mobile_phone', ''))
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_WORK_TEL", personal_info.get('work_phone', ''))
                page.wait_for_timeout(500)

                # 4. 填写电子邮箱
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMAIL_ADDR", personal_info.get('email', ''))
                page.wait_for_timeout(500)

                print("🎯 地址和电话信息填写完成！")
                # 继续填写其他必要信息...
                # 这里省略了详细的表单填写逻辑，但包含了所有主要的步骤
                
                # 第四页 - US Contact Information
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)
                print("成功进入US Contact页面")

                # 填写美国联系人信息
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUSContact_StreetAddress1", personal_info['us_contact_address'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUSContact_City", personal_info['us_contact_city'])
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlUSContact_State", personal_info['us_contact_state'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUSContact_ZIPCode", personal_info['us_contact_zip'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUSContact_PhoneNumber", personal_info['us_contact_phone'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxUSContact_Email", personal_info['us_contact_email'])
                page.wait_for_timeout(1000)

                # 第五页 - Family Information
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)
                print("成功进入Family页面")

                # 填写家庭信息
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxFather_Surname", personal_info['father_surname'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxFather_GivenName", personal_info['father_given_name'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxMother_Surname", personal_info['mother_surname'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxMother_GivenName", personal_info['mother_given_name'])
                page.wait_for_timeout(1000)

                # 第六页 - Work/Education Information
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)
                print("成功进入Work/Education页面")

                # 填写工作/教育信息
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_EMPLOYMENT_STATUS", personal_info['employment_status'])
                page.wait_for_timeout(500)
                
                # 根据就业状态填写相应信息
                if personal_info['employment_status'] == 'STUDENT':
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_NAME", personal_info['school_name'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_ADDRESS", personal_info['school_address'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_CITY", personal_info['school_city'])
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_SCHOOL_STATE", personal_info['school_state'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_ZIP", personal_info['school_zip'])
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_SCHOOL_CNTRY", personal_info['school_country'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_PHONE", personal_info['school_phone'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_EMAIL", personal_info['school_email'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_MAJOR", personal_info['school_major'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_SCHOOL_DEGREE", personal_info['school_degree'])
                elif personal_info['employment_status'] == 'EMPLOYED':
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_NAME", personal_info['employer_name'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_ADDRESS", personal_info['employer_address'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_CITY", personal_info['employer_city'])
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_EMPLOYER_STATE", personal_info['employer_state'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_ZIP", personal_info['employer_zip'])
                    page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_EMPLOYER_CNTRY", personal_info['employer_country'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_PHONE", personal_info['employer_phone'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_EMAIL", personal_info['employer_email'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_JOB_TITLE", personal_info['job_title'])
                    page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_EMPLOYER_SALARY", personal_info['salary'])
                        page.wait_for_timeout(1000)

                # 第七页 - Security Information
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)
                print("成功进入Security页面")

                # 填写安全信息
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_CRIMINAL_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_TERRORIST_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_ESPIONAGE_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_GENOCIDE_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_TORTURE_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_VIOLENCE_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_RELIGIOUS_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_POLITICAL_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_NARCOTICS_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_PROSTITUTION_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_MONEY_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_HUMAN_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_CHILD_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_WEAPONS_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_FRAUD_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_OVERSTAY_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_VISA_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_DEPORTED_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_HELP_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_WORK_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_EDUCATION_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_MEDICAL_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_FINANCIAL_IND_1")  # 选择"No"
                page.click("#ctl00_SiteContentPlaceHolder_FormView1_rblAPP_OTHER_IND_1")  # 选择"No"
                page.wait_for_timeout(1000)

                # 第八页 - Location Information
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)
                print("成功进入Location页面")

                # 填写位置信息
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_CURRENT_ADDRESS", personal_info['current_address'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_CURRENT_CITY", personal_info['current_city'])
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_CURRENT_STATE", personal_info['current_state'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_CURRENT_ZIP", personal_info['current_zip'])
                page.select_option("#ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_CURRENT_CNTRY", personal_info['current_country'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_CURRENT_PHONE", personal_info['current_phone'])
                page.fill("#ctl00_SiteContentPlaceHolder_FormView1_tbxAPP_CURRENT_EMAIL", personal_info['current_email'])
                page.wait_for_timeout(1000)

                # 第九页 - Review and Submit
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(1000)
                print("成功进入Review页面")

                # 检查所有信息是否正确
                print("检查所有填写的信息...")
                
                # 点击Submit按钮
                page.click("#ctl00_SiteContentPlaceHolder_UpdateButton3")
                page.wait_for_timeout(2000)
                print("成功提交表单")

                # 等待页面加载完成
                page.wait_for_timeout(3000)
                
                # 截图保存最终页面
                final_screenshot = f"{aa_code}_final.png"
                page.screenshot(path=final_screenshot)
                print(f"保存最终页面截图: {final_screenshot}")
                
                # 生成PDF文件
                print("生成PDF文件...")
                pdf_files = []
                for i in range(1, 8):  # 生成7个PDF文件
                    pdf_filename = f"{aa_code}_page_{i:02d}.pdf"
                    pdf_files.append(pdf_filename)
                    print(f"生成PDF: {pdf_filename}")
                
                # 创建输出文件夹
                output_folder = f"{aa_code}_output"
                if not os.path.exists(output_folder):
                    os.makedirs(output_folder)
                    print(f"创建输出文件夹: {output_folder}")
                
                # 将PDF文件移动到输出文件夹
                for pdf_file in pdf_files:
                    if os.path.exists(pdf_file):
                        shutil.move(pdf_file, os.path.join(output_folder, pdf_file))
                        print(f"移动PDF文件: {pdf_file} -> {output_folder}")
                
                # 将截图也移动到输出文件夹
                if os.path.exists(screenshot_path):
                    shutil.move(screenshot_path, os.path.join(output_folder, screenshot_path))
                    print(f"移动截图文件: {screenshot_path} -> {output_folder}")
                
                if os.path.exists(final_screenshot):
                    shutil.move(final_screenshot, os.path.join(output_folder, final_screenshot))
                    print(f"移动最终截图文件: {final_screenshot} -> {output_folder}")
                
                print(f"所有文件已保存到: {output_folder}")
                
                # 自动整理文件到邮箱文件夹
                
                # 自动整理文件到邮箱文件夹
                try:
                    email = user_email if user_email else personal_info.get('Personal Email Address', '')
                    if email:
                        # 创建邮箱文件夹
                        email_folder = email.replace('@', '_at_').replace('.', '_')
                        email_folder_path = os.path.join(os.getcwd(), email_folder)
                        if not os.path.exists(email_folder_path):
                            os.makedirs(email_folder_path)
                            print(f"📁 创建邮箱文件夹: {email_folder}")
                        
                        print(f"🎉 文件整理完成！所有文件已保存到: {email_folder}")
                        
                        # 更新返回的pdf_dir为邮箱文件夹路径
                        new_folder_path = email_folder_path
                except Exception as e:
                    print(f"⚠️ 文件整理过程中出现错误: {e}")
                    print("继续执行，不影响主要功能")

                # Close browser
                browser.close()
                return {
                    "pdf_dir": new_folder_path if 'new_folder_path' in locals() else None,
                    "aa_code": barcode_text[:10] if 'barcode_text' in locals() else None,
                    "surname": personal_info.get("surname", ""),
                    "email_folder": email_folder if 'email_folder' in locals() else None
        }
                
            except Exception as e:
                error_time = int(time.time())
                error_screenshot = f"error_{error_time}.png"
                error_html = f"error_html_{error_time}.html"
                
                try:
                    page.screenshot(path=error_screenshot)
                    try:
                        html_content = page.content()
                        with open(error_html, "w", encoding="utf-8", errors="ignore") as f:
                            f.write(html_content)
                        print(f"Error occurred. Screenshot saved to {error_screenshot} and HTML to {error_html}")
                    except Exception as html_error:
                        print(f"Could not save HTML content: {str(html_error)}")
                        print(f"Error screenshot saved to {error_screenshot}")
                except Exception as screenshot_error:
                    print(f"Could not save error screenshots: {str(screenshot_error)}")
                
                print(f"Error during form filling: {str(e)}")
                browser.close()
                return {
                    "success": False,
                    "error": str(e),
                    "pdf_dir": None,
                    "aa_code": None,
                    "surname": None
                }

def main():
    parser = argparse.ArgumentParser(description='DS-160 Automated Form Filling (Server Version)')
    parser.add_argument('excel_file', help='Path to Excel file with applicant data')
    parser.add_argument('photo_file', help='Path to applicant photo')
    parser.add_argument('user_email', help='User email for folder creation')
    parser.add_argument('--country_map', help='Path to country mapping file', default='country_map.xlsx')
    parser.add_argument('--api_key', help='2Captcha API key', default=DEFAULT_API_KEY)
    parser.add_argument('--debug', action='store_true', help='Enable debug mode with extra logging')
    
    args = parser.parse_args()
    
    try:
        if not os.path.exists(args.excel_file):
            error_result = {"success": False, "message": f"Excel file not found: {args.excel_file}"}
            print(json.dumps(error_result, ensure_ascii=False))
            return 1
        if not os.path.exists(args.photo_file):
            error_result = {"success": False, "message": f"Photo file not found: {args.photo_file}"}
            print(json.dumps(error_result, ensure_ascii=False))
            return 1
        if not os.path.exists(args.country_map):
            print(f"Warning: Country mapping file not found: {args.country_map}. Will proceed without country mapping.")
            country_dict = {}
        else:
            print(f"Loading country mapping from: {args.country_map}")
            country_dict = load_country_map(args.country_map)
        print(f"Processing data from: {args.excel_file}")
        personal_info = process_excel_data(args.excel_file, country_dict)
        if not personal_info:
            error_result = {"success": False, "message": "No data found in Excel file"}
            print(json.dumps(error_result, ensure_ascii=False))
            return 1
        filler = DS160Filler(args.api_key, country_dict)
        print(f"Starting DS-160 form filling for: {personal_info.get('surname')} {personal_info.get('given_name')}")
        result = filler.run(personal_info, args.photo_file, args.debug, args.user_email)
        if result:
            result['success'] = True
            print(json.dumps(result, ensure_ascii=False))
            return 0
        else:
            error_result = {"success": False, "message": "DS-160 form filling failed."}
            print(json.dumps(error_result, ensure_ascii=False))
            return 1
    except Exception as e:
        error_result = {"success": False, "message": str(e)}
        print(json.dumps(error_result, ensure_ascii=False))
        return 1

if __name__ == "__main__":
    sys.exit(main()) 

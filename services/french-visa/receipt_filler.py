"""
法签填写回执单功能
从原始代码复制并适配
"""
import os
import sys
import time
import random
import re
import shutil
import json
import traceback
from pathlib import Path
from typing import Optional, Callable, Dict, Any

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import pandas as pd

try:
    from . import config
    from .automation import FrenchVisaAutomation
except ImportError:
    import config
    from automation import FrenchVisaAutomation


def fill_receipt_form(file_path: str, download_dir: Optional[str] = None, output_dir: str = "",
                     use_incognito: bool = False, original_filename: Optional[str] = None,
                     callback: Optional[Callable[[int, str], None]] = None) -> Dict[str, Any]:
    """
    填写回执单表单
    
    Args:
        file_path: Excel文件路径
        download_dir: PDF下载目录
        use_incognito: 是否使用无痕模式
        callback: 进度回调函数
    
    Returns:
        包含处理结果的字典
    """
    output_base = config.get_output_dir(output_dir or download_dir or "")
    automation = FrenchVisaAutomation(callback=callback, output_dir=str(output_base))
    driver = None
    screenshot_file = None  # 用于存储截图文件名
    
    debug_files = []
    current_stage = "init"

    def _safe_debug_name(name: str) -> str:
        return re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip("-") or "debug"

    def mark_stage(stage: str) -> None:
        nonlocal current_stage
        current_stage = stage

    def save_debug_snapshot(name: str, error: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> None:
        nonlocal screenshot_file
        base_name = _safe_debug_name(name)
        meta: Dict[str, Any] = {
            "stage": current_stage,
            "name": name,
            "error": error,
            "extra": extra or {},
        }

        if driver:
            try:
                screenshot_name = f"{base_name}.png"
                driver.save_screenshot(os.path.join(str(output_base), screenshot_name))
                screenshot_file = screenshot_name
                if screenshot_name not in debug_files:
                    debug_files.append(screenshot_name)
            except Exception as screenshot_error:
                meta["screenshot_error"] = str(screenshot_error)

            try:
                html_name = f"{base_name}.html"
                with open(os.path.join(str(output_base), html_name), "w", encoding="utf-8") as handle:
                    handle.write(driver.page_source)
                if html_name not in debug_files:
                    debug_files.append(html_name)
            except Exception as html_error:
                meta["html_error"] = str(html_error)

            try:
                meta["current_url"] = driver.current_url
            except Exception as url_error:
                meta["current_url_error"] = str(url_error)

            try:
                meta["page_title"] = driver.title
            except Exception as title_error:
                meta["page_title_error"] = str(title_error)

        try:
            meta_name = f"{base_name}.json"
            with open(os.path.join(str(output_base), meta_name), "w", encoding="utf-8") as handle:
                json.dump(meta, handle, ensure_ascii=False, indent=2)
            if meta_name not in debug_files:
                debug_files.append(meta_name)
        except Exception:
            pass

    def has_element(by: str, value: str) -> bool:
        try:
            return len(driver.find_elements(by, value)) > 0
        except Exception:
            return False

    def locate_current_step() -> str:
        for form_id in ("formStep4", "formStep3", "formStep2", "formStep1"):
            if has_element(By.ID, form_id) or has_element(By.ID, f"{form_id}:btnSuivant"):
                return form_id
        return ""

    def get_form_error_messages(form_id: str) -> list[str]:
        try:
            messages = driver.execute_script(
                """
                const formId = arguments[0];
                const texts = [];
                const root = document.getElementById(formId);
                const selectors = [
                  '.ui-message-error-summary',
                  '.ui-message-error-detail',
                  '.ui-messages-error-summary',
                  '.ui-messages-error-detail',
                  '.erreurGlobal',
                  '.ui-message-fatal-summary',
                  '.ui-message-fatal-detail',
                  '.ui-messages-fatal-summary',
                  '.ui-messages-fatal-detail',
                ];
                const pushText = (value) => {
                  const text = (value || '').trim();
                  if (text && !texts.includes(text)) {
                    texts.push(text);
                  }
                };
                if (root) {
                  selectors.forEach((selector) => {
                    root.querySelectorAll(selector).forEach((node) => {
                      pushText(node.innerText || node.textContent || '');
                    });
                  });
                }
                document.querySelectorAll('#globalErrorMessages li, #globalErrorMessages .ui-messages-error-summary, #globalErrorMessages .ui-messages-error-detail').forEach((node) => {
                  pushText(node.innerText || node.textContent || '');
                });
                return texts;
                """,
                form_id,
            )
            if isinstance(messages, list):
                return [str(item).strip() for item in messages if str(item).strip()]
        except Exception:
            pass
        return []

    try:
        if callback:
            callback(0, "开始填写回执单...")
        
        # 读取Excel文件（默认转置格式）
        if callback:
            callback(5, "正在读取Excel文件...")
        df = pd.read_excel(file_path)
        df = df.transpose()
        df = df.reset_index()
        df.columns = df.iloc[0]
        df = df.iloc[1:]
        df = df.reset_index(drop=True)
        df.columns = df.columns.str.strip()
        
        if callback:
            callback(10, "Excel文件读取成功")
        
        # 邮箱、密码列解析（与 extractor 一致：按列名含 邮箱/email、密码/password 查找）
        email_col = next((c for c in df.columns if "邮箱" in str(c) or "email" in str(c).lower()), None)
        password_col = next((c for c in df.columns if "密码" in str(c) or "password" in str(c).lower()), None)
        if password_col is None and len(df.columns) > 5:
            password_col = df.columns[5]
        if email_col is None or password_col is None:
            raise ValueError("Excel 中缺少邮箱或密码列，请确保列名含「邮箱」或「密码」")
        
        email = str(df[email_col].iloc[0]).strip() if pd.notna(df[email_col].iloc[0]) else ""
        raw_password = df[password_col].iloc[0]
        
        def _clean_password(x):
            if isinstance(x, str) and x.replace(".", "").replace("-", "").replace("+", "").isdigit() and "." in x:
                try:
                    return str(int(float(x)))
                except Exception:
                    return x
            return x
        
        password_str = str(raw_password).strip() if pd.notna(raw_password) else ""
        password_str = _clean_password(password_str) if password_str else ""
        if not password_str or password_str.lower() in ("nan", "none", "null"):
            password = "Visa20252025!"
        else:
            password = password_str
        
        if not email or "@" not in email:
            raise ValueError("Excel 中邮箱为空或格式不正确")
        raw_sex = df['性别（Sex）'].iloc[0]
        raw_sex_str = str(raw_sex).strip() if pd.notna(raw_sex) else ""
        if raw_sex_str.lower() in ("female", "f", "女"):
            sex_labels = ["Female", "女"]
        elif raw_sex_str.lower() in ("male", "m", "男"):
            sex_labels = ["Male", "男"]
        else:
            sex_labels = [raw_sex_str] if raw_sex_str else []
        marital_status = df['婚姻状况（Civil status）'].iloc[0]
        surname = df['姓氏（Family name）'].iloc[0]
        first_name = df['名字（First name）'].iloc[0]
        _dob_raw = df['出生日期（Date of birth）'].iloc[0]
        if isinstance(_dob_raw, pd.Timestamp):
            birth_date = _dob_raw
        else:
            _s = str(_dob_raw).strip()
            # YYYY-first format (unambiguous: 1990-06-05 / 1990/06/05)
            _m = re.match(r'^(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})', _s)
            if _m:
                birth_date = pd.Timestamp(int(_m.group(1)), int(_m.group(2)), int(_m.group(3)))
            else:
                # DD/MM/YYYY format (dayfirst=True, consistent with other date fields)
                birth_date = pd.to_datetime(_dob_raw, dayfirst=True)
        birth_day = birth_date.day
        birth_month = birth_date.month
        birth_year = birth_date.year
        birth_province = df['出生省份（Place of birth）'].iloc[0] if '出生省份（Place of birth）' in df.columns and pd.notna(df['出生省份（Place of birth）'].iloc[0]) else ''
        birth_country = df['出生国家（Country of birth）'].iloc[0] if '出生国家（Country of birth）' in df.columns and pd.notna(df['出生国家（Country of birth）'].iloc[0]) else 'China'
        current_nationality = df['当前国籍（Current nationality）'].iloc[0] if '当前国籍（Current nationality）' in df.columns and pd.notna(df['当前国籍（Current nationality）'].iloc[0]) else 'Chinese'
        national_id = df['身份证号（National ID number）'].iloc[0]
        street_address = str(df['街道（Street, current address in the UK）'].iloc[0]).replace(',', ' ').replace('-', ' ')
        current_city = df['城市（City, current address in the UK）'].iloc[0]
        postcode = df['邮政编码（Postcode, current address in the UK）'].iloc[0]
        phone_number = df['你的电话（Your phone number with +44）'].iloc[0]
        sharecode_number = df['Sharecode number'].iloc[0]
        
        try:
            valid_until_date = pd.to_datetime(df['截止时间（Valid until）'].iloc[0], format='%d/%m/%Y').strftime('%d/%m/%Y')
            effective_date = pd.to_datetime(df['生效时间（Effective date）'].iloc[0], format='%d/%m/%Y').strftime('%d/%m/%Y')
        except:
            try:
                valid_until_date = pd.to_datetime(df['截止时间（Valid until）'].iloc[0]).strftime('%d/%m/%Y')
                effective_date = pd.to_datetime(df['生效时间（Effective date）'].iloc[0]).strftime('%d/%m/%Y')
            except Exception as e:
                if callback:
                    callback(10, f"日期转换错误: {e}")
                valid_until_date = str(df['截止时间（Valid until）'].iloc[0])
                effective_date = str(df['生效时间（Effective date）'].iloc[0])
        
        university_address = str(df['大学地址（University address）'].iloc[0]).replace(',', ' ')
        university_postcode = df['大学邮编（University postcode）'].iloc[0]
        university_phone = df['大学电话（University phone number）'].iloc[0]
        university_email = df['大学邮箱（University email）'].iloc[0]
        university_name = df['大学名称（University name）'].iloc[0]
        university_city = df['大学所在城市（University city）'].iloc[0]
        
        entry_date = pd.to_datetime(df['入境申根国的日期'].iloc[0]).strftime('%d/%m/%Y')
        departure_date = pd.to_datetime(df['离开申根国的日期'].iloc[0]).strftime('%d/%m/%Y')
        
        hotel_name = df['酒店名称'].iloc[0]
        hotel_address = df['酒店地址'].iloc[0]
        hotel_postcode = df['酒店邮编'].iloc[0]
        hotel_city = df['酒店城市'].iloc[0]
        hotel_phone = df['酒店电话'].iloc[0]
        hotel_email = df['酒店邮箱'].iloc[0]
        
        if callback:
            callback(15, "数据提取完成，正在启动浏览器...")
        
        # 启动浏览器
        download_path = download_dir or str(output_base)
        if not automation.init_browser(download_dir=download_path, use_incognito=use_incognito):
            if callback:
                callback(0, "❌ 浏览器初始化失败")
            return {
                "success": False,
                "error": "浏览器初始化失败"
            }
        
        driver = automation.driver
        driver.maximize_window()
        
        if callback:
            callback(20, "正在访问法国签证申请表单页面...")
        driver.get("https://application-form.france-visas.gouv.fr/")
        
        wait = WebDriverWait(driver, 40)
        
        # 登录
        if callback:
            callback(25, "正在登录...")
        email_input = wait.until(EC.presence_of_element_located((By.ID, "username")))
        for char in email:
            email_input.send_keys(char)
            time.sleep(random.uniform(0.05, 0.15))
        
        password_input = wait.until(EC.presence_of_element_located((By.ID, "password")))
        for char in password:
            password_input.send_keys(char)
            time.sleep(random.uniform(0.05, 0.15))
        
        login_form = wait.until(EC.presence_of_element_located((By.ID, "kc-form-login")))
        login_form.submit()
        
        if callback:
            callback(30, "已提交登录表单")
        
        mark_stage("login-post-submit")
        time.sleep(3)
        recovered_after_login = False
        for attempt in range(3):
            current_url = ""
            body_text = ""
            try:
                current_url = driver.current_url
            except Exception:
                current_url = ""
            try:
                body_text = driver.find_element(By.TAG_NAME, "body").text
            except Exception:
                body_text = ""

            has_browser_error = (
                current_url.startswith("chrome-error://")
                or "无法访问此网站" in body_text
                or "ERR_HTTP2" in body_text
                or "ERR_" in body_text
                or "/error" in current_url
            )
            if not has_browser_error:
                recovered_after_login = True
                break

            if callback:
                callback(30, f"登录后页面异常，正在恢复 ({attempt + 1}/3)...")
            save_debug_snapshot(
                f"login-post-submit-recovery-{attempt + 1}",
                error="post_login_browser_error",
                extra={"current_url": current_url, "body_excerpt": body_text[:500]},
            )

            try:
                driver.refresh()
                time.sleep(2)
            except Exception:
                pass

            try:
                current_url = driver.current_url
            except Exception:
                current_url = ""

            if current_url.startswith("chrome-error://") or "/error" in current_url:
                try:
                    driver.get("https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml")
                    time.sleep(3)
                except Exception:
                    pass

        if not recovered_after_login:
            save_debug_snapshot(
                "login-post-submit-recovery-failed",
                error="登录后的页面没有正常打开",
            )
            raise Exception("登录可能已成功，但登录后的页面没有正常打开。请刷新或直接访问 France-Visas 主页后重试。")
        
        # 点击编辑按钮
        if callback:
            callback(35, "正在查找编辑按钮...")
        
        edit_button = None
        for attempt in range(3):
            try:
                time.sleep(2)
                # 查找前检查是否在错误页面，若是则刷新
                try:
                    current_url = driver.current_url
                    body_text = driver.find_element(By.TAG_NAME, "body").text
                    if (
                        current_url.startswith("chrome-error://")
                        or "/error" in current_url
                        or "无法访问此网站" in body_text
                        or "ERR_HTTP2" in body_text
                        or "ERR_" in body_text
                    ):
                        if callback:
                            callback(35, f"检测到错误页面，刷新后重试 ({attempt + 1}/3)...")
                        save_debug_snapshot(
                            f"edit-button-recovery-{attempt + 1}",
                            error="edit_button_page_error",
                            extra={"current_url": current_url, "body_excerpt": body_text[:500]},
                        )
                        driver.refresh()
                        time.sleep(3)
                        if driver.current_url.startswith("chrome-error://") or "/error" in driver.current_url:
                            driver.get("https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml")
                            time.sleep(3)
                        continue
                except Exception:
                    pass
                try:
                    edit_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[@title='Edit application']")))
                except:
                    try:
                        edit_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@id, 'formAccueilUsager') and @title='Edit application']")))
                    except:
                        edit_button = driver.execute_script("return document.querySelector('a[title=\"Edit application\"]')")
                
                if edit_button:
                    try:
                        edit_button.click()
                    except:
                        driver.execute_script("arguments[0].click();", edit_button)
                    if callback:
                        callback(40, f"已点击编辑按钮进入申请表 (尝试 {attempt + 1})")
                    break
            except Exception as e:
                if callback:
                    callback(35, f"第 {attempt + 1} 次尝试失败: {str(e)}")
                if attempt < 2:
                    time.sleep(3)
        
        if not edit_button:
            if callback:
                callback(0, "❌ 无法找到或点击编辑按钮")
            return {
                "success": False,
                "error": "无法找到或点击编辑按钮"
            }
        
        time.sleep(0.5)
        driver.execute_script("try{var b=document&&(document.body||document.documentElement);if(b)window.scrollTo(0,(b.scrollHeight||0))}catch(e){}")
        time.sleep(0.3)
        driver.execute_script("window.scrollTo(0,200);")
        
        # 填写表单
        if callback:
            callback(45, "开始填写表单...")
        
        def open_primefaces_dropdown(label_el, panel_id: str, retries: int = 3, wait_time: float = 0.4) -> None:
            for attempt in range(retries):
                try:
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", label_el)
                    try:
                        label_el.click()
                    except Exception:
                        driver.execute_script("arguments[0].click();", label_el)
                    WebDriverWait(driver, 6).until(EC.visibility_of_element_located((By.ID, panel_id)))
                    return
                except Exception:
                    if attempt < retries - 1:
                        time.sleep(wait_time)
            raise Exception(f"无法打开下拉框: {panel_id}")

        def set_input_value(input_el, value: str) -> None:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", input_el)
            try:
                input_el.click()
            except Exception:
                driver.execute_script("arguments[0].click();", input_el)
            input_el.clear()
            time.sleep(0.2)
            input_el.send_keys(value)
            time.sleep(0.3)

        def set_input_value_with_retry(input_id: str, value: str, retries: int = 3) -> None:
            for attempt in range(retries):
                try:
                    field = wait.until(EC.element_to_be_clickable((By.ID, input_id)), timeout=12)
                    set_input_value(field, value)
                    return
                except Exception:
                    pass
                if attempt < retries - 1:
                    time.sleep(0.6)
            raise Exception(f"无法填写字段: {input_id}")

        try:
            # 选择语言
            language_dropdown = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#formHeader\\:navigationLanguage_label")))
            open_primefaces_dropdown(language_dropdown, "formHeader:navigationLanguage_panel")
            chinese_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "li[data-label='中文']")))
            chinese_option.click()
            # 语言切换会触发表单 AJAX 重载，必须等待完成后再填性别，否则会被覆盖
            time.sleep(2.0)
            active_step = locate_current_step()
            if active_step == "formStep1":
                mark_stage("step1-entry")
                if callback:
                    callback(40, "妫€娴嬪埌褰撳墠鍋滅暀鍦ㄧ 1 姝ワ紝鍏堣繘鍏ヤ釜浜轰俊鎭楠?..")
                next_step1 = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:btnSuivant")))
                try:
                    next_step1.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", next_step1)
                time.sleep(2.5)
                active_step = locate_current_step()
                if active_step == "formStep1":
                    step1_errors = get_form_error_messages("formStep1")
                    save_debug_snapshot(
                        "step1-entry-blocked",
                        error="; ".join(step1_errors) if step1_errors else "step1 did not advance",
                        extra={"messages": step1_errors},
                    )
                    detail = "[step1-entry-blocked] 填写回执单未能从第 1 步进入个人信息页。请先检查国籍、递签地和旅行证件信息是否已完整生成。"
                    if step1_errors:
                        detail += f" 当前页面提示：{'；'.join(step1_errors[:3])}"
                    raise Exception(detail)
            wait.until(EC.presence_of_element_located((By.ID, "formStep2:DDE002_102_label")))
            time.sleep(0.8)
            
            # 选择性别（表单可能为中文 男/女 或英文 Male/Female）
            gender_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:DDE002_102_label")))
            open_primefaces_dropdown(gender_dropdown, "formStep2:DDE002_102_panel", retries=4, wait_time=0.6)
            time.sleep(0.4)  # 等待面板完全展开
            gender_option = None
            for label in sex_labels:
                try:
                    # 在已打开的面板内查找，尝试多种选择器
                    for sel in [
                        f"#formStep2\\:DDE002_102_panel li[data-label='{label}']",
                        f"div[id*='DDE002_102_panel'] li[data-label='{label}']",
                        f"li.ui-selectonemenu-item[data-label='{label}']",
                        f"li[data-label='{label}']",
                    ]:
                        try:
                            gender_option = WebDriverWait(driver, 3).until(
                                EC.presence_of_element_located((By.CSS_SELECTOR, sel))
                            )
                            break
                        except Exception:
                            continue
                    if gender_option is not None:
                        break
                except Exception:
                    continue
            if gender_option is None:
                raise Exception(f"无法找到性别选项，已尝试: {sex_labels}")
            # PrimeFaces 选项：先点 li；若 label 未更新则点 li 内的 span（部分版本把点击绑在 span 上）
            gender_option.click()
            time.sleep(0.4)
            label_text = (driver.find_element(By.ID, "formStep2:DDE002_102_label").text or "").strip()
            if not any(l in label_text for l in sex_labels):
                driver.execute_script("""
                    var li = arguments[0];
                    var inner = li.querySelector('.ui-selectonemenu-item-label') || li.querySelector('span') || li;
                    inner.click();
                """, gender_option)
                time.sleep(0.4)
            
            # 选择婚姻状态
            marital_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:DDE002_104_label")))
            open_primefaces_dropdown(marital_dropdown, "formStep2:DDE002_104_panel")
            marital_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, f"li[data-label='{marital_status}']")))
            marital_option.click()
            
            if callback:
                callback(50, "正在填写个人信息...")
            
            # 填写姓名
            surname_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-surname")))
            surname_field.clear()
            surname_field.send_keys(surname)
            
            firstnames_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-firstnames")))
            firstnames_field.clear()
            firstnames_field.send_keys(first_name)
            
            # 填写出生日期
            dob_day_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-dayOfBirth")))
            dob_day_field.clear()
            dob_day_field.send_keys(birth_day)
            
            dob_month_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-monthOfBirth")))
            dob_month_field.clear()
            dob_month_field.send_keys(birth_month)
            
            dob_year_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-yearOfBirth")))
            dob_year_field.clear()
            dob_year_field.send_keys(birth_year)
            
            birth_city_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-placeOfBirth")))
            birth_city_field.clear()
            birth_city_field.send_keys(birth_province)
            
            birth_country_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:visas-selected-countryOfBirth_label")))
            birth_country_dropdown.click()
            time.sleep(0.3)
            birth_country_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "li[data-label='China']")))
            birth_country_option.click()
            
            # 填写身份证号
            idcard_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-idcardNumber")))
            idcard_field.clear()
            idcard_field.send_keys(national_id)
            
            # 填写地址
            street_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-street")))
            street_field.clear()
            street_field.send_keys(street_address)
            
            zipcode_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-zipcode")))
            zipcode_field.clear()
            zipcode_field.send_keys(postcode)
            
            city_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-place")))
            city_field.clear()
            city_field.send_keys(current_city)
            
            time.sleep(0.5)
            
            applicant_country_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:visas-selected-applicant-country_label")))
            applicant_country_dropdown.click()
            
            dropdown_panel = wait.until(EC.visibility_of_element_located((By.ID, "formStep2:visas-selected-applicant-country_panel")))
            united_kingdom_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//*[@id='formStep2:visas-selected-applicant-country_panel']//li[contains(text(), 'United Kingdom')]")))
            driver.execute_script("arguments[0].scrollIntoView(true);", united_kingdom_option)
            united_kingdom_option.click()
            
            phone_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-phoneNumber")))
            phone_field.clear()
            phone_field.send_keys(phone_number)
            
            email_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-email")))
            email_field.clear()
            email_field.send_keys(email)
            
            # Yes单选按钮
            yes_radio = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[@role='radio' and .//label[text()='Yes']]")))
            yes_radio.click()
            wait.until(lambda d: yes_radio.get_attribute("aria-checked") == "true")
            
            driver.execute_script("try{var b=document&&document.body;if(b)b.click()}catch(e){}")
            time.sleep(0.8)
            
            permit_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:Visas-dde-permitNumber")))
            permit_field.click()
            permit_field.clear()
            permit_field.send_keys(sharecode_number)
            
            expiration_date_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:Visas-dde-expiration_date_input")))
            expiration_date_field.clear()
            expiration_date_field.send_keys(valid_until_date)
            
            effective_date_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:Visas-dde-releaseDate_input")))
            effective_date_field.clear()
            effective_date_field.send_keys(effective_date)
            
            driver.execute_script("try{var b=document&&document.body;if(b)b.click()}catch(e){}")
            time.sleep(1.2)
            
            if callback:
                callback(60, "正在填写职业信息...")
            
            # Occupation
            occupation_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:visas-input-applicant-activity-occupation_label")))
            occupation_dropdown.click()
            time.sleep(0.8)
            occupation_choice = wait.until(EC.element_to_be_clickable((By.XPATH, "//*[@id='formStep2:visas-input-applicant-activity-occupation_panel']//li[contains(text(), 'Student, trainee')]")))
            occupation_choice.click()
            time.sleep(0.8)
            
            business_segment_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:visas-input-applicant-activity-businessSegment_label")))
            business_segment_dropdown.click()
            time.sleep(0.8)
            business_segment_choice = wait.until(EC.element_to_be_clickable((By.XPATH, "//*[@id='formStep2:visas-input-applicant-activity-businessSegment_panel']//li[contains(text(), 'Other activities')]")))
            business_segment_choice.click()
            
            # 大学信息
            university_name_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-employer-name")))
            university_name_field.clear()
            university_name_field.send_keys(university_name)
            
            university_address_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-employer-street")))
            university_address_field.clear()
            university_address_field.send_keys(university_address)
            
            zip_code_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-employer-zip-code")))
            zip_code_field.clear()
            zip_code_field.send_keys(university_postcode)
            
            university_city_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-applicant-employer-place")))
            university_city_field.clear()
            university_city_field.send_keys(university_city)
            
            country_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:visas-selected-applicant-employer-country_label")))
            country_dropdown.click()
            time.sleep(0.8)
            country_choice = wait.until(EC.element_to_be_clickable((By.XPATH, "//*[@id='formStep2:visas-selected-applicant-employer-country_panel']//li[contains(text(), 'United Kingdom')]")))
            country_choice.click()
            time.sleep(0.8)
            
            university_phone_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-phoneNumber-employer")))
            university_phone_field.clear()
            cleaned_phone = ''.join(filter(str.isdigit, university_phone))
            university_phone_field.send_keys(cleaned_phone)
            
            university_email_field = wait.until(EC.presence_of_element_located((By.ID, "formStep2:visas-input-email-employer")))
            university_email_field.clear()
            university_email_field.send_keys(university_email)
            
            next_button = wait.until(EC.element_to_be_clickable((By.ID, "formStep2:btnSuivant")))
            next_button.click()
            
            time.sleep(2)
            
            if callback:
                callback(70, "正在填写申根签信息...")
            
            # 申根签信息
            raw_schengen_value = df['是否办过申根签（五年内）'].iloc[0]
            mark_stage("step3-schengen-history")
            schengen_visa_last_5_years = str(raw_schengen_value).strip()

            if callback:
                callback(70, f"申根签判断值: raw='{raw_schengen_value}' norm='{schengen_visa_last_5_years}'")


            def _format_ddmmyyyy(value):
                if value is None:
                    return ""
                try:
                    ts = pd.to_datetime(value)
                    if pd.notna(ts):
                        return ts.strftime("%d/%m/%Y")
                except Exception:
                    pass
                return str(value).strip()

            def _get_first_value(df_obj, keys, date_format: bool = False):
                for key in keys:
                    if key in df_obj.columns:
                        try:
                            raw_val = df_obj[key].iloc[0]
                            val = _format_ddmmyyyy(raw_val) if date_format else str(raw_val).strip()
                            if val:
                                return val
                        except Exception:
                            continue
                return ""

            # 勾选"是否五年内有申根签"
            is_schengen_yes = str(schengen_visa_last_5_years).strip() in ("是", "yes", "Yes", "YES")
            try:
                wait.until(EC.presence_of_element_located((By.ID, "formStep3:haveOldSchengenVisas")))
                time.sleep(0.5)
            except Exception as e:
                save_debug_snapshot(
                    "step3-have-old-schengen-visas-timeout",
                    error=str(e),
                    extra={"selector": "formStep3:haveOldSchengenVisas"},
                )
                raise

            if is_schengen_yes:
                # 是：选择 Yes，填写过去五年申根签详情
                try:
                    yes_container = wait.until(
                        EC.element_to_be_clickable(
                            (By.XPATH, "//*[@id='formStep3:haveOldSchengenVisas']//div[@role='radio'][.//label[@for='formStep3:haveOldSchengenVisas:0']]")
                        )
                    )
                    driver.execute_script("arguments[0].scrollIntoView(true);", yes_container)
                    time.sleep(0.3)
                    try:
                        yes_box = yes_container.find_element(By.CSS_SELECTOR, ".ui-radiobutton-box")
                        yes_box.click()
                    except Exception:
                        try:
                            yes_container.click()
                        except Exception:
                            yes_radio = driver.find_element(By.ID, "formStep3:haveOldSchengenVisas:0")
                            yes_radio.click()
                    time.sleep(1.2)
                except Exception as e:
                    if callback:
                        callback(71, f"勾选申根签'是'单选框失败: {repr(e)}")

                # 获取申根签起始/截止日期（兼容多种列名）
                schengen_start_date = _get_first_value(df, [
                    '申根签证起始日期',
                    '申根签有效期起始',
                    '申根签有效期开始',
                ], date_format=True)
                schengen_end_date = _get_first_value(df, [
                    '申根签证截止日期',
                    '申根签有效期截止',
                    '申根签有效期结束',
                ], date_format=True)

                if callback:
                    callback(71, f"填写申根签证起始日期: {schengen_start_date}")

                try:
                    schengen_start_field = wait.until(
                        EC.element_to_be_clickable(
                            (By.ID, "formStep3:valid-visa-start_input")
                        )
                    )
                    schengen_start_field.clear()
                    if schengen_start_date:
                        schengen_start_field.send_keys(schengen_start_date)
                except Exception as e:
                    if callback:
                        callback(71, f"填写申根签证起始日期失败: {repr(e)}")

                if callback:
                    callback(71, f"填写申根签证截止日期: {schengen_end_date}")

                try:
                    schengen_end_field = wait.until(
                        EC.element_to_be_clickable(
                            (By.ID, "formStep3:valid-visa-end_input")
                        )
                    )
                    schengen_end_field.clear()
                    if schengen_end_date:
                        schengen_end_field.send_keys(schengen_end_date)
                except Exception as e:
                    if callback:
                        callback(71, f"填写申根签证截止日期失败: {repr(e)}")

                # 勾选生物采集（指纹）"Yes"单选框
                try:
                    wait.until(EC.presence_of_element_located((By.ID, "formStep3:hasFingerPrints")))
                    time.sleep(0.5)
                    fp_container = wait.until(
                        EC.element_to_be_clickable(
                            (By.XPATH, "//*[@id='formStep3:hasFingerPrints']//div[@role='radio'][.//label[@for='formStep3:hasFingerPrints:0']]")
                        )
                    )
                    driver.execute_script("arguments[0].scrollIntoView(true);", fp_container)
                    time.sleep(0.3)
                    try:
                        fp_box = fp_container.find_element(By.CSS_SELECTOR, ".ui-radiobutton-box")
                        fp_box.click()
                    except Exception:
                        try:
                            fp_container.click()
                        except Exception:
                            fp_radio = driver.find_element(By.ID, "formStep3:hasFingerPrints:0")
                            fp_radio.click()
                    time.sleep(1.2)
                    if callback:
                        callback(71, "已勾选'有指纹采集'为Yes")
                except Exception as e:
                    if callback:
                        callback(71, f"勾选指纹采集'Yes'单选框失败: {repr(e)}")

                # 填写最近一次申根签号
                schengen_visa_number = _get_first_value(df, [
                    '最近一次申根签号',
                    '最近一次申根签号码',
                ])
                if callback:
                    callback(71, f"填写最近一次申根签号: {schengen_visa_number}")
                try:
                    visa_number_field = wait.until(
                        EC.element_to_be_clickable(
                            (By.ID, "formStep3:num-visa-biometrique")
                        )
                    )
                    visa_number_field.clear()
                    if schengen_visa_number:
                        visa_number_field.send_keys(schengen_visa_number)
                        time.sleep(0.5)
                except Exception as e:
                    if callback:
                        callback(71, f"填写最近一次申根签号失败: {repr(e)}")
            else:
                # 否：只选 No，直接点 Next，不填过去五年申根签详情
                if callback:
                    callback(71, "五年内无申根签，选择 No 后进入下一步")
                try:
                    no_container = wait.until(
                        EC.element_to_be_clickable(
                            (By.XPATH, "//*[@id='formStep3:haveOldSchengenVisas']//div[@role='radio'][.//label[@for='formStep3:haveOldSchengenVisas:1']]")
                        )
                    )
                    driver.execute_script("arguments[0].scrollIntoView(true);", no_container)
                    time.sleep(0.3)
                    try:
                        no_box = no_container.find_element(By.CSS_SELECTOR, ".ui-radiobutton-box")
                        no_box.click()
                    except Exception:
                        try:
                            no_container.click()
                        except Exception:
                            no_radio = driver.find_element(By.ID, "formStep3:haveOldSchengenVisas:1")
                            no_radio.click()
                    time.sleep(0.8)
                except Exception as e:
                    if callback:
                        callback(71, f"勾选申根签'否'单选框失败: {repr(e)}")

            next_button_step3 = wait.until(EC.element_to_be_clickable((By.ID, "formStep3:btnSuivant")))
            next_button_step3.click()
            time.sleep(2.0)

            step3_errors = []
            transition_deadline = time.time() + 20
            while time.time() < transition_deadline:
                current_step = locate_current_step()
                if current_step == "formStep4" and has_element(By.ID, "formStep4:date-of-arrival_input"):
                    break
                if current_step == "formStep3":
                    step3_errors = get_form_error_messages("formStep3")
                time.sleep(0.5)
            else:
                save_debug_snapshot(
                    "step3-next-step-timeout",
                    error="; ".join(step3_errors) if step3_errors else "step3 did not advance",
                    extra={"messages": step3_errors, "current_step": locate_current_step()},
                )
                if step3_errors:
                    raise Exception(
                        "[step3-next-step-timeout] 填写回执单第 3 步存在必填项未通过，请检查旧申根签证日期、指纹采集信息和最近一次生物识别签证号。当前页面提示："
                        + "；".join(step3_errors[:3])
                    )
                raise Exception("[step3-next-step-timeout] 填写回执单第 3 步未成功进入旅行信息页。当前网站流程可能已调整，请下载调试文件确认页面结构。")
            
            if callback:
                callback(75, "正在填写旅行信息...")
            
            # 入境和离开日期
            mark_stage("step4-travel-information")
            arrival_date_field = wait.until(EC.presence_of_element_located((By.ID, "formStep4:date-of-arrival_input")))
            arrival_date_field.clear()
            arrival_date_field.send_keys(entry_date)
            
            departure_date_field = wait.until(EC.presence_of_element_located((By.ID, "formStep4:date-of-departure_input")))
            departure_date_field.clear()
            departure_date_field.send_keys(departure_date)
            
            time.sleep(0.8)
            driver.execute_script("try{var b=document&&document.body;if(b)b.click()}catch(e){}")
            
            time.sleep(0.8)
            
            country_dropdown = wait.until(EC.presence_of_element_located((By.ID, "formStep4:visas-selected-applicant-country_label")))
            country_dropdown.click()
            time.sleep(0.8)
            selected_country = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[contains(@id, 'formStep4:visas-selected-applicant-country_') and text()='Multiple entries']")))
            selected_country.click()
            
            time.sleep(0.8)
            random_stays = random.randint(3, 4)
            stays_field = wait.until(EC.presence_of_element_located((By.ID, "formStep4:visas-input-applicant-numberOfStays_input")))
            stays_field.clear()
            time.sleep(0.8)
            stays_field.send_keys(str(random_stays))
            
            random_days = random.randint(20, 28)
            days_travel_field = wait.until(EC.presence_of_element_located((By.ID, "formStep4:visas-dde-number-days-travel")))
            time.sleep(1)
            days_travel_field.clear()
            days_travel_field.send_keys(str(random_days))
            
            time.sleep(0.8)
            
            # 在提交Step 4之前截图
            if callback:
                callback(78, "正在截图Step 4界面...")
            try:
                # 确定输出目录
                screenshot_dir = download_dir if download_dir else str(output_base)
                os.makedirs(screenshot_dir, exist_ok=True)
                
                # 生成截图文件名
                if original_filename:
                    base_name = os.path.splitext(original_filename)[0]
                    screenshot_filename = f"{base_name}_step4_before_submit.png"
                else:
                    screenshot_filename = f"{surname.upper()}_{first_name.upper()}_step4_before_submit.png"
                
                screenshot_path = os.path.join(screenshot_dir, screenshot_filename)
                driver.save_screenshot(screenshot_path)
                # 确保截图保存到output_base以便下载
                if screenshot_dir != str(output_base):
                    output_screenshot_path = os.path.join(str(output_base), screenshot_filename)
                    if os.path.exists(screenshot_path):
                        shutil.copy2(screenshot_path, output_screenshot_path)
                        screenshot_file = screenshot_filename
                else:
                    screenshot_file = screenshot_filename
                if callback:
                    callback(79, f"✅ Step 4界面截图已保存: {screenshot_filename}")
            except Exception as e:
                if callback:
                    callback(79, f"⚠️ 截图失败: {str(e)}")
                print(f"[填写回执单] 截图保存错误: {traceback.format_exc()}")
            
            next_button = wait.until(EC.element_to_be_clickable((By.ID, "formStep4:btnSuivant")))
            next_button.click()
            
            # Step 5 异步加载，需等待较长时间
            time.sleep(2.5)
            
            if callback:
                callback(80, "正在填写酒店信息...")
            
            # 酒店信息：先等待 Step 5 面板可见
            wait_step5 = WebDriverWait(driver, 30)
            checkbox_div = wait_step5.until(EC.element_to_be_clickable((By.XPATH, "//div[@id='formStep5:cbxHasPlaceOfApplication']//div[contains(@class, 'ui-chkbox-box')]")))
            checkbox_div.click()
            # 勾选后酒店字段需要时间展开显示
            time.sleep(1.5)
            
            # 酒店名称：支持 ID 大小写变体（PlaceOfApplication / placeOfApplication）
            hotel_name_field = None
            for sel in [
                (By.ID, "formStep5:visas-input-application-PlaceOfApplication-name"),
                (By.CSS_SELECTOR, "[id*='PlaceOfApplication'][id*='name']"),
                (By.CSS_SELECTOR, "[id*='placeOfApplication'][id*='name']"),
            ]:
                try:
                    hotel_name_field = wait_step5.until(EC.visibility_of_element_located(sel))
                    break
                except Exception:
                    continue
            if hotel_name_field is None:
                raise Exception("无法找到 Step 5 酒店名称输入框，请确认表单结构")
            hotel_name_field.clear()
            hotel_name_field.send_keys(str(hotel_name) if hotel_name is not None else "")
            
            hotel_address_field = wait_step5.until(EC.visibility_of_element_located((By.ID, "formStep5:visas-input-application-PlaceOfApplication-address-street")))
            hotel_address_field.clear()
            hotel_address_field.send_keys(str(hotel_address) if hotel_address is not None else "")
            
            hotel_zipcode_field = wait_step5.until(EC.visibility_of_element_located((By.ID, "formStep5:visas-input-application-PlaceOfApplication-address-zipcode")))
            hotel_zipcode_field.clear()
            hotel_zipcode_field.send_keys(str(hotel_postcode) if hotel_postcode is not None else "")
            
            hotel_place_field = wait_step5.until(EC.visibility_of_element_located((By.ID, "formStep5:visas-input-application-PlaceOfApplication-address-place")))
            hotel_place_field.clear()
            hotel_place_field.send_keys(str(hotel_city) if hotel_city is not None else "")
            
            hotel_phone_field = wait_step5.until(EC.visibility_of_element_located((By.ID, "formStep5:visas-input-application-PlaceOfApplication-address-phoneNumber")))
            hotel_phone_field.clear()
            hotel_phone_field.send_keys(str(hotel_phone) if hotel_phone is not None else "")
            
            hotel_email_field = wait_step5.until(EC.visibility_of_element_located((By.ID, "formStep5:visas-input-application-PlaceOfApplication-address-email")))
            hotel_email_field.clear()
            hotel_email_field.send_keys(str(hotel_email) if hotel_email is not None else "")
            
            checkbox_myself_div = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[@id='formStep5:cbxHasAutoFunding']//div[contains(@class, 'ui-chkbox-box')]")))
            checkbox_myself_div.click()
            
            time.sleep(0.5)
            option_id = "formStep5:autoFundings:3"
            try:
                label = driver.find_element(By.CSS_SELECTOR, f'label[for="{option_id}"]')
                label.click()
            except Exception as e:
                pass
            
            next_button = wait.until(EC.element_to_be_clickable((By.ID, "formStep5:btnSuivant")))
            next_button.click()
            
            continue_button = wait.until(EC.element_to_be_clickable((By.ID, "formStepSix:btnSuivant")))
            continue_button.click()
            
            # 等待页面加载
            time.sleep(2)
            
            # 检查是否有确认对话框需要点击
            try:
                # 尝试查找确认按钮（Yes按钮）
                wait_short = WebDriverWait(driver, 5)
                confirm_button = wait_short.until(EC.element_to_be_clickable((By.ID, "formAccueilUsager:btnTransmettre")))
                driver.execute_script("arguments[0].scrollIntoView(true);", confirm_button)
                confirm_button.click()
                if callback:
                    callback(89, "已点击确认按钮")
                time.sleep(2)
            except Exception as e:
                # 如果没有确认对话框，继续
                if callback:
                    callback(89, "未找到确认对话框，继续...")
            
            if callback:
                callback(90, f"✅ {first_name}的FV回执单填写成功")
            
            # 下载PDF
            pdf_saved = False
            new_file_path = None
            try:
                # 使用原始文件名生成PDF文件名（避免法国签证站返回的 UUID 文件名）
                if original_filename:
                    base_name = os.path.splitext(original_filename)[0]
                    new_file_name = f"{base_name}FV表草稿.pdf"
                else:
                    new_file_name = f"{surname.upper()} {first_name.upper()} - Fv申请回执单草稿.pdf"
                output_dir = download_dir if download_dir else str(output_base)
                os.makedirs(output_dir, exist_ok=True)
                new_file_path = os.path.join(output_dir, new_file_name)
                
                download_folder = download_path
                existing_files = set()
                if os.path.exists(download_folder):
                    for fn in os.listdir(download_folder):
                        existing_files.add(os.path.join(download_folder, fn))

                def _is_new_pdf(fp: str) -> bool:
                    if fp in existing_files:
                        return False
                    if fp.endswith(".pdf"):
                        return True
                    try:
                        with open(fp, "rb") as f:
                            return f.read(5) == b"%PDF-"
                    except Exception:
                        return False
                
                # 查找PDF链接（使用成功的方法：通过PDF图标）
                if callback:
                    callback(91, "正在查找PDF下载链接...")
                    # 直接使用成功的方法：查找包含PDF图标的链接
                
                pdf_link = None
                try:
                    pdf_links = driver.find_elements(By.XPATH, "//a[contains(@class, 'btn') and .//i[contains(@class, 'pi-file-pdf')]]")
                    if pdf_links:
                        pdf_link = pdf_links[0]
                        if callback:
                            callback(91, "✅ 找到PDF下载链接")
                    else:
                        raise Exception("未找到PDF下载链接")
                except Exception as e:
                    if callback:
                        callback(91, f"❌ 查找PDF链接失败: {str(e)[:50]}")
                    raise Exception(f"无法找到PDF下载链接: {str(e)}")
                
                driver.execute_script("arguments[0].scrollIntoView(true);", pdf_link)
                time.sleep(0.5)
                
                if callback:
                    callback(92, "正在下载PDF（使用自定义文件名）...")
                
                # 优先使用 Playwright expect_download 直接保存为可读文件名，避免法国签证站返回的 UUID
                downloaded_file = None
                pw_page = automation.get_page()
                if pw_page:
                    try:
                        with pw_page.expect_download(timeout=60000) as download_info:
                            pdf_link.click()
                        download = download_info.value
                        download.save_as(new_file_path)
                        downloaded_file = new_file_path
                        pdf_saved = True
                        if callback:
                            callback(94, f"✅ PDF已保存为: {new_file_name}")
                    except Exception as e:
                        if callback:
                            callback(92, f"expect_download 方式失败，尝试备用方式: {str(e)[:80]}")
                        pw_page = None
                
                if not downloaded_file:
                    pdf_link.click()
                    if callback:
                        callback(92, "已点击PDF下载链接，等待文件下载...")
                # 使用原始文件名生成PDF文件名
                if original_filename:
                    # 去掉扩展名，只保留文件名部分
                    base_name = os.path.splitext(original_filename)[0]
                    new_file_name = f"{base_name}FV表草稿.pdf"
                else:
                    # 如果没有原始文件名，使用姓名
                    new_file_name = f"{surname.upper()} {first_name.upper()} - Fv申请回执单草稿.pdf"
                
                # 保存到output_base以便下载
                output_dir = download_dir if download_dir else str(output_base)
                os.makedirs(output_dir, exist_ok=True)
                time.sleep(5)
                
                # 若 expect_download 已成功则跳过后续等待和重命名
                if not pdf_saved:
                    if callback:
                        callback(93, f"等待PDF文件下载完成... (下载文件夹: {download_folder})")
                    
                    max_wait_time = 90  # 增加最大等待时间到90秒
                    wait_time = 0
                    last_file_size = 0
                    stable_count = 0
                    file_detected = False
                    if callback:
                        callback(93, f"⚠️ 下载文件夹不存在: {download_folder}，尝试创建...")
                    try:
                        os.makedirs(download_folder, exist_ok=True)
                    except Exception:
                        pass

                    # 检查下载文件夹是否存在
                    if not os.path.exists(download_folder):
                        if callback:
                            callback(93, f"⚠️ 下载文件夹不存在: {download_folder}，尝试创建...")
                        try:
                            os.makedirs(download_folder, exist_ok=True)
                        except Exception as e:
                            if callback:
                                callback(93, f"❌ 无法创建下载文件夹: {str(e)}")
                    
                    while wait_time < max_wait_time:
                        time.sleep(1)
                        wait_time += 1
                        
                        if os.path.exists(download_folder):
                            for filename in os.listdir(download_folder):
                                file_path_full = os.path.join(download_folder, filename)
                                if not _is_new_pdf(file_path_full):
                                    continue
                                try:
                                    current_size = os.path.getsize(file_path_full)
                                    if not file_detected:
                                        file_detected = True
                                        if callback:
                                            callback(93, f"✅ 检测到新PDF文件: {filename} (大小: {current_size} 字节)")
                                    if current_size == last_file_size and current_size > 0:
                                        stable_count += 1
                                        if stable_count >= 5:
                                            downloaded_file = file_path_full
                                            if callback:
                                                callback(94, f"✅ PDF文件下载完成并稳定: {filename} (大小: {current_size} 字节)")
                                            break
                                    else:
                                        stable_count = 0
                                        last_file_size = current_size
                                        if callback and wait_time % 5 == 0:
                                            callback(93, f"文件正在下载: {filename} (当前大小: {current_size} 字节，等待稳定...)")
                                except Exception as e:
                                    if callback and wait_time % 10 == 0:
                                        callback(93, f"检查文件时出错: {str(e)[:50]}")
                        
                        if downloaded_file:
                            break
                    
                    # 如果没找到新文件，尝试查找最新修改的文件
                    if not downloaded_file:
                        if callback:
                            callback(94, "未检测到新文件，尝试查找最新修改的PDF文件...")
                        pdf_files = []
                        if os.path.exists(download_folder):
                            for filename in os.listdir(download_folder):
                                file_path_full = os.path.join(download_folder, filename)
                                if not os.path.isfile(file_path_full):
                                    continue
                                try:
                                    with open(file_path_full, "rb") as f:
                                        if f.read(5) != b"%PDF-":
                                            continue
                                except Exception:
                                    continue
                                try:
                                    mod_time = os.path.getmtime(file_path_full)
                                    file_size = os.path.getsize(file_path_full)
                                    if file_size > 1024:
                                        pdf_files.append((file_path_full, filename, mod_time, file_size))
                                        if callback:
                                            callback(94, f"找到PDF文件: {filename} (大小: {file_size} 字节)")
                                except Exception as e:
                                    if callback:
                                        callback(94, f"检查文件 {filename} 时出错: {str(e)[:50]}")
                        
                        if pdf_files:
                            pdf_files.sort(key=lambda x: x[2], reverse=True)  # 按修改时间排序
                            downloaded_file = pdf_files[0][0]
                            if callback:
                                callback(94, f"✅ 使用最新修改的PDF文件: {pdf_files[0][1]}")
                    
                    # 保存PDF文件（重命名为可读文件名）
                    if downloaded_file and os.path.exists(downloaded_file):
                        try:
                            if os.path.exists(new_file_path):
                                os.remove(new_file_path)
                            if downloaded_file != new_file_path:
                                os.rename(downloaded_file, new_file_path)
                            pdf_saved = True
                            if callback:
                                callback(95, f"✅ 已将文件重命名为: {new_file_name} 并保存在: {output_dir}")
                        except Exception as e:
                            try:
                                shutil.copy2(downloaded_file, new_file_path)
                                pdf_saved = True
                                if callback:
                                    callback(95, f"✅ 已将文件复制为: {new_file_name} 并保存在: {output_dir}")
                                if downloaded_file != new_file_path:
                                    try:
                                        os.remove(downloaded_file)
                                    except Exception:
                                        pass
                            except Exception as e2:
                                if callback:
                                    callback(95, f"❌ 保存PDF文件时出错: {str(e2)}")
                                pdf_saved = False
                                print(f"[填写回执单] 保存PDF文件失败: {str(e2)}")
                    else:
                        pdf_saved = False
                        if callback:
                            if downloaded_file:
                                callback(95, f"❌ 下载的文件不存在: {downloaded_file}")
                            else:
                                callback(95, f"❌ 在下载文件夹 {download_folder} 中未找到新下载的PDF文件")
                                if os.path.exists(download_folder):
                                    all_files = os.listdir(download_folder)
                                    if all_files:
                                        callback(95, f"下载文件夹中的文件: {', '.join(all_files[:10])}")
                                    else:
                                        callback(95, "下载文件夹为空")
                        print(f"[填写回执单] PDF文件未找到 - downloaded_file={downloaded_file}, download_folder={download_folder}, exists={os.path.exists(download_folder) if download_folder else False}")
            
            except Exception as pdf_error:
                error_detail = traceback.format_exc()
                if callback:
                    callback(95, f"下载PDF时出错: {str(pdf_error)[:200]}")
                # 记录详细错误到日志
                print(f"[填写回执单] PDF下载错误详情: {error_detail}")
            
            # 返回主页（确保浏览器状态正确）
            try:
                if callback:
                    callback(98, "正在返回主页...")
                
                # 检查当前是否在主页
                current_url = driver.current_url
                if "accueil" not in current_url.lower():
                    # 如果不在主页，导航到主页
                    driver.get("https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml")
                    time.sleep(2)  # 等待主页加载
                    if callback:
                        callback(99, "✅ 已返回主页")
                else:
                    if callback:
                        callback(99, "✅ 已在主页")
            except Exception as e:
                if callback:
                    callback(99, f"返回主页时出错（可忽略）: {str(e)[:50]}")
            
            if callback:
                callback(100, "回执单填写完成")
            
            # 返回PDF文件名（相对于output_base）
            pdf_filename = None
            if pdf_saved and new_file_path and os.path.exists(new_file_path):
                pdf_filename = os.path.basename(new_file_path)
                if callback:
                    callback(96, f"✅ PDF文件已保存: {pdf_filename}")
            elif pdf_saved:
                if callback:
                    callback(96, f"⚠️ PDF文件保存状态为True，但文件路径无效或文件不存在: {new_file_path if 'new_file_path' in locals() else 'N/A'}")
            else:
                if callback:
                    callback(96, f"⚠️ PDF文件未保存，pdf_saved={pdf_saved}")
            
            # 确保变量已初始化
            if 'pdf_saved' not in locals():
                pdf_saved = False
            if 'new_file_path' not in locals():
                new_file_path = None
            
            result = {
                "success": True,
                "message": f"{first_name}的FV回执单填写成功",
                "pdf_saved": pdf_saved,
                "pdf_path": new_file_path if (pdf_saved and new_file_path) else None,
                "pdf_file": pdf_filename,  # 用于前端下载
                "screenshot_file": screenshot_file,  # 截图文件
                "debug_files": debug_files
            }
            
            # 调试输出到 stderr，避免污染 stdout 的 JSON
            print(f"[填写回执单] 返回结果: pdf_saved={pdf_saved}, pdf_file={pdf_filename}", file=sys.stderr)
            
            return result
            
        except Exception as e:
            err_msg = str(e)
            if callback:
                callback(0, f"❌ 填写表单时出错: {err_msg}")
            # 若浏览器已被关闭，给出明确提示
            if "closed" in err_msg.lower() or "browser has been closed" in err_msg.lower():
                user_msg = "浏览器窗口已被关闭。请勿在填写过程中手动关闭浏览器窗口，并重新运行。"
                if callback:
                    callback(0, f"❌ {user_msg}")
                save_debug_snapshot("browser-closed", error=user_msg)
                return {"success": False, "error": user_msg, "debug_files": debug_files, "screenshot_file": screenshot_file}
            save_debug_snapshot("error-snapshot", error=err_msg, extra={"traceback": traceback.format_exc()})
            return {
                "success": False,
                "error": err_msg,
                "debug_files": debug_files,
                "screenshot_file": screenshot_file
            }
        
    except Exception as e:
        err_msg = str(e)
        if callback:
            callback(0, f"❌ 处理时发生错误: {err_msg}")
        if "closed" in err_msg.lower() or "browser has been closed" in err_msg.lower():
            save_debug_snapshot("browser-closed", error=err_msg)
            return {
                "success": False,
                "error": "浏览器窗口已被关闭。请勿在填写过程中手动关闭浏览器窗口，并重新运行。",
                "debug_files": debug_files,
                "screenshot_file": screenshot_file
            }
        save_debug_snapshot("fatal-error", error=err_msg, extra={"traceback": traceback.format_exc()})
        return {
            "success": False,
            "error": err_msg,
            "debug_files": debug_files,
            "screenshot_file": screenshot_file
        }
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

"""
法签生成新申请功能
从原始代码复制并适配
"""
import os
import sys
import time
import json
import re
from pathlib import Path
from typing import Optional, Callable, Dict, Any

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd

try:
    from . import config
    from .automation import FrenchVisaAutomation
except ImportError:
    import config
    from automation import FrenchVisaAutomation


def extract_reference_number(text: str) -> Optional[str]:
    """
    从文本中提取法国签证申请参考号
    参考号格式：FRA + 字母数字组合，通常长度在 15-20 个字符
    例如：FRA1MC20267005531
    
    Args:
        text: 包含参考号的文本（可能包含额外描述）
        例如：'FRA1MC20267005531 France Short-stay (≤ 90 days) To be completed'
    
    Returns:
        提取的参考号，如果未找到则返回 None
        例如：'FRA1MC20267005531'
    """
    if not text:
        return None
    
    # 清理文本（移除换行符、制表符等）
    text = text.strip()
    text = ' '.join(text.split())  # 移除多余空格
    
    # 方法1: 如果文本以 FRA 开头，取第一个空格前的部分（最简单直接）
    if text.startswith('FRA'):
        parts = text.split()
        if parts:
            ref = parts[0]
            # 验证参考号格式：FRA + 字母数字组合，长度在 15-20 字符之间
            if re.match(r'^FRA[A-Z0-9]+$', ref) and 15 <= len(ref) <= 20:
                return ref
    
    # 方法2: 使用正则表达式匹配 FRA 开头的参考号格式
    # 格式：FRA + 字母数字组合（总长度通常在 15-20 字符）
    pattern = r'\bFRA[A-Z0-9]{12,17}\b'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        ref = match.group(0).upper()  # 转换为大写
        # 验证参考号长度（通常在 15-20 字符之间）
        if 15 <= len(ref) <= 20:
            return ref
    
    # 方法3: 更宽松的匹配，查找所有可能的参考号模式
    # 匹配 FRA 后跟字母数字组合的模式（不限制长度，但验证长度）
    pattern2 = r'\bFRA[0-9A-Z]{10,20}\b'
    matches = re.findall(pattern2, text, re.IGNORECASE)
    for match in matches:
        ref = match.upper()
        # 验证参考号格式和长度
        if re.match(r'^FRA[A-Z0-9]+$', ref) and 15 <= len(ref) <= 20:
            return ref
    
    return None


def create_new_application(file_path: str, original_filename: str = None, callback: Optional[Callable[[int, str], None]] = None, output_dir: str = "", result_output: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
    """
    生成新申请
    
    Args:
        file_path: Excel文件路径
        callback: 进度回调函数
        output_dir: 输出目录（为空时使用默认目录）
    
    Returns:
        包含处理结果的字典
    """
    output_base = config.get_output_dir(output_dir or "")
    automation = FrenchVisaAutomation(callback=callback, output_dir=str(output_base))
    driver = None
    
    try:
        if callback:
            callback(0, "开始生成新申请...")
        
        # 读取Excel文件
        if callback:
            callback(5, "正在读取Excel文件...")
        
        try:
            df = pd.read_excel(file_path)
            if callback:
                callback(6, "Excel文件读取完成，正在处理数据...")
        except Exception as e:
            if callback:
                callback(0, f"❌ 读取Excel文件失败: {str(e)}")
            return {
                "success": False,
                "error": f"读取Excel文件失败: {str(e)}"
            }
        
        try:
            df = df.transpose()
            if callback:
                callback(7, "数据转置完成...")
            df = df.reset_index()
            df.columns = df.iloc[0]
            df = df.iloc[1:]
            df = df.reset_index(drop=True)
            df.columns = df.columns.str.strip()
            
            if callback:
                callback(8, "数据格式处理完成...")
        except Exception as e:
            if callback:
                callback(0, f"❌ 处理Excel数据失败: {str(e)}")
            return {
                "success": False,
                "error": f"处理Excel数据失败: {str(e)}"
            }
        
        if callback:
            callback(10, "Excel文件读取成功")
        
        # 提取数据
        try:
            if callback:
                callback(11, "正在提取数据字段...")
            
            email = df['邮箱账号（Email account）'].iloc[0]
            password = df['邮箱密码（Email password）'].iloc[0]
            application_country = df['所要办理的申根国家（Schengen country to apply for）'].iloc[0]
            application_city = df['递签城市（Visa submission city）'].iloc[0]
            stay_duration = 'Short-stay (≤ 90 days)'
            destination_country = 'France'
            document_type = 'Ordinary passport'
            passport_number = df['护照号码（Number of travel document）'].iloc[0]
            
            # 解析证件发放日期（格式：日/月/年，例如：11/03/2024 = 11日3月2024年）
            issue_date_raw = df['证件发放日期（Date of issue）'].iloc[0]
            
            # 处理各种可能的输入格式
            if pd.isna(issue_date_raw):
                raise ValueError("证件发放日期为空")
            
            # 如果是pandas Timestamp或datetime对象，直接使用
            from datetime import datetime
            if isinstance(issue_date_raw, (pd.Timestamp, datetime)):
                passport_issue_date = pd.to_datetime(issue_date_raw)
                # 验证解析后的日期是否正确（显示日、月、年）
                if callback:
                    callback(12, f"✅ 日期是datetime对象: {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
            else:
                # 转换为字符串并清理
                issue_date_str = str(issue_date_raw).strip()
                # 移除可能的日期时间部分（如果Excel读取为datetime）
                if ' ' in issue_date_str:
                    issue_date_str = issue_date_str.split(' ')[0]
                
                if callback:
                    callback(12, f"原始日期字符串: {issue_date_str} (类型: {type(issue_date_raw).__name__})")
                
                try:
                    # 首先尝试 日/月/年 格式 (dd/mm/yyyy)
                    passport_issue_date = pd.to_datetime(issue_date_str, format='%d/%m/%Y', errors='raise')
                    if callback:
                        callback(12, f"✅ 日期解析成功（日/月/年）: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
                except (ValueError, TypeError) as e:
                    try:
                        # 尝试 日-月-年 格式
                        passport_issue_date = pd.to_datetime(issue_date_str, format='%d-%m-%Y', errors='raise')
                        if callback:
                            callback(12, f"✅ 日期解析成功（日-月-年）: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
                    except (ValueError, TypeError):
                        try:
                            # 尝试使用 dayfirst=True（优先将第一个数字作为日期）
                            passport_issue_date = pd.to_datetime(issue_date_str, dayfirst=True, errors='raise')
                            if callback:
                                callback(12, f"✅ 日期解析成功（dayfirst=True）: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
                        except (ValueError, TypeError):
                            # 如果都失败，尝试手动解析
                            try:
                                # 手动解析日期字符串
                                parts = issue_date_str.replace('-', '/').replace('.', '/').split('/')
                                if len(parts) == 3:
                                    day = int(parts[0].strip())
                                    month = int(parts[1].strip())
                                    year = int(parts[2].strip())
                                    # 确保年份是4位数
                                    if year < 100:
                                        year += 2000 if year < 50 else 1900
                                    passport_issue_date = pd.Timestamp(year=year, month=month, day=day)
                                    if callback:
                                        callback(12, f"✅ 日期手动解析成功: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={day}, 月={month}, 年={year})")
                                else:
                                    raise ValueError("日期格式不正确")
                            except Exception as manual_e:
                                error_msg = f"无法解析证件发放日期: {issue_date_str}，请确保格式为 日/月/年 (例如: 11/03/2024)。错误: {str(manual_e)}"
                                if callback:
                                    callback(12, f"❌ {error_msg}")
                                raise ValueError(error_msg)
            
            passport_expiry_date = (passport_issue_date + pd.DateOffset(years=10) - pd.DateOffset(days=1))
            if callback:
                callback(12, f"证件有效期: {passport_expiry_date.strftime('%d/%m/%Y')} (日/月/年)")
            travel_purpose = 'Tourism'
            
            if callback:
                callback(13, f"数据提取完成 - 邮箱: {email[:10]}..., 城市: {application_city}")
        except KeyError as e:
            if callback:
                callback(0, f"❌ Excel文件缺少必要字段: {str(e)}")
            return {
                "success": False,
                "error": f"Excel文件缺少必要字段: {str(e)}"
            }
        except Exception as e:
            if callback:
                callback(0, f"❌ 提取数据时出错: {str(e)}")
            return {
                "success": False,
                "error": f"提取数据时出错: {str(e)}"
            }
        
        if callback:
            callback(15, "数据提取完成，正在启动浏览器...")
        
        # 启动浏览器
        try:
            if callback:
                callback(16, "正在初始化浏览器...")
            browser_init_result = automation.init_browser()
            if callback:
                callback(17, f"浏览器初始化结果: {browser_init_result}")
            if not browser_init_result:
                if callback:
                    callback(0, "❌ 浏览器初始化失败")
                return {
                    "success": False,
                    "error": "浏览器初始化失败"
                }
            if callback:
                callback(18, "✅ 浏览器初始化成功")
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"浏览器初始化异常详情: {error_detail}")
            if callback:
                callback(0, f"❌ 浏览器初始化异常: {str(e)}")
            return {
                "success": False,
                "error": f"浏览器初始化异常: {str(e)}"
            }
        
        driver = automation.driver
        if not driver:
            if callback:
                callback(0, "❌ 浏览器驱动未创建")
            return {
                "success": False,
                "error": "浏览器驱动未创建"
            }
        
        if callback:
            callback(19, "浏览器已就绪，正在访问网站...")
        driver.get("https://application-form.france-visas.gouv.fr/")
        
        wait = WebDriverWait(driver, 40)
        
        # 登录
        if callback:
            callback(25, "正在登录...")
        email_input = wait.until(EC.presence_of_element_located((By.ID, "username")))
        email_input.send_keys(email)
        
        password_input = wait.until(EC.presence_of_element_located((By.ID, "password")))
        password_input.send_keys(password)
        
        login_form = wait.until(EC.presence_of_element_located((By.ID, "kc-form-login")))
        login_form.submit()
        
        if callback:
            callback(30, "登录表单提交完成")
        
        time.sleep(3)
        # 登录后若遇到 ERR_HTTP2_PROTOCOL_ERROR 等无法访问页面，刷新重试
        for _ in range(2):
            try:
                body_text = driver.find_element(By.TAG_NAME, "body").text
                if "无法访问此网站" in body_text or "ERR_HTTP2" in body_text or "ERR_" in body_text:
                    if callback:
                        callback(30, "检测到网络错误页面，正在刷新...")
                    driver.refresh()
                    time.sleep(3)
            except Exception:
                break
        time.sleep(1)
        
        # 创建新申请
        if callback:
            callback(35, "正在创建新申请...")
        create_new_app_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Create a new application in a new group of applications')]")))
        create_new_app_button.click()
        
        time.sleep(0.1)
        
        # 填写表单
        if callback:
            callback(40, "开始填写表单...")
        
        def open_primefaces_dropdown(label_el, panel_id: str, retries: int = 3, wait_time: float = 0.5) -> None:
            for attempt in range(retries):
                try:
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", label_el)
                    time.sleep(0.2)
                    try:
                        label_el.click()
                    except Exception:
                        driver.execute_script("arguments[0].click();", label_el)
                    WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.ID, panel_id)))
                    return
                except Exception:
                    if attempt < retries - 1:
                        time.sleep(wait_time)
            raise Exception(f"无法打开下拉框: {panel_id}")
        
        try:
            driver.execute_script("window.scrollTo(0, 200);")
            time.sleep(0.3)
            
            # 选择语言
            if callback:
                callback(41, "正在选择语言...")
            language_dropdown = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#formHeader\\:navigationLanguage_label")))
            open_primefaces_dropdown(language_dropdown, "formHeader:navigationLanguage_panel")
            chinese_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "li[data-label='中文']")))
            chinese_option.click()
            time.sleep(0.6)
            if callback:
                callback(42, "✅ 已选择中文语言")
            
            # 选择国籍（中国）
            if callback:
                callback(43, "正在选择国籍...")
            nationality_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:visas-selected-nationality_label")))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", nationality_dropdown)
            time.sleep(0.2)
            open_primefaces_dropdown(nationality_dropdown, "formStep1:visas-selected-nationality_panel", retries=4, wait_time=0.6)
            chinese_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[@data-label='Chinese']")))
            chinese_option.click()
            time.sleep(0.6)
            wait.until(lambda d: "Chinese" in d.find_element(By.ID, "formStep1:visas-selected-nationality_label").text)
            if callback:
                callback(44, "✅ 已选择中国国籍")
            
            # 选择提交国家
            if callback:
                callback(45, "正在选择提交国家...")
            deposit_country_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-deposit-country_label")))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", deposit_country_dropdown)
            time.sleep(0.2)
            open_primefaces_dropdown(deposit_country_dropdown, "formStep1:Visas-selected-deposit-country_panel")
            deposit_country_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[@data-label='United Kingdom']")))
            deposit_country_option.click()
            time.sleep(0.3)
            wait.until(lambda d: "United Kingdom" in d.find_element(By.ID, "formStep1:Visas-selected-deposit-country_label").text)
            if callback:
                callback(46, "✅ 已选择英国作为提交国家")
            
            # 选择停留时间
            if callback:
                callback(47, "正在选择停留时间...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-selected-stayDuration_label"))
            time.sleep(0.2)
            duration_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-stayDuration_label")))
            duration_dropdown.click()
            duration_option = wait.until(EC.element_to_be_clickable((By.XPATH, f"//li[@data-label='{stay_duration}']")))
            duration_option.click()
            time.sleep(0.3)
            if callback:
                callback(48, "✅ 已选择停留时间")
            
            # 选择目的地国家
            if callback:
                callback(49, "正在选择目的地国家...")
            try:
                destination_element = wait.until(EC.presence_of_element_located((By.ID, "formStep1:Visas-selected-destination_label")))
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", destination_element)
                time.sleep(0.5)
            except Exception as e:
                destination_element = wait.until(EC.presence_of_element_located((By.ID, "formStep1:Visas-selected-destination_label")))
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", destination_element)
                time.sleep(0.5)
            
            destination_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-destination_label")))
            destination_dropdown.click()
            time.sleep(0.3)
            france_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[@data-label='France']")))
            france_option.click()
            time.sleep(0.6)
            wait.until(lambda d: "France" in d.find_element(By.ID, "formStep1:Visas-selected-destination_label").text)
            if callback:
                callback(50, "✅ 已选择法国作为目的地")
            
            # 选择申请城市
            if callback:
                callback(51, f"正在选择申请城市: {application_city}...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-selected-deposit-town"))
            time.sleep(0.2)
            city_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-deposit-town")))
            city_dropdown.click()
            city_option = wait.until(EC.element_to_be_clickable((By.XPATH, f"//li[@data-label='{application_city}']")))
            city_option.click()
            time.sleep(0.3)
            if callback:
                callback(52, f"✅ 已选择申请城市: {application_city}")
            
            # 选择证件类型
            if callback:
                callback(53, "正在选择证件类型...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-dde-travel-document_label"))
            time.sleep(0.2)
            travel_doc_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-travel-document_label")))
            travel_doc_dropdown.click()
            doc_type_option = wait.until(EC.element_to_be_clickable((By.XPATH, f"//li[@data-label='{document_type}']")))
            doc_type_option.click()
            time.sleep(0.2)
            if callback:
                callback(54, "✅ 已选择证件类型")
            
            # 填写护照信息
            if callback:
                callback(55, "正在填写护照信息...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-dde-travel-document-number"))
            time.sleep(0.2)
            travel_doc_number = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-travel-document-number")))
            travel_doc_number.send_keys(passport_number.upper())
            time.sleep(0.2)
            if callback:
                callback(56, "✅ 已填写护照号码")
            
            release_date_input = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-release_date_real_input")))
            release_date_input.click()
            release_date_input.send_keys(passport_issue_date.strftime('%d/%m/%Y'))
            time.sleep(0.2)
            if callback:
                callback(57, "✅ 已填写护照签发日期")
            
            expiry_date_input = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-expiration_date_input")))
            expiry_date_input.click()
            expiry_date_input.send_keys(passport_expiry_date.strftime('%d/%m/%Y'))
            time.sleep(0.2)
            if callback:
                callback(58, "✅ 已填写护照到期日期")
            
            body = wait.until(EC.element_to_be_clickable((By.TAG_NAME, "body")))
            body.click()
            time.sleep(0.2)
            
            # 选择旅行目的
            if callback:
                callback(59, "正在选择旅行目的...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-selected-purposeCategory_label"))
            time.sleep(0.2)
            purpose_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-purposeCategory_label")))
            purpose_dropdown.click()
            purpose_option = wait.until(EC.element_to_be_clickable((By.XPATH, f"//li[@data-label='{travel_purpose}']")))
            purpose_option.click()
            time.sleep(0.2)
            time.sleep(2)
            if callback:
                callback(60, "✅ 已选择旅行目的类别")
            
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-selected-purpose_label"))
            time.sleep(0.2)
            specific_purpose_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-purpose_label")))
            specific_purpose_dropdown.click()
            time.sleep(0.2)
            time.sleep(1)
            
            tourism_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[@data-label='Tourism / Private visit']")))
            tourism_option.click()
            time.sleep(0.2)
            if callback:
                callback(61, "✅ 已选择具体旅行目的")
            
            body = wait.until(EC.element_to_be_clickable((By.TAG_NAME, "body")))
            body.click()
            time.sleep(0.2)
            
            if callback:
                callback(65, "表单填写完成，正在提交...")
            
            # 提交表单
            driver.execute_script("try{var b=document&&(document.body||document.documentElement);if(b)window.scrollTo(0,(b.scrollHeight||0))}catch(e){}")
            time.sleep(0.2)
            if callback:
                callback(66, "正在点击验证按钮...")
            verify_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[id$='btnVerifier']")))
            verify_button.click()
            time.sleep(0.2)
            if callback:
                callback(67, "✅ 已点击验证按钮")
            
            if callback:
                callback(68, "正在点击下一步按钮...")
            next_button = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:btnSuivant")))
            next_button.click()
            time.sleep(0.2)
            if callback:
                callback(69, "✅ 已点击下一步按钮")
            
            if callback:
                callback(70, "正在确认提交...")
            yes_button = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:btnValiderModal")))
            yes_button.click()
            time.sleep(0.2)
            if callback:
                callback(71, "✅ 已确认提交")
            
            # 等待页面跳转或加载完成（等待更长时间确保步骤完成）
            if callback:
                callback(72, "等待表单提交完成...")
            time.sleep(3)
            
            # 检查是否已经跳转到主页或其他页面（表单提交成功通常会跳转）
            try:
                # 等待URL变化或等待特定元素消失/出现
                current_url = driver.current_url
                if callback:
                    callback(73, f"检查页面状态，当前URL: {current_url[:50]}...")
                
                # 尝试等待页面跳转（如果还在表单页面，等待跳转）
                if "formStep1" in current_url or "formStep" in current_url:
                    # 等待跳转到主页（最多等待10秒）
                    if callback:
                        callback(74, "等待页面自动跳转...")
                    wait_redirect = WebDriverWait(driver, 10)
                    try:
                        wait_redirect.until(lambda d: "accueil" in d.current_url.lower() or "formStep" not in d.current_url)
                        if callback:
                            callback(75, "✅ 页面已自动跳转")
                    except:
                        # 如果10秒内没有自动跳转，说明可能需要手动跳转
                        if callback:
                            callback(75, "未检测到自动跳转，准备手动跳转...")
                else:
                    if callback:
                        callback(75, "✅ 页面已不在表单页面")
            except Exception as e:
                if callback:
                    callback(75, f"检查页面跳转: {str(e)[:50]}...")
            
            time.sleep(2)  # 额外等待确保页面完全加载
            
            if callback:
                callback(80, "正在返回到主页...")
            
            # 返回到主页
            driver.get("https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml")
            if callback:
                callback(82, "✅ 已返回到主页，等待页面加载...")
            
            # 等待页面完全加载（增加等待时间）
            time.sleep(5)
            
            # 等待表格加载完成
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "table, .dataTable, [class*='table']")))
                if callback:
                    callback(83, "✅ 表格已加载")
            except:
                if callback:
                    callback(83, "⚠️ 未检测到表格，继续尝试...")
            
            if callback:
                callback(85, "正在查找申请参考号...")
            
            # 获取申请参考号（增加重试逻辑和多种方法）
            application_ref = None
            max_retries = 3
            retry_delay = 3
            
            for attempt in range(max_retries):
                try:
                    if callback:
                        callback(85 + attempt * 2, f"尝试获取申请参考号 (方法 {attempt + 1}/{max_retries})...")
                    
                    # 方法1: 使用完整类名选择器（更灵活，不要求顺序）
                    try:
                        # 尝试多种选择器变体
                        selectors = [
                            "td.cell.value.showIfTabletteOrDesktop.forceWidth15",
                            "td[class*='cell'][class*='value'][class*='showIfTabletteOrDesktop'][class*='forceWidth15']",
                            "td.forceWidth15",
                            "td.cell.value.forceWidth15"
                        ]
                        
                        for selector in selectors:
                            try:
                                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                                for elem in elements:
                                    text = elem.text.strip()
                                    # 清理文本（移除换行符、多余空格）
                                    text = ' '.join(text.split())
                                    # 使用提取函数获取参考号
                                    extracted_ref = extract_reference_number(text)
                                    if extracted_ref:
                                        application_ref = extracted_ref
                                        if callback:
                                            callback(87, f"✅ 找到申请参考号: {application_ref}")
                                        break
                                if application_ref:
                                    break
                            except:
                                continue
                        
                        if application_ref:
                            break
                    except Exception as e:
                        if callback:
                            callback(87, f"方法1失败: {str(e)[:50]}...")
                    
                    # 方法2: 查找所有包含参考号特征的td元素
                    if not application_ref:
                        try:
                            # 查找所有td元素，检查文本内容
                            all_tds = driver.find_elements(By.TAG_NAME, "td")
                            for td in all_tds:
                                text = td.text.strip()
                                text = ' '.join(text.split())  # 清理空白字符
                                # 使用提取函数获取参考号
                                extracted_ref = extract_reference_number(text)
                                if extracted_ref:
                                    application_ref = extracted_ref
                                    if callback:
                                        callback(87, f"✅ 找到申请参考号: {application_ref}")
                                    break
                        except Exception as e:
                            if callback:
                                callback(87, f"方法2失败: {str(e)[:50]}...")
                    
                    # 方法3: 查找表格第一行第一列或包含"参考号"的列
                    if not application_ref:
                        try:
                            # 查找表格
                            tables = driver.find_elements(By.CSS_SELECTOR, "table, .dataTable")
                            for table in tables:
                                rows = table.find_elements(By.TAG_NAME, "tr")
                                for row in rows:
                                    cells = row.find_elements(By.TAG_NAME, "td")
                                    for cell in cells:
                                        text = cell.text.strip()
                                        text = ' '.join(text.split())
                                        # 使用提取函数获取参考号
                                        extracted_ref = extract_reference_number(text)
                                        if extracted_ref:
                                            application_ref = extracted_ref
                                            if callback:
                                                callback(87, f"✅ 找到申请参考号: {application_ref}")
                                            break
                                    if application_ref:
                                        break
                                if application_ref:
                                    break
                        except Exception as e:
                            if callback:
                                callback(87, f"方法3失败: {str(e)[:50]}...")
                    
                    if application_ref:
                        break
                    
                    # 如果这次尝试失败，等待后重试
                    if attempt < max_retries - 1:
                        if callback:
                            callback(87, f"未找到，等待 {retry_delay} 秒后重试...")
                        time.sleep(retry_delay)
                        
                except Exception as e:
                    if callback:
                        callback(87, f"尝试 {attempt + 1} 出错: {str(e)[:50]}...")
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
            
            if not application_ref:
                # 最后一次尝试：获取页面源码用于调试
                try:
                    page_source_snippet = driver.page_source[:2000] if len(driver.page_source) > 2000 else driver.page_source
                    if callback:
                        callback(90, f"⚠️ 页面源码片段: {page_source_snippet[-500:]}")
                except:
                    pass
                raise Exception("无法获取申请参考号：所有方法都失败，请检查页面是否已正确加载")
            
            if callback:
                callback(88, f"✅ 已获取申请参考号: {application_ref}")
            
            # 创建结果DataFrame
            if callback:
                callback(89, "正在创建结果数据...")
            result_df = pd.DataFrame({
                "邮箱": [email],
                "密码": [password],
                "申请参考号": [application_ref],
                "申请城市": [application_city],
                "姓氏": [df['姓氏（Family name）'].iloc[0]],
                "名字": [df['名字（First name）'].iloc[0]],
                "出生日期": [pd.to_datetime(df['出生日期（Date of birth）'].iloc[0])],
                "当前国籍": ["Chinese"],
                "护照类型": ["Ordinary passport"],
                "护照编号": [passport_number],
                "护照签发日期": [passport_issue_date.strftime('%Y-%m-%d')],
                "护照到期时间": [passport_expiry_date.strftime('%Y-%m-%d')],
                "手机号码": [df['你的电话（Your phone number with +44）'].iloc[0]],
                "是否办过申根签": [df['是否办过申根签（五年内）'].iloc[0]]
            })
            
            # 保存文件
            if callback:
                callback(90, "正在准备保存文件...")
            # 如果没有提供原始文件名，使用文件路径的基础名称；去掉扩展名用于输出文件名
            if not original_filename:
                original_filename = os.path.basename(file_path)
            original_stem = os.path.splitext(original_filename)[0]
            excel_dir = os.path.dirname(file_path)
            folder_name = os.path.join(excel_dir, f"{original_stem}_TLS")
            os.makedirs(folder_name, exist_ok=True)
            if callback:
                callback(91, "✅ 已创建输出文件夹")
            
            # 创建JSON结构
            if callback:
                callback(92, "正在创建JSON数据...")
            dob_raw = df['出生日期（Date of birth）'].iloc[0]
            try:
                dob_parsed = pd.to_datetime(dob_raw, dayfirst=True, errors="coerce")
            except Exception:
                dob_parsed = pd.to_datetime(dob_raw, errors="coerce")
            date_of_birth_iso = dob_parsed.strftime('%Y-%m-%d') if not pd.isnull(dob_parsed) else ""
            visa_json = [{
                "id": 1,
                "personalInfo": {
                    "familyName": df['姓氏（Family name）'].iloc[0],
                    "firstName": df['名字（First name）'].iloc[0],
                    "dateOfBirth": date_of_birth_iso,
                    "passportNumber": passport_number,
                    "passportIssueDate": passport_issue_date.strftime('%Y-%m-%d'),
                    "passportExpiryDate": passport_expiry_date.strftime('%Y-%m-%d'),
                    "mobileNumber": str(df['你的电话（Your phone number with +44）'].iloc[0]).replace(' ', '').lstrip('44').lstrip('+'),
                    "franceVisasRef": application_ref,
                    "nationality": "China",
                    "passportType": "Ordinary passport"
                },
                "travelInfo": {
                    "visaType": "Short stay (<90 days) - Tourism",
                    "reason": "Tourism / Private visit",
                    "departureDate": "2026-03-07",
                    "arrivalDate": "2026-03-07",
                    "returnDate": "2026-03-15",
                    "frenchOverseas": False
                },
                "visaHistory": {
                    "previousFingerprints": False
                }
            }]
            
            # 保存JSON文件（先保存到临时目录）
            if callback:
                callback(93, "正在保存JSON文件...")
            json_filename_temp = os.path.join(folder_name, f"tls注册_{original_stem}.json")
            with open(json_filename_temp, 'w', encoding='utf-8') as f_json:
                json.dump(visa_json, f_json, ensure_ascii=False, indent=2)
            if callback:
                callback(94, "✅ JSON文件已保存到临时目录")
            
            # 复制文件到输出目录以便下载
            if callback:
                callback(97, "正在复制文件到输出目录...")
            import shutil
            json_filename = os.path.basename(json_filename_temp)
            json_path = output_base / json_filename
            if str(json_filename_temp) != str(json_path):
                shutil.copy2(json_filename_temp, json_path)
            if callback:
                callback(98, "✅ JSON文件已复制到输出目录")
            
            if callback:
                callback(100, f"✅ 新申请创建成功！申请参考号: {application_ref}")
            result = {
                "success": True,
                "application_ref": application_ref,
                "json_file": json_filename,
                "json_path": str(json_path),
                "message": f"新申请创建成功，申请参考号: {application_ref}"
            }
            # 在 return 之前先输出结果，避免 finally 中可能的阻塞导致 API 无法收到 JSON
            if result_output:
                result_output(result)
            # 解除 driver/automation 引用，避免 return 时 GC 清理 Playwright 导致阻塞
            try:
                if automation and hasattr(automation, "driver"):
                    automation.driver = None
                driver = None
            except Exception:
                pass
            return result
            
        except Exception as e:
            if callback:
                callback(0, f"❌ 填写表单时出错: {str(e)}")
            if driver:
                driver.save_screenshot(os.path.join(str(output_base), "error_screenshot.png"))
            return {
                "success": False,
                "error": str(e)
            }
        
    except Exception as e:
        if callback:
            callback(0, f"❌ 处理时发生错误: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        # 完全不调用 close_browser：browser.close() 也会阻塞，导致进程无法退出。
        # 直接返回让 CLI 输出 JSON 并退出，进程退出时 OS 会回收子进程。
        pass

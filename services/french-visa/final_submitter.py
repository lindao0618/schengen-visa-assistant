"""
法签提交最终表功能
从原始代码复制并适配
"""
import os
import sys
import time
import random
import shutil
import traceback
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


def submit_final_form(file_path: str, download_dir: Optional[str] = None, output_dir: str = "",
                     callback: Optional[Callable[[int, str], None]] = None) -> Dict[str, Any]:
    """
    提交最终表并下载PDF

    Args:
        file_path: Excel文件路径
        download_dir: PDF下载目录
        output_dir: 输出目录（覆盖 download_dir 时的基础路径）
        callback: 进度回调函数

    Returns:
        包含处理结果的字典
    """
    output_base = config.get_output_dir(output_dir or download_dir or "")
    automation = FrenchVisaAutomation(callback=callback, output_dir=str(output_base))
    driver = None

    try:
        if callback:
            callback(0, "开始提交最终表...")

        # 读取Excel文件
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

        # 提取账号密码
        try:
            email = df['邮箱账号（Email account）'].iloc[0]
            password = df['邮箱密码（Email password）'].iloc[0]
        except KeyError as e:
            if callback:
                callback(0, f"❌ Excel文件中缺少必要字段: {e}")
            return {
                "success": False,
                "error": f"Excel文件中缺少必要字段: {e}"
            }

        if callback:
            callback(15, f"读取账号: {email}，正在启动浏览器...")

        # 启动浏览器
        download_path = download_dir or str(output_base)
        if not automation.init_browser(download_dir=download_path):
            if callback:
                callback(0, "❌ 浏览器初始化失败")
            return {
                "success": False,
                "error": "浏览器初始化失败"
            }

        driver = automation.driver
        driver.maximize_window()

        wait = WebDriverWait(driver, 40)

        # 登录账号
        if callback:
            callback(20, "正在登录账号...")

        try:
            driver.get("https://application-form.france-visas.gouv.fr/")

            email_input = wait.until(EC.presence_of_element_located((By.ID, "username")))
            email_input.clear()
            for char in email:
                email_input.send_keys(char)
                time.sleep(random.uniform(0.05, 0.15))

            password_input = wait.until(EC.presence_of_element_located((By.ID, "password")))
            password_input.clear()
            for char in password:
                password_input.send_keys(char)
                time.sleep(random.uniform(0.05, 0.15))

            login_form = wait.until(EC.presence_of_element_located((By.ID, "kc-form-login")))
            login_form.submit()

            time.sleep(3)
            # 登录后若遇到 ERR_HTTP2_PROTOCOL_ERROR 等无法访问页面，刷新重试
            for _ in range(2):
                try:
                    body_text = driver.find_element(By.TAG_NAME, "body").text
                    if "无法访问此网站" in body_text or "ERR_HTTP2" in body_text or "ERR_" in body_text:
                        if callback:
                            callback(25, "检测到网络错误页面，正在刷新...")
                        driver.refresh()
                        time.sleep(3)
                except Exception:
                    break
            time.sleep(1)

            if "error" in driver.current_url:
                if callback:
                    callback(25, f"⚠️ 登录失败，当前URL: {driver.current_url}，等待手动登录...")
                wait.until(lambda d: "error" not in d.current_url)
            else:
                if callback:
                    callback(25, "✅ 登录成功")
        except Exception as e:
            if callback:
                callback(0, f"❌ 登录过程出错: {str(e)}")
            return {
                "success": False,
                "error": f"登录失败: {str(e)}"
            }

        # 提交最终表
        if callback:
            callback(30, "准备提交最终表...")

        try:
            # 1. 勾选第一个同意复选框
            checkbox1 = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".ui-chkbox-box.ui-widget.ui-corner-all.ui-state-default")))
            driver.execute_script("arguments[0].scrollIntoView(true);", checkbox1)
            checkbox1.click()
            if callback:
                callback(35, "已勾选协议复选框")
            time.sleep(0.5)

            # 2. 点击 Continue 按钮
            continue_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(@class,'ui-button-text') and text()='Continue']/parent::button | //span[text()='Continue']/parent::a")))
            driver.execute_script("arguments[0].scrollIntoView(true);", continue_btn)
            continue_btn.click()
            if callback:
                callback(40, "点击了 Continue 按钮")
            time.sleep(1)

            # 3. 等待弹窗，点击 Yes
            try:
                wait_short = WebDriverWait(driver, 5)
                yes_btn = wait_short.until(EC.element_to_be_clickable((By.ID, "formAccueilUsager:btnTransmettre")))
                driver.execute_script("arguments[0].scrollIntoView(true);", yes_btn)
                yes_btn.click()
                if callback:
                    callback(45, "点击了 Yes 按钮")
                time.sleep(1)
            except Exception as e:
                if callback:
                    callback(45, f"未找到Yes按钮，可能已自动跳转: {str(e)}")

            # 4. 跳转页面后点击 Continue
            if callback:
                callback(50, "等待跳转到 phase2 页面...")
            wait_long = WebDriverWait(driver, 30)
            wait_long.until(EC.url_contains('phase2.xhtml'))
            if callback:
                callback(55, "已跳转到 phase2.xhtml")
            time.sleep(1)
            continue2_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(@class,'ui-button-text') and text()='Continue']/parent::button | //span[text()='Continue']/parent::a")))
            driver.execute_script("arguments[0].scrollIntoView(true);", continue2_btn)
            continue2_btn.click()
            if callback:
                callback(60, "点击了 phase2 页面 Continue 按钮")
            time.sleep(1)

            # 5. 勾选第二个同意复选框
            checkbox2 = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".ui-chkbox-box.ui-widget.ui-corner-all.ui-state-default")))
            driver.execute_script("arguments[0].scrollIntoView(true);", checkbox2)
            checkbox2.click()
            if callback:
                callback(65, "已勾选 phase2 协议复选框")
            time.sleep(0.5)

            # 6. 点击 Submit to the visa center
            submit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(@class,'ui-button-text') and text()='Submit to the visa center']/parent::button | //span[text()='Submit to the visa center']/parent::a")))
            driver.execute_script("arguments[0].scrollIntoView(true);", submit_btn)
            submit_btn.click()
            if callback:
                callback(70, "点击了 Submit to the visa center")
            time.sleep(1)

            # 7. 弹窗中点击 OK
            wait_medium = WebDriverWait(driver, 10)
            ok_btn = wait_medium.until(EC.element_to_be_clickable((By.ID, "formFinalisation:transmitionGuichet")))
            driver.execute_script("arguments[0].scrollIntoView(true);", ok_btn)
            ok_btn.click()
            if callback:
                callback(75, "点击了 OK 按钮（提交后）")
            time.sleep(2)

            # 8. 点击 Complete
            complete_btn = wait_medium.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(@class,'ui-button-text') and text()='Complete']/parent::button | //span[text()='Complete']/parent::a")))
            driver.execute_script("arguments[0].scrollIntoView(true);", complete_btn)
            complete_btn.click()
            if callback:
                callback(80, "点击了 Complete 按钮")
            time.sleep(2)

            # 9. 查找并点击PDF下载按钮
            if callback:
                callback(85, "正在查找PDF下载链接...")
            pdf_link = None
            try:
                pdf_link = wait_medium.until(EC.element_to_be_clickable((By.XPATH, "//a[@title='Read pdf completed application']")))
            except:
                try:
                    pdf_link = wait_medium.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@id, 'formAccueilUsager') and contains(@title, 'Read pdf')]")))
                except:
                    try:
                        pdf_link = wait_medium.until(EC.element_to_be_clickable((By.ID, "formAccueilUsager:j_idt91:0:j_idt106:0:j_idt169")))
                    except Exception as e:
                        if callback:
                            callback(0, f"⚠️ 无法找到PDF下载链接: {str(e)}")
                        return {
                            "success": False,
                            "error": f"无法找到PDF下载链接: {str(e)}"
                        }

            if pdf_link:
                download_folder = download_path
                click_time = time.time()
                pdf_saved = False
                new_file_path = None

                existing_pdf_files = set()
                if os.path.exists(download_folder):
                    for filename in os.listdir(download_folder):
                        if filename.endswith(".pdf"):
                            existing_pdf_files.add(os.path.join(download_folder, filename))

                driver.execute_script("arguments[0].scrollIntoView(true);", pdf_link)
                time.sleep(0.5)
                pdf_link.click()
                if callback:
                    callback(90, "已点击PDF下载链接")

                time.sleep(2)

                excel_dir = os.path.dirname(file_path)

                try:
                    surname = df['姓氏（Family name）'].iloc[0]
                    first_name = df['名字（First name）'].iloc[0]
                    new_file_name = f"{surname.upper()} {first_name.upper()} - Fv申请预约表.pdf"
                except Exception as e:
                    if callback:
                        callback(90, f"⚠️ 无法获取姓名，使用默认名称: {str(e)}")
                    new_file_name = "Fv申请预约表.pdf"

                max_wait_time = 30
                wait_time = 0
                downloaded_file = None

                while wait_time < max_wait_time:
                    time.sleep(1)
                    wait_time += 1

                    if os.path.exists(download_folder):
                        for filename in os.listdir(download_folder):
                            if filename.endswith(".pdf"):
                                file_path_full = os.path.join(download_folder, filename)
                                if file_path_full not in existing_pdf_files:
                                    try:
                                        mod_time = os.path.getmtime(file_path_full)
                                        if mod_time >= click_time - 5:
                                            downloaded_file = file_path_full
                                            if callback:
                                                callback(92, f"找到新下载的PDF文件: {filename}")
                                            break
                                    except:
                                        pass

                    if downloaded_file:
                        break

                if downloaded_file:
                    # 保存到 output_base 以便下载
                    output_dir_path = str(output_base)
                    os.makedirs(output_dir_path, exist_ok=True)

                    # 保存到 output_base
                    new_file_path = os.path.join(output_dir_path, new_file_name)

                    try:
                        if os.path.exists(new_file_path):
                            os.remove(new_file_path)
                        shutil.copy2(downloaded_file, new_file_path)
                        if callback:
                            callback(95, f"✅ PDF已保存到: {new_file_path}")
                        pdf_saved = True
                        # 清理临时下载文件
                        try:
                            os.remove(downloaded_file)
                        except:
                            pass
                    except Exception as e:
                        if callback:
                            callback(95, f"❌ 保存PDF文件时出错: {str(e)}")
                        pdf_saved = False
                else:
                    # 尝试查找最新修改的PDF文件
                    pdf_files = []
                    if os.path.exists(download_folder):
                        for filename in os.listdir(download_folder):
                            if filename.endswith(".pdf"):
                                file_path_full = os.path.join(download_folder, filename)
                                try:
                                    mod_time = os.path.getmtime(file_path_full)
                                    pdf_files.append((file_path_full, filename, mod_time))
                                except:
                                    pass

                    if pdf_files:
                        pdf_files.sort(key=lambda x: x[2], reverse=True)
                        latest_file = pdf_files[0][0]

                        # 保存到 output_base 以便下载
                        output_dir_path = str(output_base)
                        os.makedirs(output_dir_path, exist_ok=True)

                        new_file_path = os.path.join(output_dir_path, new_file_name)

                        try:
                            if os.path.exists(new_file_path):
                                os.remove(new_file_path)
                            shutil.copy2(latest_file, new_file_path)
                            if callback:
                                callback(95, f"✅ PDF已保存到: {new_file_path}")
                            pdf_saved = True
                        except Exception as e:
                            if callback:
                                callback(95, f"❌ 保存PDF文件时出错: {str(e)}")
                            pdf_saved = False
                    else:
                        if callback:
                            callback(95, f"⚠️ 在下载文件夹 {download_folder} 中未找到PDF文件")
                        pdf_saved = False

                if callback:
                    callback(100, "最终表提交完成")

                # 返回PDF文件名（相对于 output_base）
                pdf_filename = None
                if pdf_saved and 'new_file_path' in locals() and new_file_path and os.path.exists(new_file_path):
                    pdf_filename = os.path.basename(new_file_path)

                return {
                    "success": True,
                    "message": "最终表提交完成",
                    "pdf_saved": pdf_saved if 'pdf_saved' in locals() else False,
                    "pdf_path": new_file_path if ('pdf_saved' in locals() and pdf_saved and 'new_file_path' in locals()) else None,
                    "pdf_file": pdf_filename  # 用于前端下载
                }
            else:
                if callback:
                    callback(0, "❌ 无法找到PDF下载链接")
                return {
                    "success": False,
                    "error": "无法找到PDF下载链接"
                }

        except Exception as e:
            if callback:
                callback(0, f"❌ 提交过程出错: {str(e)}")
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
        if driver:
            try:
                driver.quit()
            except:
                pass

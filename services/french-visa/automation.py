"""
法签自动化核心类
整合账号注册、填写回执单、生成新申请、提交最终表等功能
使用 Playwright 启动浏览器（与美签一致），通过 Selenium 兼容层供现有代码使用。
"""
import os
import sys
import time
import random
import secrets
import traceback
import requests
import re
import json
from datetime import datetime
from urllib.parse import urlencode
from pathlib import Path
from typing import Optional, Callable, Dict, Any

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

try:
    from . import config
    from .playwright_driver import PlaywrightDriver, Select as PwSelect
except ImportError:
    import config
    from playwright_driver import PlaywrightDriver, Select as PwSelect


class FrenchVisaAutomation:
    """法国签证自动化核心类"""

    def __init__(self, callback: Optional[Callable[[int, str], None]] = None, output_dir: str = ""):
        """
        初始化

        Args:
            callback: 进度回调函数 (progress: int, message: str) -> None
            output_dir: 本任务输出目录，用于截图、验证码临时文件等
        """
        self.driver = None
        self.captcha_counter = 0
        self.api_key = config.CAPTCHA_API_KEY
        self.capsolver_key = config.CAPSOLVER_API_KEY
        self._output_dir = config.get_output_dir(output_dir)
        self._screenshot_dir = config.get_screenshot_dir(output_dir)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._log_file = self._output_dir / f"register_{ts}.log"
        self._log_rel_path = f"register_{ts}.log"
        self.base_url = "https://connect.france-visas.gouv.fr"
        self.registered_redirect_uri = "https://application-form.france-visas.gouv.fr/fv-fo-dde/login/oauth2/code/keycloak"
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        self.callback = callback

    def _log(self, message: str, progress: Optional[int] = None):
        """记录日志并调用回调（输出到 stderr，避免污染 CLI 的 stdout JSON）"""
        print(message, file=sys.stderr)
        try:
            with self._log_file.open("a", encoding="utf-8") as f:
                stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"[{stamp}] {message}\n")
        except Exception:
            pass
        if self.callback and progress is not None:
            self.callback(progress, message)
        elif self.callback:
            pass

    def get_log_file(self) -> str:
        return self._log_rel_path

    def _dump_page_state(self, context: str = "") -> None:
        """记录页面状态到日志，便于排查填表失败/未提交等问题"""
        if not self.driver:
            self._log(f"⚠️ 无法记录页面状态（driver不存在）: {context}")
            return
        try:
            url = ""
            title = ""
            try:
                url = getattr(self.driver, "current_url", "") or ""
            except Exception:
                pass
            try:
                title = self.driver.title
            except Exception:
                pass
            self._log(f"📄 页面状态{f'（{context}）' if context else ''}: url={url} title={title}")
        except Exception as e:
            self._log(f"⚠️ 记录页面状态失败: {str(e)}")

    def _save_screenshot(self, error_context: str = "") -> Optional[str]:
        if not self.driver:
            self._log("⚠️ driver不存在，无法保存截图")
            return None

        try:
            try:
                _ = self.driver.current_url
            except Exception as e:
                self._log(f"⚠️ driver已失效，无法保存截图: {str(e)}")
                return None

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_context = "".join(c for c in error_context[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_context = safe_context.replace(' ', '_') if safe_context else "error"
            filename = f"error_{timestamp}_{safe_context}.png"

            screenshot_path = self._screenshot_dir / filename
            self.driver.save_screenshot(str(screenshot_path))

            if not screenshot_path.exists():
                self._log(f"⚠️ 截图文件保存失败，文件不存在: {screenshot_path}")
                return None

            relative_path = f"screenshots/{filename}"
            self._log(f"📸 已保存错误截图: {relative_path}")
            return relative_path
        except Exception as e:
            self._log(f"⚠️ 保存截图失败: {str(e)}")
            return None

    def get_page(self):
        """获取底层 Playwright page，用于 expect_download 等高级操作"""
        return getattr(self, "_page", None)

    def _return_error(self, error_msg: str, error_context: str = "") -> Dict[str, Any]:
        self._log(f"❌ {error_msg}")
        self._dump_page_state(error_context)
        screenshot_path = self._save_screenshot(error_context)
        return {
            "success": False,
            "error": error_msg,
            "screenshot": screenshot_path,
            "log_file": self._log_rel_path
        }

    def init_browser(self, download_dir: Optional[str] = None, use_incognito: bool = False) -> bool:
        max_retries = 3
        retry_delay = 2

        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    self._log(f"浏览器初始化重试 {attempt}/{max_retries-1}...")
                    time.sleep(retry_delay)

                if self._init_browser_once(download_dir, use_incognito):
                    return True
            except Exception as e:
                if attempt == max_retries - 1:
                    error_msg = f"初始化浏览器失败（已重试{max_retries}次）: {str(e)}"
                    self._log(f"❌ {error_msg}")
                    self.driver = None
                    return False
                self._log(f"浏览器初始化尝试 {attempt+1} 失败，准备重试...")
                continue

        return False

    def _init_browser_once(self, download_dir: Optional[str] = None, use_incognito: bool = False) -> bool:
        """使用 Playwright 启动浏览器（与美签一致），无需 ChromeDriver"""
        try:
            if self.driver:
                try:
                    self.driver.quit()
                except Exception:
                    pass
                self.driver = None
                self._page = None
                self._pw_browser = None
                self._pw_context = None
                time.sleep(0.5)

            from playwright.sync_api import sync_playwright

            self._log("正在启动浏览器（Playwright Chromium）...")
            self._playwright = sync_playwright().start()
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
            requested_headless = os.environ.get("SELENIUM_HEADLESS", "true").strip().lower()
            is_headless = requested_headless not in {"false", "0", "no"}
            browser_args.extend(["--disable-gpu", "--no-sandbox"])
            if is_headless:
                browser_args.append("--headless=new")
                self._log("使用无头模式启动浏览器")
            else:
                self._log("使用有头模式启动浏览器，便于本地观察")

            launch_options = {
                "headless": is_headless,
                "args": browser_args,
                "slow_mo": 0,
            }
            browser_proxy = (
                os.environ.get("TLS_PROXY")
                or os.environ.get("HTTPS_PROXY")
                or os.environ.get("HTTP_PROXY")
                or ""
            ).strip()
            if browser_proxy:
                self._log(f"检测到浏览器代理配置: {browser_proxy}")
                launch_options["proxy"] = {"server": browser_proxy}

            self._pw_browser = self._playwright.chromium.launch(**launch_options)

            context_opts = {
                "viewport": {"width": 1920, "height": 1080},
                "user_agent": self.user_agent,
                "ignore_https_errors": True,
                "java_script_enabled": True,
            }
            if use_incognito:
                context_opts["ignore_https_errors"] = True
            if download_dir:
                context_opts["accept_downloads"] = True

            self._pw_context = self._pw_browser.new_context(**context_opts)
            self._pw_context.set_default_timeout(60000)
            page = self._pw_context.new_page()
            self._page = page
            if download_dir:
                try:
                    abs_path = os.path.abspath(download_dir)
                    os.makedirs(abs_path, exist_ok=True)
                    cdp = page.context.new_cdp_session(page)
                    cdp.send("Page.setDownloadBehavior", {"behavior": "allow", "downloadPath": abs_path})
                except Exception as e:
                    self._log(f"⚠️ 设置下载路径失败（不影响 expect_download）: {e}")
            self.driver = PlaywrightDriver(page)
            self._log("✅ 浏览器启动成功")
            return True
        except Exception as e:
            self._log(f"❌ 初始化浏览器失败: {str(e)}")
            self.driver = None
            try:
                if hasattr(self, "_playwright") and self._playwright:
                    self._playwright.stop()
            except Exception:
                pass
            return False

    def _get_chrome_version_windows(self) -> Optional[str]:
        try:
            import subprocess
            try:
                result = subprocess.run(
                    ['reg', 'query', 'HKEY_CURRENT_USER\\Software\\Google\\Chrome\\BLBeacon', '/v', 'version'],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    for line in result.stdout.split('\n'):
                        if 'version' in line.lower():
                            parts = line.split()
                            if len(parts) >= 3:
                                return parts[-1]
            except Exception:
                pass
            try:
                import winreg
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Google\Chrome\BLBeacon")
                version, _ = winreg.QueryValueEx(key, "version")
                winreg.CloseKey(key)
                return version
            except Exception:
                pass
        except Exception:
            pass
        return None

    def _get_chrome_version_linux(self) -> Optional[str]:
        try:
            import subprocess
            for cmd in [['google-chrome-stable', '--version'], ['chromium', '--version']]:
                try:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        match = re.search(r'(\d+\.\d+\.\d+\.?\d*)', result.stdout.strip())
                        if match:
                            return match.group(1)
                except Exception:
                    pass
        except Exception:
            pass
        return None

    def close_browser(self, skip_playwright_stop: bool = False):
        """关闭浏览器。skip_playwright_stop=True 时跳过 playwright.stop()，避免在 CLI 被 Node 调用时阻塞进程退出。"""
        if self.driver:
            try:
                self.driver.quit()
                self._log("浏览器已关闭")
            except Exception as e:
                self._log(f"关闭浏览器时出错: {str(e)}")
            finally:
                self.driver = None
                if not skip_playwright_stop:
                    try:
                        if hasattr(self, "_playwright") and self._playwright:
                            self._playwright.stop()
                    except Exception:
                        pass
                time.sleep(0.2)

    def build_auth_url(self) -> str:
        params = {
            "response_type": "code",
            "client_id": "fv-fo-keycloak-web",
            "state": secrets.token_urlsafe(16),
            "redirect_uri": self.registered_redirect_uri,
            "scope": "openid",
            "nonce": secrets.token_urlsafe(16),
            "prompt": "login"
        }
        return f"{self.base_url}/realms/usager/protocol/openid-connect/auth?{urlencode(params)}"

    def solve_captcha(self, image_path: str) -> Optional[str]:
        try:
            if not os.path.exists(image_path):
                self._log(f"❌ 验证码图片不存在: {image_path}")
                return None

            # 优先使用 Capsolver，失败后自动回退到 2Captcha
            if self.api_key:
                result = self._solve_captcha_2captcha(image_path)
                if result is not None:
                    return result
                if self.capsolver_key:
                    self._log("⚠️ 2Captcha 失败，自动切换到 Capsolver 备用...")
                    return self._solve_captcha_capsolver(image_path)
                return None

            if self.capsolver_key:
                result = self._solve_captcha_capsolver(image_path)
                if result is not None:
                    return result
                if self.api_key:
                    self._log("⚠️ Capsolver 失败，自动切换到 2Captcha 备用...")
                    return self._solve_captcha_2captcha(image_path)
                return None

            if self.api_key:
                return self._solve_captcha_2captcha(image_path)

            self._log("❌ 验证码API Key未配置，请设置 CAPSOLVER_API_KEY 或 CAPTCHA_API_KEY")
            return None
        except Exception as e:
            self._log(f"❌ 验证码识别出错: {str(e)[:100]}")
            return None

    def _get_requests_proxies(self) -> dict:
        proxy = (
            os.environ.get("TLS_PROXY")
            or os.environ.get("HTTPS_PROXY")
            or os.environ.get("HTTP_PROXY")
            or ""
        ).strip()
        if proxy:
            return {"http": proxy, "https": proxy}
        return {}

    def _solve_captcha_capsolver(self, image_path: str) -> Optional[str]:
        """使用 Capsolver ImageToTextTask 识别图片验证码"""
        import base64
        proxies = self._get_requests_proxies()
        try:
            with open(image_path, 'rb') as f:
                img_b64 = base64.b64encode(f.read()).decode()
            self._log(f"正在调用 Capsolver API（Key: {self.capsolver_key[:10]}...）")
            cr = requests.post(
                'https://api.capsolver.com/createTask',
                json={
                    "clientKey": self.capsolver_key,
                    "task": {"type": "ImageToTextTask", "body": img_b64},
                },
                timeout=30,
                proxies=proxies or None,
            ).json()
            if cr.get("errorId") != 0:
                self._log(f"❌ Capsolver createTask 错误: {cr.get('errorDescription', cr)}")
                return None
            tid = cr["taskId"]
            self._log(f"✅ 验证码已提交 taskId={tid}，等待结果...")
            for _ in range(20):
                time.sleep(3)
                rr = requests.post(
                    'https://api.capsolver.com/getTaskResult',
                    json={"clientKey": self.capsolver_key, "taskId": tid},
                    timeout=30,
                    proxies=proxies or None,
                ).json()
                if rr.get("errorId") != 0:
                    self._log(f"❌ Capsolver 识别失败: {rr.get('errorDescription')}")
                    return None
                if rr.get("status") == "ready":
                    code = rr.get("solution", {}).get("text", "")
                    self._log(f"✅ 验证码识别成功: {code}")
                    return code
            self._log("❌ Capsolver 识别超时")
            return None
        except Exception as e:
            self._log(f"❌ Capsolver 异常: {str(e)[:200]}")
            return None

    def _solve_captcha_2captcha(self, image_path: str) -> Optional[str]:
        """使用 2Captcha 识别图片验证码（备用）"""
        proxies = self._get_requests_proxies()
        try:
            self._log(f"正在调用2Captcha API（Key: {self.api_key[:10]}...）")
            with open(image_path, 'rb') as f:
                response = requests.post(
                    'https://2captcha.com/in.php',
                    files={'file': f},
                    data={'key': self.api_key, 'json': 1, 'regsense': 1},
                    timeout=30,
                    proxies=proxies or None,
                )
            if response.status_code != 200:
                self._log(f"❌ 2Captcha 请求失败: {response.status_code}")
                return None
            data = response.json()
            if data.get('status') != 1:
                self._log(f"❌ 2Captcha 错误: {data.get('request', 'Unknown')}")
                return None
            captcha_id = data.get('request')
            if not captcha_id:
                return None
            self._log(f"✅ 验证码已提交 ID: {captcha_id}，等待结果...")
            for _ in range(10):
                time.sleep(5)
                try:
                    r = requests.get(
                        f'https://2captcha.com/res.php?key={self.api_key}&action=get&id={captcha_id}&json=1',
                        timeout=30,
                        proxies=proxies or None,
                    )
                    if r.status_code != 200:
                        continue
                    d = r.json()
                    if d.get('status') == 1:
                        code = d.get('request')
                        self._log(f"✅ 验证码识别成功: {code}")
                        return code
                    if d.get('request') != 'CAPCHA_NOT_READY':
                        self._log(f"❌ 识别失败: {d.get('request')}")
                        return None
                except Exception as e:
                    self._log(f"⚠️ 获取结果出错: {str(e)[:80]}")
            self._log("❌ 验证码识别超时")
            return None
        except Exception as e:
            self._log(f"❌ 2Captcha 异常: {str(e)[:100]}")
            return None

    def handle_captcha(self) -> bool:
        try:
            if not self.capsolver_key and not self.api_key:
                self._log("❌ 请设置 CAPSOLVER_API_KEY 或 CAPTCHA_API_KEY")
                return False
            self._log("正在查找验证码图片...")
            time.sleep(0.5)
            captcha_element = None
            for selector in [
                (By.ID, "captchaImage"),
                (By.CSS_SELECTOR, "img[alt*='code de sécurité'], img[alt*='Recopier']"),
                (By.CSS_SELECTOR, "img[alt='captchetat']"),
            ]:
                try:
                    if selector[0] == By.ID:
                        captcha_element = WebDriverWait(self.driver, 10).until(
                            EC.presence_of_element_located(selector))
                    else:
                        captcha_element = self.driver.find_element(*selector)
                    break
                except Exception:
                    try:
                        captcha_container = self.driver.find_element(By.ID, "captchetat")
                        captcha_element = captcha_container.find_element(By.TAG_NAME, "img")
                        break
                    except Exception:
                        continue
            if not captcha_element:
                self._log("❌ 未找到验证码图片")
                return False

            captcha_filename = os.path.join(str(self._output_dir), f"captcha_{int(time.time())}.png")
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'smooth'});", captcha_element)
            time.sleep(0.1)
            WebDriverWait(self.driver, 5).until(EC.visibility_of(captcha_element))
            captcha_element.screenshot(captcha_filename)
            if not os.path.exists(captcha_filename) or os.path.getsize(captcha_filename) == 0:
                self._log("❌ 验证码截图失败")
                return False
            provider = "Capsolver" if self.capsolver_key else "2Captcha"
            self._log(f"正在调用 {provider} API 识别验证码...")
            captcha_code = self.solve_captcha(captcha_filename)
            try:
                os.remove(captcha_filename)
            except Exception:
                pass
            if not captcha_code:
                return False
            self._log(f"✅ 验证码识别成功: {captcha_code}")

            captcha_input = None
            try:
                captcha_input = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.NAME, "captchaFormulaireExtInput"))
                )
            except Exception:
                try:
                    captcha_input = self.driver.find_element(By.CSS_SELECTOR, "input[placeholder*='验证码']")
                except Exception as e:
                    self._log(f"❌ 未找到验证码输入框: {str(e)}")
                    return False
            if captcha_input:
                captcha_input.click()
                time.sleep(0.1)
                captcha_input.clear()
                time.sleep(0.05)
                for char in captcha_code:
                    captcha_input.send_keys(char)
                    time.sleep(random.uniform(0.01, 0.03))
                time.sleep(0.1)
                return True
            return False
        except Exception as e:
            self._log(f"❌ 处理验证码时出错: {str(e)}")
            return False

    def _collect_registration_feedback(self) -> list[str]:
        messages = []
        seen = set()
        selectors = [
            (By.ID, "input-error-email"),
            (By.ID, "input-error-password"),
            (By.CSS_SELECTOR, "[id^='input-error-']"),
            (By.CSS_SELECTOR, ".fr-error-text"),
            (By.CSS_SELECTOR, ".fr-alert--error"),
            (By.CSS_SELECTOR, ".alert.alert-danger"),
            (By.CSS_SELECTOR, "[role='alert']"),
        ]
        for by, selector in selectors:
            try:
                elements = self.driver.find_elements(by, selector)
            except Exception:
                continue
            for element in elements:
                try:
                    text = (element.text or "").strip()
                except Exception:
                    text = ""
                if text and text not in seen:
                    seen.add(text)
                    messages.append(text)
        return messages

    def _is_account_exists_feedback(self, message: str) -> bool:
        text = (message or "").strip().lower()
        markers = [
            "already exists",
            "already used",
            "already associated",
            "existe déjà",
            "existe deja",
            "已存在",
            "已经存在",
            "已被使用",
        ]
        return any(marker in text for marker in markers)

    def register_account(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """注册账号。data 需含: lastName, firstName, email, emailVerif, password, passwordVerif"""
        try:
            required = ["lastName", "firstName", "email", "emailVerif", "password", "passwordVerif"]
            missing = [k for k in required if not data.get(k)]
            if missing:
                return self._return_error(f"注册字段缺失: {', '.join(missing)}", "missing_fields")

            self._log("正在构建认证URL...", 10)
            auth_url = self.build_auth_url()
            self._log(f"正在访问: {auth_url}", 15)
            self.driver.get(auth_url)
            time.sleep(1)

            register_button = None
            for xpath_or_selector in [
                (By.XPATH, "//button[contains(text(), '注册帐号')]"),
                (By.CSS_SELECTOR, "button.fr-btn.fr-btn--secondary"),
                (By.CSS_SELECTOR, "button[id^='fr-button-']"),
                (By.CSS_SELECTOR, "a.btn.primaire"),
            ]:
                try:
                    register_button = WebDriverWait(self.driver, 10).until(
                        EC.element_to_be_clickable(xpath_or_selector))
                    break
                except Exception:
                    continue
            if not register_button:
                return self._return_error("无法找到注册按钮", "find_register_button")
            register_button.click()
            self._log("✅ 已点击注册按钮", 25)
            time.sleep(0.5)

            self._log("正在填写注册表单...", 30)
            self._log(f"填写信息: {data.get('lastName', '')} {data.get('firstName', '')} / {data.get('email', '')}")
            for name, key in [("lastName", "lastName"), ("firstName", "firstName"), ("email", "email"), ("emailVerif", "emailVerif")]:
                try:
                    inp = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.NAME, name)))
                    inp.clear()
                    inp.send_keys(data[key])
                except Exception as e:
                    return self._return_error(f"填写{name}失败: {str(e)}", f"fill_{name}")

            try:
                lang = PwSelect(WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, "ddeLanguage"))))
                lang.select_by_visible_text("English")
                self._log("✅ 已选择语言 English", 55)
            except Exception as e:
                return self._return_error(f"选择语言失败: {str(e)}", "select_language")

            for name, key in [("password", "password"), ("password-confirm", "passwordVerif")]:
                try:
                    inp = self.driver.find_element(By.NAME, name)
                    inp.clear()
                    inp.send_keys(data[key])
                except Exception as e:
                    return self._return_error(f"填写{name}失败: {str(e)}", f"fill_{name}")
            self._log("✅ 已填写密码", 65)

            self._log("正在处理验证码...", 70)
            if not self.handle_captcha():
                return self._return_error("验证码处理失败", "captcha_failed")

            self._log("正在提交注册表单...", 80)
            submit_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")))
            submit_button.click()
            self._log("✅ 已提交", 85)
            time.sleep(0.8)
            self.driver.refresh()
            time.sleep(0.8)

            try:
                alert = WebDriverWait(self.driver, 3).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div.alert span, div[class*='alert']")))
                if alert and ("验证" in alert.text or "verify" in alert.text.lower() or "vérifier" in alert.text.lower()):
                    self._log(f"✅ 注册成功: {alert.text}", 100)
                    return {"success": True, "message": f"注册成功: {alert.text}"}
            except Exception:
                pass
            try:
                err_el = self.driver.find_element(By.ID, "input-error-email")
                if err_el and err_el.text and ("已经存在" in err_el.text or "already exists" in err_el.text.lower()):
                    return self._return_error(f"账号已存在: {err_el.text}", "account_exists")
            except Exception:
                pass
            current_url = self.driver.current_url
            if "registration" not in current_url.lower():
                form_el = self.driver.find_elements(By.CSS_SELECTOR, "input[name='lastName'], input[name='email']")
                if not form_el:
                    self._log("✅ 注册成功", 100)
                    return {"success": True, "message": "注册成功"}
            self._log("✅ 验证码已处理并提交，判断为注册成功", 100)
            return {"success": True, "message": "注册可能成功（验证码已处理）"}
        except Exception as e:
            return self._return_error(f"注册账号时出错: {str(e)}", "register_account")

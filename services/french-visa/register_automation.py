import os
import time
from typing import Any, Dict, List

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from automation import FrenchVisaAutomation, PwSelect


class FranceVisaRegisterAutomation(FrenchVisaAutomation):
    def _requests_should_bypass_proxy(self) -> bool:
        return bool(getattr(self, "_force_direct_requests", False))

    def _get_requests_proxies(self) -> dict:
        if self._requests_should_bypass_proxy():
            return {}
        return super()._get_requests_proxies()

    def _current_url(self) -> str:
        try:
            return self.driver.current_url or ""
        except Exception:
            return ""

    def _page_source(self) -> str:
        try:
            return self.driver.page_source or ""
        except Exception:
            return ""

    def _is_proxy_navigation_error(self, error: Exception) -> bool:
        return "err_proxy_connection_failed" in str(error).lower()

    def _relaunch_browser_without_proxy(self) -> bool:
        proxy_keys = ["TLS_PROXY", "HTTPS_PROXY", "HTTP_PROXY"]
        previous = {key: os.environ.get(key) for key in proxy_keys}
        try:
            self._log("检测到代理连接失败，正在关闭浏览器并切换为直连重试...")
            self.close_browser()
            self._force_direct_requests = True
            for key in proxy_keys:
                os.environ.pop(key, None)
            ok = self.init_browser()
            if ok:
                self._log("已切换为直连浏览器重试，验证码请求也将直连")
            return ok
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def _navigate_to_auth_url_fast(self, auth_url: str) -> None:
        page = getattr(self, "_page", None)
        try:
            if page is not None:
                page.goto(auth_url, wait_until="commit", timeout=25000)
            else:
                self.driver.get(auth_url)
            return
        except Exception as error:
            if not self._is_proxy_navigation_error(error):
                raise
            if not self._relaunch_browser_without_proxy():
                raise

        page = getattr(self, "_page", None)
        if page is not None:
            page.goto(auth_url, wait_until="commit", timeout=25000)
        else:
            self.driver.get(auth_url)

    def _is_verify_email_success_page(self) -> bool:
        current_url = self._current_url().lower()
        if "execution=verify_email" in current_url:
            return True

        page_text = self._page_source().lower()
        url_markers = ["/login-actions/required-action"]
        text_markers = [
            "verify email",
            "check your email",
            "resend confirmation email",
            "complete account creation",
            "查看邮件",
            "确认邮件",
            "重新发送确认邮件",
        ]
        return any(marker in current_url for marker in url_markers) and any(
            marker.lower() in page_text for marker in text_markers
        )

    def _collect_registration_feedback(self) -> List[str]:
        messages: List[str] = []
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
        try:
            required = ["lastName", "firstName", "email", "emailVerif", "password", "passwordVerif"]
            missing = [key for key in required if not data.get(key)]
            if missing:
                return self._return_error(f"注册字段缺失: {', '.join(missing)}", "missing_fields")

            self._log("正在构建认证 URL...", 10)
            auth_url = self.build_auth_url()
            self._log(f"正在访问: {auth_url}", 15)
            self._navigate_to_auth_url_fast(auth_url)
            time.sleep(0.3)

            register_button = None
            for locator in [
                (By.CSS_SELECTOR, "button.fr-btn.fr-btn--secondary"),
                (By.CSS_SELECTOR, "button[id^='fr-button-']"),
                (By.CSS_SELECTOR, "a.btn.primaire"),
                (By.XPATH, "//button[contains(., '注册')]"),
                (By.XPATH, "//button[contains(., 'Create')]"),
                (By.XPATH, "//button[contains(., 'Créer')]"),
            ]:
                try:
                    register_button = WebDriverWait(self.driver, 8).until(EC.element_to_be_clickable(locator))
                    break
                except Exception:
                    continue
            if not register_button:
                return self._return_error("无法找到注册按钮", "find_register_button")

            register_button.click()
            self._log("已点击注册按钮", 25)
            time.sleep(0.2)

            self._log("正在填写注册表单...", 30)
            self._log(f"填写信息: {data.get('lastName', '')} {data.get('firstName', '')} / {data.get('email', '')}")
            for field_name, data_key in [
                ("lastName", "lastName"),
                ("firstName", "firstName"),
                ("email", "email"),
                ("emailVerif", "emailVerif"),
            ]:
                try:
                    field = WebDriverWait(self.driver, 8).until(
                        EC.presence_of_element_located((By.NAME, field_name))
                    )
                    field.clear()
                    field.send_keys(data[data_key])
                except Exception as error:
                    return self._return_error(f"填写 {field_name} 失败: {error}", f"fill_{field_name}")

            try:
                language = PwSelect(
                    WebDriverWait(self.driver, 8).until(EC.presence_of_element_located((By.ID, "ddeLanguage")))
                )
                language.select_by_visible_text("English")
                self._log("已选择语言 English", 55)
            except Exception as error:
                return self._return_error(f"选择语言失败: {error}", "select_language")

            for field_name, data_key in [("password", "password"), ("password-confirm", "passwordVerif")]:
                try:
                    field = self.driver.find_element(By.NAME, field_name)
                    field.clear()
                    field.send_keys(data[data_key])
                except Exception as error:
                    return self._return_error(f"填写 {field_name} 失败: {error}", f"fill_{field_name}")
            self._log("已填写密码", 65)

            self._log("正在处理验证码...", 70)
            if not self.handle_captcha():
                return self._return_error("验证码处理失败", "captcha_failed")

            self._log("正在提交注册表单...", 80)
            submit_button = WebDriverWait(self.driver, 8).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit'], input[type='submit']"))
            )
            submit_button.click()
            self._log("已提交", 85)
            time.sleep(0.6)

            if self._is_verify_email_success_page():
                self._log("注册成功: 已进入邮箱确认页面", 100)
                return {"success": True, "message": "注册成功: 已进入邮箱确认页面"}

            try:
                alert = WebDriverWait(self.driver, 2).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div.alert span, div[class*='alert']"))
                )
                alert_text = (alert.text or "").strip()
                if alert_text and (
                    "verify" in alert_text.lower()
                    or "vérifier" in alert_text.lower()
                    or "邮件" in alert_text
                    or "email" in alert_text.lower()
                ):
                    self._log(f"注册成功: {alert_text}", 100)
                    return {"success": True, "message": f"注册成功: {alert_text}"}
            except Exception:
                pass

            feedback_messages = self._collect_registration_feedback()
            if feedback_messages:
                feedback_text = " | ".join(feedback_messages)
                if self._is_account_exists_feedback(feedback_text):
                    return self._return_error(f"账号已存在: {feedback_text}", "account_exists")
                return self._return_error(f"注册失败: {feedback_text}", "register_validation_error")

            current_url = self._current_url().lower()
            if self._is_verify_email_success_page():
                self._log("注册成功: 已进入邮箱确认页面", 100)
                return {"success": True, "message": "注册成功: 已进入邮箱确认页面"}

            if "registration" not in current_url:
                try:
                    remaining_fields = self.driver.find_elements(
                        By.CSS_SELECTOR, "input[name='lastName'], input[name='email'], input[name='password']"
                    )
                except Exception:
                    remaining_fields = []
                if not remaining_fields:
                    self._log("注册成功", 100)
                    return {"success": True, "message": "注册成功"}

            return self._return_error(
                "提交后仍停留在注册页，未检测到成功提示或明确错误提示",
                "register_submit_unknown",
            )
        except Exception as error:
            if self._is_verify_email_success_page():
                self._log("注册成功: 已进入邮箱确认页面", 100)
                return {"success": True, "message": "注册成功: 已进入邮箱确认页面"}
            return self._return_error(f"注册账号时出错: {error}", "register_account")

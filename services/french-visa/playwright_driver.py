"""
Playwright 的 Selenium 兼容适配器
将 Playwright page 包装成 Selenium driver 风格接口，供现有法签自动化代码使用。
"""
import time
from typing import Any, List, Optional, Tuple
from selenium.webdriver.common.by import By


class PlaywrightElement:
    """模拟 Selenium WebElement"""
    def __init__(self, locator, page):
        self._locator = locator
        self._page = page

    def click(self) -> None:
        self._locator.click(timeout=30000)

    def clear(self) -> None:
        self._locator.clear(timeout=15000)

    def send_keys(self, text: str) -> None:
        value = str(text) if text is not None else ""
        if len(value) > 1:
            try:
                self._locator.fill(value, timeout=15000)
                return
            except Exception:
                pass
        self._locator.press_sequentially(value, delay=10)

    def submit(self) -> None:
        self._locator.evaluate("el => { const f = el.form || el.closest('form'); if (f) f.submit(); }")

    @property
    def text(self) -> str:
        return self._locator.inner_text(timeout=15000) or ""

    def screenshot(self, path: str) -> bool:
        self._locator.screenshot(path=path, timeout=15000)
        return True

    def is_displayed(self) -> bool:
        return self._locator.is_visible()

    def is_enabled(self) -> bool:
        return self._locator.is_enabled()

    def get_attribute(self, name: str) -> Optional[str]:
        return self._locator.get_attribute(name) if name else None

    def select_by_visible_text(self, text: str) -> None:
        """Select 下拉框的 select_by_visible_text"""
        self._locator.select_option(label=text, timeout=15000)


class Select:
    """兼容 Selenium Select，用于下拉框"""
    def __init__(self, element: PlaywrightElement):
        self._el = element

    def select_by_visible_text(self, text: str) -> None:
        self._el.select_by_visible_text(text)


class PlaywrightDriver:
    """Playwright page 的 Selenium driver 兼容层"""
    def __init__(self, page):
        self._page = page

    @property
    def current_url(self) -> str:
        return self._page.url

    @property
    def page_source(self) -> str:
        return self._page.content()

    def _is_transient_navigation_error(self, error: Exception) -> bool:
        text = str(error).lower()
        transient_markers = [
            "err_connection_closed",
            "err_http2_protocol_error",
            "err_connection_reset",
            "err_network_changed",
            "err_timed_out",
            "timeout 60000ms exceeded",
            'waiting until "domcontentloaded"',
        ]
        return any(marker in text for marker in transient_markers)

    def get(self, url: str) -> None:
        last_error = None
        for attempt in range(4):
            try:
                self._page.goto(url, wait_until="domcontentloaded", timeout=60000)
                return
            except Exception as error:
                last_error = error
                if not self._is_transient_navigation_error(error) or attempt == 3:
                    raise
                try:
                    self._page.wait_for_timeout(1000 + attempt * 1000)
                except Exception:
                    time.sleep(1 + attempt)
        if last_error:
            raise last_error

    def refresh(self) -> None:
        try:
            self._page.reload(wait_until="commit", timeout=60000)
        except Exception:
            try:
                url = self._page.url
                if url and not url.startswith("about:"):
                    self._page.goto(url, wait_until="commit", timeout=60000)
            except Exception:
                pass

    def save_screenshot(self, path: str) -> bool:
        self._page.screenshot(path=path, timeout=30000)
        return True

    def maximize_window(self) -> None:
        pass  # Playwright viewport 已在 context 中设置

    def quit(self) -> None:
        try:
            self._page.context.browser.close()
        except Exception:
            pass

    def close(self) -> None:
        self.quit()

    def set_page_load_timeout(self, seconds: int) -> None:
        self._page.set_default_timeout(seconds * 1000)

    def execute_script(self, script: str, *args) -> Any:
        if not args:
            return self._page.evaluate(script)
        eval_args = []
        for a in args:
            if isinstance(a, PlaywrightElement):
                eval_args.append(a._locator.element_handle(timeout=15000))
            else:
                eval_args.append(a)
        # Selenium 用 arguments[0], arguments[1]... Playwright 需转成函数参数
        for i in range(len(eval_args)):
            script = script.replace(f"arguments[{i}]", f"__arg{i}")
        params = ", ".join(f"__arg{i}" for i in range(len(eval_args)))
        new_script = f"(({params}) => {{ {script} }})"
        try:
            return self._page.evaluate(new_script, *eval_args)
        finally:
            for h in eval_args:
                if hasattr(h, "dispose"):
                    try:
                        h.dispose()
                    except Exception:
                        pass

    def _by_to_selector(self, by: str, value: str) -> str:
        if by == By.ID:
            if value.startswith("#"):
                return value
            if ":" in value or "." in value or " " in value:
                return f'[id="{value}"]'
            return f"#{value}"
        if by == By.NAME:
            return f'[name="{value}"]'
        if by == By.CSS_SELECTOR:
            return value
        if by == By.XPATH:
            return f"xpath={value}"
        if by == By.TAG_NAME:
            return value
        if by == By.CLASS_NAME:
            return f".{value}"
        return value

    def find_element(self, by: str, value: str) -> PlaywrightElement:
        sel = self._by_to_selector(by, value)
        loc = self._page.locator(sel).first
        loc.wait_for(state="attached", timeout=60000)
        return PlaywrightElement(loc, self._page)

    def find_elements(self, by: str, value: str) -> List[PlaywrightElement]:
        sel = self._by_to_selector(by, value)
        locators = self._page.locator(sel).all()
        return [PlaywrightElement(loc, self._page) for loc in locators]

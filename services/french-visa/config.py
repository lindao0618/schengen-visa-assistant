# 法签自动化配置：从环境变量读取，供 CLI 与自动化模块使用
import os
from pathlib import Path

# 输出目录由 CLI/API 每次传入，此处仅默认值
def get_output_dir(out_dir: str = "") -> Path:
    if out_dir:
        p = Path(out_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p
    base = Path(__file__).resolve().parent.parent.parent / "temp" / "french-visa-output"
    base.mkdir(parents=True, exist_ok=True)
    return base


def get_screenshot_dir(out_dir: str = "") -> Path:
    p = get_output_dir(out_dir) / "screenshots"
    p.mkdir(parents=True, exist_ok=True)
    return p


# 从环境变量读取，与 visa-automation-system 的 app.config 对齐
CAPTCHA_API_KEY = (
    os.environ.get("CAPTCHA_API_KEY")
    or os.environ.get("2CAPTCHA_API_KEY")
    or ""
)
CHROMEDRIVER_PATH = os.environ.get("CHROMEDRIVER_PATH", "")
SELENIUM_HEADLESS = os.environ.get("SELENIUM_HEADLESS", "false").lower() == "true"

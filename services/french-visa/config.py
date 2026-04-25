import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _load_env_file(file_path: Path) -> None:
    if not file_path.exists():
        return
    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


for env_name in (".env", ".env.local"):
    _load_env_file(PROJECT_ROOT / env_name)


def get_output_dir(out_dir: str = "") -> Path:
    if out_dir:
        path = Path(out_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path
    base = PROJECT_ROOT / "temp" / "french-visa-output"
    base.mkdir(parents=True, exist_ok=True)
    return base


def get_screenshot_dir(out_dir: str = "") -> Path:
    path = get_output_dir(out_dir) / "screenshots"
    path.mkdir(parents=True, exist_ok=True)
    return path


CAPTCHA_API_KEY = (
    os.environ.get("CAPTCHA_API_KEY")
    or os.environ.get("TWOCAPTCHA_API_KEY")
    or os.environ.get("2CAPTCHA_API_KEY")
    or ""
)
CAPSOLVER_API_KEY = os.environ.get("CAPSOLVER_API_KEY", "")
CHROMEDRIVER_PATH = os.environ.get("CHROMEDRIVER_PATH", "")
SELENIUM_HEADLESS = os.environ.get("SELENIUM_HEADLESS", "true").lower() != "false"

#!/usr/bin/env python3
"""安装 Playwright Chromium（法签自动化使用，与美签一致）。运行: python scripts/setup-french-visa-chromedriver.py"""
import subprocess
import sys

def main():
    print("正在安装 Playwright Chromium...")
    r = subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], capture_output=False)
    if r.returncode == 0:
        print("✅ Playwright Chromium 已就绪")
    else:
        print("❌ 安装失败，请手动运行: python -m playwright install chromium")
        sys.exit(1)

if __name__ == "__main__":
    main()

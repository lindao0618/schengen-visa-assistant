#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""美签功能环境配置：创建 country_map.xlsx 并安装 Playwright 浏览器"""
import os
import sys
import subprocess
from pathlib import Path

# 常用国家中英文映射（与 visa-automation-system / ds160 格式一致）
COUNTRY_MAP_DATA = [
    ("CHINA", "中国"),
    ("UNITED KINGDOM", "英国"),
    ("UNITED STATES", "美国"),
    ("CANADA", "加拿大"),
    ("AUSTRALIA", "澳大利亚"),
    ("JAPAN", "日本"),
    ("SOUTH KOREA", "韩国"),
    ("GERMANY", "德国"),
    ("FRANCE", "法国"),
    ("ITALY", "意大利"),
    ("SPAIN", "西班牙"),
    ("NETHERLANDS", "荷兰"),
    ("SWITZERLAND", "瑞士"),
    ("SINGAPORE", "新加坡"),
    ("HONG KONG", "香港"),
    ("TAIWAN", "台湾"),
    ("THAILAND", "泰国"),
    ("VIETNAM", "越南"),
    ("PHILIPPINES", "菲律宾"),
    ("INDONESIA", "印度尼西亚"),
    ("MALAYSIA", "马来西亚"),
    ("INDIA", "印度"),
    ("NEW ZEALAND", "新西兰"),
    ("IRELAND", "爱尔兰"),
    ("RUSSIA", "俄罗斯"),
    ("BRAZIL", "巴西"),
    ("MEXICO", "墨西哥"),
    ("ARGENTINA", "阿根廷"),
]

def main():
    project_root = Path(__file__).resolve().parent.parent
    ds160_pkg = project_root / "services" / "usvisa-runtime" / "ds160-server-package"
    country_map_path = ds160_pkg / "country_map.xlsx"

    # 1. 创建 country_map.xlsx
    try:
        import pandas as pd
        df = pd.DataFrame([
            {"English Name": en, "Chinese Name": cn} for en, cn in COUNTRY_MAP_DATA
        ])
        ds160_pkg.mkdir(parents=True, exist_ok=True)
        df.to_excel(country_map_path, index=False, engine="openpyxl")
        print(f"[OK] country_map.xlsx created: {country_map_path}")
    except Exception as e:
        print(f"[WARN] Failed to create country_map.xlsx: {e}")
        print("   DS160 will use built-in country mapping")

    # 2. Install Playwright Chromium
    try:
        print("\nInstalling Playwright Chromium...")
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        if result.returncode == 0:
            print("[OK] Playwright Chromium installed")
        else:
            print(f"[WARN] Playwright install returned: {result.returncode}")
            if result.stderr:
                print(result.stderr[:500])
    except Exception as e:
        print(f"[WARN] Playwright install failed: {e}")
        print("   Run manually: python -m playwright install chromium")

    print("\nUS Visa setup done.")

if __name__ == "__main__":
    main()

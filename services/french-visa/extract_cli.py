#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""法签注册信息提取 CLI：从 Excel（FV注册表）提取，输出 Excel + JSON。支持多文件批量合并。"""
import argparse
import json
import sys
from pathlib import Path

# 确保可导入 extractor
sys.path.insert(0, str(Path(__file__).resolve().parent))
from extractor import extract_fv_registration_info, extract_fv_registration_info_batch


def main() -> None:
    parser = argparse.ArgumentParser(description="法签 FV 注册信息提取")
    parser.add_argument("input_excel", nargs="+", help="输入 Excel 路径（含 FV注册表），可多个")
    parser.add_argument("--output-dir", "-o", required=True, help="输出目录")
    args = parser.parse_args()
    input_paths = [str(Path(p).resolve()) for p in args.input_excel]
    output_dir = args.output_dir

    if len(input_paths) == 1:
        success, output_files, error = extract_fv_registration_info(
            input_paths[0], output_dir, callback=None
        )
    else:
        success, output_files, error = extract_fv_registration_info_batch(
            input_paths, output_dir, callback=None
        )

    if success:
        excel_path, json_path = output_files
        result = {
            "success": True,
            "message": f"提取完成，共处理 {len(input_paths)} 个文件",
            "output_file": Path(excel_path).name,
            "json_file": Path(json_path).name,
            "output_dir": output_dir,
        }
    else:
        result = {"success": False, "error": error or "提取失败"}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

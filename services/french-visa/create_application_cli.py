#!/usr/bin/env python3
"""法签生成新申请 CLI：读 Excel，创建新申请，输出 PROGRESS 到 stderr，结果写到 result.json 文件。"""
import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from application_generator import create_new_application

RESULT_FILE = "create_result.json"


def _progress(pct: int, msg: str) -> None:
    sys.stderr.write(f"PROGRESS:{pct}:{msg}\n")
    sys.stderr.flush()


def _result_output(output_dir: str):
    def _write(result: dict) -> None:
        p = Path(output_dir) / RESULT_FILE
        p.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return _write


def main() -> None:
    parser = argparse.ArgumentParser(description="法签生成新申请")
    parser.add_argument("excel_path", help="Excel 文件路径")
    parser.add_argument("--output-dir", "-o", default="", help="输出目录")
    args = parser.parse_args()

    excel_path = Path(args.excel_path)
    output_dir = args.output_dir or ""
    if not excel_path.exists():
        out = {"success": False, "error": f"文件不存在: {excel_path}"}
        if output_dir:
            (Path(output_dir) / RESULT_FILE).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        os._exit(1)

    result = create_new_application(
        str(excel_path),
        original_filename=excel_path.name,
        output_dir=output_dir,
        callback=_progress,
        result_output=_result_output(output_dir),
    )
    (Path(output_dir) / RESULT_FILE).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    os._exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()

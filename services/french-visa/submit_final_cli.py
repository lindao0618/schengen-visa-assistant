#!/usr/bin/env python3
"""法签提交最终表 CLI：读 Excel，提交并下载 PDF。输出 PROGRESS 到 stderr、JSON 到 stdout。"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from final_submitter import submit_final_form


def _progress(pct: int, msg: str) -> None:
    sys.stderr.write(f"PROGRESS:{pct}:{msg}\n")
    sys.stderr.flush()


def main() -> None:
    parser = argparse.ArgumentParser(description="法签提交最终表")
    parser.add_argument("excel_path", help="Excel 文件路径")
    parser.add_argument("--output-dir", "-o", default="", help="输出/下载目录")
    args = parser.parse_args()

    excel_path = Path(args.excel_path)
    if not excel_path.exists():
        out = {"success": False, "error": f"文件不存在: {excel_path}"}
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(1)

    result = submit_final_form(
        str(excel_path),
        download_dir=args.output_dir or None,
        output_dir=args.output_dir or "",
        callback=_progress,
    )
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()

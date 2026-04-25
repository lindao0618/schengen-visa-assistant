#!/usr/bin/env python3
"""France-Visas create application CLI."""
import argparse
import json
import os
import sys
from pathlib import Path

# Must run before importing application_generator/config.
# France-Visas form automation is forced to headless mode.
os.environ["SELENIUM_HEADLESS"] = "true"

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
    parser = argparse.ArgumentParser(description="France-Visas create application")
    parser.add_argument("excel_path", help="Excel file path")
    parser.add_argument("--output-dir", "-o", default="", help="Output directory")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Kept for backward compatibility; this CLI now always runs headless",
    )
    args = parser.parse_args()

    sys.stderr.write(
        f"INFO create_application_cli: SELENIUM_HEADLESS={os.environ.get('SELENIUM_HEADLESS', '')!r} "
        "(France-Visas form automation is forced to headless mode)\n"
    )
    sys.stderr.flush()

    excel_path = Path(args.excel_path)
    output_dir = args.output_dir or ""
    if not excel_path.exists():
        out = {"success": False, "error": f"File does not exist: {excel_path}"}
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

#!/usr/bin/env python3
"""
法签账号注册 CLI：读取 Excel，逐行调用 France-visas 注册，输出 PROGRESS 到 stderr、JSON 到 stdout。
用法: python register_cli.py <excel_path> [--output-dir <dir>]
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pandas as pd

from automation import FrenchVisaAutomation


def _progress(pct: int, msg: str) -> None:
    sys.stderr.write(f"PROGRESS:{pct}:{msg}\n")
    sys.stderr.flush()


def main() -> None:
    parser = argparse.ArgumentParser(description="法签账号注册")
    parser.add_argument("excel_path", help="Excel 文件路径（列名含邮箱、密码、姓、名等）")
    parser.add_argument("--output-dir", default="", help="输出目录，用于截图等")
    args = parser.parse_args()

    excel_path = Path(args.excel_path)
    if not excel_path.exists():
        out = {"success": False, "error": f"文件不存在: {excel_path}"}
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(1)

    try:
        _progress(0, "开始账号注册...")
        df = pd.read_excel(excel_path)
    except Exception as e:
        out = {"success": False, "error": f"读取 Excel 失败: {e}"}
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(1)

    total = len(df)
    if total == 0:
        out = {"success": True, "total": 0, "success_count": 0, "fail_count": 0, "results": [], "message": "无记录"}
        print(json.dumps(out, ensure_ascii=False))
        return

    _progress(5, f"共 {total} 条记录，正在初始化浏览器...")
    automation = FrenchVisaAutomation(callback=_progress, output_dir=args.output_dir)
    if not automation.init_browser():
        out = {"success": False, "error": "浏览器初始化失败", "log_file": automation.get_log_file()}
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(1)

    success_count = 0
    fail_count = 0
    results = []

    try:
        for index, row in df.iterrows():
            progress_base = 15 + int((index / total) * 80)
            data = {
                "email": row.get("邮箱地址") or row.get("邮箱账号（Email account）", ""),
                "password": row.get("密码") or row.get("邮箱密码（Email password）", ""),
                "lastName": row.get("姓") or row.get("姓氏（Family name）", ""),
                "firstName": row.get("名") or row.get("名字（First name）", ""),
                "emailVerif": row.get("检查电子邮件地址") or row.get("邮箱地址") or row.get("邮箱账号（Email account）", ""),
                "passwordVerif": row.get("密码") or row.get("邮箱密码（Email password）", ""),
            }
            _progress(progress_base, f"正在处理第 {index + 1}/{total} 条: {data['lastName']} {data['firstName']}")

            result = automation.register_account(data)
            if isinstance(result, dict):
                if result.get("success"):
                    success_count += 1
                    results.append({
                        "index": index + 1,
                        "name": f"{data['lastName']} {data['firstName']}",
                        "email": data["email"],
                        "status": "success",
                        "message": result.get("message", "注册成功"),
                        "log_file": result.get("log_file") or automation.get_log_file(),
                    })
                else:
                    fail_count += 1
                    item = {
                        "index": index + 1,
                        "name": f"{data['lastName']} {data['firstName']}",
                        "email": data["email"],
                        "status": "failed",
                        "error": result.get("error", "注册失败"),
                        "log_file": result.get("log_file") or automation.get_log_file(),
                    }
                    if result.get("screenshot"):
                        item["screenshot"] = result["screenshot"]
                    results.append(item)
            else:
                if result:
                    success_count += 1
                    results.append({
                        "index": index + 1,
                        "name": f"{data['lastName']} {data['firstName']}",
                        "email": data["email"],
                        "status": "success",
                        "log_file": automation.get_log_file(),
                    })
                else:
                    fail_count += 1
                    results.append({
                        "index": index + 1,
                        "name": f"{data['lastName']} {data['firstName']}",
                        "email": data["email"],
                        "status": "failed",
                        "error": "注册失败",
                        "log_file": automation.get_log_file(),
                    })
            time.sleep(2)
    except KeyError as e:
        _progress(0, f"Excel 缺少字段: {e}")
        out = {"success": False, "error": f"Excel 缺少必要字段: {e}"}
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(1)
    finally:
        automation.close_browser()

    _progress(100, f"完成。成功: {success_count}, 失败: {fail_count}, 共: {total}")
    out = {
        "success": True,
        "total": total,
        "success_count": success_count,
        "fail_count": fail_count,
        "results": results,
        "message": f"成功: {success_count}, 失败: {fail_count}, 共: {total}",
        "log_file": automation.get_log_file(),
    }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()

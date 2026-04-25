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

from register_automation import FranceVisaRegisterAutomation

FV_REGISTER_SHEET_NAME = "FV" + "\u6ce8\u518c\u8868"
EMAIL_LABEL = "\u90ae\u7bb1\u5730\u5740"
EMAIL_VERIFY_LABEL = "\u68c0\u67e5\u7535\u5b50\u90ae\u4ef6\u5730\u5740"
PASSWORD_LABEL = "\u5bc6\u7801"
PASSWORD_CONFIRM_LABEL = "\u786e\u8ba4\u5bc6\u7801"
PASSWORD_VERIFY_LABEL = "\u68c0\u67e5\u5bc6\u7801"
EMAIL_ACCOUNT_LABEL = "\u90ae\u7bb1\u8d26\u53f7\uff08Email account\uff09"
EMAIL_PASSWORD_LABEL = "\u90ae\u7bb1\u5bc6\u7801\uff08Email password\uff09"
LAST_NAME_LABEL = "\u59d3\u6c0f\uff08Family name\uff09"
FIRST_NAME_LABEL = "\u540d\u5b57\uff08First name\uff09"


def _progress(pct: int, msg: str) -> None:
    sys.stderr.write(f"PROGRESS:{pct}:{msg}\n")
    sys.stderr.flush()


def _normalize_text(value) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def _clean_password(value) -> str:
    text = _normalize_text(value)
    if not text:
        return ""
    if text.replace(".", "").replace("-", "").replace("+", "").isdigit() and "." in text:
        try:
            return str(int(float(text)))
        except Exception:
            return text
    return text


def _pick_by_keywords(row, keywords, is_password: bool = False) -> str:
    normalized_keywords = [str(keyword).strip().lower() for keyword in keywords if str(keyword).strip()]
    for label in row.index:
        label_text = str(label).strip()
        label_lower = label_text.lower()
        if not any(keyword in label_lower for keyword in normalized_keywords):
            continue
        value = row.get(label)
        text = _clean_password(value) if is_password else _normalize_text(value)
        if text:
            return text
    return ""


def _is_key_value_layout(df: pd.DataFrame) -> bool:
    if df.empty or df.shape[1] < 2:
        return False
    first_col = df.iloc[:, 0].astype(str).fillna("")
    return first_col.str.contains("email|邮箱|family name|first name|姓氏|名字", case=False, regex=True).any()


def _convert_key_value_layout(df: pd.DataFrame) -> pd.DataFrame:
    row_data = {}
    for _, item in df.iterrows():
        key = _normalize_text(item.iloc[0] if len(item) > 0 else "")
        if not key:
            continue
        value = item.iloc[1] if len(item) > 1 else ""
        row_data[key] = value
    return pd.DataFrame([row_data]) if row_data else pd.DataFrame()


def _load_registration_rows(excel_path: Path) -> pd.DataFrame:
    workbook = pd.ExcelFile(excel_path)
    preferred_sheet = next((name for name in workbook.sheet_names if str(name).strip() == FV_REGISTER_SHEET_NAME), None)
    target_sheet = preferred_sheet or workbook.sheet_names[0]
    df = pd.read_excel(excel_path, sheet_name=target_sheet)
    if preferred_sheet:
        _progress(2, f"检测到原始 Excel，使用工作表：{preferred_sheet}")
    else:
        _progress(2, f"未找到 FV注册表，回退使用工作表：{target_sheet}")
    cleaned = df[df.notna().any(axis=1)].copy()
    if not preferred_sheet and _is_key_value_layout(cleaned):
        _progress(3, "检测到纵向模板，自动转换为注册行数据")
        converted = _convert_key_value_layout(cleaned)
        if not converted.empty:
            return converted
    return cleaned


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
        df = _load_registration_rows(excel_path)
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
    automation = FranceVisaRegisterAutomation(callback=_progress, output_dir=args.output_dir)
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
                "email": _pick_by_keywords(row, [EMAIL_LABEL, EMAIL_ACCOUNT_LABEL, "email account", "email"]),
                "password": _pick_by_keywords(
                    row,
                    [PASSWORD_CONFIRM_LABEL, PASSWORD_VERIFY_LABEL, EMAIL_PASSWORD_LABEL, "password", PASSWORD_LABEL],
                    is_password=True,
                ),
                "lastName": _pick_by_keywords(row, ["family name", "surname", LAST_NAME_LABEL, "last name"]),
                "firstName": _pick_by_keywords(row, ["first name", "given name", FIRST_NAME_LABEL, "first"]),
                "emailVerif": _pick_by_keywords(
                    row,
                    [EMAIL_VERIFY_LABEL, "\u786e\u8ba4\u90ae\u7bb1", "email", EMAIL_LABEL, EMAIL_ACCOUNT_LABEL],
                ),
                "passwordVerif": _pick_by_keywords(
                    row,
                    [PASSWORD_CONFIRM_LABEL, PASSWORD_VERIFY_LABEL, EMAIL_PASSWORD_LABEL, "password", PASSWORD_LABEL],
                    is_password=True,
                ),
            }
            if not data["email"] or not data["password"]:
                fail_count += 1
                results.append({
                    "index": index + 1,
                    "name": f"{data['lastName']} {data['firstName']}".strip(),
                    "email": data["email"],
                    "status": "failed",
                    "error": "Excel 缺少邮箱或密码，无法直接注册",
                    "log_file": automation.get_log_file(),
                })
                continue
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
            time.sleep(0.3)
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

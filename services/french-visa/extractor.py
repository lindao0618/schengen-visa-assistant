"""
法签注册信息提取器（从 visa-automation-system shared/french_visa/extractor.py 迁移）
从 Excel 表 "FV注册表" 读取并提取 FV 注册信息，输出 Excel + JSON
"""
import os
import json
import sys
from datetime import datetime
from typing import List, Tuple

import pandas as pd


def _progress(pct: int, msg: str) -> None:
    print(f"PROGRESS:{pct}:{msg}", file=sys.stderr, flush=True)


def extract_fv_registration_info(input_file_path: str, output_dir: str = None, callback=None):
    """
    提取 FV 注册信息（单个文件）
    Returns: (成功标志, (output_excel_path, output_json_path) 或 None, 错误信息)
    """
    try:
        if output_dir is None:
            output_dir = os.path.dirname(input_file_path)
        os.makedirs(output_dir, exist_ok=True)

        def report(pct: int, m: str) -> None:
            if callback:
                callback(pct, m)
            _progress(pct, m)

        report(5, "正在读取 Excel...")
        try:
            df_first = pd.read_excel(input_file_path, sheet_name="FV注册表", nrows=1)
            num_cols = len(df_first.columns)
            dtype_dict = {}
            if num_cols > 5:
                dtype_dict[df_first.columns[5]] = str
            df = pd.read_excel(input_file_path, sheet_name="FV注册表", dtype=dtype_dict)
        except Exception:
            df = pd.read_excel(input_file_path, sheet_name="FV注册表")

        data = df[df.notna().any(axis=1)].copy()

        email_col = None
        for col in data.columns:
            col_str = str(col).strip().lower()
            if "邮箱" in col_str or "email" in col_str:
                email_col = col
                break

        password_col = None
        for col in data.columns:
            col_str = str(col).strip().lower()
            if "密码" in col_str or "password" in col_str:
                password_col = col
                break
        if password_col is None and len(data.columns) > 5:
            password_col = data.columns[5]

        if password_col is None:
            raise ValueError("无法确定密码列位置")

        if "密码" not in data.columns:
            data["密码"] = data[password_col].copy()
        elif password_col and password_col != "密码" and password_col in data.columns:
            if data["密码"].isna().all() or (data["密码"].astype(str).str.strip() == "").all():
                data["密码"] = data[password_col].copy()

        if email_col and "邮箱地址" not in data.columns:
            data["邮箱地址"] = data[email_col].copy()
        else:
            for col in data.columns:
                v = str(data[col].iloc[0]) if len(data) > 0 else ""
                if "@" in v:
                    data["邮箱地址"] = data[col].copy()
                    break

        if "密码" in data.columns:
            data["密码"] = data["密码"].astype(str)

            def clean_password(x):
                if isinstance(x, str) and x.replace(".", "").replace("-", "").replace("+", "").isdigit() and "." in x:
                    try:
                        return str(int(float(x)))
                    except Exception:
                        return x
                return x

            data["密码"] = data["密码"].apply(clean_password)
            data["密码"] = data["密码"].replace("nan", pd.NA).replace("None", pd.NA).replace("", pd.NA)

        report(50, "正在生成输出文件...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(output_dir, f"FV注册信息提取结果_{timestamp}.xlsx")
        data.to_excel(output_file, index=False)

        default_password = "Visa20252025!"
        json_list = []
        for idx, row in data.iterrows():
            raw_password = row["密码"]
            email = str(row["邮箱地址"]).strip()
            is_na = pd.isna(raw_password) or raw_password is None
            if is_na:
                password = default_password
            else:
                password_str = str(raw_password).strip()
                if password_str.replace(".", "").replace("-", "").replace("+", "").isdigit() and "." in password_str:
                    try:
                        password_str = str(int(float(password_str)))
                    except Exception:
                        pass
                if password_str == "" or password_str.lower() in ("nan", "none", "null"):
                    password = default_password
                else:
                    password = password_str
            json_list.append({"id": idx + 1, "email": email, "password": password, "name": f"账号 {idx + 1}"})

        json_file = os.path.join(output_dir, f"FV注册信息提取结果_{timestamp}.json")
        with open(json_file, "w", encoding="utf-8") as jf:
            json.dump(json_list, jf, ensure_ascii=False, indent=2)

        report(100, "提取完成")
        return True, (output_file, json_file), None
    except Exception as e:
        return False, None, str(e)


def extract_fv_registration_info_batch(
    input_file_paths: List[str], output_dir: str = None, callback=None
) -> Tuple[bool, Tuple[str, str], str]:
    """批量提取（合并多个文件）"""
    try:
        if not input_file_paths:
            return False, None, "没有提供输入文件"
        if output_dir is None:
            output_dir = os.path.dirname(input_file_paths[0])
        os.makedirs(output_dir, exist_ok=True)

        def report(pct: int, m: str) -> None:
            if callback:
                callback(pct, m)
            _progress(pct, m)

        combined_data = pd.DataFrame()
        total_files = len(input_file_paths)
        for idx, input_file_path in enumerate(input_file_paths):
            report(int((idx / total_files) * 70), f"正在读取文件 {idx + 1}/{total_files}")
            try:
                df = pd.read_excel(input_file_path, sheet_name="FV注册表")
                data = df[df.notna().any(axis=1)].copy()
                email_col = next((c for c in data.columns if "邮箱" in str(c) or "email" in str(c).lower()), None)
                password_col = next((c for c in data.columns if "密码" in str(c) or "password" in str(c).lower()), None)
                if password_col is None and len(data.columns) > 5:
                    password_col = data.columns[5]
                if password_col and "密码" not in data.columns:
                    data["密码"] = data[password_col]
                if email_col and "邮箱地址" not in data.columns:
                    data["邮箱地址"] = data[email_col]
                if "密码" in data.columns:
                    data["密码"] = data["密码"].astype(str).replace("nan", pd.NA)
                combined_data = pd.concat([combined_data, data], ignore_index=True)
            except Exception as e:
                report(0, f"处理文件失败: {e}")
                continue

        if combined_data.empty:
            return False, None, "所有文件都没有有效数据"

        report(85, "正在生成输出...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(output_dir, f"FV注册信息提取结果_{timestamp}.xlsx")
        combined_data.to_excel(output_file, index=False)

        default_password = "Visa20252025!"
        json_list = []
        for idx, row in combined_data.iterrows():
            raw = row.get("密码", pd.NA)
            email = str(row.get("邮箱地址", "")).strip()
            if pd.isna(raw) or raw is None:
                password = default_password
            else:
                s = str(raw).strip()
                if s.lower() in ("nan", "none", "") or not s:
                    password = default_password
                else:
                    password = s
            json_list.append({"id": idx + 1, "email": email, "password": password, "name": f"账号 {idx + 1}"})

        json_file = os.path.join(output_dir, f"FV注册信息提取结果_{timestamp}.json")
        with open(json_file, "w", encoding="utf-8") as jf:
            json.dump(json_list, jf, ensure_ascii=False, indent=2)

        report(100, f"批量提取完成，共 {len(combined_data)} 条")
        return True, (output_file, json_file), None
    except Exception as e:
        return False, None, str(e)

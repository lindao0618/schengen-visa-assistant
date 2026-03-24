#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
美签照片检查：处理照片 → 基础检查 → 可选网站检测 → 提供下载
不使用 DeepSeek AI 建议
"""
from playwright.sync_api import sync_playwright
import os
import time
from PIL import Image, ImageOps
import json
import logging
from pathlib import Path
from typing import Tuple, Dict, Any, Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)


def _process_photo(photo_path: str, output_dir: str) -> str:
    """
    处理照片：调整尺寸到600x600，压缩到240KB以下，转换为JPEG格式
    返回处理后的照片路径
    """
    try:
        os.makedirs(output_dir, exist_ok=True)
        with Image.open(photo_path) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            if img.size != (600, 600):
                img = img.resize((600, 600), Image.Resampling.LANCZOS)
            original_stem = Path(photo_path).stem
            processed_filename = f"{original_stem}_process.jpg"
            processed_path = os.path.join(output_dir, processed_filename)
            quality = 95
            max_attempts = 10
            for attempt in range(max_attempts):
                img.save(processed_path, 'JPEG', quality=quality, optimize=True)
                file_size_kb = os.path.getsize(processed_path) / 1024
                if file_size_kb <= 240:
                    break
                quality -= 10
                if quality < 50:
                    quality = 50
                    if attempt == max_attempts - 1:
                        temp_img = img.resize((580, 580), Image.Resampling.LANCZOS)
                        temp_img = temp_img.resize((600, 600), Image.Resampling.LANCZOS)
                        temp_img.save(processed_path, 'JPEG', quality=quality, optimize=True)
                    break
            return processed_path
    except Exception as e:
        logging.warning(f"照片处理失败: {e}，使用原始照片")
        return photo_path


def _simple_photo_check(photo_path: str) -> Dict[str, Any]:
    """基础照片检查：文件大小、尺寸、格式"""
    try:
        if not os.path.exists(photo_path):
            return {"success": False, "message": "文件不存在", "checks": []}
        file_size = os.path.getsize(photo_path) / 1024
        with Image.open(photo_path) as img:
            width, height = img.size
            format_name = img.format or "UNKNOWN"
        checks = []
        issues = []
        if file_size > 240:
            issues.append(f"文件大小 {file_size:.1f}KB 超过240KB限制")
            checks.append(f"❌ 文件大小 {file_size:.1f}KB 超过240KB限制")
        else:
            checks.append(f"✅ 文件大小 {file_size:.1f}KB 符合要求")
        if width != 600 or height != 600:
            issues.append(f"尺寸 {width}x{height} 不符合600x600要求")
            checks.append(f"❌ 尺寸 {width}x{height} 不符合600x600要求")
        else:
            checks.append(f"✅ 尺寸 {width}x{height} 符合要求")
        if format_name not in ['JPEG', 'JPG']:
            issues.append(f"格式 {format_name} 建议使用JPEG")
            checks.append(f"❌ 格式 {format_name} 建议使用JPEG")
        else:
            checks.append(f"✅ 格式 {format_name} 符合要求")
        success = len(issues) == 0
        message = "照片符合美签基本要求" if success else f"发现 {len(issues)} 个问题需要修复"
        suggestion = "照片符合美签基本要求，建议进行官方检测确认" if success else "请根据检查结果调整照片：\n" + "\n".join([f"• {i}" for i in issues])
        return {
            "success": success,
            "message": message,
            "file_size": file_size,
            "dimensions": {"width": width, "height": height},
            "checks": checks,
            "suggestion": suggestion
        }
    except Exception as e:
        return {"success": False, "message": f"检查失败: {str(e)}", "checks": []}


def get_chinese_error_message(error_text: str) -> str:
    """将英文错误消息转换为中文（不使用 AI）"""
    error_map = {
        "Image may contain imperfections due to compression artifacts": "照片可能包含压缩导致的瑕疵，建议使用质量更高的照片",
        "access denied": "访问被拒绝，可能需要使用代理或VPN",
        "err_access_denied": "访问被拒绝，可能需要使用代理或VPN",
        "无法访问网站，请检查网络连接": "无法访问美国签证官网，请检查网络连接或使用代理",
        "无法进入照片测试页面": "无法进入照片测试页面，请检查网络连接",
        "无法提交照片": "无法提交照片，请稍后重试",
        "无法确定检测结果": "无法确定检测结果，请稍后重试",
        "Timeout": "连接超时，请检查网络连接或使用代理"
    }
    if "Timeout" in error_text:
        return error_map["Timeout"]
    if "access denied" in error_text.lower() or "err_access_denied" in error_text.lower():
        return error_map["access denied"]
    for eng, chn in error_map.items():
        if eng in error_text:
            return chn
    return f"错误: {error_text}"


def _website_photo_check(photo_path: str) -> Optional[Dict[str, Any]]:
    """CEAC 网站照片检测（可选）"""
    try:
        with sync_playwright() as p:
            # 仅使用 Chromium，避免 Firefox 未安装时报错（需先执行 playwright install chromium）
            browser = p.chromium.launch(
                headless=False,  # 有头模式，便于调试
                args=['--disable-blink-features=AutomationControlled', '--disable-web-security', '--no-sandbox']
            )
            context = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                java_script_enabled=True,
            )
            context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                Object.defineProperty(navigator, 'productSub', { get: () => '20100101' });
                window.chrome = { runtime: {} };
            """)
            page = context.new_page()
            try:
                for retry in range(2):
                    try:
                        page.goto("https://ceac.state.gov/genniv/", wait_until='domcontentloaded', timeout=15000)
                        page.wait_for_selector('#ctl00_SiteContentPlaceHolder_ucLocation_ddlLocation', state='visible', timeout=8000)
                        break
                    except Exception as e:
                        if retry == 1:
                            return {"success": False, "message": get_chinese_error_message(str(e)), "checks": [f"❌ 网站检测: {str(e)}"]}
                        time.sleep(2)
                page.locator('#ctl00_SiteContentPlaceHolder_ucLocation_ddlLocation').select_option('LND')
                time.sleep(1)
                page.click('#ctl00_SiteContentPlaceHolder_ucPhotoMenu_lnkTestPhoto')
                page.wait_for_selector('#ctl00_cphMain_imageFileUpload', state='visible', timeout=8000)
                file_input = page.locator('#ctl00_cphMain_imageFileUpload')
                file_input.set_input_files(os.path.abspath(photo_path))
                page.wait_for_selector('#ctl00_cphButtons_btnUpload', state='visible', timeout=5000)
                page.locator('#ctl00_cphButtons_btnUpload').click()
                time.sleep(2)
                for _ in range(6):
                    try:
                        result_el = page.locator('td.result').first
                        if result_el and result_el.is_visible():
                            error_text = result_el.text_content().strip()
                            return {"success": False, "message": get_chinese_error_message(error_text), "checks": [f"❌ 网站检测: {error_text}"]}
                        success_el = page.locator("td:has-text('Photo passed quality standards')").first
                        if success_el and success_el.is_visible():
                            return {"success": True, "message": "网站检测通过", "checks": ["✅ 网站检测通过"]}
                    except Exception:
                        pass
                    time.sleep(1)
                return {"success": False, "message": "无法确定检测结果", "checks": ["❌ 网站检测: 无法确定结果"]}
            finally:
                try:
                    context.close()
                    browser.close()
                except Exception:
                    pass
    except Exception as e:
        logging.error(f"网站检测失败: {e}")
        return {"success": False, "message": str(e), "checks": [f"❌ 网站检测异常: {str(e)}"]}


def _progress(pct: int, msg: str) -> None:
    """输出进度行供 Node 解析，格式: PROGRESS:百分比:消息"""
    print(f"PROGRESS:{pct}:{msg}", flush=True)


def check_photo(photo_path: str, output_dir: str, use_website_check: bool = False) -> Tuple[bool, str, Dict[str, Any]]:
    """
    流程：处理照片 → 基础检查 → 可选网站检测
    返回 (success, message, result_dict)
    result_dict 包含 processed_photo_file（供下载）
    """
    processed_photo_file = None
    try:
        _progress(10, "处理照片中...")
        # 1. 处理照片
        processed_path = _process_photo(photo_path, output_dir)
        if processed_path != photo_path:
            processed_photo_file = os.path.basename(processed_path)
        else:
            processed_photo_file = os.path.basename(photo_path)

        _progress(40, "基础检查...")
        # 2. 基础检查
        result = _simple_photo_check(processed_path)
        if not result.get("success"):
            result["processed_photo_file"] = processed_photo_file
            return False, result.get("message", "检查未通过"), result

        # 3. 可选网站检测
        if use_website_check:
            _progress(60, "网站检测中...")
            web_result = _website_photo_check(processed_path)
            if web_result:
                result["checks"].extend(web_result.get("checks", []))
                if not web_result.get("success"):
                    result["success"] = False
                    result["message"] = web_result.get("message", "网站检测未通过")
            _progress(90, "检查完成")
        else:
            _progress(90, "检查完成")

        _progress(100, "完成")
        result["processed_photo_file"] = processed_photo_file
        return result.get("success", False), result.get("message", ""), result

    except Exception as e:
        err_msg = f"检测过程出错: {str(e)}"
        return False, err_msg, {
            "success": False,
            "message": err_msg,
            "error": str(e),
            "processed_photo_file": processed_photo_file,
            "checks": [f"❌ {err_msg}"]
        }


if __name__ == "__main__":
    import sys
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("photo_path", help="照片文件路径")
    parser.add_argument("--output-dir", "-o", default=None, help="处理后的照片输出目录（默认与photo_path同目录）")
    parser.add_argument("--website", "-w", action="store_true", help="启用CEAC网站检测")
    args = parser.parse_args()
    if not os.path.exists(args.photo_path):
        print(json.dumps({"success": False, "message": "照片文件不存在", "error": "File not found"}, ensure_ascii=False))
        sys.exit(1)
    output_dir = args.output_dir or os.path.dirname(args.photo_path)
    success, message, result = check_photo(args.photo_path, output_dir, use_website_check=args.website)
    print(json.dumps(result, ensure_ascii=False))

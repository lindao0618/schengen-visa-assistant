from playwright.sync_api import sync_playwright
import os
import time
from PIL import Image
import json
import logging
import requests
from typing import Tuple, Dict, Any

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_ai_suggestion_from_error(error_text):
    """获取AI建议"""
    data = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": "你是签证照片审核助手，擅长将英文错误转化为简洁中文建议。"
            },
            {
                "role": "user",
                "content": f"你是签证照片审核助手。以下是 DS-160 系统对上传美签证件照返回的英文反馈。请你根据提示内容，判断照片不合格的原因，并生成一段简洁、自然的中文建议，用于发送给申请人。要求说明问题并提供改进建议，语言友好、无责备。\n\n英文提示：\"{error_text}\"\n\n请直接输出优化后的中文建议，不要附加说明。"
            }
        ]
    }
    
    try:
        # DeepSeek API配置
        DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
        DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
        if not DEEPSEEK_API_KEY:
            return "??? DEEPSEEK_API_KEY????? AI ??"
        
        # 发送请求到DeepSeek
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(DEEPSEEK_API_URL, headers=headers, json=data)
        if response.status_code == 200:
            result = response.json()
            return result["choices"][0]["message"]["content"]
        else:
            return f"AI建议获取失败 (状态码: {response.status_code})"
            
    except Exception as e:
        logging.error(f"获取AI建议时出错: {str(e)}")
        return f"AI建议获取失败：{str(e)}"

def get_chinese_error_message(error_text):
    """将英文错误消息转换为中文"""
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
    
    # 处理超时错误
    if "Timeout" in error_text:
        return error_map["Timeout"]
    
    # 处理访问被拒绝
    if "access denied" in error_text.lower() or "err_access_denied" in error_text.lower():
        return error_map["access denied"]
    
    # 查找完整匹配
    for eng, chn in error_map.items():
        if eng in error_text:
            return chn
            
    return f"错误: {error_text}"

def check_photo(photo_path) -> Tuple[bool, str, Dict[str, Any]]:
    """检查照片是否符合DS-160要求"""
    try:
        # 检查文件大小
        file_size = os.path.getsize(photo_path) / 1024  # KB
        if file_size > 240:
            error_msg = f"照片文件太大: {file_size:.1f}KB (最大240KB)"
            ai_suggestion = get_ai_suggestion_from_error(error_msg)
            return False, error_msg, {
                "success": False,
                "message": error_msg,
                "file_size": file_size,
                "ai_suggestion": ai_suggestion
            }

        # 检查图片尺寸
        with Image.open(photo_path) as img:
            width, height = img.size

        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                with sync_playwright() as p:
                    # 仅用 Chromium，避免 Firefox 未安装时报错
                    browser = p.chromium.launch(
                        headless=False,  # 有头模式，便于调试
                        args=[
                            '--disable-blink-features=AutomationControlled',
                            '--disable-web-security',
                            '--no-sandbox',
                        ]
                    )
                    
                    # 创建上下文
                    context = browser.new_context(
                        viewport={'width': 1920, 'height': 1080},
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        java_script_enabled=True,
                    )
                    
                    # 修改浏览器指纹
                    context.add_init_script("""
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                        Object.defineProperty(navigator, 'productSub', { get: () => '20100101' });
                        window.chrome = { runtime: {} };
                    """)
                    
                    # 创建新页面
                    page = context.new_page()
                    
                    try:
                        # 访问页面
                        logging.info("访问页面...")
                        max_retries = 2
                        for retry in range(max_retries):
                            try:
                                # 修改等待策略
                                response = page.goto(
                                    "https://ceac.state.gov/genniv/",
                                    wait_until='domcontentloaded',  # 改用更快的加载条件
                                    timeout=15000  # 减少超时时间
                                )
                                
                                # 立即检查关键元素
                                page.wait_for_selector('#ctl00_SiteContentPlaceHolder_ucLocation_ddlLocation', 
                                    state='visible', 
                                    timeout=8000  # 减少等待时间
                                )
                                break
                            except Exception as e:
                                if retry == max_retries - 1:
                                    error_msg = f"访问出错: {str(e)}"
                                    chinese_msg = get_chinese_error_message(str(e))
                                    return False, error_msg, {
                                        "success": False,
                                        "message": error_msg,
                                        "chinese_message": chinese_msg,
                                        "file_size": file_size,
                                        "ai_suggestion": get_ai_suggestion_from_error(error_msg)
                                    }
                                logging.warning(f"访问出错: {str(e)}")
                                time.sleep(2)
                        
                        # 选择地点
                        logging.info("选择地点...")
                        try:
                            # 使用 select_option 而不是 select_value
                            page.locator('#ctl00_SiteContentPlaceHolder_ucLocation_ddlLocation').select_option('LND')
                            time.sleep(1)
                            
                            # 点击照片测试链接
                            logging.info("进入照片测试页面...")
                            page.click('#ctl00_SiteContentPlaceHolder_ucPhotoMenu_lnkTestPhoto')
                            
                            # 等待文件上传输入框出现
                            page.wait_for_selector('#ctl00_cphMain_imageFileUpload', 
                                state='visible', 
                                timeout=8000
                            )
                            
                            # 上传照片
                            logging.info("上传照片...")
                            file_input = page.locator('#ctl00_cphMain_imageFileUpload')
                            file_input.set_input_files(os.path.abspath(photo_path))
                            
                            # 等待上传按钮可用并点击
                            upload_button = page.wait_for_selector('#ctl00_cphButtons_btnUpload', 
                                state='visible', 
                                timeout=5000
                            )
                            upload_button.click()
                            
                            # 检查结果
                            logging.info("检查结果...")
                            # 等待2秒让页面响应
                            time.sleep(2)
                            
                            # 最多检查6秒
                            for _ in range(6):
                                try:
                                    # 检查失败结果
                                    result_element = page.locator('td.result').first
                                    if result_element and result_element.is_visible():
                                        error_text = result_element.text_content().strip()
                                        ai_suggestion = get_ai_suggestion_from_error(error_text)
                                        logging.info(f"❌ 检测未通过\n英文错误：{error_text}")
                                        logging.info(f"✅ AI建议：{ai_suggestion}")
                                        
                                        return False, "照片不符合要求", {
                                            "success": False,
                                            "message": f"照片不符合要求: {error_text}",
                                            "chinese_message": get_chinese_error_message(error_text),
                                            "error_text": error_text,
                                            "file_size": file_size,
                                            "dimensions": {"width": width, "height": height},
                                            "ai_suggestion": ai_suggestion
                                        }
                                    
                                    # 检查成功结果
                                    success_element = page.locator("td:has-text('Photo passed quality standards')").first
                                    if success_element and success_element.is_visible():
                                        return True, "照片符合要求", {
                                            "success": True,
                                            "message": "照片符合要求",
                                            "file_size": file_size,
                                            "dimensions": {"width": width, "height": height}
                                        }
                                except:
                                    pass
                                time.sleep(1)
                            
                            error_msg = "无法确定检测结果"
                            return False, error_msg, {
                                "success": False,
                                "message": error_msg,
                                "file_size": file_size,
                                "ai_suggestion": get_ai_suggestion_from_error(error_msg)
                            }
                            
                        except Exception as e:
                            error_msg = f"操作失败: {str(e)}"
                            return False, error_msg, {
                                "success": False,
                                "message": error_msg,
                                "file_size": file_size,
                                "ai_suggestion": get_ai_suggestion_from_error(error_msg)
                            }
                    
                    except Exception as e:
                        logging.error(f"页面操作失败: {str(e)}")
                        raise
                    
                    finally:
                        try:
                            context.close()
                            browser.close()
                        except Exception as e:
                            logging.error(f"关闭浏览器失败: {str(e)}")
            
            except Exception as e:
                logging.error(f"尝试 {attempt + 1} 失败: {str(e)}")
                if attempt < max_attempts - 1:
                    logging.info("等待后重试...")
                    time.sleep(random.uniform(30, 60))
                else:
                    error_msg = f"检测过程出错: {str(e)}"
                    ai_suggestion = get_ai_suggestion_from_error(error_msg)
                    return False, error_msg, {
                        "success": False,
                        "message": error_msg,
                        "error": str(e),
                        "ai_suggestion": ai_suggestion
                    }
    
    except Exception as e:
        error_msg = f"检测过程出错: {str(e)}"
        ai_suggestion = get_ai_suggestion_from_error(error_msg)
        return False, error_msg, {
            "success": False,
            "message": error_msg,
            "error": str(e),
            "ai_suggestion": ai_suggestion
        }

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("使用方法: python server_check.py <照片路径>")
        sys.exit(1)
    
    photo_path = sys.argv[1]
    success, message, result = check_photo(photo_path)
    
    # 输出完整的JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2)) 
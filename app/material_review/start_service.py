#!/usr/bin/env python3
"""
材料审核系统启动脚本
"""
import os
import sys
import subprocess
import time

def check_dependencies():
    """检查依赖是否安装"""
    try:
        import fastapi
        import uvicorn
        print("✅ FastAPI 和 Uvicorn 已安装")
    except ImportError:
        print("❌ 缺少基础依赖，正在安装...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn"])
    
    try:
        from tencentcloud.common import credential
        from tencentcloud.ocr.v20181119 import ocr_client, models
        print("✅ 腾讯云OCR SDK 已安装")
        return True
    except ImportError:
        print("⚠️  腾讯云OCR SDK 未安装")
        print("建议安装命令：")
        print("pip install tencentcloud-sdk-python")
        print("\n系统将以备用模式运行（不支持OCR功能）")
        return False

def start_service():
    """启动服务"""
    print("🚀 启动腾讯云OCR材料审核系统...")
    print("服务地址: http://localhost:8003")
    print("API文档: http://localhost:8003/docs")
    print("按 Ctrl+C 停止服务")
    print("-" * 50)
    
    # 获取当前脚本所在目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    tencent_ocr_main_path = os.path.join(current_dir, "tencent_ocr_main.py")
    
    try:
        # 使用完整路径启动腾讯云OCR服务
        print(f"启动路径: {tencent_ocr_main_path}")
        subprocess.run([sys.executable, tencent_ocr_main_path], cwd=current_dir, check=True)
    except KeyboardInterrupt:
        print("\n👋 服务已停止")
    except subprocess.CalledProcessError as e:
        print(f"❌ 服务启动失败: {e}")
    except FileNotFoundError:
        print(f"❌ 找不到 tencent_ocr_main.py 文件: {tencent_ocr_main_path}")

def main():
    print("🔧 腾讯云OCR材料审核系统启动检查...")
    
    # 检查依赖
    ocr_available = check_dependencies()
    
    if not ocr_available:
        print("⚠️  以备用模式启动（不支持OCR功能）...")
        print("如需完整功能，请手动安装腾讯云OCR SDK：")
        print("pip install tencentcloud-sdk-python")
        print()
    
    # 启动服务
    start_service()

if __name__ == "__main__":
    main()
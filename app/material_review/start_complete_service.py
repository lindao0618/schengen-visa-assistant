#!/usr/bin/env python3
"""
启动完整材料审核服务
"""

import os
import sys
import subprocess

def check_dependencies():
    """检查依赖"""
    print("🔧 检查依赖...")
    
    required_packages = [
        "fastapi",
        "uvicorn",
        "requests",
        "pillow",
        "pymupdf",
        "python-docx",
        "tencentcloud-sdk-python"
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            if package == "tencentcloud-sdk-python":
                import tencentcloud
            elif package == "pillow":
                import PIL
            elif package == "pymupdf":
                import fitz
            elif package == "python-docx":
                import docx
            else:
                __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package}")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n⚠️  缺少依赖包: {', '.join(missing_packages)}")
        print("安装命令:")
        for package in missing_packages:
            if package == "tencentcloud-sdk-python":
                print(f"pip install {package}")
            elif package == "pillow":
                print(f"pip install {package}")
            elif package == "pymupdf":
                print(f"pip install {package}")
            elif package == "python-docx":
                print(f"pip install {package}")
            else:
                print(f"pip install {package}")
        return False
    
    return True

def setup_tencent_config():
    """设置腾讯云配置"""
    from config import Config
    
    if Config.is_tencent_configured():
        print("✅ 腾讯云配置已存在")
        return True
    
    print("\n🔑 需要配置腾讯云API密钥")
    print("请访问: https://console.cloud.tencent.com/cam/capi")
    print("获取您的 SecretId 和 SecretKey")
    
    secret_id = input("\n请输入 SecretId: ").strip()
    secret_key = input("请输入 SecretKey: ").strip()
    
    if secret_id and secret_key:
        Config.save_to_file(secret_id, secret_key)
        print("✅ 腾讯云配置已保存")
        return True
    else:
        print("❌ 配置信息不完整")
        return False

def start_service():
    """启动服务"""
    print("\n🚀 启动完整材料审核服务...")
    print("服务地址: http://localhost:8003")
    print("流程: 文件 → 图片转换 → 腾讯云OCR → DeepSeek AI分析 → 返回结果")
    print("按 Ctrl+C 停止服务")
    print("-" * 60)
    
    try:
        subprocess.run([sys.executable, "complete_material_review.py"], check=True)
    except KeyboardInterrupt:
        print("\n👋 服务已停止")
    except subprocess.CalledProcessError as e:
        print(f"❌ 服务启动失败: {e}")

def main():
    print("=" * 60)
    print("🎯 完整材料审核系统启动器")
    print("=" * 60)
    
    # 检查依赖
    if not check_dependencies():
        print("\n❌ 依赖检查失败，请先安装缺少的包")
        return
    
    # 设置腾讯云配置
    if not setup_tencent_config():
        print("\n❌ 腾讯云配置失败")
        return
    
    # 启动服务
    start_service()

if __name__ == "__main__":
    main()























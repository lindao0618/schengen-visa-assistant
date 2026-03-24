#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
启动腾讯云OCR材料审核服务
"""

import os
import sys
import subprocess
from setup_tencent_env import check_environment, setup_environment

def check_dependencies():
    """检查依赖是否已安装"""
    required_packages = [
        "fastapi",
        "uvicorn",
        "python-multipart",
        "python-docx", 
        "Pillow",
        "PyMuPDF",
        "tencentcloud-sdk-python"
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print("❌ 缺少以下依赖包:")
        for package in missing_packages:
            print(f"  - {package}")
        print()
        print("请运行以下命令安装:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    
    print("✅ 所有依赖包已安装")
    return True

def start_service():
    """启动服务"""
    try:
        print("正在启动腾讯云OCR材料审核服务...")
        print("服务地址: http://localhost:8003")
        print("健康检查: http://localhost:8003/health")
        print("按 Ctrl+C 停止服务")
        print()
        
        # 启动FastAPI服务
        subprocess.run([
            sys.executable, "tencent_ocr_main.py"
        ], check=True)
        
    except KeyboardInterrupt:
        print("\n服务已停止")
    except subprocess.CalledProcessError as e:
        print(f"服务启动失败: {e}")
    except Exception as e:
        print(f"启动服务时发生错误: {e}")

def main():
    """主函数"""
    print("=== 腾讯云OCR材料审核服务启动器 ===")
    print()
    
    # 1. 检查依赖
    print("1. 检查依赖包...")
    if not check_dependencies():
        return
    
    # 2. 检查环境变量
    print("\n2. 检查环境变量...")
    if not check_environment():
        print("需要设置腾讯云API密钥...")
        if not setup_environment():
            return
    
    # 3. 启动服务
    print("\n3. 启动服务...")
    start_service()

if __name__ == "__main__":
    main()
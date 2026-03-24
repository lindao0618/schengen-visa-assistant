#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DS160脚本调试工具
诊断Python脚本执行失败的原因
"""

import sys
import os
import subprocess
import traceback

def check_python_version():
    """检查Python版本"""
    print("🐍 Python版本检查")
    print("=" * 50)
    print(f"Python版本: {sys.version}")
    print(f"Python路径: {sys.executable}")
    print(f"平台: {sys.platform}")
    print()

def check_dependencies():
    """检查依赖包"""
    print("📦 依赖包检查")
    print("=" * 50)
    
    required_packages = [
        'pandas',
        'playwright', 
        'requests',
        'pdf2image',
        'Pillow'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}: 已安装")
        except ImportError as e:
            print(f"❌ {package}: 未安装 - {e}")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n⚠️ 缺少的包: {', '.join(missing_packages)}")
        print("请运行: pip install -r requirements.txt")
    else:
        print("\n✅ 所有依赖包都已安装")
    print()

def check_file_permissions():
    """检查文件权限"""
    print("🔐 文件权限检查")
    print("=" * 50)
    
    current_dir = os.getcwd()
    print(f"当前工作目录: {current_dir}")
    
    # 检查关键文件
    key_files = [
        'ds160_server.py',
        'requirements.txt',
        'country_map.xlsx'
    ]
    
    for file in key_files:
        if os.path.exists(file):
            try:
                # 检查是否可读
                with open(file, 'r') as f:
                    f.read(1)
                print(f"✅ {file}: 可读")
                
                # 检查是否可执行（对于.py文件）
                if file.endswith('.py'):
                    if os.access(file, os.X_OK):
                        print(f"   ✅ {file}: 可执行")
                    else:
                        print(f"   ⚠️ {file}: 不可执行")
                        
            except Exception as e:
                print(f"❌ {file}: 权限问题 - {e}")
        else:
            print(f"❌ {file}: 文件不存在")
    print()

def test_imports():
    """测试导入"""
    print("🔍 导入测试")
    print("=" * 50)
    
    try:
        print("导入pandas...")
        import pandas as pd
        print("✅ pandas导入成功")
    except Exception as e:
        print(f"❌ pandas导入失败: {e}")
        traceback.print_exc()
    
    try:
        print("导入playwright...")
        from playwright.sync_api import sync_playwright
        print("✅ playwright导入成功")
    except Exception as e:
        print(f"❌ playwright导入失败: {e}")
        traceback.print_exc()
    
    try:
        print("导入pdf2image...")
        from pdf2image import convert_from_path
        print("✅ pdf2image导入成功")
    except Exception as e:
        print(f"❌ pdf2image导入失败: {e}")
        traceback.print_exc()
    
    try:
        print("导入Pillow...")
        from PIL import Image
        print("✅ Pillow导入成功")
    except Exception as e:
        print(f"❌ Pillow导入失败: {e}")
        traceback.print_exc()
    print()

def test_script_execution():
    """测试脚本执行"""
    print("🚀 脚本执行测试")
    print("=" * 50)
    
    script_path = 'ds160_server.py'
    
    if not os.path.exists(script_path):
        print(f"❌ 脚本文件不存在: {script_path}")
        return
    
    try:
        print(f"尝试执行脚本: {script_path}")
        
        # 使用subprocess执行脚本
        result = subprocess.run([
            sys.executable, script_path, '--help'
        ], capture_output=True, text=True, timeout=30)
        
        print(f"退出码: {result.returncode}")
        print(f"标准输出: {result.stdout}")
        print(f"标准错误: {result.stderr}")
        
        if result.returncode == 0:
            print("✅ 脚本执行成功")
        else:
            print("❌ 脚本执行失败")
            
    except subprocess.TimeoutExpired:
        print("❌ 脚本执行超时")
    except Exception as e:
        print(f"❌ 脚本执行异常: {e}")
        traceback.print_exc()
    print()

def check_environment():
    """检查环境变量"""
    print("🌍 环境变量检查")
    print("=" * 50)
    
    # 检查PATH
    path = os.environ.get('PATH', '')
    print(f"PATH: {path[:100]}...")
    
    # 检查PYTHONPATH
    pythonpath = os.environ.get('PYTHONPATH', '')
    if pythonpath:
        print(f"PYTHONPATH: {pythonpath}")
    else:
        print("PYTHONPATH: 未设置")
    
    # 检查工作目录
    print(f"当前工作目录: {os.getcwd()}")
    print(f"脚本目录: {os.path.dirname(os.path.abspath(__file__))}")
    print()

def main():
    """主函数"""
    print("🔧 DS160脚本调试工具")
    print("=" * 60)
    
    # 1. Python版本检查
    check_python_version()
    
    # 2. 依赖包检查
    check_dependencies()
    
    # 3. 文件权限检查
    check_file_permissions()
    
    # 4. 导入测试
    test_imports()
    
    # 5. 脚本执行测试
    test_script_execution()
    
    # 6. 环境检查
    check_environment()
    
    print("=" * 60)
    print("🎯 调试完成！")
    print("\n💡 如果发现问题，请根据上述信息进行修复")

if __name__ == "__main__":
    main()

























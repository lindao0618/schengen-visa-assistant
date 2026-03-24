#!/usr/bin/env python3
"""
留学生签证AI问答系统部署脚本
自动化部署和配置系统
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def print_step(step, message):
    """打印步骤信息"""
    print(f"\n{'='*50}")
    print(f"步骤 {step}: {message}")
    print('='*50)

def run_command(command, description=""):
    """运行命令并处理错误"""
    print(f"执行: {command}")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ 错误: {description}")
        print(f"命令: {command}")
        print(f"错误信息: {e.stderr}")
        return False

def check_python_version():
    """检查Python版本"""
    print_step(1, "检查Python版本")
    
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Python版本过低: {version.major}.{version.minor}")
        print("需要Python 3.8或更高版本")
        return False
    
    print(f"✅ Python版本: {version.major}.{version.minor}.{version.micro}")
    return True

def install_dependencies():
    """安装依赖包"""
    print_step(2, "安装依赖包")
    
    if not os.path.exists("requirements.txt"):
        print("❌ requirements.txt文件不存在")
        return False
    
    # 升级pip
    if not run_command(f"{sys.executable} -m pip install --upgrade pip", "升级pip"):
        return False
    
    # 安装依赖
    if not run_command(f"{sys.executable} -m pip install -r requirements.txt", "安装依赖包"):
        return False
    
    print("✅ 依赖包安装完成")
    return True

def setup_environment():
    """设置环境变量"""
    print_step(3, "设置环境变量")
    
    env_file = ".env"
    env_example = "env_example.txt"
    
    if os.path.exists(env_file):
        print(f"✅ 环境文件已存在: {env_file}")
        return True
    
    if os.path.exists(env_example):
        shutil.copy(env_example, env_file)
        print(f"✅ 已创建环境文件: {env_file}")
        print("⚠️ 请编辑 .env 文件，设置您的DeepSeek API密钥")
        return True
    else:
        # 创建基本的环境文件
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write("# DeepSeek API配置\n")
            f.write("DEEPSEEK_API_KEY=your_deepseek_api_key_here\n")
            f.write("\n# 服务器配置\n")
            f.write("HOST=0.0.0.0\n")
            f.write("PORT=8000\n")
            f.write("\n# 日志级别\n")
            f.write("LOG_LEVEL=INFO\n")
        
        print(f"✅ 已创建环境文件: {env_file}")
        print("⚠️ 请编辑 .env 文件，设置您的DeepSeek API密钥")
        return True

def create_directories():
    """创建必要的目录"""
    print_step(4, "创建目录结构")
    
    directories = ["static", "logs", "data"]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"✅ 目录已创建: {directory}")
    
    return True

def create_sample_data():
    """创建示例数据"""
    print_step(5, "创建示例数据")
    
    if os.path.exists("visa_faq_sample.xlsx"):
        print("✅ 示例FAQ文件已存在")
        return True
    
    try:
        # 运行示例数据创建脚本
        if os.path.exists("create_sample_data.py"):
            if run_command(f"{sys.executable} create_sample_data.py", "创建示例数据"):
                print("✅ 示例数据创建完成")
                return True
        
        # 如果脚本不存在，尝试直接创建
        from utils.excel_loader import create_sample_excel
        create_sample_excel()
        print("✅ 示例数据创建完成")
        return True
        
    except Exception as e:
        print(f"⚠️ 示例数据创建失败: {e}")
        print("系统仍可正常运行，但建议手动创建FAQ数据")
        return True

def test_system():
    """测试系统"""
    print_step(6, "测试系统")
    
    if os.path.exists("test_system.py"):
        print("运行系统测试...")
        if run_command(f"{sys.executable} test_system.py", "系统测试"):
            print("✅ 系统测试通过")
            return True
        else:
            print("⚠️ 系统测试失败，请检查配置")
            return False
    else:
        print("⚠️ 测试脚本不存在，跳过测试")
        return True

def create_startup_scripts():
    """创建启动脚本"""
    print_step(7, "创建启动脚本")
    
    # Windows批处理文件
    with open("start.bat", 'w', encoding='utf-8') as f:
        f.write("@echo off\n")
        f.write("echo 启动留学生签证AI问答系统...\n")
        f.write("python start_server.py\n")
        f.write("pause\n")
    
    # Linux/Mac shell脚本
    with open("start.sh", 'w', encoding='utf-8') as f:
        f.write("#!/bin/bash\n")
        f.write("echo '启动留学生签证AI问答系统...'\n")
        f.write("python3 start_server.py\n")
    
    # 设置执行权限（Linux/Mac）
    try:
        os.chmod("start.sh", 0o755)
    except:
        pass
    
    print("✅ 启动脚本已创建:")
    print("  - Windows: start.bat")
    print("  - Linux/Mac: start.sh")
    
    return True

def show_next_steps():
    """显示后续步骤"""
    print_step(8, "部署完成")
    
    print("🎉 系统部署完成！")
    print("\n📋 后续步骤:")
    print("1. 编辑 .env 文件，设置您的DeepSeek API密钥")
    print("2. 运行测试: python test_system.py")
    print("3. 启动服务:")
    print("   - API服务器: python start_server.py")
    print("   - 命令行聊天: python main_chat.py")
    print("   - 或使用启动脚本: start.bat (Windows) 或 ./start.sh (Linux/Mac)")
    print("\n🌐 访问地址:")
    print("- Web界面: http://localhost:8000")
    print("- API文档: http://localhost:8000/docs")
    print("- 健康检查: http://localhost:8000/health")
    
    print("\n📚 更多信息请查看 README.md 文件")

def main():
    """主部署函数"""
    print("🚀 留学生签证AI问答系统部署脚本")
    print("=" * 50)
    
    steps = [
        check_python_version,
        install_dependencies,
        setup_environment,
        create_directories,
        create_sample_data,
        test_system,
        create_startup_scripts
    ]
    
    for i, step in enumerate(steps, 1):
        if not step():
            print(f"\n❌ 部署在步骤 {i} 失败")
            print("请检查错误信息并重新运行部署脚本")
            return False
    
    show_next_steps()
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ 部署被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 部署过程中出现未预期的错误: {e}")
        sys.exit(1) 
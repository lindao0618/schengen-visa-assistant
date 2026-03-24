#!/usr/bin/env python3
"""
留学生签证AI问答系统启动脚本
"""

import os
import sys
import uvicorn
from dotenv import load_dotenv

def main():
    """启动服务器"""
    # 加载环境变量
    load_dotenv()
    
    # 检查API密钥
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        print("❌ 错误：未设置DEEPSEEK_API_KEY环境变量")
        print("请先运行 python set_api_key.py 设置API密钥")
        sys.exit(1)
    
    # 获取配置
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    print("🚀 启动留学生签证AI问答系统...")
    print(f"📡 服务地址: http://{host}:{port}")
    print(f"📚 API文档: http://{host}:{port}/docs")
    print(f"🔧 交互式文档: http://{host}:{port}/redoc")
    print("按 Ctrl+C 停止服务器")
    print("-" * 50)
    
    try:
        # 启动服务器
        uvicorn.run(
            "main_api:app",
            host=host,
            port=port,
            log_level=log_level,
            reload=True,  # 开发模式下自动重载
            access_log=True
        )
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 
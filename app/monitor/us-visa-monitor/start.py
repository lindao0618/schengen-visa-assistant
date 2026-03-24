#!/usr/bin/env python3
"""
美签监控启动脚本
同时启动WebSocket监控和API服务
"""

import asyncio
import subprocess
import sys
import os
import time
from datetime import datetime

def start_api_server():
    """启动API服务器"""
    print("🚀 启动美签监控API服务器...")
    try:
        # 获取当前脚本所在目录
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 启动API服务器意思
        api_process = subprocess.Popen([
            sys.executable, "api.py"
        ], cwd=script_dir)
        
        print(f"✅ API服务器已启动 (PID: {api_process.pid})")
        print("🌐 API地址: http://localhost:8005")
        print("📖 API文档: http://localhost:8005/docs")
        
        return api_process
        
    except Exception as e:
        print(f"❌ 启动API服务器失败: {e}")
        return None

def start_monitor():
    """启动WebSocket监控"""
    print("🔌 启动美签WebSocket监控...")
    try:
        # 获取当前脚本所在目录
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 启动监控程序
        monitor_process = subprocess.Popen([
            sys.executable, "main.py"
        ], cwd=script_dir)
        
        print(f"✅ WebSocket监控已启动 (PID: {monitor_process.pid})")
        print("🔗 WebSocket URL: wss://us-ais.vis.lol/api/slots")
        
        return monitor_process
        
    except Exception as e:
        print(f"❌ 启动WebSocket监控失败: {e}")
        return None

def main():
    """主函数"""
    print("=" * 60)
    print("🇺🇸 美签监控系统启动")
    print("=" * 60)
    print(f"⏰ 启动时间: {datetime.now()}")
    print("📁 工作目录:", os.getcwd())
    print("=" * 60)
    
    # 检查依赖
    try:
        import websockets
        import fastapi
        import uvicorn
        print("✅ 依赖检查通过")
    except ImportError as e:
        print(f"❌ 缺少依赖: {e}")
        print("💡 请运行: pip install websockets fastapi uvicorn")
        return
    
    # 启动API服务器
    api_process = start_api_server()
    if not api_process:
        return
    
    # 等待API服务器启动
    print("⏳ 等待API服务器启动...")
    time.sleep(3)
    
    # 启动WebSocket监控
    monitor_process = start_monitor()
    if not monitor_process:
        print("❌ 启动WebSocket监控失败，停止API服务器")
        api_process.terminate()
        return
    
    print("\n" + "=" * 60)
    print("🎉 美签监控系统启动完成！")
    print("=" * 60)
    print("📊 监控状态:")
    print("  - API服务器: 运行中 (端口 8005)")
    print("  - WebSocket监控: 运行中")
    print("  - 日志文件: us_visa_monitor.log")
    print("=" * 60)
    print("💡 使用说明:")
    print("  - 访问 http://localhost:8005/docs 查看API文档")
    print("  - 访问 http://localhost:8005/status 查看监控状态")
    print("  - 按 Ctrl+C 停止所有服务")
    print("=" * 60)
    
    try:
        # 等待进程结束
        while True:
            if api_process.poll() is not None:
                print("❌ API服务器已停止")
                break
            if monitor_process.poll() is not None:
                print("❌ WebSocket监控已停止")
                break
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n⏹️ 收到停止信号，正在关闭服务...")
        
        # 停止API服务器
        if api_process and api_process.poll() is None:
            print("🛑 停止API服务器...")
            api_process.terminate()
            api_process.wait()
        
        # 停止WebSocket监控
        if monitor_process and monitor_process.poll() is None:
            print("🛑 停止WebSocket监控...")
            monitor_process.terminate()
            monitor_process.wait()
        
        print("✅ 所有服务已停止")

if __name__ == "__main__":
    main()

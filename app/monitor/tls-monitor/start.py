#!/usr/bin/env python3
"""
TLS法签监控启动脚本
启动监控主程序和API服务
"""

import subprocess
import sys
import os
import time
import signal
import logging
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 进程管理
processes = []

def signal_handler(signum, frame):
    """信号处理器"""
    logger.info(f"收到信号 {signum}，正在关闭所有进程...")
    stop_all_processes()
    sys.exit(0)

def start_monitor_main():
    """启动监控主程序"""
    try:
        logger.info("🚀 启动TLS监控主程序...")
        
        # 切换到脚本所在目录
        script_dir = Path(__file__).parent
        os.chdir(script_dir)
        
        # 启动监控主程序
        cmd = [sys.executable, "main.py"]
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        processes.append(("监控主程序", process))
        logger.info(f"✅ 监控主程序已启动，PID: {process.pid}")
        
        return process
        
    except Exception as e:
        logger.error(f"❌ 启动监控主程序失败: {e}")
        return None

def start_api_server():
    """启动API服务器"""
    try:
        logger.info("🚀 启动TLS监控API服务器...")
        
        # 切换到脚本所在目录
        script_dir = Path(__file__).parent
        os.chdir(script_dir)
        
        # 启动API服务器
        cmd = [sys.executable, "api.py"]
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        processes.append(("API服务器", process))
        logger.info(f"✅ API服务器已启动，PID: {process.pid}")
        
        return process
        
    except Exception as e:
        logger.error(f"❌ 启动API服务器失败: {e}")
        return None

def check_process_health(process, name):
    """检查进程健康状态"""
    if process.poll() is None:
        return True
    else:
        logger.warning(f"⚠️ {name} 进程已退出，退出码: {process.returncode}")
        return False

def monitor_processes():
    """监控所有进程"""
    logger.info("🔍 开始监控进程状态...")
    
    while True:
        all_healthy = True
        
        for name, process in processes:
            if not check_process_health(process, name):
                all_healthy = False
                # 移除已退出的进程
                processes.remove((name, process))
        
        if not all_healthy:
            logger.warning("⚠️ 检测到进程异常，尝试重启...")
            # 这里可以添加重启逻辑
        
        time.sleep(5)

def stop_all_processes():
    """停止所有进程"""
    logger.info("🛑 正在停止所有进程...")
    
    for name, process in processes:
        try:
            logger.info(f"🛑 停止 {name} (PID: {process.pid})...")
            process.terminate()
            
            # 等待进程结束
            try:
                process.wait(timeout=10)
                logger.info(f"✅ {name} 已正常停止")
            except subprocess.TimeoutExpired:
                logger.warning(f"⚠️ {name} 未在10秒内停止，强制终止")
                process.kill()
                process.wait()
                logger.info(f"✅ {name} 已强制停止")
                
        except Exception as e:
            logger.error(f"❌ 停止 {name} 时出错: {e}")

def main():
    """主函数"""
    logger.info("🚀 TLS法签监控系统启动脚本")
    
    # 注册信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # 启动监控主程序
        monitor_process = start_monitor_main()
        if not monitor_process:
            logger.error("❌ 监控主程序启动失败")
            return
        
        # 等待一下让监控程序初始化
        time.sleep(3)
        
        # 启动API服务器
        api_process = start_api_server()
        if not api_process:
            logger.error("❌ API服务器启动失败")
            return
        
        # 等待一下让API服务器初始化
        time.sleep(3)
        
        logger.info("✅ 所有服务已启动")
        logger.info("📋 服务信息:")
        logger.info("  - 监控主程序: 运行中")
        logger.info("  - API服务器: http://localhost:8004")
        logger.info("  - 监控状态: http://localhost:8004/status")
        logger.info("  - 健康检查: http://localhost:8004/health")
        logger.info("")
        logger.info("按 Ctrl+C 停止所有服务")
        
        # 开始监控进程
        monitor_processes()
        
    except KeyboardInterrupt:
        logger.info("🛑 收到中断信号")
    except Exception as e:
        logger.error(f"❌ 启动过程中出错: {e}")
    finally:
        stop_all_processes()
        logger.info("✅ 所有服务已停止")

if __name__ == "__main__":
    main()




























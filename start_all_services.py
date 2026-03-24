#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
签证助手系统 - 统一启动脚本
一键启动所有服务：TLS监控、AI助手、美签填表、材料定制API等
"""

import subprocess
import sys
import os
import time
import signal
import threading
from pathlib import Path
import psutil
import json
from typing import List, Dict

# 设置控制台编码为UTF-8
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

class ServiceManager:
    def __init__(self):
        self.services = []
        self.running = True
        self.base_dir = Path(__file__).parent.absolute()
        
        # 服务配置
        self.service_configs = {
            "frontend": {
                "name": "Next.js前端服务",
                "command": ["cmd", "/c", "npm", "run", "dev"],
                "cwd": str(self.base_dir),
                "port": 3001,
                "health_check": "http://localhost:3001",
                "startup_delay": 5,
                "color": "\033[96m"  # 青色
            },
            "tls_monitor": {
                "name": "TLS监控服务",
                "command": [sys.executable, "app/tls-monitor/main.py"],
                "cwd": str(self.base_dir),
                "port": 8004,
                "health_check": "http://localhost:8004/health",
                "startup_delay": 3,
                "color": "\033[92m"  # 绿色
            },
            "ai_assistant": {
                "name": "AI助手服务",
                "command": [sys.executable, "VISA-ASK-SYSTEM/main_api.py"],
                "cwd": str(self.base_dir),
                "port": 8000,
                "health_check": "http://localhost:8000/health",
                "startup_delay": 8,
                "color": "\033[94m"  # 蓝色
            },
            "material_review": {
                "name": "材料审核服务",
                "command": [sys.executable, "app/material_review/main.py"],
                "cwd": str(self.base_dir),
                "port": 8003,
                "health_check": "http://localhost:8003/health",
                "startup_delay": 3,
                "color": "\033[93m"  # 黄色
            },
            "itinerary_generator": {
                "name": "行程单生成服务",
                "command": [sys.executable, "services/itinerary-generator/itinerary_generator.py"],
                "cwd": str(self.base_dir),
                "port": None,  # 命令行工具，无端口
                "health_check": None,
                "startup_delay": 1,
                "color": "\033[95m"  # 紫色
            }
        }
    
    def print_banner(self):
        """打印启动横幅"""
        banner = """
╔══════════════════════════════════════════════════════════════╗
║                    签证助手系统 - 统一启动器                    ║
║                                                              ║
║  🌐 Next.js前端服务     (端口: 3001)                          ║
║  🔍 TLS监控服务        (端口: 8004)                          ║
║  🤖 AI助手服务         (端口: 8000)                          ║
║  📋 材料审核服务       (端口: 8003)                          ║
║  📄 行程单生成服务     (集成服务)                             ║
║                                                              ║
║  按 Ctrl+C 停止所有服务                                       ║
╚══════════════════════════════════════════════════════════════╝
        """
        print(banner)
    
    def check_port(self, port: int) -> bool:
        """检查端口是否被占用"""
        try:
            for conn in psutil.net_connections():
                if conn.laddr.port == port:
                    return True
            return False
        except:
            return False
    
    def kill_port(self, port: int):
        """杀死占用指定端口的进程"""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'connections']):
                try:
                    for conn in proc.info['connections'] or []:
                        if conn.laddr.port == port:
                            print(f"🔪 杀死占用端口 {port} 的进程: PID {proc.info['pid']} ({proc.info['name']})")
                            proc.terminate()
                            time.sleep(1)
                            if proc.is_running():
                                proc.kill()
                            return True
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            return False
        except Exception as e:
            print(f"❌ 清理端口 {port} 时出错: {e}")
            return False
    
    def start_service(self, service_name: str, config: Dict):
        """启动单个服务"""
        color = config.get("color", "\033[97m")
        reset = "\033[0m"
        
        print(f"{color}🚀 启动 {config['name']}...{reset}")
        
        # 检查并清理端口
        if config.get("port") and self.check_port(config["port"]):
            print(f"⚠️  端口 {config['port']} 已被占用，正在清理...")
            self.kill_port(config["port"])
            time.sleep(2)
        
        try:
            # 设置环境变量
            env = os.environ.copy()
            if service_name == "frontend":
                env["PORT"] = "3001"
                env["NEXT_TELEMETRY_DISABLED"] = "1"
            
            # 启动进程
            process = subprocess.Popen(
                config["command"],
                cwd=config["cwd"],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            self.services.append({
                "name": service_name,
                "config": config,
                "process": process,
                "started": time.time()
            })
            
            print(f"{color}✅ {config['name']} 已启动 (PID: {process.pid}){reset}")
            
            # 启动输出监控线程
            threading.Thread(
                target=self.monitor_service_output,
                args=(service_name, process, color, reset),
                daemon=True
            ).start()
            
            # 等待服务启动
            if config.get("startup_delay"):
                time.sleep(config["startup_delay"])
            
        except Exception as e:
            print(f"❌ 启动 {config['name']} 失败: {e}")
    
    def monitor_service_output(self, service_name: str, process, color: str, reset: str):
        """监控服务输出"""
        try:
            for line in process.stdout:
                if self.running:
                    # 过滤掉一些噪音日志
                    if any(skip in line.lower() for skip in ["compiled successfully", "webpack", "hot reload"]):
                        continue
                    print(f"{color}[{service_name.upper()}]{reset} {line.strip()}")
        except:
            pass
    
    def check_service_health(self, service_name: str, config: Dict) -> bool:
        """检查服务健康状态"""
        if not config.get("health_check"):
            return True
        
        try:
            import requests
            response = requests.get(config["health_check"], timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def start_all_services(self):
        """启动所有服务"""
        self.print_banner()
        
        print("🔧 正在检查系统环境...")
        
        # 检查必要的依赖
        dependencies = {
            "node": "Node.js (前端服务)",
            "npm": "NPM (包管理器)",
            "python": "Python (后端服务)"
        }
        
        for cmd, desc in dependencies.items():
            try:
                result = subprocess.run([cmd, "--version"], capture_output=True, text=True)
                if result.returncode == 0:
                    version = result.stdout.strip().split('\n')[0]
                    print(f"✅ {desc}: {version}")
                else:
                    print(f"❌ {desc}: 未安装")
            except FileNotFoundError:
                print(f"❌ {desc}: 未找到")
        
        print("\n" + "="*60)
        print("🚀 开始启动所有服务...")
        print("="*60)
        
        # 按顺序启动服务
        service_order = ["ai_assistant", "material_review", "tls_monitor", "frontend"]
        
        for service_name in service_order:
            if service_name in self.service_configs:
                self.start_service(service_name, self.service_configs[service_name])
                time.sleep(1)  # 服务间启动间隔
        
        print("\n" + "="*60)
        print("🎉 所有服务启动完成！")
        print("="*60)
        
        # 显示服务状态
        self.show_service_status()
        
        print("\n📋 服务访问地址:")
        print("   🌐 前端界面: http://localhost:3001")
        print("   🤖 AI助手API: http://localhost:8000")
        print("   📋 材料审核API: http://localhost:8003")
        print("   🔍 TLS监控API: http://localhost:8004")
        print("\n💡 提示: 按 Ctrl+C 停止所有服务")
        
        # 保持运行并监控服务
        self.monitor_services()
    
    def show_service_status(self):
        """显示服务状态"""
        print("\n📊 服务状态:")
        for service in self.services:
            name = service["config"]["name"]
            process = service["process"]
            port = service["config"].get("port")
            
            if process.poll() is None:  # 进程仍在运行
                status = "🟢 运行中"
                if port:
                    status += f" (端口: {port})"
            else:
                status = "🔴 已停止"
            
            print(f"   {name}: {status}")
    
    def monitor_services(self):
        """监控服务状态"""
        try:
            while self.running:
                time.sleep(10)  # 每10秒检查一次
                
                # 检查服务是否还在运行
                for service in self.services[:]:  # 使用切片复制避免修改时出错
                    if service["process"].poll() is not None:  # 进程已结束
                        name = service["config"]["name"]
                        print(f"⚠️  {name} 意外停止，正在重启...")
                        self.services.remove(service)
                        time.sleep(2)
                        self.start_service(service["name"], service["config"])
                
        except KeyboardInterrupt:
            self.stop_all_services()
    
    def stop_all_services(self):
        """停止所有服务"""
        print("\n🛑 正在停止所有服务...")
        self.running = False
        
        for service in self.services:
            try:
                name = service["config"]["name"]
                process = service["process"]
                
                print(f"🔄 停止 {name}...")
                process.terminate()
                
                # 等待进程优雅退出
                try:
                    process.wait(timeout=5)
                    print(f"✅ {name} 已停止")
                except subprocess.TimeoutExpired:
                    print(f"⚠️  强制停止 {name}...")
                    process.kill()
                    process.wait()
                    print(f"✅ {name} 已强制停止")
                    
            except Exception as e:
                print(f"❌ 停止服务时出错: {e}")
        
        print("🎯 所有服务已停止")
        sys.exit(0)

def main():
    """主函数"""
    try:
        # 检查是否在正确的目录中运行
        if not os.path.exists("package.json"):
            print("❌ 请在项目根目录中运行此脚本")
            sys.exit(1)
        
        manager = ServiceManager()
        
        # 设置信号处理
        def signal_handler(signum, frame):
            manager.stop_all_services()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # 启动所有服务
        manager.start_all_services()
        
    except KeyboardInterrupt:
        print("\n👋 用户中断，正在退出...")
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

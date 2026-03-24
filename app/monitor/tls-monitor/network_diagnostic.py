#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
网络连接诊断工具
检查DNS、网络连接、防火墙等问题
"""

import socket
import subprocess
import requests
import ssl
import time
import json
from urllib.parse import urlparse

# 目标服务器信息
TARGET_HOST = "tls.vis.lol"
TARGET_PORT = 443
WEBSOCKET_URL = "wss://tls.vis.lol/api/slots"

def check_dns_resolution():
    """检查DNS解析"""
    print("🔍 检查DNS解析")
    print("=" * 60)
    
    try:
        # 获取IP地址
        ip_address = socket.gethostbyname(TARGET_HOST)
        print(f"✅ DNS解析成功: {TARGET_HOST} -> {ip_address}")
        
        # 反向DNS查询
        try:
            hostname = socket.gethostbyaddr(ip_address)[0]
            print(f"✅ 反向DNS: {ip_address} -> {hostname}")
        except socket.herror:
            print(f"⚠️ 反向DNS查询失败: {ip_address}")
        
        return ip_address
    except socket.gaierror as e:
        print(f"❌ DNS解析失败: {e}")
        return None

def check_tcp_connection(host, port):
    """检查TCP连接"""
    print(f"\n🔌 检查TCP连接: {host}:{port}")
    print("=" * 60)
    
    try:
        # 创建socket连接
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        
        print(f"🔄 尝试连接到 {host}:{port}...")
        result = sock.connect_ex((host, port))
        
        if result == 0:
            print(f"✅ TCP连接成功: {host}:{port}")
            
            # 获取连接信息
            local_addr = sock.getsockname()
            print(f"   本地地址: {local_addr[0]}:{local_addr[1]}")
            
            # 检查SSL/TLS支持
            try:
                context = ssl.create_default_context()
                with context.wrap_socket(sock, server_hostname=host) as ssock:
                    print(f"✅ SSL/TLS握手成功")
                    print(f"   协议版本: {ssock.version()}")
                    print(f"   加密套件: {ssock.cipher()[0]}")
            except Exception as e:
                print(f"⚠️ SSL/TLS握手失败: {e}")
            
            return True
        else:
            print(f"❌ TCP连接失败: 错误代码 {result}")
            return False
            
    except Exception as e:
        print(f"❌ 连接异常: {e}")
        return False
    finally:
        try:
            sock.close()
        except:
            pass

def check_http_connectivity():
    """检查HTTP连接性"""
    print(f"\n🌐 检查HTTP连接性")
    print("=" * 60)
    
    try:
        # 尝试HTTP请求
        response = requests.get(f"https://{TARGET_HOST}", timeout=10, verify=True)
        print(f"✅ HTTP连接成功: 状态码 {response.status_code}")
        print(f"   服务器: {response.headers.get('Server', 'Unknown')}")
        print(f"   内容类型: {response.headers.get('Content-Type', 'Unknown')}")
        return True
    except requests.exceptions.SSLError as e:
        print(f"❌ SSL证书问题: {e}")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"❌ 连接错误: {e}")
        return False
    except requests.exceptions.Timeout as e:
        print(f"❌ 连接超时: {e}")
        return False
    except Exception as e:
        print(f"❌ HTTP请求异常: {e}")
        return False

def check_websocket_handshake():
    """检查WebSocket握手"""
    print(f"\n🤝 检查WebSocket握手")
    print("=" * 60)
    
    try:
        # 创建WebSocket握手请求
        import websocket
        
        # 测试WebSocket连接（不保持连接）
        ws = websocket.create_connection(
            WEBSOCKET_URL,
            header=[
                "x-vis-lol-token: 9513a9ba-c388-4d5d-8ed5-408c0d5ec658",
                "X-Vis-Lol-Api: tls",
                "User-Agent: PythonWebSocket/1.0"
            ],
            timeout=10
        )
        
        print("✅ WebSocket握手成功")
        print(f"   协议: {ws.protocol}")
        print(f"   状态: {ws.status}")
        
        # 立即关闭连接
        ws.close()
        return True
        
    except websocket.WebSocketBadStatusException as e:
        print(f"❌ WebSocket握手失败 - 状态码: {e}")
        return False
    except websocket.WebSocketTimeoutException as e:
        print(f"❌ WebSocket握手超时: {e}")
        return False
    except Exception as e:
        print(f"❌ WebSocket握手异常: {e}")
        return False

def check_network_route():
    """检查网络路由"""
    print(f"\n🛣️ 检查网络路由")
    print("=" * 60)
    
    try:
        # 使用tracert (Windows) 或 traceroute (Linux/Mac)
        if subprocess.run(['where', 'tracert'], capture_output=True).returncode == 0:
            cmd = ['tracert', '-d', '-h', '15', TARGET_HOST]
        else:
            cmd = ['traceroute', '-n', '-m', '15', TARGET_HOST]
        
        print(f"🔄 执行路由跟踪: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ 路由跟踪完成:")
            lines = result.stdout.strip().split('\n')
            for line in lines[-5:]:  # 显示最后5行
                if line.strip():
                    print(f"   {line.strip()}")
        else:
            print(f"❌ 路由跟踪失败: {result.stderr}")
            
    except subprocess.TimeoutExpired:
        print("❌ 路由跟踪超时")
    except Exception as e:
        print(f"❌ 路由跟踪异常: {e}")

def check_firewall_proxy():
    """检查防火墙和代理设置"""
    print(f"\n🔥 检查防火墙和代理设置")
    print("=" * 60)
    
    # 检查环境变量中的代理设置
    proxy_vars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
    for var in proxy_vars:
        value = os.environ.get(var)
        if value:
            print(f"⚠️ 发现代理设置: {var}={value}")
        else:
            print(f"✅ 无代理设置: {var}")
    
    # 检查Windows防火墙状态
    try:
        result = subprocess.run(['netsh', 'advfirewall', 'show', 'allprofiles'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("✅ 防火墙状态检查完成")
            # 可以进一步解析防火墙状态
        else:
            print(f"⚠️ 防火墙状态检查失败: {result.stderr}")
    except Exception as e:
        print(f"⚠️ 防火墙检查异常: {e}")

def check_network_interface():
    """检查网络接口"""
    print(f"\n🌐 检查网络接口")
    print("=" * 60)
    
    try:
        # 获取本机IP地址
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        print(f"✅ 本机信息:")
        print(f"   主机名: {hostname}")
        print(f"   本地IP: {local_ip}")
        
        # 获取所有网络接口
        interfaces = socket.getaddrinfo(hostname, None)
        print(f"   网络接口数量: {len(interfaces)}")
        
        for i, (family, type, proto, canonname, sockaddr) in enumerate(interfaces[:3]):
            if family == socket.AF_INET:  # IPv4
                print(f"   接口 {i+1}: {sockaddr[0]}")
                
    except Exception as e:
        print(f"❌ 网络接口检查异常: {e}")

def main():
    """主诊断函数"""
    print("🔧 TLS监控系统网络诊断工具")
    print("=" * 60)
    
    # 1. DNS解析检查
    ip_address = check_dns_resolution()
    
    if ip_address:
        # 2. TCP连接检查
        tcp_success = check_tcp_connection(ip_address, TARGET_PORT)
        
        # 3. HTTP连接性检查
        http_success = check_http_connectivity()
        
        # 4. WebSocket握手检查
        ws_success = check_websocket_handshake()
        
        # 5. 网络路由检查
        check_network_route()
        
        # 6. 防火墙和代理检查
        check_firewall_proxy()
        
        # 7. 网络接口检查
        check_network_interface()
        
        # 总结
        print("\n" + "=" * 60)
        print("🎯 诊断总结:")
        print(f"   DNS解析: {'✅ 成功' if ip_address else '❌ 失败'}")
        print(f"   TCP连接: {'✅ 成功' if tcp_success else '❌ 失败'}")
        print(f"   HTTP连接: {'✅ 成功' if http_success else '❌ 失败'}")
        print(f"   WebSocket握手: {'✅ 成功' if ws_success else '❌ 失败'}")
        
        print("\n💡 问题分析:")
        if not tcp_success:
            print("   - TCP连接失败，可能是防火墙或网络问题")
        if not http_success:
            print("   - HTTP连接失败，可能是SSL证书或代理问题")
        if not ws_success:
            print("   - WebSocket握手失败，可能是协议或认证问题")
            
        print("\n🔧 建议解决方案:")
        if not tcp_success:
            print("   1. 检查防火墙设置")
            print("   2. 检查网络代理配置")
            print("   3. 联系网络管理员")
        if not ws_success:
            print("   1. 验证WebSocket协议支持")
            print("   2. 检查认证头信息")
            print("   3. 尝试不同的User-Agent")
    else:
        print("❌ DNS解析失败，无法进行后续检查")
        print("💡 建议检查网络连接和DNS设置")

if __name__ == "__main__":
    import os
    main()

























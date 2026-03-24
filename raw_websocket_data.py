#!/usr/bin/env python3
"""
原始WebSocket数据查看器
直接显示接收到的原始数据，不做任何处理
"""

import asyncio
import websockets

async def view_raw_data():
    """查看原始WebSocket数据"""
    websocket_url = "wss://tls.vis.lol/api/slots"
    token = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"
    headers = [("x-vis-lol-token", token)]
    
    print("🔌 连接WebSocket查看原始数据")
    print(f"🌐 URL: {websocket_url}")
    print(f"🔑 Token: {token}")
    print("=" * 50)
    
    try:
        async with websockets.connect(websocket_url, extra_headers=headers) as ws:
            print("✅ 连接成功！")
            print("📡 等待数据...")
            print("💡 按 Ctrl+C 停止")
            print("-" * 50)
            
            message_count = 0
            
            async for message in ws:
                message_count += 1
                print(f"\n📨 消息 #{message_count}")
                print(f"📏 长度: {len(message)} 字节")
                print(f"📄 原始数据:")
                print("-" * 30)
                print(message)
                print("-" * 30)
                
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ 认证失败: {e}")
        print("🔑 Token可能已过期")
    except Exception as e:
        print(f"❌ 连接错误: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(view_raw_data())
    except KeyboardInterrupt:
        print("\n⏹️ 停止")

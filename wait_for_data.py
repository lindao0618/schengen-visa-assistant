#!/usr/bin/env python3
import asyncio
import websockets

async def wait_for_data():
    websocket_url = "wss://tls.vis.lol/api/slots"
    token = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"
    headers = [("x-vis-lol-token", token)]
    
    print("连接WebSocket...")
    
    try:
        async with websockets.connect(
            websocket_url, 
            extra_headers=headers,
            ping_interval=None,
            ping_timeout=None
        ) as ws:
            print("连接成功，等待数据...")
            print("按Ctrl+C停止")
            
            message_count = 0
            
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=300)  # 5分钟超时
                    message_count += 1
                    print(f"\n=== 消息 #{message_count} ===")
                    print(message)
                    print("=" * 50)
                    
                except asyncio.TimeoutError:
                    print("5分钟无数据，继续等待...")
                    
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(wait_for_data())
    except KeyboardInterrupt:
        print("\n停止")

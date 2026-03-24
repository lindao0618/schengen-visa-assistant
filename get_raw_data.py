#!/usr/bin/env python3
import asyncio
import websockets

async def get_raw_data():
    websocket_url = "wss://tls.vis.lol/api/slots"
    token = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"
    headers = [("x-vis-lol-token", token)]
    
    print("连接WebSocket...")
    
    try:
        async with websockets.connect(websocket_url, extra_headers=headers) as ws:
            print("连接成功，等待数据...")
            
            async for message in ws:
                print("收到数据:")
                print(message)
                print("-" * 50)
                
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    asyncio.run(get_raw_data())

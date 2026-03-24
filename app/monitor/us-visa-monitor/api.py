#!/usr/bin/env python3
"""
美签监控API服务
提供REST API接口，支持前端数据对接
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
import asyncio
from datetime import datetime
import uvicorn

app = FastAPI(title="US Visa Monitor API", version="1.0.0")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量存储监控状态
monitor_status = {
    "is_running": False,
    "start_time": None,
    "message_count": 0,
    "slot_count": 0,
    "matched_slots": [],
    "last_activity": None,
    "config": {},
    "submitted_data": {},  # 存储前端提交的原始数据
    "data_history": []     # 存储数据提交历史
}

# WebSocket连接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # 移除断开的连接
                self.active_connections.remove(connection)

manager = ConnectionManager()

class MonitorConfig(BaseModel):
    allowed_cities: List[str]
    allowed_visa_types: List[str]
    date_ranges: List[Dict[str, str]]

class MonitorRequest(BaseModel):
    action: str
    config: Optional[MonitorConfig] = None

@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "US Visa Monitor API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/status")
async def get_status():
    """获取监控状态"""
    try:
        # 尝试加载配置
        config = load_config()
        has_config = True
    except FileNotFoundError:
        config = {}
        has_config = False
    
    return {
        "is_running": monitor_status["is_running"],
        "start_time": monitor_status["start_time"],
        "message_count": monitor_status["message_count"],
        "slot_count": monitor_status["slot_count"],
        "matched_slots_count": len(monitor_status["matched_slots"]),
        "last_activity": monitor_status["last_activity"],
        "config": config,
        "has_config": has_config,
        "message": "请从前端页面启动监控" if not has_config else "监控系统就绪"
    }

@app.post("/monitor/start")
async def start_monitor(request: MonitorRequest):
    """启动监控"""
    try:
        if request.config:
            # 更新配置
            config = load_config()
            if request.config.allowed_cities:
                config["allowed_cities"] = request.config.allowed_cities
            if request.config.allowed_visa_types:
                config["allowed_visa_types"] = request.config.allowed_visa_types
            if request.config.date_ranges:
                config["date_ranges"] = request.config.date_ranges
            
            save_config(config)
            monitor_status["config"] = config
        
        monitor_status["is_running"] = True
        monitor_status["start_time"] = datetime.now().isoformat()
        monitor_status["last_activity"] = datetime.now().isoformat()
        
        return {
            "success": True,
            "message": "美签监控已启动",
            "status": monitor_status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动监控失败: {str(e)}")

@app.post("/monitor/stop")
async def stop_monitor():
    """停止监控"""
    try:
        monitor_status["is_running"] = False
        
        return {
            "success": True,
            "message": "美签监控已停止",
            "status": monitor_status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"停止监控失败: {str(e)}")

@app.get("/config")
async def get_config():
    """获取当前配置"""
    try:
        config = load_config()
        return {
            "success": True,
            "config": config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")

@app.post("/config")
async def update_config(config: MonitorConfig):
    """更新配置"""
    try:
        current_config = load_config()
        
        if config.allowed_cities:
            current_config["allowed_cities"] = config.allowed_cities
        if config.allowed_visa_types:
            current_config["allowed_visa_types"] = config.allowed_visa_types
        if config.date_ranges:
            current_config["date_ranges"] = config.date_ranges
        
        save_config(current_config)
        monitor_status["config"] = current_config
        
        return {
            "success": True,
            "message": "配置已更新",
            "config": current_config
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")

@app.post("/config/update")
async def update_config_from_frontend(request: dict):
    """从前端接收配置并更新监控参数"""
    try:
        # 解析前端数据
        selected_countries = request.get("selectedCountries", [])
        selected_visa_types = request.get("selectedVisaTypes", [])
        time_ranges = request.get("timeRanges", [])
        
        # 记录提交的原始数据
        submitted_data = {
            "timestamp": datetime.now().isoformat(),
            "selectedCountries": selected_countries,
            "selectedVisaTypes": selected_visa_types,
            "timeRanges": time_ranges
        }
        
        # 保存到历史记录
        monitor_status["data_history"].append(submitted_data)
        monitor_status["submitted_data"] = submitted_data
        
        # 转换城市名称到代码
        city_mapping = {
            "中国": ["SHA", "PEK", "CAN", "CTU", "SY"],
            "香港": ["HKG"],
            "台湾": ["TPE", "KHH"],
            "日本": ["TYO", "OSA", "NGO", "FUK", "SPK"],
            "韩国": ["SEL", "PUS"],
            "新加坡": ["SGP"],
            "印度": ["DEL", "BOM", "BLR", "MAA", "HYD", "CCU"],
            "英国": ["LON", "EDI", "BHM", "MAN", "GLA"],
            "加拿大": ["YYZ", "YVR", "YUL", "YYC", "YOW"],
            "澳大利亚": ["SYD", "MEL", "BNE", "PER", "ADL"]
        }
        
        # 国家代码映射（中文到英文小写）
        country_mapping = {
            "中国": "cn",
            "香港": "hk",
            "台湾": "tw",
            "日本": "jp",
            "韩国": "kr",
            "新加坡": "sg",
            "印度": "in",
            "英国": "gb",
            "加拿大": "ca",
            "澳大利亚": "au",
            "美国": "us",
            "墨西哥": "mx",
            "巴西": "br",
            "阿根廷": "ar",
            "智利": "cl",
            "哥伦比亚": "co",
            "秘鲁": "pe",
            "法国": "fr",
            "德国": "de",
            "意大利": "it",
            "西班牙": "es",
            "荷兰": "nl",
            "比利时": "be",
            "爱尔兰": "ie",
            "希腊": "gr",
            "葡萄牙": "pt",
            "土耳其": "tr",
            "丹麦": "dk",
            "芬兰": "fi",
            "匈牙利": "hu",
            "挪威": "no",
            "黑山": "me",
            "瑞典": "se",
            "瑞士": "ch"
        }
        
        # 转换签证类型
        visa_mapping = {
            "B1/B2": ["B1", "B2"],
            "F1": ["F1"],
            "H1B": ["H1B"],
            "L1": ["L1"],
            "J1": ["J1"],
            "O1": ["O1"]
        }
        
        # 生成新的配置
        allowed_cities = []
        allowed_countries = []
        for country in selected_countries:
            if country in city_mapping:
                allowed_cities.extend(city_mapping[country])
            if country in country_mapping:
                allowed_countries.append(country_mapping[country])
        
        allowed_visa_types = []
        for visa_type in selected_visa_types:
            if visa_type in visa_mapping:
                allowed_visa_types.extend(visa_mapping[visa_type])
        
        # 转换日期范围
        date_ranges = []
        for time_range in time_ranges:
            date_ranges.append({
                "start_date": time_range["startDate"],
                "end_date": time_range["endDate"]
            })
        
        # 更新配置
        new_config = {
            "token": "9513a9ba-c388-4d5d-8ed5-408c0d5ec658",
            "allowed_cities": allowed_cities,
            "allowed_countries": allowed_countries,
            "allowed_visa_types": allowed_visa_types,
            "date_ranges": date_ranges,
            "reconnect_delay": 10,
            "max_reconnect_attempts": 10,
            "log_level": "INFO",
            "selected_countries": selected_countries,
            "selected_visa_types": selected_visa_types
        }
        
        # 保存配置
        save_config(new_config)
        
        # 更新监控状态
        monitor_status["config"] = new_config
        monitor_status["last_activity"] = datetime.now().isoformat()
        
        print(f"📝 前端数据已接收: {submitted_data}")
        
        return {
            "success": True,
            "message": "配置已从前端更新",
            "config": {
                "selected_countries": selected_countries,
                "selected_visa_types": selected_visa_types,
                "allowed_cities": allowed_cities,
                "allowed_countries": allowed_countries,
                "allowed_visa_types": allowed_visa_types,
                "date_ranges": date_ranges
            },
            "submitted_data": submitted_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")

@app.post("/monitor/start-from-frontend")
async def start_monitor_from_frontend(request: dict):
    """从前端启动监控"""
    try:
        # 检查是否来自真实的前端页面
        user_agent = request.get("user_agent", "")
        source = request.get("source", "")
        
        # 先更新配置
        await update_config_from_frontend(request)
        
        # 启动监控
        monitor_status["is_running"] = True
        monitor_status["start_time"] = datetime.now().isoformat()
        monitor_status["last_activity"] = datetime.now().isoformat()
        
        print(f"🎯 监控已从前端启动，数据来源: {source}")
        
        return {
            "success": True,
            "message": "监控已从前端启动",
            "status": monitor_status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动监控失败: {str(e)}")

@app.get("/stats")
async def get_stats():
    """获取统计信息"""
    try:
        return {
            "success": True,
            "stats": {
                "is_running": monitor_status["is_running"],
                "start_time": monitor_status["start_time"],
                "message_count": monitor_status["message_count"],
                "slot_count": monitor_status["slot_count"],
                "matched_slots_count": len(monitor_status["matched_slots"]),
                "last_activity": monitor_status["last_activity"],
                "config": monitor_status["config"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")

@app.get("/slots")
async def get_matched_slots():
    """获取匹配的槽位"""
    try:
        return {
            "success": True,
            "matched_slots": monitor_status["matched_slots"],
            "count": len(monitor_status["matched_slots"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取槽位信息失败: {str(e)}")

@app.get("/websocket/status")
async def get_websocket_status():
    """获取WebSocket连接状态"""
    try:
        return {
            "success": True,
            "websocket": {
                "url": "wss://us-ais.vis.lol/api/slots",
                "is_connected": monitor_status["is_running"],
                "last_activity": monitor_status["last_activity"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取WebSocket状态失败: {str(e)}")

@app.get("/submitted-data")
async def get_submitted_data():
    """获取前端提交的数据历史"""
    try:
        return {
            "success": True,
            "current_data": monitor_status["submitted_data"],
            "data_history": monitor_status["data_history"],
            "history_count": len(monitor_status["data_history"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取提交数据失败: {str(e)}")

@app.get("/data-summary")
async def get_data_summary():
    """获取数据摘要"""
    try:
        current_data = monitor_status["submitted_data"]
        history = monitor_status["data_history"]
        
        # 统计最常选择的国家和签证类型
        country_stats = {}
        visa_stats = {}
        
        for record in history:
            for country in record.get("selectedCountries", []):
                country_stats[country] = country_stats.get(country, 0) + 1
            for visa in record.get("selectedVisaTypes", []):
                visa_stats[visa] = visa_stats.get(visa, 0) + 1
        
        return {
            "success": True,
            "summary": {
                "total_submissions": len(history),
                "last_submission": current_data.get("timestamp") if current_data else None,
                "most_selected_countries": sorted(country_stats.items(), key=lambda x: x[1], reverse=True)[:5],
                "most_selected_visa_types": sorted(visa_stats.items(), key=lambda x: x[1], reverse=True)[:5],
                "current_config": monitor_status["config"] if monitor_status["config"] else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取数据摘要失败: {str(e)}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket连接端点"""
    await manager.connect(websocket)
    try:
        while True:
            # 保持连接活跃
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/broadcast")
async def broadcast_message(data: Dict[str, Any]):
    """广播消息到所有WebSocket连接"""
    try:
        message = json.dumps(data, ensure_ascii=False)
        await manager.broadcast(message)
        return {"success": True, "message": "消息广播成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"广播消息失败: {str(e)}")

def load_config() -> Dict[str, Any]:
    """加载配置文件"""
    config_file = "config.json"
    if not os.path.exists(config_file):
        raise FileNotFoundError(f"配置文件 {config_file} 不存在，请先从前端启动监控")
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
            print(f"配置文件加载成功: {config}")
            return config
    except Exception as e:
        print(f"加载配置文件失败: {e}")
        raise

def save_config(config: Dict[str, Any]):
    """保存配置文件"""
    config_file = "config.json"
    try:
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"保存配置文件失败: {e}")

if __name__ == "__main__":
    # 启动API服务（不初始化配置，等待前端数据）
    print("🚀 美签监控API服务启动")
    print("📝 等待前端发送配置数据...")
    print("🌐 API地址: http://localhost:8005")
    print("📖 API文档: http://localhost:8005/docs")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8005,
        log_level="info"
    )

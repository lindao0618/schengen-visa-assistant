#!/usr/bin/env python3
"""
TLS法签监控主程序
与前端数据格式对接，支持实时监控和通知
"""

import asyncio
import json
import uuid
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Set, List
import websocket
from datetime import datetime
import os
import threading
import time

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('tls_monitor.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# WebSocket上游配置
WS_UPSTREAM = "wss://tls.vis.lol/api/slots"
TOKEN = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"

# 邮件配置
EMAIL_CONFIG = {
    "smtp_server": "smtp.163.com",
    "smtp_port": 465,
    "sender_email": "19857174374@163.com",
    "sender_password": "FTn7LTc27jfmi2rv",
    "recipient_email": "yidianmeile@gmail.com"
}

# 全局存储
MONITOR_CONFIGS: Dict[str, Dict[str, Any]] = {}  # 监控配置
ACTIVE_MONITORS: Set[str] = set()  # 活跃的监控ID
MATCHED_SLOTS: Set[str] = set()  # 已匹配的槽位
STATS = {
    "total_messages": 0,
    "total_slots": 0,
    "matched_slots": 0,
    "last_activity": None,
    "active_monitors": 0
}

def load_config():
    """加载配置文件"""
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_config(config):
    """保存配置文件"""
    with open('config.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def convert_frontend_to_backend(frontend_data: Dict[str, Any]) -> Dict[str, Any]:
    """将前端数据格式转换为后端格式"""
    logger.info("=== 开始转换前端数据到后端格式 ===")
    logger.info(f"原始前端数据: {json.dumps(frontend_data, ensure_ascii=False, indent=2)}")
    
    # 国家代码映射
    country_mapping = {
        "china": "cn",
        "uk": "gb", 
        "us": "us"
    }
    
    # 城市代码映射
    city_mapping = {
        # 中国城市
        "beijing": "BJS",
        "shanghai": "SHA", 
        "guangzhou": "CAN",
        "chengdu": "CTU",
        # 英国城市
        "london": "LON",
        "manchester": "MNC",
        "edinburgh": "EDI",
        # 美国城市
        "new_york": "NYC",
        "los_angeles": "LAX",
        "chicago": "CHI",
        "houston": "HOU",
        "miami": "MIA",
        "san_francisco": "SFO",
        "boston": "BOS",
        "washington": "WAS",
        "atlanta": "ATL",
        "seattle": "SEA",
        "philadelphia": "PHL",
        "detroit": "DTT",
        "denver": "DEN",
        "phoenix": "PHX",
        "las_vegas": "LAS",
        "dallas": "DFW",
        "orlando": "ORL",
        "portland": "PDX",
        "minneapolis": "MSP",
        "san_diego": "SAN"
    }
    
    # Slot类型映射
    slot_type_mapping = {
        "normal": "normal",
        "prime_time": "prime_time", 
        "premium": "premium"
    }
    
    logger.info(f"国家代码映射: {country_mapping}")
    logger.info(f"城市代码映射: {city_mapping}")
    
    # 转换国家代码
    application_country = frontend_data.get("application_country", "")
    backend_country = country_mapping.get(application_country, application_country)
    logger.info(f"国家代码转换: '{application_country}' -> '{backend_country}'")
    
    # 转换城市代码
    application_city = frontend_data.get("application_city", "")
    backend_city = city_mapping.get(application_city, application_city)
    logger.info(f"城市代码转换: '{application_city}' -> '{backend_city}'")
    
    # 转换slot类型
    slot_types = frontend_data.get("slot_types", [])
    acceptable_types = [slot_type_mapping.get(st, st) for st in slot_types]
    logger.info(f"Slot类型转换: {slot_types} -> {acceptable_types}")
    
    # 转换日期范围格式
    date_ranges = frontend_data.get("date_ranges", [])
    filters = []
    for date_range in date_ranges:
        filter_item = {
            "date": {
                "from": date_range.get("start_date"),
                "to": date_range.get("end_date")
            },
            "skip_days": 0,
            "time": {
                "from": date_range.get("start_time"),
                "to": date_range.get("end_time")
            }
        }
        filters.append(filter_item)
    
    # 构建后端格式数据
    backend_data = {
        "application_city": backend_city,
        "application_country": backend_country,
        "visa_country": "fr",  # 固定为法国
        "group_id": "",  # 默认group_id
        "phone": frontend_data.get("notifications", {}).get("phone", ""),
        "email": frontend_data.get("notifications", {}).get("email", ""),
        "password": frontend_data.get("notifications", {}).get("password", ""),  # 前端获取的密码
        "filters": filters,
        "operational_time_ranges": [],
        "acceptable_types": acceptable_types,
        # 保留前端原始数据用于匹配
        "frontend_data": frontend_data
    }
    
    logger.info(f"转换后的后端数据: {json.dumps(backend_data, ensure_ascii=False, indent=2)}")
    logger.info("=== 数据转换完成 ===")
    
    return backend_data

def slot_match(slot: dict, config: dict) -> bool:
    """检查槽位是否匹配配置"""
    try:
        logger.info(f"🔍 开始匹配槽位: {slot.get('city', 'N/A')} - {slot.get('visa', 'N/A')}")
        logger.info(f"📋 当前配置: {json.dumps(config, ensure_ascii=False, indent=2)}")
        
        # 1. 国家匹配
        slot_country = slot.get("country", "").lower()
        config_country = config.get("application_country", "").lower()
        logger.info(f"🌍 国家匹配检查: 槽位={slot_country}, 配置={config_country}")
        
        if slot_country != config_country:
            logger.info(f"❌ 国家不匹配: {slot_country} != {config_country}")
            return False
        
        # 2. 城市匹配
        slot_city = slot.get("city", "").lower()
        config_city = config.get("application_city", "").lower()
        logger.info(f"🏙️ 城市匹配检查: 槽位={slot_city}, 配置={config_city}")
        
        if slot_city != config_city:
            logger.info(f"❌ 城市不匹配: {slot_city} != {config_city}")
            return False
        
        # 3. 签证类型匹配
        slot_visa = slot.get("visa", "").lower()
        config_visa = "fr"  # 固定为法国签证
        logger.info(f"📝 签证类型匹配检查: 槽位={slot_visa}, 配置={config_visa}")
        
        if slot_visa != config_visa:
            logger.info(f"❌ 签证类型不匹配: {slot_visa} != {config_visa}")
            return False
        
        # 4. 时间范围匹配
        if not config.get("filters"):
            logger.info("✅ 无时间限制，匹配成功")
            return True
        
        # 获取槽位的日期时间信息
        slot_datetimes = slot.get("datetimes", [])
        if not slot_datetimes:
            logger.info("❌ 槽位无日期时间信息")
            return False
        
        # 检查是否有日期在配置的时间范围内
        for filter_item in config.get("filters", []):
            date_range = filter_item.get("date", {})
            start_date = date_range.get("from", "")
            end_date = date_range.get("to", "")
            start_time = filter_item.get("time", {}).get("from", "")
            end_time = filter_item.get("time", {}).get("to", "")
            
            if start_date and end_date:
                # 转换为日期对象进行比较
                from datetime import datetime
                try:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                    
                    for dt_item in slot_datetimes:
                        slot_date = dt_item.get("date", "")
                        slot_time = dt_item.get("time", "")
                        
                        if slot_date:
                            slot_dt = datetime.strptime(slot_date, "%Y-%m-%d")
                            
                            # 检查日期是否在范围内
                            if start_dt <= slot_dt <= end_dt:
                                # 检查时间是否在范围内（如果有时间限制）
                                if start_time and end_time and slot_time:
                                    slot_time_obj = datetime.strptime(slot_time, "%H:%M").time()
                                    start_time_obj = datetime.strptime(start_time, "%H:%M").time()
                                    end_time_obj = datetime.strptime(end_time, "%H:%M").time()
                                    
                                    if start_time_obj <= slot_time_obj <= end_time_obj:
                                        logger.info(f"✅ 时间匹配成功: {slot_date} {slot_time} 在范围 [{start_date} {start_time}, {end_date} {end_time}] 内")
                                        return True
                                else:
                                    # 只有日期限制，时间不限
                                    logger.info(f"✅ 日期匹配成功: {slot_date} 在范围 [{start_date}, {end_date}] 内")
                                    return True
                                    
                except ValueError as e:
                    logger.warning(f"⚠️ 日期格式转换失败: {e}")
                    continue
        
        logger.info("❌ 时间范围不匹配")
        return False
        
    except Exception as e:
        logger.error(f"❌ 匹配检查出错: {e}")
        return False

def send_email_notification(slot_data: dict, config: dict):
    """发送邮件通知"""
    try:
        # 国家映射
        country_map = {
            "gb": "英国", "cn": "中国", "us": "美国", "fr": "法国"
        }
        
        # 城市映射
        city_map = {
            "LON": "伦敦", "MNC": "曼彻斯特", "EDI": "爱丁堡",
            "BJS": "北京", "SHA": "上海", "CAN": "广州", "CTU": "成都",
            "NYC": "纽约", "LAX": "洛杉矶", "CHI": "芝加哥", "MIA": "迈阿密", "SFO": "旧金山", "BOS": "波士顿", "WAS": "华盛顿", "SEA": "西雅图", "ATL": "亚特兰大", "DEN": "丹佛", "LAS": "拉斯维加斯", "PHX": "凤凰城"
        }
        
        # 获取显示信息
        country_display = country_map.get(slot_data.get('country', ''), slot_data.get('country', 'N/A'))
        city_display = city_map.get(slot_data.get('city', ''), slot_data.get('city', 'N/A'))
        
        # 格式化可用日期时间
        def format_datetimes(datetimes, config_filters):
            if not datetimes:
                return "暂无可用时间"
            
            # 按日期分组
            date_groups = {}
            for dt_item in datetimes:
                date_str = dt_item.get("date", "")
                time_str = dt_item.get("time", "")
                
                if date_str and time_str:
                    # 转换日期格式
                    try:
                        from datetime import datetime
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                        formatted_date = date_obj.strftime("%m月%d日")
                        
                        if formatted_date not in date_groups:
                            date_groups[formatted_date] = []
                        date_groups[formatted_date].append(time_str)
                    except ValueError:
                        continue
            
            # 格式化显示
            formatted_parts = []
            for date_key in sorted(date_groups.keys()):
                times = sorted(date_groups[date_key])
                formatted_parts.append(f"<strong>{date_key}</strong>: {', '.join(times)}")
            
            return "<br>".join(formatted_parts)
        
        available_datetimes = format_datetimes(slot_data.get('datetimes', []), config.get('filters', []))
        
        # 构建邮件内容
        subject = f"🎉 TLS法签预约成功！{city_display} - 法国签证"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎉 TLS法签预约时间-出现通知！</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">恭喜！您监控的TLS法签预约Slot已开放！</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h3 style="color: #2196F3; margin-top: 0;">📋 匹配的Slot信息</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>🌍 国家：</strong>{country_display}</p>
                    <p><strong>🏙️ 城市：</strong>{city_display}</p>
                    <p><strong>📝 签证类型：</strong>法国签证</p>
                    <p><strong>📅 可用时间段：</strong></p>
                    <div style="margin-left: 20px; line-height: 1.8; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        {available_datetimes}
                    </div>
                </div>
                
                <h3 style="color: #2196F3; margin-top: 30px;">🎯 您的监控配置</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>🌍 申请国家：</strong>{country_map.get(config.get('application_country', ''), config.get('application_country', 'N/A'))}</p>
                    <p><strong>🏙️ 申请城市：</strong>{city_map.get(config.get('application_city', ''), config.get('application_city', 'N/A'))}</p>
                    <p><strong>📝 签证类型：</strong>法国签证</p>
                    <p><strong>📅 监控时间范围：</strong></p>
                    <div style="margin-left: 20px; line-height: 1.8; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        {available_datetimes}
                    </div>
                </div>
                
                <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196F3;">
                    <h4 style="color: #1976d2; margin-top: 0;">🚀 立即行动</h4>
                    <p style="margin: 0; color: #1565c0;">请立即登录TLS系统进行预约，这些时段通常很快就会被抢完！</p>
                </div>
                
                <div style="margin-top: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>此邮件由TLS监控系统自动发送</p>
                    <p>发送时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
            </div>
        </div>
        </body>
        </html>
        """
        
        # 发送邮件
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = EMAIL_CONFIG["sender_email"]
        msg['To'] = config.get("email", EMAIL_CONFIG["recipient_email"])
        
        html_part = MIMEText(body, 'html', 'utf-8')
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"]) as server:
            server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
            server.send_message(msg)
        
        logger.info(f"✅ 邮件通知已发送: {subject}")
        
    except Exception as e:
        logger.error(f"❌ 发送邮件通知失败: {e}")

def upstream_consumer():
    """上游WebSocket消费者 - 使用websocket-client库"""
    backoff = 1
    while True:
        try:
            logger.info("🔗 连接上游WebSocket...")
            
            # 创建WebSocket连接
            ws = websocket.WebSocketApp(
                WS_UPSTREAM,
                on_message=on_websocket_message,
                on_error=on_websocket_error,
                on_close=on_websocket_close,
                on_open=on_websocket_open,
                header=[
                    f"x-vis-lol-token: {TOKEN}",
                    "X-Vis-Lol-Api: tls",
                    "Origin: https://tls.vis.lol",
                    "User-Agent: PythonWebSocket/0.1"
                ]
            )
            
            # 在后台线程中运行WebSocket
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # 等待连接建立
            time.sleep(2)
            
            # 保持运行
            while ws.sock and ws.sock.connected:
                time.sleep(1)
                
        except Exception as e:
            logger.error(f"❌ 上游WebSocket错误: {e}")
        
        time.sleep(backoff)
        backoff = min(backoff * 2, 60)

def on_websocket_message(ws, message):
    """WebSocket消息处理"""
    try:
        slot = json.loads(message)
        STATS["total_messages"] += 1
        STATS["last_activity"] = time.time()
        
        # 检查是否有活跃监控
        if not MONITOR_CONFIGS:
            return
        
        STATS["total_slots"] += 1
        logger.info(f"📥 收到新槽位: {slot.get('city', 'N/A')} - {slot.get('country', 'N/A')}")
        
        # 为每个监控配置检查匹配
        for monitor_id, config in list(MONITOR_CONFIGS.items()):
            try:
                if slot_match(slot, config):
                    STATS["matched_slots"] += 1
                    
                    # 创建槽位唯一标识
                    slot_key = f"{slot.get('country', '')}_{slot.get('city', '')}_{slot.get('visa', '')}_{slot.get('from', '')}"
                    
                    # 检查是否已经匹配过这个槽位
                    if slot_key not in MATCHED_SLOTS:
                        MATCHED_SLOTS.add(slot_key)
                        
                        logger.info(f"🎯 匹配成功！监控ID: {monitor_id}")
                        logger.info(f"📋 槽位: {json.dumps(slot, ensure_ascii=False, indent=2)}")
                        
                        # 发送邮件通知
                        send_email_notification(slot, config)
                        
                        # 匹配成功后停止该监控
                        logger.info(f"🛑 停止监控 {monitor_id}（已匹配成功）")
                        if monitor_id in MONITOR_CONFIGS:
                            del MONITOR_CONFIGS[monitor_id]
                        if monitor_id in ACTIVE_MONITORS:
                            ACTIVE_MONITORS.remove(monitor_id)
                        
                        STATS["active_monitors"] = len(ACTIVE_MONITORS)
                        
                    else:
                        logger.info(f"⏭️ 跳过重复槽位: {slot_key}")
                        
            except Exception as e:
                logger.error(f"❌ 检查监控 {monitor_id} 匹配时出错: {e}")
                continue
                
    except json.JSONDecodeError:
        return
    except Exception as e:
        logger.error(f"❌ 处理上游消息时出错: {e}")

def on_websocket_error(ws, error):
    """WebSocket错误处理"""
    logger.error(f"❌ WebSocket错误: {error}")

def on_websocket_close(ws, close_status_code, close_msg):
    """WebSocket连接关闭处理"""
    logger.info(f"🔌 WebSocket连接关闭 - 状态码: {close_status_code}, 消息: {close_msg}")

def on_websocket_open(ws):
    """WebSocket连接打开处理"""
    logger.info("✅ 上游WebSocket连接成功")

def start_monitor(frontend_config: Dict[str, Any]) -> Dict[str, Any]:
    """启动监控"""
    try:
        logger.info("🚀 从前端启动监控")
        logger.info(f"📋 前端配置: {json.dumps(frontend_config, ensure_ascii=False, indent=2)}")
        
        # 转换前端数据格式
        backend_config = convert_frontend_to_backend(frontend_config)
        
        # 创建监控ID
        monitor_id = str(uuid.uuid4())
        MONITOR_CONFIGS[monitor_id] = backend_config
        ACTIVE_MONITORS.add(monitor_id)
        STATS["active_monitors"] = len(ACTIVE_MONITORS)
        
        logger.info(f"✅ 监控已启动: {monitor_id}")
        logger.info(f"📋 后端配置: {json.dumps(backend_config, ensure_ascii=False, indent=2)}")
        
        return {
            "success": True,
            "monitor_id": monitor_id,
            "message": "监控已启动"
        }
        
    except Exception as e:
        logger.error(f"❌ 启动监控失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }

def stop_monitor(monitor_id: str) -> Dict[str, Any]:
    """停止指定监控"""
    try:
        if monitor_id in MONITOR_CONFIGS:
            del MONITOR_CONFIGS[monitor_id]
        if monitor_id in ACTIVE_MONITORS:
            ACTIVE_MONITORS.remove(monitor_id)
        
        STATS["active_monitors"] = len(ACTIVE_MONITORS)
        logger.info(f"🛑 监控已停止: {monitor_id}")
        
        return {
            "success": True,
            "message": "监控已停止"
        }
        
    except Exception as e:
        logger.error(f"❌ 停止监控失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }

def get_status() -> Dict[str, Any]:
    """获取监控状态"""
    return {
        "running": True,
        "stats": STATS,
        "active_monitors": len(ACTIVE_MONITORS),
        "monitor_configs": list(MONITOR_CONFIGS.keys())
    }

def get_monitor_config(monitor_id: str) -> Dict[str, Any]:
    """获取指定监控的配置"""
    return MONITOR_CONFIGS.get(monitor_id, {})

def main():
    """主函数"""
    logger.info("🚀 TLS法签监控系统启动")
    
    # 启动上游消费者
    consumer_thread = threading.Thread(target=upstream_consumer)
    consumer_thread.daemon = True
    consumer_thread.start()
    
    try:
        # 保持运行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("🛑 收到中断信号，正在关闭...")
        logger.info("✅ TLS法签监控系统已关闭")

if __name__ == "__main__":
    main()

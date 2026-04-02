#!/usr/bin/env python3
"""
TLS法签监控API服务
提供REST API接口，支持前端数据对接和监控管理
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import json
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="TLS法签监控API",
    description="TLS法签预约槽位监控API，支持前端数据对接",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量
monitor_status = {
    "is_running": False,
    "start_time": None,
    "message_count": 0,
    "slot_count": 0,
    "matched_slots": [],
    "last_activity": None,
    "config": {},
    "submitted_data": {},
    "data_history": []
}

# 监控配置存储
MONITOR_CONFIGS = {}
ACTIVE_MONITORS = set()
MATCHED_SLOTS = set()

# 邮件配置
EMAIL_CONFIG = {
    "smtp_server": "smtp.163.com",
    "smtp_port": 465,
    "sender_email": "19857174374@163.com",
    "sender_password": "FTn7LTc27jfmi2rv",
    "recipient_email": "yidianmeile@gmail.com"
}

# 统计数据
STATS = {
    "total_messages": 0,
    "total_slots": 0,
    "matched_slots": 0,
    "last_activity": None,
    "active_monitors": 0
}

def send_monitor_start_email(config: dict, monitor_id: str):
    """发送监控开始邮件通知"""
    try:
        # 国家映射
        country_map = {
            "china": "中国", "uk": "英国", "us": "美国", "fr": "法国"
        }
        
        # 城市映射
        city_map = {
            "shanghai": "上海", "beijing": "北京", "guangzhou": "广州", "chengdu": "成都",
            "london": "伦敦", "manchester": "曼彻斯特", "edinburgh": "爱丁堡",
            "paris": "巴黎", "lyon": "里昂", "marseille": "马赛"
        }
        
        # 获取显示信息
        country_display = country_map.get(config.get('application_country', ''), config.get('application_country', 'N/A'))
        city_display = city_map.get(config.get('application_city', ''), config.get('application_city', 'N/A'))
        
        # 格式化日期范围
        def format_date_ranges(date_ranges):
            if not date_ranges:
                return "无时间限制"
            
            formatted_parts = []
            for i, date_range in enumerate(date_ranges):
                start_date = date_range.get('start_date', 'N/A')
                end_date = date_range.get('end_date', 'N/A')
                start_time = date_range.get('start_time', 'N/A')
                end_time = date_range.get('end_time', 'N/A')
                
                formatted_parts.append(f"时间段{i+1}: {start_date} 至 {end_date}, {start_time} - {end_time}")
            
            return "<br>".join(formatted_parts)
        
        date_ranges_display = format_date_ranges(config.get('date_ranges', []))
        
        # 构建邮件内容
        subject = f"🚀 TLS法签监控已启动 - {city_display} - 法国签证"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🚀 TLS法签监控已启动！</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">您的监控配置已成功提交，系统开始实时监控</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h3 style="color: #2196F3; margin-top: 0;">📋 监控配置详情</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>🔍 监控ID：</strong><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">{monitor_id}</code></p>
                    <p><strong>🌍 申请国家：</strong>{country_display}</p>
                    <p><strong>🏙️ 申请城市：</strong>{city_display}</p>
                    <p><strong>📝 签证类型：</strong>{config.get('visa_type', 'N/A')}</p>
                    <p><strong>🎯 旅行目的：</strong>{config.get('travel_purpose', 'N/A')}</p>
                    <p><strong>⏰ 监控时间范围：</strong></p>
                    <div style="margin-left: 20px; line-height: 1.8; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        {date_ranges_display}
                    </div>
                    <p><strong>🎫 槽位类型：</strong>{', '.join(config.get('slot_types', []))}</p>
                </div>
                
                <h3 style="color: #2196F3; margin-top: 30px;">🔔 通知设置</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>📧 邮箱通知：</strong>{config.get('notifications', {}).get('email', '未设置')}</p>
                    <p><strong>📱 手机通知：</strong>{config.get('notifications', {}).get('phone', '未设置')}</p>
                </div>
                
                <div style="margin-top: 30px; padding: 20px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <h4 style="color: #2e7d32; margin-top: 0;">✅ 监控状态</h4>
                    <p style="margin: 0; color: #2e7d32;">您的监控已成功启动，系统将实时监控TLS法签预约槽位。一旦发现匹配的槽位，我们将立即通过邮件通知您！</p>
                </div>
                
                <div style="margin-top: 20px; padding: 20px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <h4 style="color: #856404; margin-top: 0;">💡 温馨提示</h4>
                    <ul style="margin: 0; color: #856404;">
                        <li>监控将持续运行，直到找到匹配的槽位</li>
                        <li>请保持邮箱畅通，及时查收通知</li>
                        <li>如需修改监控配置，请重新提交</li>
                        <li>如有问题，请查看系统日志或联系技术支持</li>
                    </ul>
                </div>
                
                <div style="margin-top: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>此邮件由TLS监控系统自动发送</p>
                    <p>启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                    <p>监控ID: {monitor_id}</p>
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
        msg['To'] = config.get("notifications", {}).get("email", EMAIL_CONFIG["recipient_email"])
        
        html_part = MIMEText(body, 'html', 'utf-8')
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"]) as server:
            server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
            server.send_message(msg)
        
        logger.info(f"✅ 监控开始邮件通知已发送: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"❌ 发送监控开始邮件通知失败: {e}")
        return False

    """发送监控开始邮件通知"""
    try:
        # 国家映射
        country_map = {
            "china": "中国", "uk": "英国", "us": "美国", "fr": "法国"
        }
        
        # 城市映射
        city_map = {
            "shanghai": "上海", "beijing": "北京", "guangzhou": "广州", "chengdu": "成都",
            "london": "伦敦", "manchester": "曼彻斯特", "edinburgh": "爱丁堡",
            "paris": "巴黎", "lyon": "里昂", "marseille": "马赛"
        }
        
        # 获取显示信息
        country_display = country_map.get(config.get('application_country', ''), config.get('application_country', 'N/A'))
        city_display = city_map.get(config.get('application_city', ''), config.get('application_city', 'N/A'))
        
        # 格式化日期范围
        def format_date_ranges(date_ranges):
            if not date_ranges:
                return "无时间限制"
            
            formatted_parts = []
            for i, date_range in enumerate(date_ranges):
                start_date = date_range.get('start_date', 'N/A')
                end_date = date_range.get('end_date', 'N/A')
                start_time = date_range.get('start_time', 'N/A')
                end_time = date_range.get('end_time', 'N/A')
                
                formatted_parts.append(f"时间段{i+1}: {start_date} 至 {end_date}, {start_time} - {end_time}")
            
            return "<br>".join(formatted_parts)
        
        date_ranges_display = format_date_ranges(config.get('date_ranges', []))
        
        # 构建邮件内容
        subject = f"🚀 TLS法签监控已启动 - {city_display} - 法国签证"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🚀 TLS法签监控已启动！</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">您的监控配置已成功提交，系统开始实时监控</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h3 style="color: #2196F3; margin-top: 0;">📋 监控配置详情</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>🔍 监控ID：</strong><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">{monitor_id}</code></p>
                    <p><strong>🌍 申请国家：</strong>{country_display}</p>
                    <p><strong>🏙️ 申请城市：</strong>{city_display}</p>
                    <p><strong>📝 签证类型：</strong>{config.get('visa_type', 'N/A')}</p>
                    <p><strong>🎯 旅行目的：</strong>{config.get('travel_purpose', 'N/A')}</p>
                    <p><strong>⏰ 监控时间范围：</strong></p>
                    <div style="margin-left: 20px; line-height: 1.8; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        {date_ranges_display}
                    </div>
                    <p><strong>🎫 槽位类型：</strong>{', '.join(config.get('slot_types', []))}</p>
                </div>
                
                <h3 style="color: #2196F3; margin-top: 30px;">🔔 通知设置</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>📧 邮箱通知：</strong>{config.get('notifications', {}).get('email', '未设置')}</p>
                    <p><strong>📱 手机通知：</strong>{config.get('notifications', {}).get('phone', '未设置')}</p>
                </div>
                
                <div style="margin-top: 30px; padding: 20px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <h4 style="color: #2e7d32; margin-top: 0;">✅ 监控状态</h4>
                    <p style="margin: 0; color: #2e7d32;">您的监控已成功启动，系统将实时监控TLS法签预约槽位。一旦发现匹配的槽位，我们将立即通过邮件通知您！</p>
                </div>
                
                <div style="margin-top: 20px; padding: 20px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <h4 style="color: #856404; margin-top: 0;">💡 温馨提示</h4>
                    <ul style="margin: 0; color: #856404;">
                        <li>监控将持续运行，直到找到匹配的槽位</li>
                        <li>请保持邮箱畅通，及时查收通知</li>
                        <li>如需修改监控配置，请重新提交</li>
                        <li>如有问题，请查看系统日志或联系技术支持</li>
                    </ul>
                </div>
                
                <div style="margin-top: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>此邮件由TLS监控系统自动发送</p>
                    <p>启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                    <p>监控ID: {monitor_id}</p>
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
        msg['To'] = config.get("notifications", {}).get("email", EMAIL_CONFIG["recipient_email"])
        
        html_part = MIMEText(body, 'html', 'utf-8')
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"]) as server:
            server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
            server.send_message(msg)
        
        logger.info(f"✅ 监控开始邮件通知已发送: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"❌ 发送监控开始邮件通知失败: {e}")
        return False

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "TLS法签监控API",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "active_monitors": len(ACTIVE_MONITORS),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/status")
async def get_status():
    """获取监控状态"""
    return {
        "running": True,
        "stats": STATS,
        "active_monitors": len(ACTIVE_MONITORS),
        "monitor_configs": list(MONITOR_CONFIGS.keys())
    }

@app.post("/monitor/start")
async def start_monitor(request: dict):
    """启动监控"""
    try:
        logger.info("🚀 [API] /monitor/start 端点被调用")
        logger.info(f"📦 [前端数据] 接收到监控配置: {json.dumps(request, ensure_ascii=False, indent=2)}")
        
        # 验证必需字段
        required_fields = [
            'application_country', 'application_city', 'visa_type', 
            'travel_purpose', 'slot_types', 'date_ranges', 'notifications'
        ]
        
        for field in required_fields:
            if field not in request:
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "error": f"Missing required field: {field}",
                        "message": '缺少必需字段'
                    }
                )
        
        # 验证日期范围
        if not request['date_ranges']:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "No date ranges provided",
                    "message": '请至少提供一个日期范围'
                }
            )
        
        # 验证通知设置
        if not request['notifications'].get('email') and not request['notifications'].get('phone'):
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "No notification method provided",
                    "message": '请至少提供一种通知方式（邮箱或手机号）'
                }
            )
        
        # 创建监控配置
        monitor_id = str(uuid.uuid4())
        MONITOR_CONFIGS[monitor_id] = request
        ACTIVE_MONITORS.add(monitor_id)
        STATS["active_monitors"] = len(ACTIVE_MONITORS)
        
        # 记录监控配置
        logger.info(f"🔍 [监控配置] 监控ID: {monitor_id}")
        logger.info(f"🔍 [监控配置] 申请国家: {request['application_country']}")
        logger.info(f"🔍 [监控配置] 申请城市: {request['application_city']}")
        logger.info(f"🔍 [监控配置] 签证类型: {request['visa_type']}")
        logger.info(f"🔍 [监控配置] 旅行目的: {request['travel_purpose']}")
        logger.info(f"🔍 [监控配置] Slot类型: {request['slot_types']}")
        logger.info(f"🔍 [监控配置] 日期范围数量: {len(request['date_ranges'])}")
        logger.info(f"🔍 [监控配置] 通知方式: email={bool(request['notifications'].get('email'))}, phone={bool(request['notifications'].get('phone'))}")
        
        # 更新全局状态
        monitor_status["is_running"] = True
        monitor_status["start_time"] = datetime.now().isoformat()
        monitor_status["config"] = request
        monitor_status["submitted_data"] = request
        
        # 保存到历史记录
        monitor_status["data_history"].append({
            "timestamp": datetime.now().isoformat(),
            "action": "start_monitor",
            "config": request,
            "monitor_id": monitor_id
        })
        
        # 发送监控开始邮件通知
        email_sent = send_monitor_start_email(request, monitor_id)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "监控已启动",
                "monitor_id": monitor_id,
                "config": request,
                "email_notification_sent": email_sent
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 启动监控失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "启动监控失败"
            }
        )

@app.post("/monitor/stop")
async def stop_monitor(request: dict = {}):
    """停止监控"""
    try:
        logger.info("🛑 [API] /monitor/stop 端点被调用")
        
        monitor_id = request.get("monitor_id")
        
        if monitor_id:
            # 停止指定监控
            if monitor_id in MONITOR_CONFIGS:
                del MONITOR_CONFIGS[monitor_id]
            if monitor_id in ACTIVE_MONITORS:
                ACTIVE_MONITORS.remove(monitor_id)
            
            logger.info(f"🛑 [监控停止] 监控ID: {monitor_id}")
        else:
            # 停止所有监控
            MONITOR_CONFIGS.clear()
            ACTIVE_MONITORS.clear()
            logger.info("🛑 [监控停止] 所有监控已停止")
        
        STATS["active_monitors"] = len(ACTIVE_MONITORS)
        
        # 更新全局状态
        if not ACTIVE_MONITORS:
            monitor_status["is_running"] = False
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "监控已停止",
                "active_monitors": len(ACTIVE_MONITORS)
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 停止监控失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "停止监控失败"
            }
        )

@app.get("/monitor/status")
async def get_monitor_status():
    """获取监控状态"""
    try:
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "is_running": monitor_status["is_running"],
                "start_time": monitor_status["start_time"],
                "active_monitors": len(ACTIVE_MONITORS),
                "total_messages": STATS["total_messages"],
                "total_slots": STATS["total_slots"],
                "matched_slots": STATS["matched_slots"],
                "last_activity": STATS["last_activity"],
                "config": monitor_status["config"]
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 获取监控状态失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "获取监控状态失败"
            }
        )

@app.get("/monitor/config/{monitor_id}")
async def get_monitor_config(monitor_id: str):
    """获取指定监控的配置"""
    try:
        if monitor_id not in MONITOR_CONFIGS:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": "Monitor not found",
                    "message": "监控不存在"
                }
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "monitor_id": monitor_id,
                "config": MONITOR_CONFIGS[monitor_id]
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 获取监控配置失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "获取监控配置失败"
            }
        )

@app.get("/monitor/list")
async def list_monitors():
    """列出所有监控"""
    try:
        monitors = []
        for monitor_id, config in MONITOR_CONFIGS.items():
            monitors.append({
                "monitor_id": monitor_id,
                "application_country": config.get("application_country"),
                "application_city": config.get("application_city"),
                "visa_type": config.get("visa_type"),
                "slot_types": config.get("slot_types"),
                "date_ranges_count": len(config.get("date_ranges", [])),
                "notifications": config.get("notifications", {})
            })
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "monitors": monitors,
                "total": len(monitors)
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 列出监控失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "列出监控失败"
            }
        )

@app.get("/stats")
async def get_stats():
    """获取统计信息"""
    try:
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "stats": STATS,
                "monitor_status": monitor_status,
                "timestamp": datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 获取统计信息失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "获取统计信息失败"
            }
        )

@app.get("/data/history")
async def get_data_history():
    """获取数据提交历史"""
    try:
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "history": monitor_status["data_history"],
                "total": len(monitor_status["data_history"])
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 获取数据历史失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "获取数据历史失败"
            }
        )

@app.post("/data/test")
async def test_data_format(request: dict):
    """测试数据格式"""
    try:
        logger.info("🧪 [API] /data/test 端点被调用")
        logger.info(f"📦 [测试数据] 接收到数据: {json.dumps(request, ensure_ascii=False, indent=2)}")
        
        # 验证数据格式
        validation_result = validate_monitor_data(request)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "数据格式验证完成",
                "validation": validation_result,
                "received_data": request
            }
        )
        
    except Exception as e:
        logger.error(f"❌ [API] 测试数据格式失败: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "message": "测试数据格式失败"
            }
        )

def validate_monitor_data(data: dict) -> dict:
    """验证监控数据格式"""
    validation = {
        "valid": True,
        "errors": [],
        "warnings": []
    }
    
    # 检查必需字段
    required_fields = [
        'application_country', 'application_city', 'visa_type', 
        'travel_purpose', 'slot_types', 'date_ranges', 'notifications'
    ]
    
    for field in required_fields:
        if field not in data:
            validation["valid"] = False
            validation["errors"].append(f"缺少必需字段: {field}")
    
    # 检查日期范围
    if 'date_ranges' in data and data['date_ranges']:
        for i, date_range in enumerate(data['date_ranges']):
            if not isinstance(date_range, dict):
                validation["valid"] = False
                validation["errors"].append(f"日期范围 {i} 格式错误")
                continue
            
            required_date_fields = ['start_date', 'end_date', 'start_time', 'end_time']
            for field in required_date_fields:
                if field not in date_range:
                    validation["valid"] = False
                    validation["errors"].append(f"日期范围 {i} 缺少字段: {field}")
    
    # 检查通知设置
    if 'notifications' in data:
        notifications = data['notifications']
        if not notifications.get('email') and not notifications.get('phone'):
            validation["warnings"].append("建议至少提供一种通知方式")
    
    return validation

if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("TLS_MONITOR_PORT", "8004"))
    uvicorn.run(app, host="0.0.0.0", port=port)

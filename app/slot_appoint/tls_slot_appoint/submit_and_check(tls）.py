#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# pip install requests

import json, time, requests, logging, smtplib
from typing import Dict, Any, List, Tuple
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ========= 配置 =========
TOKEN = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"
TLS_USERS = "https://tls.vis.lol/api/users"
PAGE_SIZE = 50
FIRST_WAIT_SECONDS = 90
RETRY_INTERVAL = 10
MAX_POLLS = 30

# 邮件配置
EMAIL_CONFIG = {
    "smtp_server": "smtp.163.com",
    "smtp_port": 465,
    "sender_email": "19857174374@163.com",
    "sender_password": "FTn7LTc27jfmi2rv",
    "recipient_email": "yidianmeile@gmail.com"  # 测试邮箱
}

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("tls_slot_check.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def send_email(subject: str, body: str, recipient_email: str = None, is_html: bool = False):
    """发送邮件通知"""
    try:
        # 默认发送到测试邮箱
        if not recipient_email:
            recipient_email = EMAIL_CONFIG["recipient_email"]
        # 测试阶段，所有邮件都发送到测试邮箱
        recipient_email = EMAIL_CONFIG["recipient_email"]
        
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_CONFIG["sender_email"]
        msg['To'] = recipient_email
        msg['Subject'] = subject
        
        if is_html:
            # 发送HTML格式邮件
            html_part = MIMEText(body, 'html', 'utf-8')
            msg.attach(html_part)
        else:
            # 发送纯文本邮件
            text_part = MIMEText(body, 'plain', 'utf-8')
            msg.attach(text_part)
        
        server = smtplib.SMTP_SSL(EMAIL_CONFIG["smtp_server"], EMAIL_CONFIG["smtp_port"])
        server.login(EMAIL_CONFIG["sender_email"], EMAIL_CONFIG["sender_password"])
        
        text = msg.as_string()
        server.sendmail(EMAIL_CONFIG["sender_email"], recipient_email, text)
        server.quit()
        
        logger.info(f"邮件发送成功: {subject}")
        return True
    except Exception as e:
        logger.error(f"邮件发送失败: {e}")
        return False

def create_html_email(title: str, content: str, status: str = "info") -> str:
    """创建HTML格式的邮件"""
    # 根据状态选择颜色
    color_map = {
        "success": "#28a745",
        "error": "#dc3545", 
        "warning": "#ffc107",
        "info": "#17a2b8"
    }
    status_color = color_map.get(status, "#17a2b8")
    
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }}
            .email-container {{
                background-color: #ffffff;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }}
            .header {{
                background: linear-gradient(135deg, {status_color}, {status_color}dd);
                color: white;
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }}
            .content {{
                padding: 30px;
            }}
            .info-section {{
                background-color: #f8f9fa;
                border-left: 4px solid {status_color};
                padding: 20px;
                margin: 20px 0;
                border-radius: 0 5px 5px 0;
            }}
            .info-item {{
                margin: 10px 0;
                display: flex;
                align-items: center;
            }}
            .info-label {{
                font-weight: 600;
                color: #495057;
                min-width: 120px;
                margin-right: 10px;
            }}
            .info-value {{
                color: #212529;
            }}
            .status-badge {{
                display: inline-block;
                padding: 8px 16px;
                background-color: {status_color};
                color: white;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 500;
                margin: 10px 0;
            }}
            .error-list {{
                background-color: #fff5f5;
                border: 1px solid #fed7d7;
                border-radius: 5px;
                padding: 15px;
                margin: 15px 0;
            }}
            .error-item {{
                color: #c53030;
                margin: 5px 0;
                padding: 5px 0;
                border-bottom: 1px solid #fed7d7;
            }}
            .error-item:last-child {{
                border-bottom: none;
            }}
            .footer {{
                background-color: #e9ecef;
                padding: 20px;
                text-align: center;
                color: #6c757d;
                font-size: 14px;
            }}
            .logo {{
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 10px;
            }}
            .timestamp {{
                color: #6c757d;
                font-size: 12px;
                margin-top: 20px;
                text-align: center;
                border-top: 1px solid #dee2e6;
                padding-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">🎯 TLS签证助手</div>
                <h1>{title}</h1>
            </div>
            
            <div class="content">
                {content}
                
                <div class="timestamp">
                    发送时间: {time.strftime('%Y年%m月%d日 %H:%M:%S')}
                </div>
            </div>
            
            <div class="footer">
                <p>此邮件由TLS签证助手系统自动发送</p>
                <p>如有问题，请联系技术支持</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_template

def sess():
    s = requests.Session()
    retry = Retry(
        total=3, connect=3, read=3,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "POST"])
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s

def headers_post():
    return {
        "x-vis-lol-token": TOKEN,
        "X-Vis-Lol-Api": "tls",
        "Origin": "https://tls.vis.lol",
        "User-Agent": "PythonRequests/2.x",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

def headers_get():
    return {
        "x-vis-lol-token": TOKEN,
        "X-Vis-Lol-Api": "tls",
        "Origin": "https://tls.vis.lol",
        "User-Agent": "PythonRequests/2.x",
        "Accept": "application/json",
    }

def convert_frontend_to_backend(frontend_data: Dict[str, Any]) -> Dict[str, Any]:
    """将前端数据格式转换为后端格式"""
    
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
        # 法国城市
        "paris": "CDG",
        "lyon": "LYS",
        "marseille": "MRS"
    }
    
    # Slot类型映射
    slot_type_mapping = {
        "normal": "normal",
        "prime": "prime_time", 
        "premium": "premium"
    }
    
    # 处理不同的前端数据格式
    if "tlsAccount" in frontend_data:
        # 新的预约页面格式
        tls_account = frontend_data.get("tlsAccount", {})
        booking_params = frontend_data.get("bookingParams", {})
        
        # 转换国家代码
        application_country = tls_account.get("country", "")
        backend_country = country_mapping.get(application_country, application_country)
        
        # 转换城市代码
        application_city = tls_account.get("city", "")
        backend_city = city_mapping.get(application_city, application_city.upper())
        
        # 转换slot类型
        slot_types = booking_params.get("slotTypes", [])
        acceptable_types = [slot_type_mapping.get(st, st) for st in slot_types]
        
        # 转换日期范围格式
        date_time_ranges = booking_params.get("dateTimeRanges", [])
        filters = []
        for date_range in date_time_ranges:
            filter_item = {
                "date": {
                    "from": date_range.get("startDate"),
                    "to": date_range.get("endDate")
                },
                "skip_days": 0,
                "time": {
                    "from": date_range.get("startTime"),
                    "to": date_range.get("endTime")
                }
            }
            filters.append(filter_item)
        
        # 构建后端格式数据
        backend_data = {
            "application_city": backend_city,
            "application_country": backend_country,
            "visa_country": "fr",  # 申根签证固定为法国
            "group_id": "22405954",  # 默认group_id
            "phone": "",  # 预约页面没有手机号
            "email": tls_account.get("username", ""),  # 使用TLS用户名作为邮箱
            "password": tls_account.get("password", ""),  # 使用用户输入的密码
            "filters": filters,
            "operational_time_ranges": [],
            "acceptable_types": acceptable_types
        }
        
    else:
        # 原有的监控页面格式
        # 转换国家代码
        application_country = frontend_data.get("application_country", "")
        backend_country = country_mapping.get(application_country, application_country)
        
        # 转换slot类型
        slot_types = frontend_data.get("slot_types", [])
        acceptable_types = [slot_type_mapping.get(st, st) for st in slot_types]
        
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
            "application_city": frontend_data.get("application_city"),
            "application_country": backend_country,
            "visa_country": "fr",  # 固定为法国
            "group_id": "22405954",  # 默认group_id
            "phone": frontend_data.get("notifications", {}).get("phone", "").replace("+", ""),
            "email": frontend_data.get("notifications", {}).get("email", ""),
            "password": "Visa20252025!",  # 默认密码
            "filters": filters,
            "operational_time_ranges": [],
            "acceptable_types": acceptable_types
        }
    
    logger.info(f"前端数据转换: {frontend_data}")
    logger.info(f"后端数据格式: {json.dumps(backend_data, ensure_ascii=False)}")
    
    return backend_data

def submit_tls(form: Dict[str, Any]) -> Dict[str, Any]:
    """提交 TLS 用户信息"""
    payload = {
        "application_city": form["application_city"],
        "application_country": form["application_country"],
        "visa_country": form["visa_country"],
        "group_id": form["group_id"],
        "phone": form["phone"],
        "email": form["email"],
        "password": form["password"],
        "filters": form.get("filters", []),
        "operational_time_ranges": form.get("operational_time_ranges", []),
        "acceptable_types": form.get("acceptable_types", []),  # 新增字段
    }
    safe_payload = {**payload, "password": "***"}
    logger.info("提交 TLS 用户信息: %s", json.dumps(safe_payload, ensure_ascii=False))

    r = sess().post(TLS_USERS, headers=headers_post(), data=json.dumps(payload), timeout=20)
    logger.info("提交响应: %s", r.status_code)
    return {"status": r.status_code, "text": r.text}

def check_appointment_success(email: str, filters: List[Dict[str, Any]], booking_params: Dict[str, Any] = None) -> Tuple[bool, str, str]:
    """检查预约是否成功 - 增强版匹配逻辑"""
    logger.info(f"检查预约成功状态，邮箱: {email}")
    logger.info(f"预约参数: {booking_params}")
    
    try:
        # 获取预约列表
        appointments_url = "https://tls.vis.lol/api/appointments"
        params = {"offset": 0, "limit": 200}  # 获取更多预约记录
        
        resp = sess().get(appointments_url, params=params, headers=headers_get(), timeout=10)
        
        if resp.status_code == 200:
            appointments_data = resp.json()
            logger.info(f"获取到预约数据总数: {len(appointments_data.get('data', []))}")
            
            # 查找对应邮箱的预约
            user_appointments = []
            if "data" in appointments_data:
                for appointment in appointments_data["data"]:
                    if appointment.get("email") == email:
                        user_appointments.append(appointment)
            
            logger.info(f"找到用户预约数量: {len(user_appointments)}")
            
            # 检查是否有符合条件的预约
            for appointment in user_appointments:
                logger.info(f"检查预约: {appointment}")
                
                # 1. 基础信息匹配
                appointment_datetime = appointment.get("appointment_datetime") or appointment.get("datetime")
                appointment_city = appointment.get("city", "").upper() or appointment.get("application_city", "").upper()
                appointment_country = appointment.get("country", "").upper() or appointment.get("application_country", "").upper()
                
                if not appointment_datetime:
                    logger.info("预约缺少时间信息，跳过")
                    continue
                
                # 2. 城市和国家匹配（如果有预约参数）
                if booking_params:
                    tls_account = booking_params.get("tlsAccount", {})
                    expected_city = tls_account.get("city", "").upper()
                    expected_country = tls_account.get("country", "").upper()
                    
                    # 城市匹配检查
                    if expected_city and appointment_city:
                        if expected_city not in appointment_city and appointment_city not in expected_city:
                            logger.info(f"城市不匹配: 期望 {expected_city}, 实际 {appointment_city}")
                            continue
                    
                    # 国家匹配检查
                    if expected_country and appointment_country:
                        if expected_country not in appointment_country and appointment_country not in expected_country:
                            logger.info(f"国家不匹配: 期望 {expected_country}, 实际 {appointment_country}")
                            continue
                
                # 3. 时间范围匹配
                time_match = False
                for filter_item in filters:
                    date_range = filter_item.get("date", {})
                    time_range = filter_item.get("time", {})
                    
                    start_date = date_range.get("from")
                    end_date = date_range.get("to")
                    start_time = time_range.get("from", "00:00")
                    end_time = time_range.get("to", "23:59")
                    
                    # 解析预约时间
                    try:
                        # 支持多种时间格式: "2025-05-22T08:30" 或 "2025-05-22 08:30"
                        if "T" in appointment_datetime:
                            appointment_date = appointment_datetime.split("T")[0]
                            appointment_time = appointment_datetime.split("T")[1][:5]  # 取HH:MM部分
                        else:
                            # 格式: "2025-05-22 08:30"
                            parts = appointment_datetime.split(" ")
                            if len(parts) >= 2:
                                appointment_date = parts[0]
                                appointment_time = parts[1][:5]  # 取HH:MM部分
                            else:
                                logger.error(f"无法解析时间格式: {appointment_datetime}")
                                continue
                        
                        logger.info(f"检查时间匹配: 预约时间 {appointment_date} {appointment_time}")
                        logger.info(f"期望范围: {start_date} 至 {end_date}, {start_time} 至 {end_time}")
                        
                        # 检查日期范围
                        if start_date and end_date:
                            if start_date <= appointment_date <= end_date:
                                # 检查时间范围
                                if start_time <= appointment_time <= end_time:
                                    time_match = True
                                    logger.info(f"时间匹配成功: {appointment_datetime}")
                                    break
                    except Exception as e:
                        logger.error(f"解析预约时间出错: {e}")
                        continue
                
                if not time_match:
                    logger.info("时间范围不匹配，跳过")
                    continue
                
                # 4. 检查预约状态（如果有相关字段）
                appointment_status = appointment.get("status", "").lower()
                if appointment_status in ["cancelled", "expired", "invalid"]:
                    logger.info(f"预约状态无效: {appointment_status}")
                    continue
                
                # 5. 所有条件都匹配，返回成功
                logger.info(f"找到完全符合条件的预约: {appointment_datetime}")
                logger.info(f"预约详情: 城市={appointment_city}, 国家={appointment_country}, 状态={appointment_status}")
                return True, appointment_datetime, "预约成功"
            
            logger.info("未找到符合条件的预约")
            return False, "", "未找到符合条件的预约"
            
        else:
            logger.error(f"获取预约列表失败: {resp.status_code}")
            return False, "", f"获取预约列表失败: {resp.status_code}"
            
    except Exception as e:
        logger.error(f"检查预约成功状态时出错: {e}")
        return False, "", f"检查预约状态出错: {str(e)}"

def poll_tls(email: str, filters: List[Dict[str, Any]] = None, booking_params: Dict[str, Any] = None) -> Dict[str, Any]:
    """轮询 TLS_USERS，检查 error 字段，并检查预约是否成功"""
    logger.info(f"等待 {FIRST_WAIT_SECONDS} 秒后开始轮询 TLS 记录...")
    time.sleep(FIRST_WAIT_SECONDS)

    for i in range(1, MAX_POLLS+1):
        # 首先检查预约是否成功
        if filters:
            appointment_success, appointment_time, appointment_msg = check_appointment_success(email, filters, booking_params)
            if appointment_success:
                logger.info(f"检测到预约成功: {appointment_time}")
                return {
                    "found": True,
                    "results": [{"success": True, "status": "appointment_success", "error": None}],
                    "has_error": False,
                    "error_messages": [],
                    "has_success": True,
                    "appointment_datetime": appointment_time,
                    "appointment_message": appointment_msg
                }
        
        offset, hits = 0, []
        while True:
            r = sess().get(TLS_USERS, headers=headers_get(),
                           params={"offset": str(offset), "limit": str(PAGE_SIZE)}, timeout=20)
            if r.status_code != 200:
                logger.warning("查询失败，状态码 %s", r.status_code)
                break
            data = r.json()
            page = data.get("data") or []
            for it in page:
                if it.get("email", "").lower() == email.lower():
                    hits.append(it)
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

        if hits:
            logger.info(f"找到 {len(hits)} 条记录，保存到 tls_check_{email}.json")
            with open(f"tls_check_{email}.json", "w", encoding="utf-8") as f:
                json.dump(hits, f, ensure_ascii=False, indent=2)

            results = []
            has_error = False
            error_messages = []
            has_success = False  # 标记是否有成功的记录
            
            for idx, it in enumerate(hits, 1):
                st = it.get("status")
                err = it.get("error")
                
                # 检查是否满足成功条件：error为null且status为active
                if (not err or str(err).strip().lower() in ("", "none", "null")) and st == "active":
                    logger.info(f"[成功] #{idx} {email} status={st} - 满足成功条件")
                    results.append({"success": True, "status": st, "error": None})
                    has_success = True
                elif not err or str(err).strip().lower() in ("", "none", "null"):
                    logger.info(f"[部分成功] #{idx} {email} status={st} - error为null但status不是active")
                    results.append({"success": True, "status": st, "error": None})
                else:
                    logger.error(f"[失败] #{idx} {email} status={st} error={err}")
                    results.append({"success": False, "status": st, "error": err})
                    # 只有在没有成功记录的情况下才收集错误信息
                    if not has_success:
                        has_error = True
                        error_messages.append(f"记录#{idx}: {err}")

            # 如果有成功的记录（error为null且status为active），则忽略其他错误
            if has_success:
                has_error = False
                error_messages = []
                logger.info(f"发现成功记录，忽略其他错误信息")

            return {
                "found": True, 
                "results": results, 
                "has_error": has_error, 
                "error_messages": error_messages,
                "has_success": has_success
            }

        logger.info(f"[{i}/{MAX_POLLS}] 未找到 {email}，{RETRY_INTERVAL} 秒后重试...")
        time.sleep(RETRY_INTERVAL)

    return {"found": False, "results": [], "has_error": False, "error_messages": []}

def submit_and_check(form: Dict[str, Any], is_frontend_format: bool = False):
    """完整流程"""
    
    # 如果是前端格式，先转换为后端格式
    if is_frontend_format:
        form = convert_frontend_to_backend(form)
    
    email = form["email"]
    
    # 提交TLS用户信息
    submit_res = submit_tls(form)
    if submit_res["status"] != 200:
        logger.warning("提交可能失败: %s", submit_res["text"])
        # 发送提交失败邮件
        subject = f"TLS提交失败 - {email}"
        
        content = f"""
        <div class="status-badge">❌ 提交失败</div>
        
        <div class="info-section">
            <div class="info-item">
                <span class="info-label">邮箱:</span>
                <span class="info-value">{email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">状态码:</span>
                <span class="info-value">{submit_res["status"]}</span>
            </div>
            <div class="info-item">
                <span class="info-label">错误信息:</span>
                <span class="info-value">{submit_res["text"]}</span>
            </div>
        </div>
        
        <p>请检查网络连接和API配置，然后重新尝试提交。</p>
        """
        
        html_body = create_html_email("TLS提交失败", content, "error")
        send_email(subject, html_body, email, is_html=True)
        return {"submit": submit_res, "poll": None, "email_sent": True}
    
    # 轮询检查结果
    poll_res = poll_tls(email, form.get("filters", []), form)
    
    # 根据结果发送邮件
    if poll_res["found"]:
        # 优先检查是否有成功记录（error为null且status为active）
        if poll_res.get("has_success", False):
            # 检查是否有预约成功
            if poll_res.get("appointment_datetime"):
                # 预约成功，发送成功邮件
                subject = f"🎉 预约成功！ - {email}"
                
                content = f"""
                <div class="status-badge" style="background-color: #28a745;">🎉 预约成功</div>
                
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">邮箱:</span>
                        <span class="info-value">{email}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">申请城市:</span>
                        <span class="info-value">{form['application_city']}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">申请国家:</span>
                        <span class="info-value">{form['application_country']}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">签证国家:</span>
                        <span class="info-value">{form['visa_country']}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">预约时间:</span>
                        <span class="info-value" style="color: #28a745; font-weight: bold;">{poll_res['appointment_datetime']}</span>
                    </div>
                </div>
                
                <div class="status-badge" style="background-color: #28a745;">✅ 抢号成功</div>
                
                <p><strong>恭喜！</strong>您的签证预约已成功完成！</p>
                <p>系统已为您成功预约到符合条件的时段，请及时查看您的邮箱确认预约详情。</p>
                """
                
                html_body = create_html_email("预约成功", content, "success")
                send_email(subject, html_body, email, is_html=True)
            else:
                # 提交成功但还未预约成功，发送监控邮件
                subject = f"TLS提交成功，正在抢号 - {email}"
                
                content = f"""
                <div class="status-badge">✅ 提交成功</div>
                
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">邮箱:</span>
                        <span class="info-value">{email}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">申请城市:</span>
                        <span class="info-value">{form['application_city']}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">申请国家:</span>
                        <span class="info-value">{form['application_country']}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">签证国家:</span>
                        <span class="info-value">{form['visa_country']}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">状态:</span>
                        <span class="info-value">active (已激活)</span>
                    </div>
                </div>
                
                <div class="status-badge" style="background-color: #28a745;">🔄 正在监控</div>
                
                <p><strong>恭喜！</strong>您的TLS用户信息已成功提交并通过验证，系统正在为您监控可用名额。</p>
                <p>状态已激活，一旦发现符合条件的预约时段，系统将立即为您进行预约操作。</p>
                """
                
                html_body = create_html_email("TLS提交成功，正在抢号", content, "success")
                send_email(subject, html_body, email, is_html=True)
        elif poll_res["has_error"]:
            # 有错误信息，发送重新提交邮件
            subject = f"TLS信息有误，需要重新提交 - {email}"
            
            error_content = ""
            for error_msg in poll_res['error_messages']:
                error_content += f'<div class="error-item">• {error_msg}</div>'
            
            content = f"""
            <div class="status-badge">⚠️ 信息有误</div>
            
            <div class="info-section">
                <div class="info-item">
                    <span class="info-label">邮箱:</span>
                    <span class="info-value">{email}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">申请城市:</span>
                    <span class="info-value">{form['application_city']}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">申请国家:</span>
                    <span class="info-value">{form['application_country']}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">签证国家:</span>
                    <span class="info-value">{form['visa_country']}</span>
                </div>
            </div>
            
            <h3>发现以下错误:</h3>
            <div class="error-list">
                {error_content}
            </div>
            
            <p>请检查并修正上述错误信息，然后重新提交申请。</p>
            """
            
            html_body = create_html_email("TLS信息有误，需要重新提交", content, "warning")
            send_email(subject, html_body, email, is_html=True)
        else:
            # 没有错误信息也没有成功记录，发送部分成功邮件
            subject = f"TLS提交部分成功 - {email}"
            
            content = f"""
            <div class="status-badge">⚠️ 部分成功</div>
            
            <div class="info-section">
                <div class="info-item">
                    <span class="info-label">邮箱:</span>
                    <span class="info-value">{email}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">申请城市:</span>
                    <span class="info-value">{form['application_city']}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">申请国家:</span>
                    <span class="info-value">{form['application_country']}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">签证国家:</span>
                    <span class="info-value">{form['visa_country']}</span>
                </div>
            </div>
            
            <p><strong>注意：</strong>您的TLS用户信息已提交，但状态尚未完全激活。</p>
            <p>系统将继续监控，一旦状态变为active，将立即开始为您抢号。</p>
            <p>请耐心等待，如有问题请联系技术支持。</p>
            """
            
            html_body = create_html_email("TLS提交部分成功", content, "warning")
            send_email(subject, html_body, email, is_html=True)
        
        logger.info(f"邮件通知已发送: {subject}")
    else:
        # 未找到记录，发送超时邮件
        subject = f"TLS查询超时 - {email}"
        
        content = f"""
        <div class="status-badge">⏰ 查询超时</div>
        
        <div class="info-section">
            <div class="info-item">
                <span class="info-label">邮箱:</span>
                <span class="info-value">{email}</span>
            </div>
            <div class="info-item">
                <span class="info-label">轮询次数:</span>
                <span class="info-value">{MAX_POLLS}</span>
            </div>
            <div class="info-item">
                <span class="info-label">等待时间:</span>
                <span class="info-value">{FIRST_WAIT_SECONDS + MAX_POLLS * RETRY_INTERVAL} 秒</span>
            </div>
        </div>
        
        <h3>可能原因:</h3>
        <ul>
            <li>提交失败</li>
            <li>系统处理延迟</li>
            <li>网络连接问题</li>
        </ul>
        
        <p>请稍后重试或联系技术支持。</p>
        """
        
        html_body = create_html_email("TLS查询超时", content, "warning")
        send_email(subject, html_body, email, is_html=True)
    
    return {"submit": submit_res, "poll": poll_res, "email_sent": True}

# ====== 主程序入口 ======
if __name__ == "__main__":
    import sys
    
    # 检查是否有标准输入数据
    if not sys.stdin.isatty():
        try:
            # 从标准输入读取JSON数据
            input_data = sys.stdin.read()
            frontend_data = json.loads(input_data)
            
            logger.info("从标准输入接收到数据")
            result = submit_and_check(frontend_data, is_frontend_format=True)
            
            # 输出JSON结果到标准输出
            print(json.dumps(result, ensure_ascii=False, indent=2))
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析错误: {e}")
            print(json.dumps({
                "success": False,
                "error": f"JSON解析错误: {e}"
            }, ensure_ascii=False, indent=2))
            sys.exit(1)
        except Exception as e:
            logger.error(f"处理数据时出错: {e}")
            print(json.dumps({
                "success": False,
                "error": f"处理数据时出错: {e}"
            }, ensure_ascii=False, indent=2))
            sys.exit(1)
    else:
        # 没有标准输入，运行测试示例
        print("=== 运行测试示例 ===")
        
        # 后端格式示例（原有格式）
        backend_form = {
            "application_city": "EDI",
            "application_country": "gb",
            "visa_country": "fr",
            "group_id": "22405954",
            "phone": "19857181202",
            "email": "yidianmeile@gmail.com",
            "password": "Visa20252025!",
            "filters": [
                {
                    "date": {"from": "2025-07-01", "to": "2025-07-01"},
                    "skip_days": 0,
                    "time": {"from": "00:00", "to": "23:59"}
                }
            ],
            "operational_time_ranges": [],
            "acceptable_types": ["normal", "prime_time"]
        }

        print("=== 后端格式测试 ===")
        result = submit_and_check(backend_form)
        print("最终结果:", json.dumps(result, ensure_ascii=False, indent=2))
        
        # 前端格式示例（监控页面格式）
        frontend_monitor_form = {
            "application_country": "china",
            "application_city": "SHA",
            "visa_type": "short_stay",
            "travel_purpose": "tourism_private_visit",
            "slot_types": ["normal", "prime_time"],
            "date_ranges": [
                {
                    "start_date": "2025-01-20",
                    "end_date": "2025-02-20",
                    "start_time": "09:00",
                    "end_time": "16:00"
                }
            ],
            "notifications": {
                "email": "yidianmeile@gmail.com",
                "phone": "8613800138000"
            }
        }
        
        print("\n=== 前端监控格式测试 ===")
        result = submit_and_check(frontend_monitor_form, is_frontend_format=True)
        print("最终结果:", json.dumps(result, ensure_ascii=False, indent=2))
        
        # 前端格式示例（预约页面格式）
        frontend_booking_form = {
            "tlsAccount": {
                "username": "yidianmeile@gmail.com",
                "password": "Visa20252025!",
                "country": "china",
                "city": "shanghai"
            },
            "bookingParams": {
                "dateTimeRanges": [
                    {
                        "startDate": "2025-01-20",
                        "endDate": "2025-02-20",
                        "startTime": "09:00",
                        "endTime": "16:00"
                    }
                ],
                "slotTypes": ["normal", "prime"],
                "selectedSlot": {
                    "date": "2025-01-25",
                    "time": "10:30",
                    "type": "normal",
                    "price": 350
                }
            },
            "payment": {
                "peopleCount": 2,
                "isUrgent": False,
                "paymentMethod": "wechat",
                "totalAmount": 700
            }
        }
        
        print("\n=== 前端预约格式测试 ===")
        result = submit_and_check(frontend_booking_form, is_frontend_format=True)
        print("最终结果:", json.dumps(result, ensure_ascii=False, indent=2))

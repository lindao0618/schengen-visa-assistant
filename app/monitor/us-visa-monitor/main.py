#!/usr/bin/env python3
"""
美签监控主程序
与前端数据格式对接，支持多种签证系统
"""

import asyncio
import json
import uuid
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import websockets
from matcher import slot_match

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('us_visa_monitor.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# WebSocket上游配置
WS_UPSTREAM = "wss://us-ais.vis.lol/api/slots"
TOKEN = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"  # 实际的token
HEADERS = [
    ("x-vis-lol-token", TOKEN),
    ("Origin", "https://vis.lol"),
    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PythonWebSocketClient/1.0"),
]

# 邮件配置
EMAIL_CONFIG = {
    "smtp_server": "smtp.163.com",  # 163邮箱SMTP服务器
    "smtp_port": 465,  # 163邮箱SSL端口
    "sender_email": "19857174374@163.com",  # 发件人邮箱
    "sender_password": "FTn7LTc27jfmi2rv",  # 163邮箱授权码
    "recipient_email": "yidianmeile@gmail.com"  # 收件人邮箱
}

app = FastAPI(title="US Visa Monitor", version="1.0.0")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 内存存储
SUBS: Dict[str, Dict[str, Any]] = {}  # 订阅ID -> 配置
CHANNELS: Dict[str, Set[WebSocket]] = {}  # 订阅ID -> WebSocket连接集合
STATS = {
    "total_messages": 0,
    "total_slots": 0,
    "matched_slots": 0,
    "last_activity": None,
    "active_subscriptions": 0,
    "total_connections": 0
}

# 存储前端提交的数据历史
FRONTEND_DATA_HISTORY = []

# 存储已匹配的槽位，避免重复通知
MATCHED_SLOTS = set()

def send_email_notification(slot_data: dict, config: dict):
    """发送邮件通知"""
    try:
        # 国家映射
        country_map = {
            # 欧洲
            "gb": "英国", "ie": "爱尔兰", "fr": "法国", "de": "德国", "es": "西班牙", 
            "it": "意大利", "nl": "荷兰", "be": "比利时", "at": "奥地利", "ch": "瑞士",
            "se": "瑞典", "dk": "丹麦", "no": "挪威", "fi": "芬兰", "pl": "波兰",
            "cz": "捷克", "hu": "匈牙利", "ro": "罗马尼亚", "bg": "保加利亚", "gr": "希腊",
            "tr": "土耳其", "ru": "俄罗斯",
            
            # 北美洲
            "us": "美国", "ca": "加拿大", "mx": "墨西哥", "gt": "危地马拉", "cr": "哥斯达黎加",
            "pa": "巴拿马", "cu": "古巴", "jm": "牙买加", "bb": "巴巴多斯", "tt": "特立尼达和多巴哥",
            
            # 亚洲
            "cn": "中国", "hk": "香港", "jp": "日本", "kr": "韩国", "tw": "台湾",
            "sg": "新加坡", "th": "泰国", "ph": "菲律宾", "id": "印度尼西亚", "my": "马来西亚",
            "in": "印度", "bd": "孟加拉国", "pk": "巴基斯坦", "lk": "斯里兰卡", "mm": "缅甸",
            "vn": "越南", "kh": "柬埔寨", "la": "老挝", "mn": "蒙古", "kz": "哈萨克斯坦",
            
            # 大洋洲
            "au": "澳大利亚", "nz": "新西兰", "fj": "斐济", "pg": "巴布亚新几内亚", 
            "vu": "瓦努阿图", "sb": "所罗门群岛", "ws": "萨摩亚", "to": "汤加",
            
            # 南美洲
            "br": "巴西", "ar": "阿根廷", "cl": "智利", "pe": "秘鲁", "co": "哥伦比亚",
            "ve": "委内瑞拉", "ec": "厄瓜多尔", "bo": "玻利维亚", "py": "巴拉圭", "uy": "乌拉圭",
            "gy": "圭亚那", "sr": "苏里南",
            
            # 非洲
            "za": "南非", "eg": "埃及", "ng": "尼日利亚", "ke": "肯尼亚", "gh": "加纳",
            "ma": "摩洛哥", "tn": "突尼斯", "et": "埃塞俄比亚", "ug": "乌干达", "tz": "坦桑尼亚"
        }
        
        # 城市映射
        city_map = {
            # 英国
            "london": "伦敦", "manchester": "曼彻斯特", "belfast": "贝尔法斯特", "edinburgh": "爱丁堡", 
            "birmingham": "伯明翰", "glasgow": "格拉斯哥", "cardiff": "卡迪夫", "leeds": "利兹",
            
            # 加拿大
            "toronto": "多伦多", "vancouver": "温哥华", "montreal": "蒙特利尔", "ottawa": "渥太华",
            "calgary": "卡尔加里", "edmonton": "埃德蒙顿", "halifax": "哈利法克斯", "winnipeg": "温尼伯",
            
            # 美国
            "new york": "纽约", "los angeles": "洛杉矶", "chicago": "芝加哥", "miami": "迈阿密",
            "houston": "休斯顿", "dallas": "达拉斯", "atlanta": "亚特兰大", "boston": "波士顿",
            "seattle": "西雅图", "denver": "丹佛", "phoenix": "凤凰城", "las vegas": "拉斯维加斯",
            
            # 日本
            "tokyo": "东京", "osaka": "大阪", "kyoto": "京都", "nagoya": "名古屋",
            "sapporo": "札幌", "fukuoka": "福冈", "kobe": "神户", "yokohama": "横滨",
            
            # 澳大利亚
            "sydney": "悉尼", "melbourne": "墨尔本", "brisbane": "布里斯班", "perth": "珀斯",
            "adelaide": "阿德莱德", "canberra": "堪培拉", "darwin": "达尔文", "hobart": "霍巴特",
            
            # 新西兰
            "auckland": "奥克兰", "wellington": "惠灵顿", "christchurch": "基督城", "hamilton": "汉密尔顿",
            
            # 爱尔兰
            "dublin": "都柏林", "cork": "科克", "galway": "戈尔韦", "limerick": "利默里克",
            
            # 其他常见城市
            "paris": "巴黎", "berlin": "柏林", "madrid": "马德里", "rome": "罗马",
            "amsterdam": "阿姆斯特丹", "brussels": "布鲁塞尔", "vienna": "维也纳", "zurich": "苏黎世",
            "stockholm": "斯德哥尔摩", "copenhagen": "哥本哈根", "oslo": "奥斯陆", "helsinki": "赫尔辛基",
            "warsaw": "华沙", "prague": "布拉格", "budapest": "布达佩斯", "bucharest": "布加勒斯特",
            "sofia": "索菲亚", "athens": "雅典", "istanbul": "伊斯坦布尔", "moscow": "莫斯科",
            "beijing": "北京", "shanghai": "上海", "guangzhou": "广州", "shenzhen": "深圳",
            "hong kong": "香港", "taipei": "台北", "seoul": "首尔", "singapore": "新加坡",
            "bangkok": "曼谷", "manila": "马尼拉", "jakarta": "雅加达", "kuala lumpur": "吉隆坡",
            "mumbai": "孟买", "delhi": "德里", "bangalore": "班加罗尔", "chennai": "金奈",
            "kolkata": "加尔各答", "hyderabad": "海得拉巴", "pune": "浦那", "ahmedabad": "艾哈迈达巴德",
            "mexico city": "墨西哥城", "guadalajara": "瓜达拉哈拉", "monterrey": "蒙特雷", "tijuana": "蒂华纳",
            "sao paulo": "圣保罗", "rio de janeiro": "里约热内卢", "buenos aires": "布宜诺斯艾利斯", "santiago": "圣地亚哥",
            "lima": "利马", "bogota": "波哥大", "caracas": "加拉加斯", "panama city": "巴拿马城",
            "kingston": "金斯敦", "bridgetown": "布里奇敦", "port of spain": "西班牙港", "georgetown": "乔治敦"
        }
        
        # 领馆映射
        consulate_map = {
            "LON": "伦敦", "MAN": "曼彻斯特", "EDI": "爱丁堡",
            "YYZ": "多伦多", "YVR": "温哥华", "YUL": "蒙特利尔",
            "TYO": "东京", "OSA": "大阪"
        }
        
        # 格式化日期 - 按月份分组，并根据配置筛选
        def format_dates(dates, date_ranges=None):
            if not dates:
                return "暂无可用日期"
            
            # 筛选符合配置日期范围的日期
            filtered_dates = []
            if date_ranges:
                # 检查是否有任何日期在配置的范围内
                has_match_in_ranges = False
                for date_int in dates:
                    date_str = str(date_int)
                    if len(date_str) == 8:
                        for date_range in date_ranges:
                            if len(date_range) == 2:
                                start_date = date_range[0]
                                end_date = date_range[1]
                                if start_date <= date_int <= end_date:
                                    has_match_in_ranges = True
                                    break
                        if has_match_in_ranges:
                            break
                
                # 如果有匹配的日期，显示所有在配置范围内的日期
                if has_match_in_ranges:
                    for date_int in dates:
                        date_str = str(date_int)
                        if len(date_str) == 8:
                            for date_range in date_ranges:
                                if len(date_range) == 2:
                                    start_date = date_range[0]
                                    end_date = date_range[1]
                                    if start_date <= date_int <= end_date:
                                        filtered_dates.append(date_int)
                                        break
            else:
                # 如果没有配置日期范围，显示所有日期
                filtered_dates = dates
            
            if not filtered_dates:
                return "在您设置的日期范围内暂无可用日期"
            
            # 按月份分组
            month_groups = {}
            for date_int in filtered_dates:
                date_str = str(date_int)
                if len(date_str) == 8:
                    year = date_str[:4]
                    month = date_str[4:6]
                    day = date_str[6:8]
                    
                    month_key = f"{year}年{month}月"
                    if month_key not in month_groups:
                        month_groups[month_key] = []
                    month_groups[month_key].append(f"{month}.{day}")
                else:
                    # 处理非标准格式的日期
                    if "其他" not in month_groups:
                        month_groups["其他"] = []
                    month_groups["其他"].append(str(date_int))
            
            # 格式化输出
            formatted_parts = []
            for month_key in sorted(month_groups.keys()):
                if month_key == "其他":
                    formatted_parts.append(f"<strong>{month_key}</strong>: {', '.join(month_groups[month_key])}")
                else:
                    formatted_parts.append(f"<strong style='font-size: 16px; color: #2196F3;'>{month_key}</strong><br>{', '.join(month_groups[month_key])}")
            
            return "<br>".join(formatted_parts)
        
        # 格式化日期范围
        def format_date_ranges(date_ranges):
            if not date_ranges:
                return "未设置"
            formatted_ranges = []
            for date_range in date_ranges:
                if len(date_range) == 2:
                    start_int = date_range[0]
                    end_int = date_range[1]
                    start_str = str(start_int)
                    end_str = str(end_int)
                    if len(start_str) == 8 and len(end_str) == 8:
                        start_formatted = f"{start_str[:4]}年{start_str[4:6]}月{start_str[6:8]}日"
                        end_formatted = f"{end_str[:4]}年{end_str[4:6]}月{end_str[6:8]}日"
                        formatted_ranges.append(f"{start_formatted} 至 {end_formatted}")
                    else:
                        formatted_ranges.append(f"{start_int} 至 {end_int}")
                else:
                    formatted_ranges.append(str(date_range))
            return "<br>".join(formatted_ranges)
        
        # 获取显示信息
        country_display = country_map.get(slot_data.get('country', ''), slot_data.get('country', 'N/A'))
        city_display = city_map.get(slot_data.get('city', ''), slot_data.get('city', 'N/A'))
        available_dates = format_dates(slot_data.get('dates', []), config.get('date_ranges', []))
        date_ranges = format_date_ranges(config.get('date_ranges', []))
        
        # 构建邮件内容
        subject = f"🎉 美签预约成功！{city_display} - {slot_data.get('visa', 'N/A')}"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">🎉 美签预约时间-出现通知！</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">恭喜！您监控的美签预约Slot已开放！</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h3 style="color: #2196F3; margin-top: 0;">📋 匹配的Slot信息</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>🌍 国家：</strong>{country_display}</p>
                    <p><strong>🏙️ 城市：</strong>{city_display}</p>
                    <p><strong>📝 签证类型：</strong>{slot_data.get('visa', 'N/A')}</p>
                    <p><strong>📅 可用时间段：</strong></p>
                    <div style="margin-left: 20px; line-height: 1.8; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        {available_dates}
                    </div>
                </div>
                
                <h3 style="color: #2196F3; margin-top: 30px;">🎯 您的Slot监控配置</h3>
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p><strong>🌍 国家：</strong>{country_map.get(config.get('country', ''), config.get('country', 'N/A'))}</p>
                    <p><strong>🏙️ 城市：</strong>{city_display}</p>
                    <p><strong>📝 签证类型：</strong>{config.get('visa', 'N/A')}</p>
                    <p><strong>📅 日期范围：</strong></p>
                    <div style="margin-left: 20px; line-height: 1.8; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                        {date_ranges}
                    </div>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <p style="margin: 0; color: #856404; font-weight: bold;">⚠️ 请尽快登录美签预约系统进行预约！</p>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                <hr style="border: none; border-top: 1px solid #eee;">
                <p>此邮件由美签监控系统自动发送</p>
            </div>
        </div>
        </body>
        </html>
        """
        
        # 创建邮件
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = EMAIL_CONFIG['sender_email']
        msg['To'] = EMAIL_CONFIG['recipient_email']
        
        # 添加HTML内容
        html_part = MIMEText(body, 'html', 'utf-8')
        msg.attach(html_part)
        
        # 发送邮件
        if EMAIL_CONFIG['smtp_port'] == 465:
            # SSL连接
            with smtplib.SMTP_SSL(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
                server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
                server.send_message(msg)
        else:
            # STARTTLS连接
            with smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
                server.starttls()
                server.login(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['sender_password'])
                server.send_message(msg)
        
        logger.info(f"📧 邮件通知发送成功: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"📧 邮件发送失败: {e}")
        return False

def convert_frontend_config(frontend_data: Dict[str, Any]) -> Dict[str, Any]:
    """将前端数据转换为后端配置格式"""
    # 国家映射 - 四大洲
    country_map = {
        # 欧洲
        "英国": "gb", "爱尔兰": "ie", "法国": "fr", "德国": "de", "西班牙": "es", 
        "意大利": "it", "荷兰": "nl", "比利时": "be", "奥地利": "at", "瑞士": "ch",
        "瑞典": "se", "丹麦": "dk", "挪威": "no", "芬兰": "fi", "波兰": "pl",
        "捷克": "cz", "匈牙利": "hu", "罗马尼亚": "ro", "保加利亚": "bg", "希腊": "gr",
        "土耳其": "tr", "俄罗斯": "ru",
        
        # 北美洲
        "美国": "us", "加拿大": "ca", "墨西哥": "mx", "危地马拉": "gt", "哥斯达黎加": "cr",
        "巴拿马": "pa", "古巴": "cu", "牙买加": "jm", "巴巴多斯": "bb", "特立尼达和多巴哥": "tt",
        
        # 亚洲
        "中国": "cn", "香港": "hk", "日本": "jp", "韩国": "kr", "台湾": "tw",
        "新加坡": "sg", "泰国": "th", "菲律宾": "ph", "印度尼西亚": "id", "马来西亚": "my",
        "印度": "in", "孟加拉国": "bd", "巴基斯坦": "pk", "斯里兰卡": "lk", "缅甸": "mm",
        "越南": "vn", "柬埔寨": "kh", "老挝": "la", "蒙古": "mn", "哈萨克斯坦": "kz",
        
        # 大洋洲
        "澳大利亚": "au", "新西兰": "nz", "斐济": "fj", "巴布亚新几内亚": "pg", 
        "瓦努阿图": "vu", "所罗门群岛": "sb", "萨摩亚": "ws", "汤加": "to",
        
        # 南美洲
        "巴西": "br", "阿根廷": "ar", "智利": "cl", "秘鲁": "pe", "哥伦比亚": "co",
        "委内瑞拉": "ve", "厄瓜多尔": "ec", "玻利维亚": "bo", "巴拉圭": "py", "乌拉圭": "uy",
        "圭亚那": "gy", "苏里南": "sr",
        
        # 非洲
        "南非": "za", "埃及": "eg", "尼日利亚": "ng", "肯尼亚": "ke", "加纳": "gh",
        "摩洛哥": "ma", "突尼斯": "tn", "埃塞俄比亚": "et", "乌干达": "ug", "坦桑尼亚": "tz"
    }
    
    # 转换国家
    selected_countries = frontend_data.get("selectedCountries", [])
    country = ""
    if selected_countries:
        country = country_map.get(selected_countries[0], selected_countries[0])
    
    # 添加调试日志
    logger.info(f"🔍 前端原始数据: {json.dumps(frontend_data, ensure_ascii=False, indent=2)}")
    logger.info(f"🌍 选择的国家: {selected_countries}")
    logger.info(f"🌍 转换后的国家: {country}")
    
    # 转换签证类型
    selected_visa_types = frontend_data.get("selectedVisaTypes", [])
    visa = ""
    if selected_visa_types:
        visa = selected_visa_types[0]
    
    # 转换日期范围
    time_ranges = frontend_data.get("timeRanges", [])
    date_ranges = []
    for tr in time_ranges:
        start_date = tr.get("startDate", "")
        end_date = tr.get("endDate", "")
        if start_date and end_date:
            # 转换为yyyymmdd格式
            start_int = int(start_date.replace("-", ""))
            end_int = int(end_date.replace("-", ""))
            date_ranges.append([start_int, end_int])
    
    # 转换城市字段 - 领馆代码转换为城市名
    consulate_code = frontend_data.get("city", "")
    
    # 领馆代码到城市名的映射
    consulate_to_city_map = {
        # 中国
        "SH": "shanghai", "BJ": "beijing", "GZ": "guangzhou", "CD": "chengdu", "SY": "shenyang",
        "HKC": "hong kong",
        
        # 英国
        "LON": "london", "MAN": "manchester", "EDI": "edinburgh", "BFS": "belfast",
        
        # 加拿大
        "YYZ": "toronto", "YVR": "vancouver", "YUL": "montreal", "YYC": "calgary",
        
        # 日本
        "TYO": "tokyo", "OSA": "osaka", "NGO": "nagoya", "FUK": "fukuoka",
        
        # 韩国
        "SEL": "seoul", "PUS": "busan",
        
        # 台湾
        "TPE": "taipei", "KHH": "kaohsiung",
        
        # 新加坡
        "SGP": "singapore",
        
        # 泰国
        "BKK": "bangkok",
        
        # 马来西亚
        "KUL": "kuala lumpur",
        
        # 越南
        "HAN": "hanoi", "SGN": "ho chi minh city",
        
        # 印度
        "DEL": "delhi", "BOM": "mumbai", "BLR": "bangalore", "MAA": "chennai",
        
        # 以色列
        "TLV": "tel aviv",
        
        # 卡塔尔
        "DOH": "doha",
        
        # 沙特阿拉伯
        "RUH": "riyadh",
        
        # 阿联酋
        "DXB": "dubai",
        
        # 法国
        "PAR": "paris",
        
        # 西班牙
        "MAD": "madrid", "BCN": "barcelona",
        
        # 意大利
        "ROM": "rome", "MIL": "milan",
        
        # 比利时
        "BRU": "brussels",
        
        # 荷兰
        "AMS": "amsterdam",
        
        # 爱尔兰
        "DUB": "dublin",
        
        # 希腊
        "ATH": "athens",
        
        # 葡萄牙
        "LIS": "lisbon",
        
        # 土耳其
        "IST": "istanbul",
        
        # 德国
        "BER": "berlin", "MUC": "munich",
        
        # 丹麦
        "CPH": "copenhagen",
        
        # 芬兰
        "HEL": "helsinki",
        
        # 匈牙利
        "BUD": "budapest",
        
        # 挪威
        "OSL": "oslo",
        
        # 黑山
        "TGD": "podgorica",
        
        # 瑞典
        "STO": "stockholm",
        
        # 瑞士
        "ZRH": "zurich", "GVA": "geneva",
        
        # 墨西哥
        "MEX": "mexico city",
        
        # 智利
        "SCL": "santiago",
        
        # 巴西
        "GRU": "sao paulo", "RIO": "rio de janeiro",
        
        # 阿根廷
        "EZE": "buenos aires",
        
        # 哥伦比亚
        "BOG": "bogota",
        
        # 秘鲁
        "LIM": "lima",
        
        # 澳大利亚
        "SYD": "sydney", "MEL": "melbourne", "BNE": "brisbane", "PER": "perth", "ADL": "adelaide",
        
        # 新西兰
        "AKL": "auckland", "CHC": "christchurch"
    }
    
    # 转换领馆代码为城市名
    city = consulate_to_city_map.get(consulate_code, consulate_code.lower())
    
    # 添加调试日志
    logger.info(f"🏢 领馆代码: {consulate_code}")
    logger.info(f"🏙️ 转换后城市: {city}")
    
    return {
        "country": country,
        "city": city,  # 转换后的城市名
        "consulate": consulate_code,  # 保留原始领馆代码用于显示
        "visa": visa,
        "date_ranges": date_ranges,
        # 保留原始数据用于日志
        "selected_countries": selected_countries,
        "selected_visa_types": selected_visa_types,
        "timeRanges": time_ranges
    }

@app.post("/subscribe")
async def subscribe(cfg: Dict[str, Any]):
    """创建订阅"""
    sub_id = str(uuid.uuid4())
    SUBS[sub_id] = cfg
    CHANNELS[sub_id] = set()
    STATS["active_subscriptions"] = len(SUBS)
    logger.info(f"📝 创建订阅: {sub_id}")
    return {"sub_id": sub_id}

@app.websocket("/ws/{sub_id}")
async def ws_client(ws: WebSocket, sub_id: str):
    """WebSocket客户端连接"""
    await ws.accept()
    if sub_id not in CHANNELS:
        await ws.close()
        return
    
    CHANNELS[sub_id].add(ws)
    STATS["total_connections"] += 1
    logger.info(f"🔗 WebSocket连接: {sub_id}")
    
    try:
        while True:
            # 前端可以发送心跳或取消消息
            _ = await ws.receive_text()
    except WebSocketDisconnect:
        CHANNELS[sub_id].discard(ws)
        STATS["total_connections"] -= 1
        logger.info(f"🔌 WebSocket断开: {sub_id}")

@app.post("/monitor/start-from-frontend")
async def start_monitor_from_frontend(frontend_data: Dict[str, Any]):
    """从前端启动监控"""
    try:
        # 转换前端数据
        config = convert_frontend_config(frontend_data)
        
        # 保存原始数据到历史记录
        FRONTEND_DATA_HISTORY.append({
            "timestamp": asyncio.get_event_loop().time(),
            "data": frontend_data,
            "converted_config": config
        })
        
        # 创建订阅
        sub_id = str(uuid.uuid4())
        SUBS[sub_id] = config
        CHANNELS[sub_id] = set()
        STATS["active_subscriptions"] = len(SUBS)
        
        logger.info(f"🚀 从前端启动监控: {sub_id}")
        logger.info(f"📋 配置: {json.dumps(config, ensure_ascii=False, indent=2)}")
        
        return {
            "success": True,
            "sub_id": sub_id,
            "message": "监控已启动"
        }
        
    except Exception as e:
        logger.error(f"❌ 启动监控失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/status")
async def get_status():
    """获取监控状态"""
    return {
        "running": True,
        "stats": STATS,
        "active_subscriptions": len(SUBS)
    }

@app.get("/config")
async def get_config():
    """获取当前配置"""
    if SUBS:
        # 返回最新的配置
        latest_sub_id = list(SUBS.keys())[-1]
        return SUBS[latest_sub_id]
    return {}

@app.get("/slots")
async def get_slots():
    """获取匹配的槽位"""
    return {"slots": []}  # 暂时返回空，可以扩展为返回历史匹配记录

@app.get("/submitted-data")
async def get_submitted_data():
    """获取前端提交的数据历史"""
    return {"history": FRONTEND_DATA_HISTORY}

@app.get("/data-summary")
async def get_data_summary():
    """获取数据摘要"""
    if not FRONTEND_DATA_HISTORY:
        return {"summary": "暂无数据"}
    
    # 统计最常选择的国家和签证类型
    countries = []
    visa_types = []
    
    for record in FRONTEND_DATA_HISTORY:
        data = record["data"]
        countries.extend(data.get("selectedCountries", []))
        visa_types.extend(data.get("selectedVisaTypes", []))
    
    from collections import Counter
    country_counts = Counter(countries)
    visa_counts = Counter(visa_types)
    
    return {
        "summary": {
            "total_submissions": len(FRONTEND_DATA_HISTORY),
            "most_selected_countries": country_counts.most_common(3),
            "most_selected_visa_types": visa_counts.most_common(3)
        }
    }

@app.post("/monitor/stop")
async def stop_monitor():
    """停止所有监控"""
    global SUBS, CHANNELS, MATCHED_SLOTS
    
    # 关闭所有WebSocket连接
    for sub_id, connections in CHANNELS.items():
        for ws in connections:
            try:
                await ws.close()
            except:
                pass
    
    # 清空数据
    SUBS.clear()
    CHANNELS.clear()
    MATCHED_SLOTS.clear()
    STATS["active_subscriptions"] = 0
    STATS["total_connections"] = 0
    
    logger.info("🛑 所有监控已停止")
    return {"success": True, "message": "监控已停止"}

async def upstream_consumer():
    """上游WebSocket消费者"""
    backoff = 1
    while True:
        try:
            logger.info("🔗 连接上游WebSocket...")
            async with websockets.connect(WS_UPSTREAM, extra_headers=HEADERS) as upstream:
                logger.info("✅ 上游WebSocket连接成功")
                backoff = 1
                
                async for msg in upstream:
                    try:
                        slot = json.loads(msg)
                        STATS["total_messages"] += 1
                        STATS["last_activity"] = asyncio.get_event_loop().time()
                        
                        # 检查是否有活跃订阅
                        if not SUBS:
                            continue
                        
                        STATS["total_slots"] += 1
                        
                        # 为每个订阅检查匹配
                        for sub_id, cfg in list(SUBS.items()):
                            try:
                                if slot_match(slot, cfg):
                                    STATS["matched_slots"] += 1
                                    
                                    # 创建槽位唯一标识
                                    slot_key = f"{slot.get('country', '')}_{slot.get('city', '')}_{slot.get('visa', '')}_{slot.get('from', '')}"
                                    
                                    # 检查是否已经匹配过这个槽位
                                    if slot_key not in MATCHED_SLOTS:
                                        MATCHED_SLOTS.add(slot_key)
                                        
                                        logger.info(f"🎯 匹配成功！订阅: {sub_id}")
                                        logger.info(f"📋 槽位: {json.dumps(slot, ensure_ascii=False, indent=2)}")
                                        
                                        # 发送邮件通知
                                        send_email_notification(slot, cfg)
                                        
                                        # 推送到WebSocket客户端
                                        payload = json.dumps(slot, ensure_ascii=False)
                                        dead_connections = []
                                        
                                        for ws in CHANNELS.get(sub_id, []):
                                            try:
                                                await ws.send_text(payload)
                                            except Exception:
                                                dead_connections.append(ws)
                                        
                                        # 清理死连接
                                        for ws in dead_connections:
                                            CHANNELS[sub_id].discard(ws)
                                            STATS["total_connections"] -= 1
                                        
                                        # 匹配成功后停止该订阅的监控
                                        logger.info(f"🛑 停止订阅 {sub_id} 的监控（已匹配成功）")
                                        if sub_id in SUBS:
                                            del SUBS[sub_id]
                                        if sub_id in CHANNELS:
                                            # 关闭该订阅的所有WebSocket连接
                                            for ws in CHANNELS[sub_id]:
                                                try:
                                                    await ws.close()
                                                except:
                                                    pass
                                            del CHANNELS[sub_id]
                                        
                                        STATS["active_subscriptions"] = len(SUBS)
                                        
                                    else:
                                        logger.info(f"⏭️ 跳过重复槽位: {slot_key}")
                                        
                            except Exception as e:
                                logger.error(f"❌ 检查订阅 {sub_id} 匹配时出错: {e}")
                                continue
                                
                    except json.JSONDecodeError:
                        continue
                    except Exception as e:
                        logger.error(f"❌ 处理上游消息时出错: {e}")
                        continue
                        
        except Exception as e:
            logger.error(f"❌ 上游WebSocket错误: {e}")
        
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 60)

@app.on_event("startup")
async def startup_event():
    """启动事件"""
    asyncio.create_task(upstream_consumer())

@app.get("/", response_class=HTMLResponse)
async def root():
    """根路径，返回监控仪表板"""
    with open("monitor_dashboard.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)

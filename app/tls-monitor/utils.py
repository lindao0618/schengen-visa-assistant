import json
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_config(config_path: str = "config.json") -> Dict[str, Any]:
    """加载配置文件"""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"加载配置文件失败: {e}")
        return {}

def format_slot(slot: Dict[str, Any]) -> str:
    """格式化slot信息（适配实际WebSocket数据结构）"""
    # 使用实际的WebSocket数据字段
    visa_country = slot.get('visa_country', 'N/A').upper()
    app_country = slot.get('application_country', 'N/A').upper()
    app_city = slot.get('application_city', 'N/A').upper()
    visa_type = slot.get('visa_type', 'N/A')
    travel_purpose = slot.get('travel_purpose', 'N/A')
    appointment_type = slot.get('appointment_type', 'N/A')
    
    # 处理datetimes数组
    datetimes = slot.get('datetimes', [])
    if datetimes and len(datetimes) > 0:
        first_datetime = datetimes[0]
        date_info = f"{first_datetime.get('date', 'N/A')} {first_datetime.get('time', 'N/A')}"
        if len(datetimes) > 1:
            date_info += f" (+{len(datetimes)-1}个时间段)"
    else:
        date_info = 'N/A'
    
    return (
        f"🌍 ({app_country} {app_city}) → {visa_country} | "
        f"📅 {date_info} | "
        f"🛂 {visa_type} | "
        f"✈️ {travel_purpose} | "
        f"📋 {appointment_type}"
    )

def slot_matches_filter(slot: Dict[str, Any], config: Dict[str, Any]) -> bool:
    """检查slot是否匹配过滤器（适配实际WebSocket数据结构）"""
    filters = config.get('filters', {})
    
    # 国家过滤（使用实际的字段名）
    allowed_countries = filters.get('allowed_countries', [])
    # WebSocket数据使用 visa_country 字段
    country = slot.get('visa_country', '').lower()
    if allowed_countries and country not in allowed_countries:
        return False
    
    # 城市过滤（使用实际的字段名）
    allowed_cities = filters.get('allowed_cities', [])
    # WebSocket数据使用 application_city 字段
    city = slot.get('application_city', '').upper()
    if allowed_cities and city not in allowed_cities:
        return False
    
    # Slot类型过滤（appointment_type字段）
    allowed_slot_types = filters.get('allowed_slot_types', [])
    if allowed_slot_types:
        # WebSocket数据使用 appointment_type 字段
        raw_slot_type = slot.get('appointment_type', '').lower().strip()
        
        # 建立WebSocket数据类型与前端类型的映射关系
        slot_type_mapping = {
            'normal': 'normal',
            'prime time': 'prime_time',  # WebSocket中是"prime time"，前端是"prime_time"
            'premium': 'premium'
        }
        
        # 将WebSocket类型标准化为前端格式
        normalized_slot_type = slot_type_mapping.get(raw_slot_type, raw_slot_type)
        
        # 检查标准化后的类型是否在允许列表中
        if normalized_slot_type not in [t.lower() for t in allowed_slot_types]:
            logger.debug(f"🔍 [类型过滤] slot类型不匹配: WebSocket='{raw_slot_type}' -> 标准化='{normalized_slot_type}', 允许类型={allowed_slot_types}")
            return False
        else:
            logger.debug(f"✅ [类型过滤] slot类型匹配成功: WebSocket='{raw_slot_type}' -> 标准化='{normalized_slot_type}'")
    
    # 日期范围过滤（适配 datetimes 数组结构）
    min_date_str = filters.get('min_date', '')
    max_date_str = filters.get('max_date', '')
    
    if min_date_str or max_date_str:
        try:
            min_date = None
            max_date = None
            
            if min_date_str:
                min_date = datetime.strptime(min_date_str, '%Y-%m-%d').date()
            if max_date_str:
                max_date = datetime.strptime(max_date_str, '%Y-%m-%d').date()
            
            # WebSocket数据使用 datetimes 数组
            datetimes = slot.get('datetimes', [])
            if datetimes:
                # 检查是否有任何日期在指定范围内
                date_matched = False
                for dt in datetimes:
                    if isinstance(dt, dict) and 'date' in dt:
                        slot_date = datetime.strptime(dt['date'], '%Y-%m-%d').date()
                        
                        # 检查日期是否在范围内
                        date_in_range = True
                        if min_date and slot_date < min_date:
                            date_in_range = False
                        if max_date and slot_date > max_date:
                            date_in_range = False
                        
                        if date_in_range:
                            date_matched = True
                            logger.debug(f"✅ [日期过滤] 日期匹配成功: {dt['date']} 在范围 [{min_date_str} - {max_date_str}] 内")
                            break
                        else:
                            logger.debug(f"❌ [日期过滤] 日期不匹配: {dt['date']} 不在范围 [{min_date_str} - {max_date_str}] 内")
                
                if not date_matched:
                    logger.debug(f"🔍 [日期过滤] 所有日期都不在指定范围内")
                    return False
            else:
                logger.debug(f"🔍 [日期过滤] slot无日期信息，跳过日期检查")
                return False
        except ValueError as e:
            logger.warning(f"日期格式错误: {e}")
            return False
    
    return True

def create_slot_id(slot: Dict[str, Any]) -> str:
    """创建slot的唯一ID"""
    country = slot.get('country', '')
    city = slot.get('city', '')
    visa_type = slot.get('visa_type', '')
    slot_date = slot.get('date', '')
    center = slot.get('application_center', '')
    
    return f"{country}_{city}_{visa_type}_{slot_date}_{center}".lower()

def is_valid_slot(slot: Dict[str, Any]) -> bool:
    """验证slot数据是否有效"""
    required_fields = ['country', 'city', 'visa_type', 'date']
    return all(field in slot and slot[field] for field in required_fields)

def parse_date(date_str: str) -> Optional[date]:
    """解析日期字符串"""
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None

def get_slot_priority(slot: Dict[str, Any]) -> int:
    """获取slot优先级（用于排序）"""
    priority = 0
    
    # 日期越近优先级越高
    slot_date = parse_date(slot.get('date', ''))
    if slot_date:
        days_until = (slot_date - date.today()).days
        if days_until <= 7:
            priority += 100
        elif days_until <= 30:
            priority += 50
    
    # 热门国家优先级更高
    hot_countries = ['gb', 'fr', 'de', 'es']
    if slot.get('country', '').lower() in hot_countries:
        priority += 20
    
    return priority 
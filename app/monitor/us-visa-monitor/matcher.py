# matcher.py
import logging

logger = logging.getLogger(__name__)

CONFIG_KEYS = ("country", "consulate", "date_ranges", "visa")

CITY_MAP = {
    # 英国
    "london": "LON", "manchester": "MAN", "belfast": "BFS", "edinburgh": "EDI", 
    "birmingham": "BHM", "glasgow": "GLA", "cardiff": "CDF", "leeds": "LDS",
    
    # 加拿大
    "toronto": "YYZ", "vancouver": "YVR", "montreal": "YUL", "ottawa": "YOW",
    "calgary": "YYC", "edmonton": "YEG", "halifax": "YHZ", "winnipeg": "YWG",
    
    # 美国
    "new york": "NYC", "los angeles": "LAX", "chicago": "ORD", "miami": "MIA",
    "houston": "IAH", "dallas": "DFW", "atlanta": "ATL", "boston": "BOS",
    "seattle": "SEA", "denver": "DEN", "phoenix": "PHX", "las vegas": "LAS",
    
    # 日本
    "tokyo": "TYO", "osaka": "OSA", "kyoto": "KYO", "nagoya": "NGO",
    "sapporo": "CTS", "fukuoka": "FUK", "kobe": "UKB", "yokohama": "YOK",
    
    # 澳大利亚
    "sydney": "SYD", "melbourne": "MEL", "brisbane": "BNE", "perth": "PER",
    "adelaide": "ADL", "canberra": "CBR", "darwin": "DRW", "hobart": "HBA",
    
    # 新西兰
    "auckland": "AKL", "wellington": "WLG", "christchurch": "CHC", "hamilton": "HLZ",
    
    # 爱尔兰
    "dublin": "DUB", "cork": "ORK", "galway": "GWY", "limerick": "SNN",
    
    # 其他常见城市
    "paris": "CDG", "berlin": "BER", "madrid": "MAD", "rome": "FCO",
    "amsterdam": "AMS", "brussels": "BRU", "vienna": "VIE", "zurich": "ZRH",
    "stockholm": "ARN", "copenhagen": "CPH", "oslo": "OSL", "helsinki": "HEL",
    "warsaw": "WAW", "prague": "PRG", "budapest": "BUD", "bucharest": "OTP",
    "sofia": "SOF", "athens": "ATH", "istanbul": "IST", "moscow": "SVO",
    "beijing": "PEK", "shanghai": "SHA", "guangzhou": "CAN", "shenzhen": "SZX",
    "hong kong": "HKG", "taipei": "TPE", "seoul": "ICN", "singapore": "SIN",
    "bangkok": "BKK", "manila": "MNL", "jakarta": "CGK", "kuala lumpur": "KUL",
    "mumbai": "BOM", "delhi": "DEL", "bangalore": "BLR", "chennai": "MAA",
    "kolkata": "CCU", "hyderabad": "HYD", "pune": "PNQ", "ahmedabad": "AMD",
    "mexico city": "MEX", "guadalajara": "GDL", "monterrey": "MTY", "tijuana": "TIJ",
    "sao paulo": "GRU", "rio de janeiro": "GIG", "buenos aires": "EZE", "santiago": "SCL",
    "lima": "LIM", "bogota": "BOG", "caracas": "CCS", "panama city": "PTY",
    "kingston": "KIN", "bridgetown": "BGI", "port of spain": "POS", "georgetown": "GEO",
    "nassau": "NAS", "havana": "HAV", "santo domingo": "SDQ", "san juan": "SJU"
}

# 反向映射：从领馆代码到城市名称
CONSULATE_TO_CITY = {code: city for city, code in CITY_MAP.items()}

def to_consulate_code(raw_city: str) -> str:
    """将原始城市名转换为领馆代码"""
    if not raw_city:
        return ""
    rc = raw_city.lower().strip()
    return CITY_MAP.get(rc, rc.upper())

def consulate_to_city(consulate_code: str) -> str:
    """将领馆代码转换为城市名称"""
    if not consulate_code:
        return ""
    return CONSULATE_TO_CITY.get(consulate_code.upper(), consulate_code.lower())

def slot_match(slot: dict, cfg: dict) -> bool:
    """检查槽位是否匹配配置"""
    try:
        # 记录开始匹配
        logger.info(f"🔍 开始匹配槽位: {slot.get('city', 'N/A')} - {slot.get('visa', 'N/A')}")
        logger.info(f"📋 当前配置:")
        logger.info(f"  国家: {cfg.get('country', 'N/A')}")
        logger.info(f"  领馆: {cfg.get('consulate', 'N/A')}")
        logger.info(f"  签证: {cfg.get('visa', 'N/A')}")
        logger.info(f"  日期范围: {cfg.get('date_ranges', [])}")
        
        # 打印前端原始数据
        logger.info(f"📥 前端原始数据:")
        logger.info(f"  selected_countries: {cfg.get('selected_countries', [])}")
        logger.info(f"  selected_visa_types: {cfg.get('selected_visa_types', [])}")
        logger.info(f"  timeRanges: {cfg.get('timeRanges', [])}")
        
        # 打印数据转换过程
        logger.info(f"🔄 数据转换过程:")
        logger.info(f"  前端国家: {cfg.get('selected_countries', [])} -> 转换后: {cfg.get('country', '')}")
        logger.info(f"  前端签证: {cfg.get('selected_visa_types', [])} -> 转换后: {cfg.get('visa', '')}")
        logger.info(f"  前端日期: {cfg.get('timeRanges', [])} -> 转换后: {cfg.get('date_ranges', [])}")
        
        # 1. 国家匹配
        slot_country = slot.get("country", "").lower()
        cfg_country = cfg.get("country", "").lower()
        logger.info(f"🌍 国家匹配检查:")
        logger.info(f"  槽位国家: {slot_country}")
        logger.info(f"  配置国家: {cfg_country}")
        
        if slot_country != cfg_country:
            logger.info(f"  ❌ 国家不匹配")
            return False
        logger.info(f"  ✓ 国家匹配")
        
        # 2. 城市匹配 - 修改后的逻辑
        slot_city = slot.get("city", "").lower().strip()
        cfg_consulate = cfg.get("consulate", "").upper()
        
        # 将配置中的领馆代码转换为对应的城市名称
        expected_city = consulate_to_city(cfg_consulate)
        
        logger.info(f"🏙️ 城市匹配检查:")
        logger.info(f"  槽位城市: {slot_city}")
        logger.info(f"  配置领馆: {cfg_consulate}")
        logger.info(f"  期望城市: {expected_city}")
        
        # 如果没有配置领馆，或者城市不匹配
        if cfg_consulate and slot_city != expected_city:
            logger.info(f"  ❌ 城市不匹配")
            return False
        logger.info(f"  ✓ 城市匹配")
        
        # 3. 签证类型匹配 - 改进的逻辑
        slot_visa = slot.get("visa", "").upper()
        cfg_visa = cfg.get("visa", "").upper()
        
        logger.info(f"📝 签证类型匹配检查:")
        logger.info(f"  槽位签证: {slot_visa}")
        logger.info(f"  配置签证: {cfg_visa}")
        
        if cfg_visa:
            # 将配置的签证类型拆分为关键字（如 "B1/B2" -> ["B1", "B2"]）
            visa_keywords = []
            if "/" in cfg_visa:
                visa_keywords = [kw.strip() for kw in cfg_visa.split("/")]
            else:
                visa_keywords = [cfg_visa]
            
            # 检查槽位签证是否包含任何一个关键字
            visa_match = False
            for keyword in visa_keywords:
                if keyword in slot_visa:
                    logger.info(f"  ✓ 找到关键字: {keyword}")
                    visa_match = True
                    break
            
            if not visa_match:
                logger.info(f"  ❌ 签证类型不匹配 - 未找到关键字: {visa_keywords}")
                return False
        logger.info(f"  ✓ 签证类型匹配")
        
        # 4. 日期范围匹配
        slot_dates = slot.get("dates", [])
        cfg_date_ranges = cfg.get("date_ranges", [])
        
        logger.info(f"📅 日期范围匹配检查:")
        logger.info(f"  槽位日期: {slot_dates}")
        logger.info(f"  配置范围: {cfg_date_ranges}")
        
        if not cfg_date_ranges:
            logger.info(f"  ✓ 无日期限制，默认匹配")
        else:
            date_match = False
            for slot_date in slot_dates:
                for date_range in cfg_date_ranges:
                    if len(date_range) >= 2:
                        start_date = date_range[0]
                        end_date = date_range[1]
                        if start_date <= slot_date <= end_date:
                            logger.info(f"  ✓ 日期 {slot_date} 在范围 {start_date}-{end_date} 内")
                            date_match = True
                            break
                if date_match:
                    break
            
            if not date_match:
                logger.info(f"  ❌ 日期不在允许范围内")
                return False
        
        # 所有条件都匹配
        logger.info(f"🎯 所有条件匹配成功！")
        logger.info(f"  国家: {slot_country} ✓")
        logger.info(f"  城市: {slot_city} ✓")
        logger.info(f"  签证: {slot_visa} ✓")
        logger.info(f"  日期: {slot_dates} ✓")
        
        return True
        
    except Exception as e:
        logger.error(f"检查槽位匹配时出错: {e}")
        return False

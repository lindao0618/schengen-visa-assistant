#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# pip install requests

import json, re, time, requests
from typing import Any, Dict, Tuple, Optional
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('us_slot_appoint.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TOKEN = "9513a9ba-c388-4d5d-8ed5-408c0d5ec658"

ENDPOINTS = {
    "ais":    "https://us-ais.vis.lol/api/users",
    "cgi-v2": "https://us-cgi-v2.vis.lol/api/users", 
    "avits":  "https://us-avits.vis.lol/api/users",
}

# 城市代码映射表
CITY_MAPPING = {
    # 中国城市
    "SH": "Shanghai", "BJ": "Beijing", "GZ": "Guangzhou", "CD": "Chengdu", 
    "SY": "Shenyang", "HKC": "Hong Kong",
    # 英国城市
    "LON": "London", "MAN": "Manchester", "EDI": "Edinburgh", "BFS": "Belfast",
    # 加拿大城市
    "YYZ": "Toronto", "YVR": "Vancouver", "YUL": "Montreal", "YYC": "Calgary",
    # 澳大利亚城市
    "SYD": "Sydney", "MEL": "Melbourne", "BNE": "Brisbane", "PER": "Perth",
    # 其他国家城市
    "MEX": "Mexico City", "SCL": "Santiago", "GRU": "Sao Paulo", "EZE": "Buenos Aires",
    "BOG": "Bogota", "LIM": "Lima", "AKL": "Auckland", "CHC": "Christchurch"
}

FIRST_WAIT_SECONDS = 60
RETRY_INTERVAL     = 10
MAX_POLLS          = 120
PAGE_SIZE          = 50

def to_int_date(s: str) -> int:
    """将 YYYY-MM-DD 格式转换为 YYYYMMDD 整数"""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if not m: 
        raise ValueError(f"非法日期格式: {s}，期望 YYYY-MM-DD")
    return int(m.group(1) + m.group(2) + m.group(3))

def map_city_code(city_code: str) -> str:
    """映射城市代码到实际城市名"""
    return CITY_MAPPING.get(city_code.upper(), city_code)

def make_filters(date_ranges: list, city: Optional[str] = None, skip_days: int = 0) -> list:
    """构造过滤器数组"""
    cities = [map_city_code(city)] if city else []
    arr = []
    for dr in (date_ranges or []):
        arr.append({
            "cities": cities,
            "from": to_int_date(dr["startDate"]),
            "to": to_int_date(dr["endDate"]),
            "skip_days": int(skip_days),
        })
    return arr

def map_form(system: str, form: Dict[str, Any]) -> Tuple[str, str, str, Dict[str, Any]]:
    """映射表单数据到对应系统的payload"""
    url = ENDPOINTS.get(system)
    if not url: 
        raise ValueError(f"不支持的系统: {system}")

    country = str(form["country"]).lower()
    
    logger.info(f"映射 {system} 系统表单数据，国家: {country}")

    if system == "ais":
        payload = {
            "action": "create",
            "country": country,
            "email": form["email"],
            "password": form["password"],
            "ivr": str(form.get("ivrNumber") or form.get("ivr") or "").strip(),
            "language": "zh",
            "filters": make_filters(form.get("dateRanges"), form.get("city"), 0),
        }
        return url, "email", payload["email"], payload

    elif system == "cgi-v2":
        # 处理安全问题，确保有3个
        sq = []
        for qa in (form.get("securityQuestions") or []):
            sq.append({
                "question": (qa.get("question") or "").strip(),
                "answer": (qa.get("answer") or "").strip()
            })
        
        # 如果安全问题不足3个，补充空的安全问题
        while len(sq) < 3:
            sq.append({"question": "", "answer": ""})
        
        payload = {
            "action": "create",
            "country": country,
            "username": form["username"],
            "password": form["password"],
            "language": "zh",
            "link_appointment_cities": bool(form.get("link_appointment_cities", True)),
            "security_questions": sq,
            "filters": make_filters(form.get("dateRanges"), form.get("city"), 1),
        }
        return url, "username", payload["username"], payload

    elif system == "avits":
        payload = {
            "action": "create",
            "application_id": form.get("application_id") or form.get("groupId") or "",
            "country": country,
            "username": form["username"],
            "password": form["password"],
            "language": "zh",
            "filters": make_filters(form.get("dateRanges"), form.get("city"), 0),
        }
        return url, "username", payload["username"], payload

    else:
        raise ValueError(f"不支持的系统: {system}")

def sess():
    """创建带重试的会话"""
    s = requests.Session()
    retry = Retry(
        total=3, 
        connect=3, 
        read=3, 
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET","POST"])
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s

def post_headers():
    """POST请求头"""
    return {
        "x-vis-lol-token": TOKEN,
        "X-Vis-Lol-Token": TOKEN,
        "X-Vis-Lol-Api": "1",
        "Origin": "https://vis.lol",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PythonRequests/2.x",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",
    }

def get_headers():
    """GET请求头"""
    return {
        "X-Vis-Lol-Api": "1",
        "X-Vis-Lol-Token": TOKEN,
        "Origin": "https://vis.lol",
        "Referer": "https://vis.lol/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PythonRequests/2.x",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
    }

def submit(system: str, form: Dict[str, Any]) -> Dict[str, Any]:
    """提交表单到对应系统"""
    url, id_field, id_value, payload = map_form(system, form)
    
    # 记录提交信息（隐藏敏感数据）
    safe_payload = payload.copy()
    safe_payload["password"] = "***"
    if "security_questions" in safe_payload:
        safe_payload["security_questions"] = [{"question": q["question"], "answer": "***"} for q in safe_payload["security_questions"]]
    
    logger.info(f"提交到 {system} 系统: {url}")
    logger.info(f"标识字段: {id_field} = {id_value}")
    logger.info(f"Payload: {json.dumps(safe_payload, ensure_ascii=False, indent=2)}")
    
    s = sess()
    try:
        r = s.post(url, headers=post_headers(), data=json.dumps(payload), timeout=20)
        logger.info(f"提交响应状态码: {r.status_code}")
        
        if r.status_code == 200:
            logger.info("提交成功")
        else:
            logger.warning(f"提交可能失败，状态码: {r.status_code}")
            if r.text:
                logger.warning(f"响应内容: {r.text}")
                
    except Exception as e:
        logger.error(f"提交请求异常: {e}")
        raise
    
    return {
        "system": system, 
        "url": url, 
        "id_field": id_field, 
        "id_value": id_value, 
        "payload": safe_payload
    }

def error_is_empty(v) -> bool:
    """判断错误字段是否为空"""
    if v is None: 
        return True
    s = str(v).strip().lower()
    return s in ("", "none", "null")

def poll(system: str, id_field: str, id_value: str) -> Dict[str, Any]:
    """轮询检查提交结果"""
    url = ENDPOINTS[system]
    s = sess()
    
    logger.info(f"等待 {FIRST_WAIT_SECONDS} 秒后开始轮询 {system} 系统...")
    time.sleep(FIRST_WAIT_SECONDS)

    for i in range(1, MAX_POLLS + 1):
        offset = 0
        hits = []
        
        # 分页查询所有记录
        while True:
            try:
                r = s.get(
                    url, 
                    headers=get_headers(),
                    params={"offset": str(offset), "limit": str(PAGE_SIZE)}, 
                    timeout=20
                )
                
                if r.status_code != 200:
                    logger.warning(f"查询失败，状态码: {r.status_code}")
                    break
                    
                data = r.json()
                page = data.get("data") or []
                
                # 查找匹配的记录
                for it in page:
                    # 兼容不同返回字段
                    v = str(it.get(id_field) or it.get("email") or it.get("username") or "").lower()
                    if v == str(id_value).lower():
                        hits.append(it)
                
                if len(page) < PAGE_SIZE: 
                    break
                offset += PAGE_SIZE
                
            except Exception as e:
                logger.error(f"查询异常: {e}")
                break

        if hits:
            # 保存找到的记录
            with open(f"submit_check_{system}_{id_value}.json", "w", encoding="utf-8") as f:
                json.dump(hits, f, ensure_ascii=False, indent=2)
            
            logger.info(f"找到 {len(hits)} 条记录，已保存到 submit_check_{system}_{id_value}.json")
            
            results = []
            for idx, it in enumerate(hits, 1):
                st = it.get("status")
                err = it.get("error")
                ident_show = it.get(id_field) or it.get("email") or it.get("username")
                
                if error_is_empty(err):
                    logger.info(f"[成功] #{idx} {ident_show} status={st} -> 提交成功（error为空）")
                    results.append({
                        "index": idx,
                        "identifier": ident_show,
                        "status": st,
                        "error": err,
                        "success": True
                    })
                else:
                    logger.error(f"[失败] #{idx} {ident_show} status={st} -> 提交失败：{err}")
                    results.append({
                        "index": idx,
                        "identifier": ident_show,
                        "status": st,
                        "error": err,
                        "success": False
                    })
            
            return {
                "found": True,
                "count": len(hits),
                "results": results,
                "poll_count": i
            }

        logger.info(f"[{i}/{MAX_POLLS}] 未找到记录，{RETRY_INTERVAL} 秒后重试...")
        time.sleep(RETRY_INTERVAL)

    logger.warning("轮询超时：仍未出现该账号的记录")
    return {
        "found": False,
        "count": 0,
        "results": [],
        "poll_count": MAX_POLLS
    }

def submit_and_check(system: str, form_data: Dict[str, Any]) -> Dict[str, Any]:
    """完整的提交和检查流程"""
    logger.info(f"开始处理 {system} 系统提交")
    
    try:
        # 1. 提交
        submit_result = submit(system, form_data)
        
        # 2. 轮询检查
        poll_result = poll(
            submit_result["system"], 
            submit_result["id_field"], 
            submit_result["id_value"]
        )
        
        # 3. 合并结果
        final_result = {
            "system": system,
            "submit": submit_result,
            "poll": poll_result,
            "success": poll_result["found"] and any(r["success"] for r in poll_result["results"])
        }
        
        logger.info(f"{system} 系统处理完成，最终结果: {'成功' if final_result['success'] else '失败'}")
        return final_result
        
    except Exception as e:
        logger.error(f"{system} 系统处理异常: {e}")
        return {
            "system": system,
            "error": str(e),
            "success": False
        }

# ====== 示例调用 ======
if __name__ == "__main__":
    # 1) CGI-V2（中国）
    cgi_form_data = {
        "country": "cn",
        "city": "SH",
        "dateRanges": [
            {"startDate": "2024-12-01", "endDate": "2024-12-31"},
            {"startDate": "2025-01-01", "endDate": "2025-01-31"}
        ],
        "email": "zhang.san@example.com",
        "phone": "13800138000",
        "username": "zhang.san@example.com",
        "password": "mypassword123",
        "securityQuestions": [
            {"question": "您最喜欢的颜色是什么？", "answer": "红色"},
            {"question": "您的出生地是哪里？", "answer": "上海"},
            {"question": "您最喜欢的食物是什么？", "answer": "小笼包"},
        ],
        "groupSize": 2,
        "isExpedited": True
    }
    
    result = submit_and_check("cgi-v2", cgi_form_data)
    print(f"CGI-V2 结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    # 2) AIS（英国）
    ais_form_data = {
        "country": "gb",
        "city": "LON",
        "dateRanges": [
            {"startDate": "2024-12-15", "endDate": "2025-01-15"}
        ],
        "email": "john.smith@example.com",
        "username": "john.smith@example.com",
        "password": "ukpassword456",
        "ivrNumber": "12345678",
        "groupSize": 1,
        "isExpedited": False
    }
    
    # result = submit_and_check("ais", ais_form_data)
    # print(f"AIS 结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    # 3) AVITS（澳大利亚）
    avits_form_data = {
        "country": "au",
        "city": "SYD",
        "dateRanges": [
            {"startDate": "2025-01-01", "endDate": "2025-02-28"},
            {"startDate": "2025-03-01", "endDate": "2025-03-31"}
        ],
        "email": "mike.wilson@example.com",
        "username": "mike.wilson@example.com",
        "password": "aupassword789",
        "groupId": "GROUP123456",
        "groupSize": 3,
        "isExpedited": True
    }
    
    # result = submit_and_check("avits", avits_form_data)
    # print(f"AVITS 结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

#!/usr/bin/env python3
"""
模拟WebSocket数据格式
显示可能的TLS WebSocket数据格式
"""

import json
import time

def show_sample_data():
    """显示示例数据格式"""
    
    print("🔌 TLS WebSocket 数据格式示例")
    print("=" * 50)
    
    # 示例1: 列表格式的槽位数据
    sample_list_data = [
        {
            "application_country": "cn",
            "application_city": "SHA",
            "visa_type": "short_stay",
            "date": "2025-09-15",
            "application_center": "Shanghai TLS Contact",
            "appointment_type": "normal",
            "datetimes": [
                {
                    "date": "2025-09-15",
                    "time": "09:30"
                }
            ]
        },
        {
            "country": "cn",
            "city": "SHA", 
            "visa_type": "short_stay",
            "date": "2025-09-16",
            "application_center": "Shanghai TLS Contact",
            "appointment_type": "prime_time",
            "datetimes": [
                {
                    "date": "2025-09-16",
                    "time": "14:00"
                }
            ]
        }
    ]
    
    print("📋 示例1: 列表格式 (多个槽位)")
    print(json.dumps(sample_list_data, indent=2, ensure_ascii=False))
    print("\n" + "-" * 50)
    
    # 示例2: 单个槽位数据
    sample_single_data = {
        "application_country": "cn",
        "application_city": "SHA",
        "visa_type": "short_stay", 
        "date": "2025-09-17",
        "application_center": "Shanghai TLS Contact",
        "appointment_type": "normal",
        "datetimes": [
            {
                "date": "2025-09-17",
                "time": "10:30"
            }
        ]
    }
    
    print("🎯 示例2: 单个槽位格式")
    print(json.dumps(sample_single_data, indent=2, ensure_ascii=False))
    print("\n" + "-" * 50)
    
    # 示例3: 状态消息
    sample_status_data = {
        "type": "status",
        "message": "Connected to TLS WebSocket",
        "timestamp": "2025-08-25T23:30:00Z"
    }
    
    print("📊 示例3: 状态消息格式")
    print(json.dumps(sample_status_data, indent=2, ensure_ascii=False))
    print("\n" + "-" * 50)
    
    # 示例4: 错误消息
    sample_error_data = {
        "type": "error",
        "message": "Invalid token",
        "code": 401
    }
    
    print("❌ 示例4: 错误消息格式")
    print(json.dumps(sample_error_data, indent=2, ensure_ascii=False))
    print("\n" + "-" * 50)
    
    # 字段说明
    print("📝 字段说明:")
    print("🌍 国家字段:")
    print("  - application_country: 申请国家代码 (如: cn, uk, us)")
    print("  - country: 国家代码 (如: cn, uk, us)")
    print("  - applicant_country: 申请人国家代码")
    print()
    print("🏢 城市字段:")
    print("  - application_city: 申请城市代码 (如: SHA, PEK, LON)")
    print("  - city: 城市代码 (如: SHA, PEK, LON)")
    print("  - applicant_city: 申请人城市代码")
    print()
    print("📅 时间字段:")
    print("  - date: 预约日期 (YYYY-MM-DD)")
    print("  - datetimes: 时间范围数组")
    print("    - date: 具体日期")
    print("    - time: 具体时间 (HH:MM)")
    print()
    print("🎯 其他字段:")
    print("  - visa_type: 签证类型 (如: short_stay, long_stay)")
    print("  - appointment_type: 预约类型 (如: normal, prime_time, premium)")
    print("  - application_center: 申请中心名称")
    print()
    print("📨 消息类型:")
    print("  - type: 消息类型 (status, error, data)")
    print("  - message: 消息内容")
    print("  - timestamp: 时间戳")

def test_matching_logic():
    """测试匹配逻辑"""
    print("\n" + "=" * 50)
    print("🔍 匹配逻辑测试")
    print("=" * 50)
    
    # 监控配置
    monitor_config = {
        "application_country": "cn",
        "application_city": "SHA",
        "slot_types": ["normal", "prime_time"],
        "date_ranges": [
            {
                "start_date": "2025-09-01",
                "end_date": "2025-09-30",
                "start_time": "08:30",
                "end_time": "16:30"
            }
        ]
    }
    
    print("📋 监控配置:")
    print(json.dumps(monitor_config, indent=2, ensure_ascii=False))
    print()
    
    # 测试数据
    test_slots = [
        {
            "application_country": "cn",
            "application_city": "SHA",
            "appointment_type": "normal",
            "datetimes": [{"date": "2025-09-15", "time": "09:30"}]
        },
        {
            "country": "cn",
            "city": "SHA",
            "appointment_type": "prime_time", 
            "datetimes": [{"date": "2025-09-16", "time": "14:00"}]
        },
        {
            "application_country": "uk",
            "application_city": "LON",
            "appointment_type": "normal",
            "datetimes": [{"date": "2025-09-15", "time": "10:00"}]
        }
    ]
    
    print("🎯 测试槽位:")
    for i, slot in enumerate(test_slots):
        print(f"\n槽位 {i+1}:")
        print(json.dumps(slot, indent=2, ensure_ascii=False))
        
        # 测试匹配
        country = (slot.get("application_country", "") or 
                  slot.get("country", "")).lower()
        city = (slot.get("application_city", "") or 
               slot.get("city", "")).upper()
        
        country_match = country == monitor_config["application_country"]
        city_match = city == monitor_config["application_city"]
        
        print(f"  国家匹配: {country} == {monitor_config['application_country']} -> {country_match}")
        print(f"  城市匹配: {city} == {monitor_config['application_city']} -> {city_match}")
        print(f"  总体匹配: {country_match and city_match}")

if __name__ == "__main__":
    show_sample_data()
    test_matching_logic()

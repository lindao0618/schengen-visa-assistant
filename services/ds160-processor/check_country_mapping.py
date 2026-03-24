#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查country_map.xlsx中的国家映射
"""

import pandas as pd

def check_country_mapping():
    """检查国家映射"""
    print("=== 检查country_map.xlsx中的国家映射 ===")
    
    try:
        df = pd.read_excel("country_map.xlsx")
        print("country_map.xlsx结构:")
        print(f"列名: {df.columns.tolist()}")
        print(f"行数: {len(df)}")
        
        # 查找"中国"的映射
        china_rows = df[df['Chinese Name'] == '中国']
        print(f"\n查找'中国'的映射: {len(china_rows)} 行")
        if len(china_rows) > 0:
            print(china_rows)
        
        # 查找"CHINA"的映射
        china_en_rows = df[df['English Name'] == 'CHINA']
        print(f"\n查找'CHINA'的映射: {len(china_en_rows)} 行")
        if len(china_en_rows) > 0:
            print(china_en_rows)
        
        # 查找包含"中国"的行
        china_contains = df[df['Chinese Name'].str.contains('中国', na=False)]
        print(f"\n包含'中国'的行: {len(china_contains)} 行")
        if len(china_contains) > 0:
            print(china_contains)
        
        # 查找包含"CHINA"的行
        china_en_contains = df[df['English Name'].str.contains('CHINA', na=False)]
        print(f"\n包含'CHINA'的行: {len(china_en_contains)} 行")
        if len(china_en_contains) > 0:
            print(china_en_contains)
            
    except Exception as e:
        print(f"检查失败: {e}")

if __name__ == "__main__":
    check_country_mapping()

























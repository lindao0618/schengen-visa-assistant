#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查Excel文件格式
"""

import pandas as pd
import os

def check_excel_format():
    """检查Excel文件格式"""
    print("🔍 检查Excel文件格式")
    print("=" * 50)
    
    # 检查country_map.xlsx
    if os.path.exists('country_map.xlsx'):
        print("📊 检查 country_map.xlsx:")
        try:
            df = pd.read_excel('country_map.xlsx')
            print(f"   列数: {len(df.columns)}")
            print(f"   行数: {len(df)}")
            print(f"   列名: {list(df.columns)}")
            print(f"   前3行数据:")
            print(df.head(3).to_string())
        except Exception as e:
            print(f"   ❌ 读取失败: {e}")
    else:
        print("❌ country_map.xlsx 文件不存在")
    
    print()
    
    # 检查是否有其他Excel文件
    excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and f != 'country_map.xlsx']
    
    if excel_files:
        print(f"📊 找到其他Excel文件: {excel_files}")
        for file in excel_files:
            print(f"\n检查 {file}:")
            try:
                df = pd.read_excel(file)
                print(f"   列数: {len(df.columns)}")
                print(f"   行数: {len(df)}")
                print(f"   列名: {list(df.columns)}")
                
                # 检查是否包含所需的列
                has_field = any('Field' in col or 'field' in col for col in df.columns)
                has_value = any('填写' in col or 'value' in col or '填' in col for col in df.columns)
                
                print(f"   包含Field列: {'✅' if has_field else '❌'}")
                print(f"   包含填写列: {'✅' if has_value else '❌'}")
                
                if has_field and has_value:
                    print(f"   ✅ {file} 格式正确，可用于DS160填表")
                else:
                    print(f"   ❌ {file} 格式不正确")
                    
            except Exception as e:
                print(f"   ❌ 读取失败: {e}")
    else:
        print("⚠️ 没有找到其他Excel文件")
    
    print("\n" + "=" * 50)
    print("💡 说明:")
    print("DS160脚本需要Excel文件包含以下列:")
    print("   - Field列: 包含字段名称")
    print("   - 填写列: 包含填写内容")
    print("country_map.xlsx 是国家映射文件，不是DS160数据文件")

if __name__ == "__main__":
    check_excel_format()

























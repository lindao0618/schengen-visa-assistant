#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查Excel文件中的实际字段名称
"""

import pandas as pd

def check_actual_fields():
    """检查Excel文件中的实际字段名称"""
    print("检查Excel文件中的实际字段名称")
    print("=" * 50)
    
    try:
        df = pd.read_excel("ds160_data模板.xlsx")
        
        # 显示所有字段名称
        print("所有字段名称:")
        for i, field in enumerate(df['Field']):
            if pd.notna(field) and str(field).strip():
                print(f"  {i+1:3d}: {field}")
        
        print(f"\n总共找到 {len(df)} 行数据")
        
        # 查找包含特定关键词的字段
        print("\n包含'Country'的字段:")
        for i, field in enumerate(df['Field']):
            if pd.notna(field) and 'Country' in str(field):
                value = df.iloc[i]['填写内容']
                print(f"  {field}: {value}")
        
        print("\n包含'Institution'的字段:")
        for i, field in enumerate(df['Field']):
            if pd.notna(field) and 'Institution' in str(field):
                value = df.iloc[i]['填写内容']
                print(f"  {field}: {value}")
        
        print("\n包含'Date'的字段:")
        for i, field in enumerate(df['Field']):
            if pd.notna(field) and 'Date' in str(field):
                value = df.iloc[i]['填写内容']
                print(f"  {field}: {value}")
                
    except Exception as e:
        print(f"检查失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_actual_fields()

























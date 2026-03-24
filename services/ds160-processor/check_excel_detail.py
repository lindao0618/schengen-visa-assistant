#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
详细检查Excel模板中的Educational Institution Country字段
"""

import pandas as pd

def check_excel_detail():
    """详细检查Excel模板"""
    print("=== 详细检查test-ds160.xlsx中的Educational Institution Country字段 ===")
    
    try:
        df = pd.read_excel("test-ds160.xlsx")
        print(f"Excel文件列名: {df.columns.tolist()}")
        print(f"总行数: {len(df)}")
        
        # 查找Educational Institution Country字段
        edu_country_rows = df[df['Field'] == 'Educational Institution Country']
        print(f"\n找到Educational Institution Country字段: {len(edu_country_rows)} 行")
        
        if len(edu_country_rows) > 0:
            for idx, row in edu_country_rows.iterrows():
                print(f"行号: {idx}")
                print(f"Field: '{row['Field']}'")
                print(f"填写内容: '{row['填写内容']}'")
                print(f"填写内容类型: {type(row['填写内容'])}")
                print(f"填写内容长度: {len(str(row['填写内容']))}")
                print(f"是否为空: {pd.isna(row['填写内容'])}")
                print(f"去除空格后: '{str(row['填写内容']).strip()}'")
        
        # 查找所有包含Country的字段
        print(f"\n=== 所有包含Country的字段 ===")
        country_fields = df[df['Field'].str.contains('Country', case=False, na=False)]
        for idx, row in country_fields.iterrows():
            print(f"字段: '{row['Field']}' -> 值: '{row['填写内容']}'")
        
        # 查找所有包含Institution的字段
        print(f"\n=== 所有包含Institution的字段 ===")
        inst_fields = df[df['Field'].str.contains('Institution', case=False, na=False)]
        for idx, row in inst_fields.iterrows():
            print(f"字段: '{row['Field']}' -> 值: '{row['填写内容']}'")
            
    except Exception as e:
        print(f"检查失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_excel_detail()

























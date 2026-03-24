#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
查看Excel文件的原始内容
"""

import pandas as pd

def check_excel_raw():
    """查看Excel原始内容"""
    print("=== 查看test-ds160.xlsx的原始内容 ===")
    
    try:
        df = pd.read_excel("test-ds160.xlsx")
        
        # 查找Educational Institution Country字段的所有行
        print("查找包含'Educational Institution Country'的所有行:")
        for idx, row in df.iterrows():
            if 'Educational Institution Country' in str(row['Field']):
                print(f"行 {idx}: Field='{row['Field']}', 填写内容='{row['填写内容']}'")
                # 显示原始字节
                content_bytes = str(row['填写内容']).encode('utf-8')
                print(f"  字节表示: {content_bytes}")
                print(f"  十六进制: {content_bytes.hex()}")
        
        # 查找包含"英国"的所有行
        print("\n查找包含'英国'的所有行:")
        for idx, row in df.iterrows():
            if '英国' in str(row['填写内容']):
                print(f"行 {idx}: Field='{row['Field']}', 填写内容='{row['填写内容']}'")
        
        # 查找包含"CHINA"的所有行
        print("\n查找包含'CHINA'的所有行:")
        for idx, row in df.iterrows():
            if 'CHINA' in str(row['填写内容']):
                print(f"行 {idx}: Field='{row['Field']}', 填写内容='{row['填写内容']}'")
        
        # 显示前几行和后几行
        print("\n前5行:")
        print(df.head())
        print("\n后5行:")
        print(df.tail())
        
    except Exception as e:
        print(f"检查失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_excel_raw()

























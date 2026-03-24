#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查特定字段值
"""

import pandas as pd

def check_specific_fields():
    """检查特定字段值"""
    print("检查特定字段值")
    print("=" * 50)
    
    try:
        df = pd.read_excel("ds160_data模板.xlsx")
        
        # 检查教育机构相关字段
        fields_to_check = [
            'Educational Institution Country',
            'Previous Employer or School Country',
            'Name of the educational institution',
            'Educational Institution Address',
            'Educational Institution City',
            'Educational Institution State',
            'Educational Institution Zip',
            'Course of Study',
            'Educational Institution Start Date',
            'Educational Institution End Date'
        ]
        
        print("教育机构相关字段:")
        for field in fields_to_check:
            if field in df.columns:
                # 查找该字段在Excel中的位置
                for i, row in df.iterrows():
                    if str(row['Field']).strip() == field:
                        value = str(row['填写内容']).strip()
                        print(f"  {field}: {value}")
                        break
            else:
                print(f"  {field}: 字段不存在")
        
        print("\n检查是否有重复或冲突的字段:")
        # 检查是否有重复的字段名
        field_counts = df['Field'].value_counts()
        duplicates = field_counts[field_counts > 1]
        if not duplicates.empty:
            print("发现重复字段:")
            for field, count in duplicates.items():
                print(f"  {field}: 出现 {count} 次")
        else:
            print("没有重复字段")
            
    except Exception as e:
        print(f"检查失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_specific_fields()

























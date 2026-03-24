#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查Course of Study字段
"""

import pandas as pd

def check_course_field():
    """检查Course of Study字段"""
    print("检查Course of Study字段")
    print("=" * 50)
    
    try:
        df = pd.read_excel("ds160_data模板.xlsx")
        
        # 查找Course of Study字段
        course_field = None
        course_value = None
        
        for i, row in df.iterrows():
            if str(row['Field']).strip() == 'Course of Study':
                course_field = row['Field']
                course_value = row['填写内容']
                print(f"找到Course of Study字段:")
                print(f"  行号: {i+1}")
                print(f"  字段名: {course_field}")
                print(f"  字段值: {course_value}")
                print(f"  值类型: {type(course_value)}")
                print(f"  是否为空: {pd.isna(course_value)}")
                print(f"  长度: {len(str(course_value)) if not pd.isna(course_value) else 'N/A'}")
                break
        
        if course_field is None:
            print("❌ 未找到Course of Study字段")
            
            # 查找包含"Course"的字段
            print("\n查找包含'Course'的字段:")
            for i, row in df.iterrows():
                if 'Course' in str(row['Field']):
                    print(f"  {row['Field']}: {row['填写内容']}")
        
        # 检查相关字段
        print("\n检查相关字段:")
        related_fields = [
            'Name of the educational institution',
            'Educational Institution Country',
            'Course of Study'
        ]
        
        for field in related_fields:
            found = False
            for i, row in df.iterrows():
                if str(row['Field']).strip() == field:
                    value = str(row['填写内容']).strip()
                    print(f"  {field}: {value}")
                    found = True
                    break
            
            if not found:
                print(f"  {field}: ❌ 字段不存在")
                
    except Exception as e:
        print(f"检查失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_course_field()

























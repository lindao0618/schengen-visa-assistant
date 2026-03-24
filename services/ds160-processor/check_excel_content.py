#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查Excel文件的实际内容
"""

import pandas as pd
import os

def check_excel_content():
    """检查Excel文件内容"""
    print("🔍 检查Excel文件内容")
    print("=" * 50)
    
    if os.path.exists("ds160_data模板.xlsx"):
        try:
            df = pd.read_excel("ds160_data模板.xlsx")
            print(f"✅ 成功读取Excel文件")
            print(f"   列数: {len(df.columns)}")
            print(f"   行数: {len(df)}")
            print(f"   列名: {list(df.columns)}")
            
            print("\n📋 前10行数据:")
            print(df.head(10).to_string())
            
            print("\n🔍 查找关键字段:")
            # 检查是否有包含关键信息的行
            key_fields = ['surname', 'given_name', 'birth_date', 'nationality', '姓', '名', '出生', '国籍']
            
            for i, row in df.iterrows():
                field = str(row['Field']).lower()
                value = str(row['填写内容'])
                
                for key in key_fields:
                    if key in field:
                        print(f"   行 {i+1}: {row['Field']} = {row['填写内容']}")
                        break
                        
        except Exception as e:
            print(f"❌ Excel读取失败: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("❌ Excel文件不存在")

def check_field_mapping():
    """检查字段映射"""
    print("\n🔄 检查字段映射")
    print("=" * 50)
    
    if os.path.exists("ds160_data模板.xlsx"):
        try:
            df = pd.read_excel("ds160_data模板.xlsx")
            
            # 创建字段映射
            field_mapping = {}
            
            for i, row in df.iterrows():
                field = str(row['Field']).strip()
                value = str(row['填写内容']).strip()
                
                if field and value and field != 'nan':
                    field_mapping[field] = value
            
            print(f"✅ 找到 {len(field_mapping)} 个有效字段")
            
            print("\n📋 字段映射:")
            for field, value in field_mapping.items():
                print(f"   {field}: {value}")
                
        except Exception as e:
            print(f"❌ 字段映射检查失败: {e}")
    else:
        print("❌ Excel文件不存在")

def main():
    """主函数"""
    print("🔧 Excel文件内容检查工具")
    print("=" * 60)
    
    # 检查Excel内容
    check_excel_content()
    
    # 检查字段映射
    check_field_mapping()
    
    print("\n" + "=" * 60)
    print("🎯 检查完成！")

if __name__ == "__main__":
    main()

























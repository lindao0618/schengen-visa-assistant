#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复DS160 London选择问题
"""

import pandas as pd
import os
import time
from playwright.sync_api import sync_playwright

def test_location_selection():
    """测试London选择功能"""
    print("🧪 测试London选择功能")
    print("=" * 50)
    
    try:
        with sync_playwright() as p:
            # 启动浏览器
            browser = p.chromium.launch(
                headless=False,  # 显示浏览器窗口，方便调试
                slow_mo=100  # 慢速操作，便于观察
            )
            
            page = browser.new_page()
            
            try:
                # 导航到DS160网站
                print("1. 导航到DS160网站...")
                page.goto("https://ceac.state.gov/GenNIV/Default.aspx", timeout=60000)
                print("✅ 成功导航到DS160网站")
                
                # 等待页面加载
                page.wait_for_timeout(3000)
                
                # 检查是否有location选择器
                print("\n2. 检查location选择器...")
                location_selector = "select[name='ctl00$SiteContentPlaceHolder$ucLocation$ddlLocation']"
                
                try:
                    page.wait_for_selector(location_selector, state="visible", timeout=10000)
                    print("✅ 找到location选择器")
                    
                    # 获取所有可用的选项
                    options = page.locator(f"{location_selector} option")
                    option_count = options.count()
                    print(f"   找到 {option_count} 个选项")
                    
                    # 显示前几个选项
                    for i in range(min(5, option_count)):
                        option_text = options.nth(i).inner_text()
                        option_value = options.nth(i).get_attribute("value")
                        print(f"   选项 {i+1}: {option_text} (值: {option_value})")
                    
                    # 查找London选项
                    london_found = False
                    for i in range(option_count):
                        option_text = options.nth(i).inner_text()
                        if "LONDON" in option_text.upper() or "LND" in option_text.upper():
                            print(f"✅ 找到London选项: {option_text}")
                            london_found = True
                            break
                    
                    if not london_found:
                        print("❌ 未找到London选项")
                        # 显示所有选项
                        print("\n所有可用选项:")
                        for i in range(option_count):
                            option_text = options.nth(i).inner_text()
                            option_value = options.nth(i).get_attribute("value")
                            print(f"   {option_text} (值: {option_value})")
                    
                except Exception as e:
                    print(f"❌ 未找到location选择器: {e}")
                    
                    # 保存页面截图和HTML用于调试
                    page.screenshot(path="location_page_debug.png")
                    with open("location_page_debug.html", "w", encoding="utf-8") as f:
                        f.write(page.content())
                    print("✅ 已保存调试信息")
                
                # 等待用户确认
                print("\n3. 请检查浏览器中的页面状态")
                input("按回车键继续...")
                
            except Exception as e:
                print(f"❌ 测试过程中出现错误: {e}")
                import traceback
                traceback.print_exc()
                
                # 保存错误页面
                page.screenshot(path="error_page.png")
                with open("error_page.html", "w", encoding="utf-8") as f:
                    f.write(page.content())
                print("✅ 已保存错误页面信息")
            
            finally:
                browser.close()
                
    except Exception as e:
        print(f"❌ 浏览器启动失败: {e}")

def check_excel_data():
    """检查Excel数据"""
    print("\n📊 检查Excel数据")
    print("=" * 50)
    
    if os.path.exists("ds160_data模板.xlsx"):
        try:
            df = pd.read_excel("ds160_data模板.xlsx")
            print(f"✅ 成功读取Excel文件")
            print(f"   列数: {len(df.columns)}")
            print(f"   行数: {len(df)}")
            print(f"   列名: {list(df.columns)}")
            
            # 检查关键字段
            key_fields = ['surname', 'given_name', 'birth_date', 'nationality']
            for field in key_fields:
                if field in df.columns:
                    value = df.iloc[0][field] if len(df) > 0 else "N/A"
                    print(f"   {field}: {value}")
                else:
                    print(f"   {field}: ❌ 字段不存在")
                    
        except Exception as e:
            print(f"❌ Excel读取失败: {e}")
    else:
        print("❌ Excel文件不存在")

def main():
    """主函数"""
    print("🔧 DS160 London选择问题修复工具")
    print("=" * 60)
    
    # 检查Excel数据
    check_excel_data()
    
    # 测试London选择
    test_location_selection()
    
    print("\n" + "=" * 60)
    print("🎯 测试完成！")
    print("\n💡 如果发现问题，请根据上述信息进行修复")

if __name__ == "__main__":
    main()

























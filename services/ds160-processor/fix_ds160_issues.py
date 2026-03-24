#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复DS160所有问题
"""

import pandas as pd
import os
import time
from playwright.sync_api import sync_playwright

def test_network_connection():
    """测试网络连接"""
    print("🌐 测试网络连接")
    print("=" * 50)
    
    import requests
    
    urls_to_test = [
        "https://ceac.state.gov/",
        "https://ceac.state.gov/GenNIV/",
        "https://www.google.com/",
        "https://www.baidu.com/"
    ]
    
    for url in urls_to_test:
        try:
            print(f"测试 {url}...")
            response = requests.get(url, timeout=10)
            print(f"   ✅ 状态码: {response.status_code}")
        except Exception as e:
            print(f"   ❌ 连接失败: {e}")
    
    print()

def test_ds160_access():
    """测试DS160网站访问"""
    print("🌐 测试DS160网站访问")
    print("=" * 50)
    
    try:
        with sync_playwright() as p:
            # 启动浏览器
            browser = p.chromium.launch(
                headless=False,  # 显示浏览器窗口
                slow_mo=200  # 慢速操作
            )
            
            page = browser.new_page()
            
            try:
                # 设置更长的超时时间
                page.set_default_timeout(120000)  # 2分钟
                
                print("1. 尝试访问DS160主页...")
                page.goto("https://ceac.state.gov/", timeout=120000, wait_until="domcontentloaded")
                print("✅ 成功访问DS160主页")
                
                # 等待页面加载
                page.wait_for_timeout(5000)
                
                # 保存页面截图
                page.screenshot(path="ds160_main_page.png")
                print("✅ 已保存主页截图")
                
                # 尝试导航到DS160表单页面
                print("\n2. 尝试导航到DS160表单页面...")
                try:
                    # 查找DS160链接
                    ds160_link = page.locator("a:has-text('DS-160')").first
                    if ds160_link.count() > 0:
                        print("✅ 找到DS160链接")
                        ds160_link.click()
                        page.wait_for_timeout(5000)
                        
                        # 保存表单页面截图
                        page.screenshot(path="ds160_form_page.png")
                        print("✅ 已保存表单页面截图")
                        
                        # 检查location选择器
                        print("\n3. 检查location选择器...")
                        location_selectors = [
                            "select[name='ctl00$SiteContentPlaceHolder$ucLocation$ddlLocation']",
                            "select[id*='ddlLocation']",
                            "select[id*='Location']",
                            "select"
                        ]
                        
                        location_found = False
                        for selector in location_selectors:
                            try:
                                if page.locator(selector).count() > 0:
                                    print(f"✅ 找到location选择器: {selector}")
                                    location_found = True
                                    
                                    # 获取选项
                                    options = page.locator(f"{selector} option")
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
                                    
                                    break
                            except Exception as e:
                                continue
                        
                        if not location_found:
                            print("❌ 未找到任何location选择器")
                            
                    else:
                        print("❌ 未找到DS160链接")
                        
                except Exception as e:
                    print(f"❌ 导航到DS160表单页面失败: {e}")
                
                # 等待用户确认
                print("\n4. 请检查浏览器中的页面状态")
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

def check_excel_processing():
    """检查Excel数据处理"""
    print("\n📊 检查Excel数据处理")
    print("=" * 50)
    
    try:
        # 导入DS160处理函数
        from ds160_server import process_excel_data, load_country_map
        
        print("1. 加载国家映射...")
        country_map = load_country_map("country_map.xlsx")
        print(f"✅ 成功加载国家映射，共 {len(country_map)} 个国家")
        
        print("\n2. 处理Excel数据...")
        personal_info = process_excel_data("ds160_data模板.xlsx", country_map)
        
        if personal_info:
            print(f"✅ 成功处理Excel数据，共 {len(personal_info)} 个字段")
            
            # 显示关键字段
            key_fields = ['surname', 'given_name', 'birth_date', 'nationality']
            for field in key_fields:
                if field in personal_info:
                    print(f"   {field}: {personal_info[field]}")
                else:
                    print(f"   {field}: ❌ 字段不存在")
        else:
            print("❌ Excel数据处理失败")
            
    except Exception as e:
        print(f"❌ Excel数据处理检查失败: {e}")
        import traceback
        traceback.print_exc()

def main():
    """主函数"""
    print("🔧 DS160问题修复工具")
    print("=" * 60)
    
    # 1. 测试网络连接
    test_network_connection()
    
    # 2. 检查Excel数据处理
    check_excel_processing()
    
    # 3. 测试DS160网站访问
    test_ds160_access()
    
    print("\n" + "=" * 60)
    print("🎯 修复完成！")
    print("\n💡 如果发现问题，请根据上述信息进行修复")

if __name__ == "__main__":
    main()

























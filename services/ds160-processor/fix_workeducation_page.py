#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复Work/Education页面的问题
"""

import pandas as pd
import os
import time
from playwright.sync_api import sync_playwright

def test_workeducation_page():
    """测试Work/Education页面"""
    print("🧪 测试Work/Education页面")
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
                # 直接访问Work/Education页面
                print("1. 直接访问Work/Education页面...")
                page.goto("https://ceac.state.gov/GenNIV/General/complete/complete_workeducation2.aspx?node=WorkEducation2", timeout=120000)
                print("✅ 成功访问Work/Education页面")
                
                # 等待页面加载
                page.wait_for_timeout(5000)
                
                # 保存页面截图
                page.screenshot(path="workeducation_page.png")
                print("✅ 已保存页面截图")
                
                # 检查关键选择器
                print("\n2. 检查关键选择器...")
                
                # 检查"Were you previously employed?"选择器
                selectors_to_check = [
                    "#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_0",  # Yes
                    "#ctl00_SiteContentPlaceHolder_FormView1_rblPreviouslyEmployed_1",  # No
                    "#ctl00_SiteContentPlaceHolder_FormView1_rblOtherEduc_0",  # Yes for education
                    "#ctl00_SiteContentPlaceHolder_FormView1_rblOtherEduc_1"   # No for education
                ]
                
                for selector in selectors_to_check:
                    try:
                        if page.locator(selector).count() > 0:
                            print(f"✅ 找到选择器: {selector}")
                        else:
                            print(f"❌ 未找到选择器: {selector}")
                    except Exception as e:
                        print(f"❌ 检查选择器失败 {selector}: {e}")
                
                # 检查教育机构国家选择器
                print("\n3. 检查教育机构国家选择器...")
                country_selector = "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_ddlSchoolCountry"
                
                try:
                    if page.locator(country_selector).count() > 0:
                        print(f"✅ 找到教育机构国家选择器")
                        
                        # 获取所有可用的选项
                        options = page.locator(f"{country_selector} option")
                        option_count = options.count()
                        print(f"   找到 {option_count} 个选项")
                        
                        # 显示前几个选项
                        for i in range(min(10, option_count)):
                            option_text = options.nth(i).inner_text()
                            option_value = options.nth(i).get_attribute("value")
                            print(f"   选项 {i+1}: {option_text} (值: {option_value})")
                        
                        # 查找United Kingdom选项
                        uk_found = False
                        for i in range(option_count):
                            option_text = options.nth(i).inner_text()
                            if "UNITED KINGDOM" in option_text.upper() or "UK" in option_text.upper():
                                print(f"✅ 找到United Kingdom选项: {option_text}")
                                uk_found = True
                                break
                        
                        if not uk_found:
                            print("❌ 未找到United Kingdom选项")
                            
                    else:
                        print(f"❌ 未找到教育机构国家选择器")
                        
                except Exception as e:
                    print(f"❌ 检查教育机构国家选择器失败: {e}")
                
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

def check_excel_data_for_workeducation():
    """检查Excel数据中Work/Education相关字段"""
    print("\n📊 检查Excel数据中Work/Education相关字段")
    print("=" * 50)
    
    try:
        df = pd.read_excel("ds160_data模板.xlsx")
        
        # 检查Work/Education相关字段
        work_education_fields = [
            'Were you previously employed',
            'Previous Employer or School Name',
            'Previous Employer or School Country',
            'Previous Employer or School Start Date',
            'Previous Employer or School End Date',
            'Name of the educational institution',
            'Educational Institution Country',
            'Educational Institution Start Date',
            'Educational Institution End Date',
            'Course of Study'
        ]
        
        print("Work/Education相关字段:")
        for field in work_education_fields:
            # 查找该字段在Excel中的位置
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

def main():
    """主函数"""
    print("🔧 Work/Education页面问题修复工具")
    print("=" * 60)
    
    # 检查Excel数据
    check_excel_data_for_workeducation()
    
    # 测试Work/Education页面
    test_workeducation_page()
    
    print("\n" + "=" * 60)
    print("🎯 测试完成！")

if __name__ == "__main__":
    main()

























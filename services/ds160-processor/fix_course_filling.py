#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复课程填写问题
"""

import pandas as pd
import os
import time
from playwright.sync_api import sync_playwright

def test_course_filling():
    """测试课程填写功能"""
    print("🧪 测试课程填写功能")
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
                page.screenshot(path="workeducation_page_initial.png")
                print("✅ 已保存初始页面截图")
                
                # 检查课程字段选择器
                print("\n2. 检查课程字段选择器...")
                course_selector = "#ctl00_SiteContentPlaceHolder_FormView1_dtlPrevEduc_ctl00_tbxSchoolCourseOfStudy"
                
                try:
                    if page.locator(course_selector).count() > 0:
                        print(f"✅ 找到课程字段选择器")
                        
                        # 检查元素状态
                        element = page.locator(course_selector).first
                        is_visible = element.is_visible()
                        is_enabled = element.is_enabled()
                        is_editable = element.is_editable()
                        
                        print(f"   是否可见: {is_visible}")
                        print(f"   是否启用: {is_enabled}")
                        print(f"   是否可编辑: {is_editable}")
                        
                        if is_visible and is_enabled and is_editable:
                            print("✅ 课程字段可以正常填写")
                            
                            # 尝试填写课程
                            print("\n3. 尝试填写课程...")
                            try:
                                # 先清空字段
                                element.clear()
                                page.wait_for_timeout(500)
                                
                                # 填写课程
                                element.fill("Management")
                                page.wait_for_timeout(1000)
                                
                                # 检查是否填写成功
                                filled_value = element.input_value()
                                print(f"   填写后的值: {filled_value}")
                                
                                if filled_value == "Management":
                                    print("✅ 课程填写成功")
                                else:
                                    print("❌ 课程填写失败")
                                    
                            except Exception as e:
                                print(f"❌ 课程填写过程中出现错误: {e}")
                        else:
                            print("❌ 课程字段状态异常，无法填写")
                            
                    else:
                        print(f"❌ 未找到课程字段选择器")
                        
                        # 查找所有可能的课程字段
                        print("\n查找所有可能的课程字段:")
                        possible_selectors = [
                            "input[id*='Course']",
                            "input[id*='Study']",
                            "input[name*='Course']",
                            "input[name*='Study']",
                            "input[type='text']"
                        ]
                        
                        for selector in possible_selectors:
                            try:
                                count = page.locator(selector).count()
                                if count > 0:
                                    print(f"  {selector}: 找到 {count} 个元素")
                            except Exception as e:
                                continue
                        
                except Exception as e:
                    print(f"❌ 检查课程字段选择器失败: {e}")
                
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

def check_excel_course_data():
    """检查Excel中的课程数据"""
    print("\n📊 检查Excel中的课程数据")
    print("=" * 50)
    
    try:
        df = pd.read_excel("ds160_data模板.xlsx")
        
        # 查找课程相关字段
        course_fields = [
            'Course of Study',
            'Name of the educational institution',
            'Educational Institution Country'
        ]
        
        print("课程相关字段:")
        for field in course_fields:
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
    print("🔧 课程填写问题修复工具")
    print("=" * 60)
    
    # 检查Excel数据
    check_excel_course_data()
    
    # 测试课程填写
    test_course_filling()
    
    print("\n" + "=" * 60)
    print("🎯 测试完成！")

if __name__ == "__main__":
    main()

























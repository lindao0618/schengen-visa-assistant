#!/usr/bin/env python3
"""
行程单生成服务
根据用户输入的旅行信息生成详细的行程单PDF
"""

import json
import sys
import base64
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import io
import os

# 注册中文字体
try:
    # 尝试使用系统字体
    pdfmetrics.registerFont(TTFont('SimHei', 'C:/Windows/Fonts/simhei.ttf'))
    pdfmetrics.registerFont(TTFont('SimSun', 'C:/Windows/Fonts/simsun.ttc'))
    chinese_font = 'SimHei'
except:
    # 如果系统字体不可用，使用默认字体
    chinese_font = 'Helvetica'

class ItineraryGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        # 创建中文标题样式
        self.title_style = ParagraphStyle(
            'ChineseTitle',
            parent=self.styles['Title'],
            fontName=chinese_font,
            fontSize=18,
            spaceAfter=20,
            alignment=1  # 居中
        )
        
        # 创建中文正文样式
        self.body_style = ParagraphStyle(
            'ChineseBody',
            parent=self.styles['Normal'],
            fontName=chinese_font,
            fontSize=12,
            spaceAfter=10
        )
        
        # 创建中文标题2样式
        self.heading_style = ParagraphStyle(
            'ChineseHeading',
            parent=self.styles['Heading2'],
            fontName=chinese_font,
            fontSize=14,
            spaceAfter=10
        )

    def generate_itinerary_content(self, data):
        """根据输入数据生成行程内容"""
        country = data.get('country', '')
        departure_city = data.get('departure_city', '')
        arrival_city = data.get('arrival_city', '')
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        hotel_name = data.get('hotel_name', '')
        hotel_address = data.get('hotel_address', '')
        hotel_phone = data.get('hotel_phone', '')
        
        # 计算旅行天数
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        days = (end_dt - start_dt).days + 1
        
        # 生成详细行程
        itinerary = []
        
        # 第一天：到达
        day1 = start_dt
        itinerary.append({
            'day': 1,
            'date': day1.strftime('%Y年%m月%d日'),
            'activities': [
                f'从{departure_city}出发前往{arrival_city}',
                f'抵达{country}{arrival_city}',
                f'入住酒店：{hotel_name}',
                '适应时差，附近简单游览'
            ]
        })
        
        # 中间几天：观光
        for i in range(2, days):
            current_date = start_dt + timedelta(days=i-1)
            itinerary.append({
                'day': i,
                'date': current_date.strftime('%Y年%m月%d日'),
                'activities': [
                    f'{arrival_city}市中心观光',
                    '参观当地著名景点',
                    '体验当地美食文化',
                    '购物和休闲活动'
                ]
            })
        
        # 最后一天：离开
        if days > 1:
            last_day = end_dt
            itinerary.append({
                'day': days,
                'date': last_day.strftime('%Y年%m月%d日'),
                'activities': [
                    '酒店退房',
                    '最后购物或观光',
                    f'前往机场返回{departure_city}',
                    '行程结束'
                ]
            })
        
        return itinerary

    def create_pdf(self, data):
        """创建PDF文档"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        
        # 标题
        title = Paragraph(f"{data.get('country', '')}旅行行程单", self.title_style)
        story.append(title)
        story.append(Spacer(1, 20))
        
        # 基本信息
        basic_info = [
            ['出发城市:', data.get('departure_city', '')],
            ['目的地:', f"{data.get('country', '')} {data.get('arrival_city', '')}"],
            ['出行日期:', f"{data.get('start_date', '')} 至 {data.get('end_date', '')}"],
            ['住宿酒店:', data.get('hotel_name', '')],
            ['酒店地址:', data.get('hotel_address', '')],
            ['酒店电话:', data.get('hotel_phone', '')]
        ]
        
        basic_table = Table(basic_info, colWidths=[2*inch, 4*inch])
        basic_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), chinese_font),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey)
        ]))
        
        story.append(Paragraph("基本信息", self.heading_style))
        story.append(basic_table)
        story.append(Spacer(1, 20))
        
        # 详细行程
        story.append(Paragraph("详细行程安排", self.heading_style))
        
        itinerary = self.generate_itinerary_content(data)
        
        for day_plan in itinerary:
            # 日期标题
            day_title = f"第{day_plan['day']}天 ({day_plan['date']})"
            story.append(Paragraph(day_title, self.heading_style))
            
            # 活动列表
            for activity in day_plan['activities']:
                story.append(Paragraph(f"• {activity}", self.body_style))
            
            story.append(Spacer(1, 10))
        
        # 注意事项
        story.append(Spacer(1, 20))
        story.append(Paragraph("重要提醒", self.heading_style))
        
        reminders = [
            "请确保护照有效期至少还有6个月",
            "请提前办理好相关签证手续", 
            "建议购买旅游保险",
            "请保留好所有预订确认单据",
            "遵守当地法律法规和风俗习惯"
        ]
        
        for reminder in reminders:
            story.append(Paragraph(f"• {reminder}", self.body_style))
        
        # 生成PDF
        doc.build(story)
        pdf_data = buffer.getvalue()
        buffer.close()
        
        return pdf_data

    def generate_analysis(self, data):
        """生成行程分析"""
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        country = data.get('country', '')
        
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        days = (end_dt - start_dt).days + 1
        
        analysis = f"""
行程分析报告：

1. 行程时长：{days}天
2. 目的地：{country}
3. 行程合理性：
   - 时间安排适中，有足够时间游览主要景点
   - 酒店预订信息完整，便于签证申请
   - 行程安排符合旅游签证要求

4. 签证建议：
   - 建议提前2-4周申请签证
   - 准备充足的资金证明
   - 保留所有预订确认单据
   - 购买符合要求的旅游保险

5. 注意事项：
   - 请确保所有信息真实有效
   - 建议准备行程计划的英文版本
   - 保持行程的合理性和可信度
"""
        return analysis.strip()

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "缺少输入数据"}))
        return
    
    try:
        # 解析输入数据
        input_data = json.loads(sys.argv[1])
        
        # 创建行程生成器
        generator = ItineraryGenerator()
        
        # 生成PDF
        pdf_data = generator.create_pdf(input_data)
        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
        
        # 生成分析
        analysis = generator.generate_analysis(input_data)
        
        # 返回结果
        result = {
            "success": True,
            "pdf_base64": pdf_base64,
            "analysis": analysis,
            "message": "行程单生成成功"
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "message": "生成行程单失败"
        }
        print(json.dumps(error_result, ensure_ascii=False))

if __name__ == "__main__":
    main() 
#!/usr/bin/env python3
"""
Mail Merge 行程单生成器
使用 docxtpl 进行模板渲染，完美保持格式
"""

from docxtpl import DocxTemplate
from datetime import datetime, timedelta
import os
import re
from typing import Dict, List, Any


class MailMergeItineraryGenerator:
    """Mail Merge 行程单生成器"""
    
    def __init__(self, template_path="template_mailmerge_simple.docx"):
        """
        初始化生成器
        
        Args:
            template_path: 模板文件路径
        """
        self.template_path = template_path
        self.output_dir = "output"
        
        # 确保输出目录存在
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            
        # 检查模板文件是否存在
        if not os.path.exists(self.template_path):
            raise FileNotFoundError(f"模板文件不存在: {self.template_path}")
            
        print(f"📋 Mail Merge生成器初始化完成")
        print(f"   模板文件: {self.template_path}")
        
    def detect_language(self, departure_city, arrival_city):
        """
        检测输入语言，基于城市名称判断
        
        Args:
            departure_city: 出发城市
            arrival_city: 到达城市
            
        Returns:
            bool: True if Chinese, False if English
        """
        # 检查是否包含中文字符
        chinese_pattern = re.compile(r'[\u4e00-\u9fff]')
        
        is_chinese = (chinese_pattern.search(departure_city) or 
                     chinese_pattern.search(arrival_city))
        
        return is_chinese
        
    def generate_itinerary_data(self, params: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        生成行程数据
        
        Args:
            params: 参数字典，包含country, departure_city, arrival_city, 
                   start_date, end_date, hotel_name, hotel_address, hotel_phone
                   
        Returns:
            List[Dict]: 行程数据列表
        """
        start_date = datetime.strptime(params['start_date'], '%Y-%m-%d')
        end_date = datetime.strptime(params['end_date'], '%Y-%m-%d')
        total_days = (end_date - start_date).days + 1
        
        # 检测语言
        is_chinese = self.detect_language(params['departure_city'], params['arrival_city'])
        
        print(f"📊 生成行程数据:")
        print(f"   语言: {'中文' if is_chinese else 'English'}")
        print(f"   总天数: {total_days} 天")
        
        itinerary = []
        
        # 生成每日行程
        for i in range(total_days):
            current_date = start_date + timedelta(days=i)
            day_num = i + 1
            
            # 格式化日期
            if is_chinese:
                date_formatted = current_date.strftime('%Y年%m月%d日')
            else:
                date_formatted = current_date.strftime('%d/%m/%Y')
            
            # 确定城市和活动
            if day_num == 1:
                # 第一天：到达
                city = f"{params['departure_city']} ➔ {params['arrival_city']}"
                if is_chinese:
                    activities = "抵达日 - 酒店入住"
                else:
                    activities = "Arrival Day - Hotel Check-in"
            elif day_num == total_days:
                # 最后一天：离开
                city = f"{params['arrival_city']} ➔ {params['departure_city']}"
                if is_chinese:
                    activities = "离开日 - 酒店退房"
                else:
                    activities = "Departure Day - Hotel Check-out"
            else:
                # 中间的天数：在目的地游览
                city = params['arrival_city']
                if is_chinese:
                    activities = f"第{day_num-1}天游览活动"
                else:
                    activities = f"Day {day_num-1} Sightseeing"
            
            # 酒店信息
            if day_num == total_days:
                hotel_info = ""  # 最后一天不显示酒店
            else:
                if is_chinese:
                    hotel_info = f"酒店: {params['hotel_name']}\n地址: {params['hotel_address']}\n电话: {params['hotel_phone']}"
                else:
                    hotel_info = f"Hotel: {params['hotel_name']}\nAddress: {params['hotel_address']}\nPhone: {params['hotel_phone']}"
            
            itinerary.append({
                'day': str(day_num),
                'date': date_formatted,
                'city': city,
                'activities': activities,
                'hotel': hotel_info
            })
            
        return itinerary
        
    def create_context_data(self, params: Dict[str, Any], itinerary: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        创建模板渲染上下文数据
        
        Args:
            params: 原始参数
            itinerary: 行程数据
            
        Returns:
            Dict: 上下文数据
        """
        start_date = datetime.strptime(params['start_date'], '%Y-%m-%d')
        end_date = datetime.strptime(params['end_date'], '%Y-%m-%d')
        total_days = (end_date - start_date).days + 1
        
        # 检测语言
        is_chinese = self.detect_language(params['departure_city'], params['arrival_city'])
        
        # 格式化日期
        if is_chinese:
            start_date_formatted = start_date.strftime('%Y年%m月%d日')
            end_date_formatted = end_date.strftime('%Y年%m月%d日')
            trip_title = f"{params['departure_city']}到{params['arrival_city']}旅行行程单"
            generated_date = datetime.now().strftime('%Y年%m月%d日')
        else:
            start_date_formatted = start_date.strftime('%d/%m/%Y')
            end_date_formatted = end_date.strftime('%d/%m/%Y')
            trip_title = f"{params['departure_city']} to {params['arrival_city']} Travel Itinerary"
            generated_date = datetime.now().strftime('%d/%m/%Y')
        
        context = {
            'trip_title': trip_title,
            'start_date': start_date_formatted,
            'end_date': end_date_formatted,
            'total_days': total_days,
            'departure_city': params['departure_city'],
            'arrival_city': params['arrival_city'],
            'country': params['country'],
            'hotel_name': params['hotel_name'],
            'hotel_address': params['hotel_address'],
            'hotel_phone': params['hotel_phone'],
            'generated_date': generated_date,
            'itinerary': itinerary
        }
        
        print(f"📝 创建上下文数据:")
        print(f"   标题: {trip_title}")
        print(f"   日期: {start_date_formatted} - {end_date_formatted}")
        print(f"   行程项目: {len(itinerary)} 项")
        
        return context
        
    def generate_document(self, params: Dict[str, Any], output_path: str) -> str:
        """
        生成Word文档
        
        Args:
            params: 参数字典
            output_path: 输出文件路径
            
        Returns:
            str: 生成的文件路径
        """
        print(f"📝 开始生成Mail Merge文档...")
        print(f"   输出路径: {output_path}")
        
        try:
            # 生成行程数据
            itinerary = self.generate_itinerary_data(params)
            
            # 创建上下文数据
            context = self.create_context_data(params, itinerary)
            
            # 加载模板
            doc = DocxTemplate(self.template_path)
            print(f"   模板加载成功: {self.template_path}")
            
            # 渲染模板
            doc.render(context)
            print(f"   模板渲染完成")
            
            # 保存文档
            doc.save(output_path)
            print(f"✅ Word文档生成成功: {output_path}")
            
            # 检查文件是否存在
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                print(f"📊 文件信息:")
                print(f"   文件路径: {output_path}")
                print(f"   文件大小: {file_size} 字节")
                return output_path
            else:
                raise Exception("文件生成失败")
                
        except Exception as e:
            print(f"❌ 生成文档时出错: {str(e)}")
            raise


def test_mail_merge():
    """测试Mail Merge生成器"""
    
    print("=" * 60)
    print("Mail Merge行程单生成器测试")
    print("=" * 60)
    
    # 测试参数 - 使用英文
    test_params = {
        'country': 'France',
        'departure_city': 'London',
        'arrival_city': 'Paris',
        'start_date': '2025-06-20',
        'end_date': '2025-06-26',
        'hotel_name': 'Hotel Le Richemont',
        'hotel_address': '17 Rue Jean Colly, 13th arr., 75013 Paris, France',
        'hotel_phone': '+33 1 45 82 84 84'
    }
    
    print(f"📋 测试参数:")
    for key, value in test_params.items():
        print(f"   {key}: {value}")
    
    try:
        # 创建生成器
        generator = MailMergeItineraryGenerator()
        
        # 生成时间戳文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"output/mailmerge_itinerary_{timestamp}.docx"
        
        # 生成文档
        result_file = generator.generate_document(test_params, output_file)
        
        print(f"🎉 Mail Merge测试完成!")
        print(f"📄 已尝试打开文件: {result_file}")
        
        # 尝试打开文件（Windows）
        try:
            os.system(f'start "" "{result_file}"')
        except:
            pass
            
    except Exception as e:
        print(f"❌ 测试失败: {str(e)}")


if __name__ == "__main__":
    test_mail_merge()
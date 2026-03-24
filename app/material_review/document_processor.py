"""
文档处理器 - 专门处理不同类型的签证材料
"""
import re
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class ItineraryProcessor:
    """行程单处理器"""
    
    @staticmethod
    def extract_dates(text: str) -> List[str]:
        """提取日期信息"""
        # 多种日期格式的正则表达式
        date_patterns = [
            r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?',  # 2024-12-25, 2024年12月25日
            r'\d{1,2}[-/]\d{1,2}[-/]\d{4}',          # 25/12/2024
            r'\d{1,2}[月]\d{1,2}[日]',               # 12月25日
            r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}',  # Dec 25, 2024
        ]
        
        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)
        
        return list(set(dates))  # 去重
    
    @staticmethod
    def extract_destinations(text: str) -> List[str]:
        """提取目的地信息"""
        # 常见欧洲城市和国家
        destinations = []
        
        # 法国城市
        french_cities = ['巴黎', 'Paris', '里昂', 'Lyon', '马赛', 'Marseille', '尼斯', 'Nice', '戛纳', 'Cannes']
        # 德国城市
        german_cities = ['柏林', 'Berlin', '慕尼黑', 'Munich', '汉堡', 'Hamburg', '科隆', 'Cologne']
        # 意大利城市
        italian_cities = ['罗马', 'Rome', '米兰', 'Milan', '威尼斯', 'Venice', '佛罗伦萨', 'Florence']
        # 西班牙城市
        spanish_cities = ['马德里', 'Madrid', '巴塞罗那', 'Barcelona', '塞维利亚', 'Seville']
        
        all_cities = french_cities + german_cities + italian_cities + spanish_cities
        
        for city in all_cities:
            if city in text:
                destinations.append(city)
        
        return destinations
    
    @staticmethod
    def extract_accommodations(text: str) -> List[Dict[str, str]]:
        """提取住宿信息"""
        accommodations = []
        
        # 酒店关键词
        hotel_keywords = ['酒店', 'Hotel', '宾馆', '民宿', 'B&B', 'Airbnb', 'Hostel']
        
        lines = text.split('\n')
        for line in lines:
            for keyword in hotel_keywords:
                if keyword.lower() in line.lower():
                    accommodations.append({
                        'text': line.strip(),
                        'type': keyword
                    })
                    break
        
        return accommodations
    
    @staticmethod
    def validate_itinerary(extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """验证行程合理性"""
        validation_results = {
            "date_consistency": True,
            "reasonable_duration": True,
            "sufficient_destinations": True,
            "accommodation_coverage": True,
            "issues": []
        }
        
        dates = extracted_data.get("dates", [])
        destinations = extracted_data.get("destinations", [])
        accommodations = extracted_data.get("accommodations", [])
        
        # 检查日期
        if len(dates) < 2:
            validation_results["date_consistency"] = False
            validation_results["issues"].append("行程日期信息不足，需要明确的开始和结束日期")
        
        # 检查目的地数量
        if len(destinations) == 0:
            validation_results["sufficient_destinations"] = False
            validation_results["issues"].append("未找到明确的旅游目的地")
        elif len(destinations) > 10:
            validation_results["issues"].append("目的地过多，可能影响签证通过率")
        
        # 检查住宿安排
        if len(accommodations) == 0:
            validation_results["accommodation_coverage"] = False
            validation_results["issues"].append("未找到住宿安排信息")
        
        return validation_results

class HotelBookingProcessor:
    """酒店预订单处理器"""
    
    @staticmethod
    def extract_booking_info(text: str) -> Dict[str, str]:
        """提取预订信息"""
        booking_info = {
            "hotel_name": "",
            "guest_name": "",
            "check_in": "",
            "check_out": "",
            "booking_reference": "",
            "total_amount": ""
        }
        
        # 提取确认号/预订号
        ref_patterns = [
            r'确认号[：:]?\s*([A-Z0-9]{6,})',
            r'预订号[：:]?\s*([A-Z0-9]{6,})',
            r'Confirmation\s*[：:]?\s*([A-Z0-9]{6,})',
            r'Reference\s*[：:]?\s*([A-Z0-9]{6,})'
        ]
        
        for pattern in ref_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                booking_info["booking_reference"] = match.group(1)
                break
        
        # 提取金额
        amount_patterns = [
            r'总价[：:]?\s*[￥$€]?\s*(\d+(?:[.,]\d{2})?)',
            r'Total[：:]?\s*[￥$€]?\s*(\d+(?:[.,]\d{2})?)',
            r'Amount[：:]?\s*[￥$€]?\s*(\d+(?:[.,]\d{2})?)'
        ]
        
        for pattern in amount_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                booking_info["total_amount"] = match.group(1)
                break
        
        return booking_info
    
    @staticmethod
    def validate_booking(booking_info: Dict[str, str], text: str) -> Dict[str, Any]:
        """验证预订信息"""
        validation_results = {
            "booking_confirmed": True,
            "dates_valid": True,
            "amount_reasonable": True,
            "issues": []
        }
        
        # 检查是否有确认标识
        confirmation_keywords = ['confirmed', '已确认', 'booked', 'reserved', '预订成功']
        if not any(keyword.lower() in text.lower() for keyword in confirmation_keywords):
            validation_results["booking_confirmed"] = False
            validation_results["issues"].append("未找到预订确认标识")
        
        # 检查预订号
        if not booking_info.get("booking_reference"):
            validation_results["issues"].append("缺少预订确认号")
        
        # 检查金额
        if not booking_info.get("total_amount"):
            validation_results["issues"].append("未找到预订金额信息")
        
        return validation_results

class BankStatementProcessor:
    """银行流水处理器"""
    
    @staticmethod
    def extract_transactions(text: str) -> List[Dict[str, str]]:
        """提取交易记录"""
        transactions = []
        
        # 简单的交易记录提取（可以根据实际银行格式调整）
        lines = text.split('\n')
        
        for line in lines:
            # 查找包含日期和金额的行
            if re.search(r'\d{4}[-/]\d{1,2}[-/]\d{1,2}', line) and re.search(r'\d+\.\d{2}', line):
                transactions.append({
                    'line': line.strip(),
                    'type': 'transaction'
                })
        
        return transactions
    
    @staticmethod
    def extract_balance_info(text: str) -> Dict[str, str]:
        """提取余额信息"""
        balance_info = {
            "current_balance": "",
            "period_start_balance": "",
            "period_end_balance": ""
        }
        
        # 余额提取模式
        balance_patterns = [
            r'余额[：:]?\s*[￥]?\s*([\d,]+\.?\d*)',
            r'Balance[：:]?\s*[￥$€]?\s*([\d,]+\.?\d*)',
            r'当前余额[：:]?\s*[￥]?\s*([\d,]+\.?\d*)'
        ]
        
        for pattern in balance_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                balance_info["current_balance"] = match.group(1)
                break
        
        return balance_info
    
    @staticmethod
    def validate_statement(balance_info: Dict[str, str], transactions: List[Dict[str, str]]) -> Dict[str, Any]:
        """验证银行流水"""
        validation_results = {
            "sufficient_balance": True,
            "regular_transactions": True,
            "period_adequate": True,
            "issues": []
        }
        
        # 检查余额
        if not balance_info.get("current_balance"):
            validation_results["sufficient_balance"] = False
            validation_results["issues"].append("未找到余额信息")
        else:
            try:
                balance = float(balance_info["current_balance"].replace(',', ''))
                if balance < 10000:  # 假设最低要求1万
                    validation_results["sufficient_balance"] = False
                    validation_results["issues"].append("余额可能不足以支持旅行费用")
            except ValueError:
                validation_results["issues"].append("余额格式无法识别")
        
        # 检查交易记录数量
        if len(transactions) < 10:
            validation_results["period_adequate"] = False
            validation_results["issues"].append("交易记录过少，建议提供更长期间的银行流水")
        
        return validation_results

class DocumentValidator:
    """通用文档验证器"""
    
    @staticmethod
    def check_document_quality(text: str) -> Dict[str, Any]:
        """检查文档质量"""
        quality_results = {
            "readable": True,
            "complete": True,
            "clear": True,
            "issues": []
        }
        
        # 检查文本长度
        if len(text) < 50:
            quality_results["complete"] = False
            quality_results["issues"].append("文档内容过少，可能不完整")
        
        # 检查是否包含乱码
        if '?' in text and text.count('?') > len(text) * 0.1:
            quality_results["readable"] = False
            quality_results["issues"].append("文档可能包含大量乱码，建议重新扫描")
        
        # 检查是否有明显的OCR错误
        if re.search(r'[^\w\s\u4e00-\u9fff\.,!?;:()\-/\'"]{3,}', text):
            quality_results["clear"] = False
            quality_results["issues"].append("文档可能存在识别错误，建议检查原始文档质量")
        
        return quality_results
    
    @staticmethod
    def generate_recommendations(validation_results: Dict[str, Any], document_type: str) -> List[str]:
        """生成改进建议"""
        recommendations = []
        
        if document_type == "itinerary":
            if not validation_results.get("date_consistency", True):
                recommendations.append("请确保行程单包含明确的出发和返回日期")
            
            if not validation_results.get("sufficient_destinations", True):
                recommendations.append("请在行程单中明确标注具体的旅游目的地")
            
            if not validation_results.get("accommodation_coverage", True):
                recommendations.append("请提供完整的住宿安排证明")
        
        elif document_type == "hotel_booking":
            if not validation_results.get("booking_confirmed", True):
                recommendations.append("请确保酒店预订确认单包含明确的确认状态")
            
            recommendations.append("建议提供可取消的预订，以提高签证通过率")
        
        elif document_type == "bank_statement":
            if not validation_results.get("sufficient_balance", True):
                recommendations.append("建议增加银行账户余额或提供其他财务证明")
            
            if not validation_results.get("period_adequate", True):
                recommendations.append("建议提供至少3个月的银行流水记录")
        
        # 通用建议
        recommendations.append("建议所有文档保持最新状态（30天内）")
        recommendations.append("确保文档清晰可读，避免模糊或不完整的扫描件")
        
        return recommendations
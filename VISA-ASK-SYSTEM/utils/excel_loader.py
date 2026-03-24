"""
Excel FAQ数据加载器
用于从Excel文件中加载签证问答数据
"""

import pandas as pd
import os
from typing import List, Dict, Optional, Any
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ExcelFAQLoader:
    """Excel FAQ数据加载器"""
    
    def __init__(self, file_path: str):
        """
        初始化加载器
        
        Args:
            file_path: Excel文件路径
        """
        self.file_path = file_path
        self.data = None
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Excel文件不存在: {file_path}")
        
        if not file_path.lower().endswith(('.xlsx', '.xls')):
            raise ValueError("文件必须是Excel格式(.xlsx或.xls)")
    
    def load(self, 
             question_col: str = "问题", 
             answer_col: str = "回答", 
             category_col: Optional[str] = "类别",
             sheet_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        加载FAQ数据
        
        Args:
            question_col: 问题列名
            answer_col: 回答列名
            category_col: 类别列名（可选）
            sheet_name: 工作表名称（可选，默认第一个）
            
        Returns:
            FAQ数据列表
        """
        try:
            # 读取Excel文件
            if sheet_name:
                df = pd.read_excel(self.file_path, sheet_name=sheet_name)
            else:
                df = pd.read_excel(self.file_path)
            
            logger.info(f"成功读取Excel文件，共{len(df)}行数据")
            
            # 自动检测列名（支持中英文）
            column_mapping = {
                "question": ["问题", "Question", "question", "Q", "q"],
                "answer": ["回答", "答案", "Answer", "answer", "A", "a"],
                "category": ["类别", "分类", "Tag", "tag", "Category", "category", "Type", "type"]
            }
            
            actual_question_col = question_col
            actual_answer_col = answer_col
            actual_category_col = category_col
            
            # 检查问题列
            if question_col not in df.columns:
                for col in column_mapping["question"]:
                    if col in df.columns:
                        actual_question_col = col
                        logger.info(f"自动检测到问题列: {col}")
                        break
                else:
                    raise ValueError(f"未找到问题列，尝试过的列名: {column_mapping['question']}")
            
            # 检查回答列
            if answer_col not in df.columns:
                for col in column_mapping["answer"]:
                    if col in df.columns:
                        actual_answer_col = col
                        logger.info(f"自动检测到回答列: {col}")
                        break
                else:
                    raise ValueError(f"未找到回答列，尝试过的列名: {column_mapping['answer']}")
            
            # 检查类别列（可选）
            if category_col and category_col not in df.columns:
                for col in column_mapping["category"]:
                    if col in df.columns:
                        actual_category_col = col
                        logger.info(f"自动检测到类别列: {col}")
                        break
                else:
                    actual_category_col = None
                    logger.info("未找到类别列，将使用默认分类")
            
            # 清理数据
            df = df.dropna(subset=[actual_question_col, actual_answer_col])  # 删除空值行
            df[actual_question_col] = df[actual_question_col].astype(str).str.strip()
            df[actual_answer_col] = df[actual_answer_col].astype(str).str.strip()
            
            # 过滤空内容
            df = df[df[actual_question_col] != '']
            df = df[df[actual_answer_col] != '']
            
            logger.info(f"数据清理后剩余{len(df)}行有效数据")
            
            # 转换为字典列表
            faq_data = []
            for _, row in df.iterrows():
                item = {
                    "question": row[actual_question_col],
                    "answer": row[actual_answer_col],
                    "category": row.get(actual_category_col, "未分类") if actual_category_col and actual_category_col in df.columns else "未分类"
                }
                
                # 添加其他列作为元数据
                for col in df.columns:
                    if col not in [actual_question_col, actual_answer_col, actual_category_col]:
                        item[col] = row[col] if pd.notna(row[col]) else ""
                
                faq_data.append(item)
            
            self.data = faq_data
            logger.info(f"成功加载{len(faq_data)}条FAQ数据")
            return faq_data
            
        except Exception as e:
            logger.error(f"加载Excel文件失败: {e}")
            raise
    
    def get_categories(self) -> List[str]:
        """
        获取所有类别
        
        Returns:
            类别列表
        """
        if not self.data:
            return []
        
        categories = set()
        for item in self.data:
            categories.add(item.get("category", "未分类"))
        
        return sorted(list(categories))
    
    def filter_by_category(self, category: str) -> List[Dict[str, Any]]:
        """
        按类别筛选数据
        
        Args:
            category: 类别名称
            
        Returns:
            筛选后的数据
        """
        if not self.data:
            return []
        
        return [item for item in self.data if item.get("category") == category]
    
    def search_questions(self, keyword: str) -> List[Dict[str, Any]]:
        """
        搜索包含关键词的问题
        
        Args:
            keyword: 搜索关键词
            
        Returns:
            匹配的问题列表
        """
        if not self.data:
            return []
        
        keyword = keyword.lower()
        results = []
        
        for item in self.data:
            question = item["question"].lower()
            answer = item["answer"].lower()
            
            if keyword in question or keyword in answer:
                results.append(item)
        
        return results
    
    def validate_data(self) -> Dict[str, Any]:
        """
        验证数据质量
        
        Returns:
            验证结果
        """
        if not self.data:
            return {"valid": False, "message": "没有数据"}
        
        stats = {
            "total_count": len(self.data),
            "categories": len(self.get_categories()),
            "avg_question_length": 0,
            "avg_answer_length": 0,
            "empty_questions": 0,
            "empty_answers": 0,
            "duplicate_questions": 0
        }
        
        question_lengths = []
        answer_lengths = []
        questions_seen = set()
        
        for item in self.data:
            question = item["question"]
            answer = item["answer"]
            
            # 统计长度
            question_lengths.append(len(question))
            answer_lengths.append(len(answer))
            
            # 检查空内容
            if not question.strip():
                stats["empty_questions"] += 1
            if not answer.strip():
                stats["empty_answers"] += 1
            
            # 检查重复问题
            if question in questions_seen:
                stats["duplicate_questions"] += 1
            else:
                questions_seen.add(question)
        
        if question_lengths:
            stats["avg_question_length"] = sum(question_lengths) / len(question_lengths)
        if answer_lengths:
            stats["avg_answer_length"] = sum(answer_lengths) / len(answer_lengths)
        
        # 判断数据质量
        issues = []
        if stats["empty_questions"] > 0:
            issues.append(f"{stats['empty_questions']}个空问题")
        if stats["empty_answers"] > 0:
            issues.append(f"{stats['empty_answers']}个空回答")
        if stats["duplicate_questions"] > 0:
            issues.append(f"{stats['duplicate_questions']}个重复问题")
        
        stats["valid"] = len(issues) == 0
        stats["issues"] = issues
        
        return stats
    
    def export_sample(self, output_path: str, sample_size: int = 10):
        """
        导出样本数据
        
        Args:
            output_path: 输出文件路径
            sample_size: 样本大小
        """
        if not self.data:
            raise ValueError("没有数据可导出")
        
        sample_data = self.data[:sample_size]
        df = pd.DataFrame(sample_data)
        df.to_excel(output_path, index=False)
        logger.info(f"已导出{len(sample_data)}条样本数据到: {output_path}")

def create_sample_excel(file_path: str = "visa_faq_sample.xlsx"):
    """
    创建示例Excel文件
    
    Args:
        file_path: 输出文件路径
    """
    sample_data = [
        {
            "问题": "英国学生签证需要准备哪些材料？",
            "回答": "英国学生签证主要需要以下材料：1. 有效护照；2. CAS确认函；3. 资金证明（银行存款证明）；4. 学术材料（毕业证、成绩单等）；5. 英语能力证明；6. 肺结核检测证明；7. 签证申请表和照片。建议提前3个月开始准备。",
            "类别": "英国签证"
        },
        {
            "问题": "美国F1签证面试有什么技巧？",
            "回答": "美国F1签证面试技巧：1. 准备充分的材料和回答；2. 诚实回答问题，不要撒谎；3. 表现出明确的学习目标和回国意愿；4. 穿着得体，保持自信；5. 英语表达要清晰；6. 准备解释资金来源；7. 了解所申请的学校和专业。记住，签证官主要关心你是否有移民倾向。",
            "类别": "美国签证"
        },
        {
            "问题": "申根签证可以在哪些国家使用？",
            "回答": "申根签证可以在26个申根国家自由通行，包括：德国、法国、意大利、西班牙、荷兰、比利时、奥地利、瑞士、瑞典、挪威、丹麦、芬兰、波兰、捷克、匈牙利、斯洛伐克、斯洛文尼亚、爱沙尼亚、拉脱维亚、立陶宛、葡萄牙、希腊、马耳他、卢森堡、冰岛、列支敦士登。持申根签证可以在这些国家间自由旅行。",
            "类别": "申根签证"
        },
        {
            "问题": "签证被拒签后可以重新申请吗？",
            "回答": "签证被拒签后是可以重新申请的，但需要注意：1. 仔细分析拒签原因；2. 补充或改善相关材料；3. 等待适当时间再申请（通常建议间隔1-3个月）；4. 如实填写之前的拒签记录；5. 考虑寻求专业帮助。重新申请时要针对拒签原因进行改进，提高成功率。",
            "类别": "一般问题"
        },
        {
            "问题": "法国留学签证的资金要求是多少？",
            "回答": "法国留学签证的资金要求：1. 银行存款证明至少要有615欧元/月×留学月数的资金；2. 资金需要在银行存放至少3个月；3. 可以提供父母的资金证明和资助声明；4. 如果有奖学金，需要提供奖学金证明；5. 资金证明需要是法语或英语，或提供官方翻译。建议准备比最低要求多20%的资金。",
            "类别": "法国签证"
        }
    ]
    
    df = pd.DataFrame(sample_data)
    df.to_excel(file_path, index=False)
    logger.info(f"已创建示例Excel文件: {file_path}")

if __name__ == "__main__":
    # 创建示例文件
    create_sample_excel()
    
    # 测试加载
    loader = ExcelFAQLoader("visa_faq_sample.xlsx")
    data = loader.load()
    
    print(f"加载了{len(data)}条数据")
    print(f"类别: {loader.get_categories()}")
    
    # 验证数据
    validation = loader.validate_data()
    print(f"数据验证结果: {validation}") 
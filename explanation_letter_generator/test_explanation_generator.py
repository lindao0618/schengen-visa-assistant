"""
解释信生成器测试文件
"""

import asyncio
import os
from deepseek_api import DeepSeekAPI
from explanation_letter_generator import ExplanationLetterGenerator

async def test_explanation_generation():
    """
    测试解释信生成功能
    """
    # 测试数据
    test_data = {
        "chinese_name": "张三",
        "english_name": "Zhang San",
        "organization": "北京科技有限公司",
        "passport_number": "E12345678",
        "visa_country": "法国",
        "visa_type": "短期旅游签证",
        "applicant_type": "在职人员",
        "departure_date": "2025-03-15",
        "problem_type": "insufficient_bank_statement",
        "detailed_explanation": "由于最近几个月工资发放方式改为现金，导致银行流水记录不够完整。但我有其他财务证明材料可以证明我的经济状况。",
        "additional_info": "已提供工资证明、房产证和其他投资证明。"
    }
    
    print("开始测试解释信生成...")
    
    # 测试DeepSeek API调用
    deepseek_api = DeepSeekAPI()
    try:
        content = await deepseek_api.generate_explanation_letter(**test_data)
        print(f"生成的解释信内容:\n{content}\n")
    except Exception as e:
        print(f"DeepSeek API调用失败，使用备用方案: {e}")
        content = deepseek_api._get_fallback_explanation(**test_data)
        print(f"备用解释信内容:\n{content}\n")
    
    # 测试文档生成
    doc_generator = ExplanationLetterGenerator()
    
    output_docx = "test_explanation_letter.docx"
    output_pdf = "test_explanation_letter.pdf"
    
    try:
        # 生成Word文档
        doc_generator.create_explanation_letter_document(
            content=content,
            chinese_name=test_data["chinese_name"],
            english_name=test_data["english_name"],
            passport_number=test_data["passport_number"],
            output_path=output_docx
        )
        print(f"Word文档生成成功: {output_docx}")
        
        # 转换为PDF
        doc_generator.convert_to_pdf(output_docx, output_pdf)
        print(f"PDF转换成功: {output_pdf}")
        
        # 检查文件是否存在
        if os.path.exists(output_docx):
            print(f"Word文件大小: {os.path.getsize(output_docx)} bytes")
        
        if os.path.exists(output_pdf):
            print(f"PDF文件大小: {os.path.getsize(output_pdf)} bytes")
        
    except Exception as e:
        print(f"文档生成失败: {e}")

if __name__ == "__main__":
    asyncio.run(test_explanation_generation())